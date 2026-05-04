/**
 * Thought Continuation Game - Closed-Loop Adaptive System
 * 
 * A "flow-shaped" game with NO wrong answers.
 * The goal is to help users finish thoughts, not test vocabulary.
 * 
 * Key intelligence features (Tier A - no alignment required):
 * - Stuck-type classification using local metrics
 * - Adaptive prompt selection based on previous stuck type
 * - Decision logging for what prompt was selected and why
 * 
 * Key principles:
 * - Never say "wrong" or "incorrect"
 * - Always provide forward motion
 * - Scaffold silently with narrowing hints
 * - Reward continuation, not precision
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Lightbulb, ArrowRight, ChevronRight, Bug, Check } from 'lucide-react';
import { ExercisePurposeBanner } from '@/components/ExercisePurposeBanner';
import { AdaptationBadge } from '@/components/AdaptationBadge';
import { LevelBadge } from '@/components/exercise/LevelBadge';
import { describeLevel, tierToLevel } from '@/lib/gameLevels';
import { useDiscourseAdaptation } from '@/hooks/useDiscourseAdaptation';
import { useDiscourseSignalScorer } from '@/hooks/useDiscourseSignalScorer';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { voiceController } from '@/lib/voiceController';
import { useThoughtDecisionLog } from '@/hooks/useThoughtDecisionLog';
import { useAdaptationTrialLogger } from '@/hooks/useAdaptationTrialLogger';
import { detectUtteranceComplete } from '@/lib/completionDetector';
import { validateSpokenResponse } from '@/lib/evaluation/responseValidation';
import { gateResponse } from '@/lib/evaluation/gateResponse';
import { broadcastGateDecision } from '@/components/dev/VoiceGateHud';
import { useVoiceState } from '@/hooks/useVoiceState';
import { trackValidation, logValidationDetail } from '@/lib/evaluation/validationTelemetry';
import { speakMayaCoaching, resetCoachingState } from '@/lib/evaluation/mayaCoachingResponses';
import { classifyStuckType, getStuckTypeLabel, type StuckType, type TierAMetrics } from '@/lib/stuckTypeClassifier';
import { 
  selectNextPrompt, 
  createEmptySessionHistory, 
  updateSessionHistory,
  type SessionHistory,
} from '@/lib/adaptivePromptSelector';
import { 
  getRandomNudge, 
  getRandomStarterNudge,
} from '@/data/thoughtPromptBank';
import { 
  ThoughtPrompt, 
  ThoughtGamePhase, 
  selectFeedback, 
  determineFeedbackTypes 
} from '@/types/thoughtContinuation';
import type { FlowMetrics, MomentumComponents } from '@/types/thoughtContinuation';

// =============================================================================
// Configuration
// =============================================================================

const PROMPTS_PER_SESSION = 8;
const SILENCE_NUDGE_DELAY_MS = 20000;   // 20 seconds before first gentle nudge
const SILENCE_NARROW_DELAY_MS = 45000;  // 45 seconds before narrowing hint
const MIN_SPEECH_FOR_COMPLETE_MS = 500; // Reduced - any speech counts

// === Auto-advance after speech (consistent with PhotoNaming / D&G rhythm) ===
// 2.0s of silence after the user's last detected word commits the answer.
const AUTO_ADVANCE_AFTER_LAST_WORD_MS = 2000;
// 1.0s of silence after speech reveals the optional manual "Done" override.
const BUTTON_REVEAL_AFTER_SILENCE_MS = 1000;

const DEV_MODE = import.meta.env.DEV;   // Show debug overlay in dev

// =============================================================================
// Props
// =============================================================================

interface ThoughtContinuationGameProps {
  userId: string;
  profileId: string;
  sessionId: string | null;
  onComplete?: (summary: {
    totalPrompts: number;
    promptsSpoken: number;
    avgMomentumScore: number;
    completedThoughts: number;
  }) => void;
  onExit?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function ThoughtContinuationGame({
  userId,
  profileId,
  sessionId,
  onComplete,
  onExit,
}: ThoughtContinuationGameProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  
  const [phase, setPhase] = useState<ThoughtGamePhase>('idle');
  const [currentPrompt, setCurrentPrompt] = useState<ThoughtPrompt | null>(null);
  const [promptCount, setPromptCount] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [narrowingLevel, setNarrowingLevel] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [sessionResults, setSessionResults] = useState<{
    momentumScore: number;
    complete: boolean;
    hintUsed: boolean;
    stuckType: StuckType;
  }[]>([]);
  
  // Adaptive system state
  const [sessionHistory, setSessionHistory] = useState<SessionHistory>(createEmptySessionHistory());
  const [previousStuckType, setPreviousStuckType] = useState<StuckType | null>(null);
  const [usedPromptIds, setUsedPromptIds] = useState<string[]>([]);
  const [lastStuckType, setLastStuckType] = useState<StuckType | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Auto-advance UX state
  const [showDoneButton, setShowDoneButton] = useState(false);

  // Refs
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechStartTimeRef = useRef<number | null>(null);
  const latencyStartRef = useRef<number | null>(null);
  const latencyToFirstWordRef = useRef<number | null>(null);
  const narrowingTriggerRef = useRef<'auto_silence' | 'user_request' | null>(null);

  // Auto-advance refs (cleared per trial)
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const buttonRevealTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptValueRef = useRef<string>('');
  const latestTranscriptRef = useRef<string>('');
  const hasCommittedRef = useRef<boolean>(false);
  const isListeningRef = useRef<boolean>(false);
  // Gate the trial-start effect so it only runs ONCE per promptCount.
  // Without this, identity changes in `startListening` / `clearAnswerState`
  // cause the effect to re-fire repeatedly while phase is still 'idle',
  // tearing down and restarting the mic so voice is never captured.
  // Mirrors PhotoNamingGame's `attemptStartedTrialRef` guard.
  const attemptStartedForPromptRef = useRef<number>(-1);
  
  // Hooks
  const { stop: stopTTS } = useTextToSpeech();
  const vg = useVoiceGuidance('thought-continuation');
  const { shouldAutoSpeak, speakIntro, speakIfVoiceLed } = vg;
  const { awaitMicSafe } = useVoiceState();
  const hasSpokenIntroRef = useRef(false);
  const promptStartSequenceRef = useRef(0);
  const { 
    startAttempt, 
    logBrowserTranscript,
    logFinalAnalysis, 
    resetAttempt,
  } = useUtteranceLogger();
  const {
    isRecording,
    startRecording,
    stopRecording,
    uploadRecording,
  } = useAudioRecorder();
  const { logDecision, logCurrentOutcome } = useThoughtDecisionLog();

  // Discourse Adaptation Bridge — mirrors the trial-based games' visible
  // up/down/hold cues based on conversational signals.
  const adaptation = useDiscourseAdaptation({ initialLevel: 2 });
  const previousAdaptationLevelRef = useRef(adaptation.level);

  // Phase 4 — per-trial logging into adaptation_trial_logs for real-world
  // adaptive validation. Discourse games log one row per spoken turn.
  const { logTrial: logAdaptationTrial } = useAdaptationTrialLogger({
    userId,
    sessionId,
    exerciseSlug: 'thought_continuation',
  });

  // LLM-first clinical scorer (with local fallback). Replaces stuck-type-only
  // heuristics with semantic / target-achievement / error-type judgement.
  const scorer = useDiscourseSignalScorer({
    sessionId,
    exerciseSlug: 'thought_continuation',
  });

  
  // Speech recognition with callback - PATIENT MODE enabled
  const handleSpeechResult = useCallback((text: string) => {
    latestTranscriptRef.current = text;
    setTranscript(text);
    logBrowserTranscript(text);
  }, [logBrowserTranscript]);
  
  const {
    isListening,
    transcript: liveTranscript,
    fullTranscript,
    resetTranscript: resetSpeechTranscript,
    startListening,
    stopListening,
    isSupported,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    autoStart: false,
    continuousListening: true,
    patientMode: true, // Keep mic on continuously - no auto-cutoff
    discourseMode: true, // Accumulate all speech segments instead of replacing
  });

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // ---------------------------------------------------------------------------
  // Select first/next prompt using adaptive selector
  // ---------------------------------------------------------------------------
  
  const selectAndSetNextPrompt = useCallback(async () => {
    // Pass the engine discourse level so the selector enforces the mapped
    // content tier as a hard band — no cumulative blending across tiers.
    const selection = selectNextPrompt(
      previousStuckType,
      sessionHistory,
      usedPromptIds,
      adaptation.level,
    );

    console.log('[ThoughtGame] Prompt selected:', {
      strategy: selection.strategy,
      reason: selection.reason,
      promptTheme: selection.prompt.theme,
      promptIntent: selection.prompt.intentType,
      promptTier: selection.prompt.difficultyTier,
      engineLevel: adaptation.level,
      previousStuckType,
    });
    
    // Log the decision
    await logDecision({
      userId,
      profileId,
      sessionId,
      prompt: selection.prompt,
      selectionReason: selection.reason,
      strategy: selection.strategy,
      previousStuckType,
      sessionHistory,
    });
    
    // Update state
    setCurrentPrompt(selection.prompt);
    setUsedPromptIds(prev => [...prev, selection.prompt.id]);
    setPromptCount(prev => prev + 1);
  }, [previousStuckType, sessionHistory, usedPromptIds, userId, profileId, sessionId, logDecision, adaptation.level]);

  useEffect(() => {
    if (!currentPrompt && promptCount === 0) {
      selectAndSetNextPrompt();
    }
  }, [currentPrompt, promptCount, selectAndSetNextPrompt]);

  // ---------------------------------------------------------------------------
  // Track live transcript
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    // Use fullTranscript (accumulated discourse) instead of liveTranscript (last segment only)
    const currentText = fullTranscript || liveTranscript;
    if (currentText && currentText.trim().length > 0) {
      latestTranscriptRef.current = currentText;
      setTranscript(currentText);
      
      // Record latency to first word
      if (latencyToFirstWordRef.current === null && latencyStartRef.current) {
        latencyToFirstWordRef.current = Date.now() - latencyStartRef.current;
      }
      
      // Record speech start time
      if (speechStartTimeRef.current === null) {
        speechStartTimeRef.current = Date.now();
      }
      
      // User is speaking - reset silence timers
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      
      // Move to listening phase if not already
      if (phase === 'idle' || phase === 'narrowing') {
        setPhase('listening');
      }
    }
  }, [fullTranscript, liveTranscript, phase]);

  const clearAnswerState = useCallback(() => {
    setTranscript('');
    setShowDoneButton(false);
    lastTranscriptValueRef.current = '';
    latestTranscriptRef.current = '';
    hasCommittedRef.current = false;
    resetSpeechTranscript();
    if (autoAdvanceTimerRef.current) { clearTimeout(autoAdvanceTimerRef.current); autoAdvanceTimerRef.current = null; }
    if (buttonRevealTimerRef.current) { clearTimeout(buttonRevealTimerRef.current); buttonRevealTimerRef.current = null; }
  }, [resetSpeechTranscript]);

  // ---------------------------------------------------------------------------
  // Auto-advance after speech (2s silence after last word) + button reveal
  // (1s silence after speech). Mirrors PhotoNaming/D&G rhythm so the system
  // feels consistent across games.
  // ---------------------------------------------------------------------------
  const processUtteranceRef = useRef<() => void>(() => {});

  useEffect(() => {
    // Only arm the auto-advance loop while we're actively listening for an answer.
    if (phase !== 'idle' && phase !== 'listening') return;
    if (hasCommittedRef.current) return;

    const trimmed = transcript.trim();
    if (!trimmed) return;

    // Restart timers ONLY when transcript actually changed (new word(s) heard).
    if (trimmed === lastTranscriptValueRef.current) return;
    lastTranscriptValueRef.current = trimmed;

    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (buttonRevealTimerRef.current) clearTimeout(buttonRevealTimerRef.current);

    setShowDoneButton(false);

    buttonRevealTimerRef.current = setTimeout(() => {
      if (!hasCommittedRef.current) setShowDoneButton(true);
    }, BUTTON_REVEAL_AFTER_SILENCE_MS);

    autoAdvanceTimerRef.current = setTimeout(() => {
      if (hasCommittedRef.current) return;
      hasCommittedRef.current = true;
      processUtteranceRef.current?.();
    }, AUTO_ADVANCE_AFTER_LAST_WORD_MS);
  }, [transcript, phase]);

  // Clean up auto-advance timers on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      if (buttonRevealTimerRef.current) clearTimeout(buttonRevealTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Silence detection for auto-nudges
  // ---------------------------------------------------------------------------
  
  const startSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    
    const delay = narrowingLevel === 0 ? SILENCE_NUDGE_DELAY_MS : SILENCE_NARROW_DELAY_MS;
    
    silenceTimerRef.current = setTimeout(() => {
      // Only trigger if still idle and no transcript
      if (phase === 'idle' && transcript.trim().length === 0) {
        if (narrowingLevel === 0) {
          // First nudge: gentle encouragement
          setFeedbackMessage(getRandomStarterNudge());
          setPhase('narrowing');
          narrowingTriggerRef.current = 'auto_silence';
        } else if (currentPrompt && narrowingLevel <= currentPrompt.narrowingSteps.length) {
          // Progressive narrowing
          const step = currentPrompt.narrowingSteps[narrowingLevel - 1];
          if (step) {
            setFeedbackMessage(step.text);
            setNarrowingLevel(prev => prev + 1);
            narrowingTriggerRef.current = 'auto_silence';
          }
        }
      }
    }, delay);
  }, [narrowingLevel, phase, transcript, currentPrompt]);

  // ---------------------------------------------------------------------------
  // Start listening when prompt is shown
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    if (!currentPrompt || phase !== 'idle' || promptCount <= 0) return;
    // Only initialize each prompt once. Without this guard, callback identity
    // changes (startListening / clearAnswerState) cause the effect to re-fire
    // repeatedly and reset the mic, so voice is never captured.
    if (attemptStartedForPromptRef.current === promptCount) return;
    attemptStartedForPromptRef.current = promptCount;

    // Reset state for new prompt (incl. auto-advance UX)
    clearAnswerState();
    setNarrowingLevel(0);
    setFeedbackMessage(null);
    speechStartTimeRef.current = null;
    latencyToFirstWordRef.current = null;
    latencyStartRef.current = Date.now();
    narrowingTriggerRef.current = null;

    // Start a new attempt
    startAttempt({
      sessionId: sessionId || 'standalone',
      userId,
      exerciseSlug: 'thought_continuation',
      trialIndex: promptCount - 1,
      attemptNumber: 1,
      targetWord: currentPrompt.promptText.slice(0, 50),
      category: currentPrompt.theme,
    });

    // Sync-Wait: speak the prompt first, then open recording/mic only after
    // Maya is fully done. This prevents the game from hearing its own prompt.
    (async () => {
      const sequenceId = ++promptStartSequenceRef.current;
      if (shouldAutoSpeak) {
        if (promptCount === 1 && !hasSpokenIntroRef.current) {
          hasSpokenIntroRef.current = true;
          await speakIntro();
        }
        if (promptStartSequenceRef.current !== sequenceId) return;
        await speakIfVoiceLed(currentPrompt.promptText);
      }
      if (promptStartSequenceRef.current !== sequenceId) return;
      await awaitMicSafe(8000);
      if (promptStartSequenceRef.current !== sequenceId) return;
      clearAnswerState();
      void startRecording();

      let retryCount = 0;
      const tryStartListening = () => {
        retryCount += 1;
        startListening();
        if (retryCount >= 5) return;

        const delay = retryCount === 1 ? 300 : retryCount === 2 ? 600 : retryCount === 3 ? 1000 : 1400;
        setTimeout(() => {
          if (!isListeningRef.current && !hasCommittedRef.current) {
            tryStartListening();
          }
        }, delay);
      };

      // Fire immediately after TTS + mic-safe gate (was 250ms delay).
      // Matches Mic Auto-start standard (0.5–1.0s after Maya completes prompt;
      // awaitMicSafe already enforces the audio settle window).
      tryStartListening();
    })();

    // Start silence timer (this is the long "no-speech-at-all" nudge timer,
    // separate from the 2s auto-advance after speech)
    startSilenceTimer();
  }, [currentPrompt, phase, promptCount, sessionId, userId, startAttempt, startListening, startSilenceTimer, startRecording, awaitMicSafe, clearAnswerState, shouldAutoSpeak, speakIntro, speakIfVoiceLed]);

  // ---------------------------------------------------------------------------
  // Process completed speech - Core intelligence loop
  // ---------------------------------------------------------------------------
  
  const processUtterance = useCallback(async () => {
    if (!currentPrompt) return;

    // Cancel any pending auto-advance / button-reveal timers — we're committing now.
    if (autoAdvanceTimerRef.current) { clearTimeout(autoAdvanceTimerRef.current); autoAdvanceTimerRef.current = null; }
    if (buttonRevealTimerRef.current) { clearTimeout(buttonRevealTimerRef.current); buttonRevealTimerRef.current = null; }
    hasCommittedRef.current = true;
    setShowDoneButton(false);
    const answerText = (latestTranscriptRef.current || transcript).trim();

    // ─── MANDATORY PRE-SCORING GATE ──────────────────────────────────────────
    // Reject prompt-repeats, instruction echoes, fillers, and parroting of
    // Maya's most recent speech BEFORE we count it as a valid response.
    // Without this the game "accepts everything" and feeds garbage into the
    // adaptation engine.
    const gate = gateResponse({
      transcript: answerText,
      promptText: currentPrompt.promptText,
      // Finish-the-thought accepts ANY real content word as a valid completion.
      // Use the dedicated mode so the gate doesn't reject 1–2 word answers
      // (e.g. "milk", "to school") as too_short.
      expectedMode: 'thought_continuation',
    });
    broadcastGateDecision('thought_continuation', gate, answerText);

    if (!gate.ok) {
      console.log('[ThoughtContinuation] gate REJECT', {
        classification: gate.classification,
        reason: gate.rejectionReason,
        echoMatched: gate.echoMatched,
      });
      // Soft-reject: clear committed flag, surface a brief coaching nudge,
      // re-arm the mic for another attempt. Do NOT advance the prompt.
      stopListening();
      clearAnswerState();
      setPhase('idle');
      if (gate.coachingText) {
        setFeedbackMessage(gate.coachingText);
        setTimeout(() => setFeedbackMessage(null), 4000);
      }
      // Re-open mic for retry
      (async () => {
        await awaitMicSafe(5000);
        startListening();
      })();
      return;
    }

    setPhase('processing');
    stopListening();
    
    // Stop audio recording and capture blob
    const recordingResult = await stopRecording();
    
    // Clear timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    const speechDuration = speechStartTimeRef.current 
      ? Date.now() - speechStartTimeRef.current 
      : 0;
    
    // Upload audio for clinical persistence
    let audioStoragePath: string | null = null;
    if (recordingResult?.audioBlob && sessionId && userId) {
      audioStoragePath = await uploadRecording(
        recordingResult.audioBlob,
        userId,
        sessionId || 'standalone',
        promptCount,
        recordingResult.mimeType
      );
    }
    
    // =========================================================================
    // TIER A METRICS - Locally measurable, no alignment required
    // =========================================================================
    
    const validation = validateSpokenResponse({
      transcript: answerText,
      promptText: currentPrompt.promptText,
      expectedMode: 'thought_continuation',
    });
    trackValidation('thought_continuation', validation);
    logValidationDetail('thought_continuation', answerText, validation);
    const wordCount = answerText ? answerText.split(/\s+/).length : 0;
    const didSpeak = wordCount > 0 && validation.valid;
    const completionResult = detectUtteranceComplete(answerText, null);
    const latencyToFirstWordMs = latencyToFirstWordRef.current || 
      (didSpeak ? 0 : Date.now() - (latencyStartRef.current || Date.now()));
    
    // Tier A metrics for stuck-type classification
    const tierAMetrics: TierAMetrics = {
      didSpeak,
      latencyToFirstWordMs,
      utteranceComplete: completionResult.isComplete,
      wordCount,
      durationMs: speechDuration,
      narrowingLevelUsed: narrowingLevel,
      // Tier B fields (null for now - will come from alignment)
      trailingOffDetected: !completionResult.isComplete && wordCount > 2,
    };
    
    // =========================================================================
    // STUCK-TYPE CLASSIFICATION
    // =========================================================================
    
    const stuckResult = classifyStuckType(tierAMetrics);
    const stuckType = stuckResult.stuckType;
    
    console.log('[ThoughtGame] Stuck-type classified:', {
      stuckType,
      confidence: stuckResult.confidence,
      reasoning: stuckResult.reasoning,
      metrics: stuckResult.metrics,
    });
    
    setLastStuckType(stuckType);
    
    // =========================================================================
    // MOMENTUM SCORE (Tier A simplified)
    // =========================================================================
    
    let momentumScore = 0;
    if (didSpeak) {
      momentumScore = 0.4; // Base score for speaking
      if (completionResult.isComplete) {
        momentumScore += 0.3;
      }
      if (wordCount >= 5) {
        momentumScore += 0.15;
      }
      if (wordCount >= 10) {
        momentumScore += 0.15;
      }
      // Penalize high latency
      if (latencyToFirstWordMs > 8000) {
        momentumScore -= 0.1;
      }
    }
    
    const momentumComponents: MomentumComponents = {
      pauseRatio: 0, // Tier B
      prewordPauseAvgMs: 0, // Tier B
      filledPauseRate: 0, // Tier B
      burstCount: didSpeak ? 1 : 0,
      longestPauseMs: 0, // Tier B
      trailingOffDetected: tierAMetrics.trailingOffDetected || false,
    };
    
    const flowMetrics: FlowMetrics = {
      didSpeak,
      utteranceComplete: completionResult.isComplete,
      momentumScore,
      momentumComponents,
      latencyToFirstWordMs,
      narrowingLevelUsed: narrowingLevel,
      narrowingTrigger: narrowingTriggerRef.current || undefined,
    };
    
    // =========================================================================
    // LOG TO DATABASE
    // =========================================================================
    
    await logFinalAnalysis({
      transcript: answerText,
      transcriptSource: 'browser',
      evaluationModel: 'flow',
      isCorrect: null, // Flow games don't have correctness
      errorType: undefined,
      didSpeak: flowMetrics.didSpeak,
      utteranceComplete: flowMetrics.utteranceComplete,
      momentumScore: flowMetrics.momentumScore,
      momentumComponents: flowMetrics.momentumComponents,
      latencyToFirstWordMs: flowMetrics.latencyToFirstWordMs,
      narrowingLevelUsed: flowMetrics.narrowingLevelUsed,
      narrowingTrigger: flowMetrics.narrowingTrigger,
      promptIntentType: currentPrompt.intentType,
      promptTheme: currentPrompt.theme,
      recordingDurationMs: speechDuration,
      audioStoragePath: audioStoragePath || undefined,
      stuckType,
      fluencyAvailable: false,
      fluencyUnavailableReason: 'discourse_task',
    });
    
    // Log decision outcome
    await logCurrentOutcome(stuckType, didSpeak, latencyToFirstWordMs, completionResult.isComplete);
    
    // =========================================================================
    // UPDATE SESSION HISTORY (for adaptive selection)
    // =========================================================================
    
    const updatedHistory = updateSessionHistory(
      sessionHistory,
      stuckType,
      latencyToFirstWordMs,
      narrowingLevel,
      currentPrompt.theme,
      currentPrompt.intentType,
      completionResult.isComplete
    );
    setSessionHistory(updatedHistory);
    setPreviousStuckType(stuckType);
    
    // Store result
    setSessionResults(prev => [...prev, {
      momentumScore: flowMetrics.momentumScore,
      complete: flowMetrics.utteranceComplete,
      hintUsed: narrowingLevel > 0,
      stuckType,
    }]);

    // Score this turn with the LLM-first clinical scorer (with local fallback).
    // The scorer drives both the adaptation badge AND DB logging for the
    // clinician audit trail. We wrap recordTurn so we can capture the decision
    // and forward it to the universal adaptation_trial_logs telemetry.
    let lastDecision: ReturnType<typeof adaptation.recordTurn> | null = null;
    const recordTurnWithCapture = (signals: Parameters<typeof adaptation.recordTurn>[0]) => {
      const decision = adaptation.recordTurn(signals);
      lastDecision = decision;
      return decision;
    };
    await scorer.scoreAndRecord(
      {
        exerciseSlug: 'thought_continuation',
        promptText: currentPrompt.promptText,
        transcript: answerText,
        wordCount,
        latencyToFirstWordMs: latencyToFirstWordMs ?? null,
        durationMs: speechDuration,
        scaffoldUsed: narrowingLevel > 0,
        taskGoal: `Finish the thought (${currentPrompt.intentType}, theme: ${currentPrompt.theme})`,
        turnNumber: promptCount,
      },
      recordTurnWithCapture,
    );

    // Mirror the discourse-adaptation decision into adaptation_trial_logs so
    // this game shows up in the same telemetry surface as trial-based games.
    {
      const fromLevel = previousAdaptationLevelRef.current;
      const toLevel = lastDecision?.level ?? fromLevel;
      const direction = lastDecision?.direction;
      const isChange = direction === 'up' || direction === 'down';
      previousAdaptationLevelRef.current = toLevel;

      if (isChange && import.meta.env.DEV) {
        console.log(`[ThoughtContinuation] L${fromLevel} → L${toLevel}, reason: ${lastDecision?.reason ?? 'discourse_adaptation'}`);
      }

      logAdaptationTrial({
        trialIndex: promptCount,
        difficulty: toLevel,
        cueLevel: narrowingLevel,
        cueDependency: null,
        successRate: null,
        correct: flowMetrics.didSpeak && flowMetrics.utteranceComplete,
        reactionTimeMs: latencyToFirstWordMs ?? null,
        trialsAtLevel: null,
        difficultyChange: isChange
          ? {
              direction: direction as 'up' | 'down',
              from: fromLevel,
              to: toLevel,
              reason: lastDecision?.reason ?? 'discourse_adaptation',
            }
          : null,
      });
    }


    
    // =========================================================================
    // FEEDBACK
    // =========================================================================
    
    const feedbackTypes = determineFeedbackTypes(flowMetrics);
    const feedback = selectFeedback(feedbackTypes);
    setFeedbackMessage(feedback);
    
    // Update streak
    if (didSpeak) {
      setStreak(prev => prev + 1);
    }
    
    setPhase('celebrated');
    
    // Auto-advance after showing feedback
    setTimeout(() => {
      moveToNextPrompt();
    }, 2000);
  }, [currentPrompt, transcript, narrowingLevel, sessionHistory, logFinalAnalysis, logCurrentOutcome, stopListening, stopRecording, uploadRecording, sessionId, userId, promptCount, scorer, adaptation, awaitMicSafe, startListening, clearAnswerState]);

  // Keep the ref pointing at the latest processUtterance for the auto-advance
  // effect (which is declared above this callback to avoid hoisting issues).
  useEffect(() => {
    processUtteranceRef.current = processUtterance;
  }, [processUtterance]);

  // ---------------------------------------------------------------------------
  // Auto-cutoff is now handled by the 2s post-last-word silence timer above.
  // The "Done Speaking" button below is an OPTIONAL manual override that only
  // appears after 1s of post-speech silence.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  
  const moveToNextPrompt = useCallback(() => {
    resetAttempt();

    // CRITICAL: kill any in-flight TTS (old example carryover) and clear the
    // EchoFilter spoken-history so a previous prompt can't be matched as the
    // user "echoing" the new one.
    stopTTS();
    vg.interrupt?.();
    voiceController.clearSpokenHistory();

    if (promptCount >= PROMPTS_PER_SESSION) {
      // Session complete
      const avgMomentum = sessionResults.length > 0
        ? sessionResults.reduce((sum, r) => sum + r.momentumScore, 0) / sessionResults.length
        : 0;

      onComplete?.({
        totalPrompts: promptCount,
        promptsSpoken: sessionResults.filter(r => r.momentumScore > 0).length,
        avgMomentumScore: avgMomentum,
        completedThoughts: sessionResults.filter(r => r.complete).length,
      });
      return;
    }

    // Per-trial state reset — every field that could leak across prompts.
    setPhase('idle');
    clearAnswerState();
    setFeedbackMessage(null);
    setNarrowingLevel(0);
    setLastStuckType(null);
    setCurrentPrompt(null);
    speechStartTimeRef.current = null;
    latencyToFirstWordRef.current = null;
    narrowingTriggerRef.current = null;

    // Select next prompt (will be triggered by useEffect)
    selectAndSetNextPrompt();
  }, [promptCount, sessionResults, resetAttempt, onComplete, selectAndSetNextPrompt, stopTTS, vg, clearAnswerState]);

  const handleSkipPrompt = useCallback(async () => {
    // Stop mic + recording to prevent leaks
    stopListening();
    await stopRecording();
    
    // Log skip as no_speech
    const tierAMetrics: TierAMetrics = {
      didSpeak: false,
      latencyToFirstWordMs: null,
      utteranceComplete: false,
      wordCount: 0,
      durationMs: 0,
      narrowingLevelUsed: narrowingLevel,
    };
    
    const stuckResult = classifyStuckType(tierAMetrics);
    setLastStuckType(stuckResult.stuckType);
    
    await logFinalAnalysis({
      transcript: '',
      transcriptSource: 'browser',
      evaluationModel: 'flow',
      isCorrect: null,
      didSpeak: false,
      utteranceComplete: false,
      momentumScore: 0,
      narrowingLevelUsed: narrowingLevel,
      promptIntentType: currentPrompt?.intentType,
      promptTheme: currentPrompt?.theme,
      stuckType: stuckResult.stuckType,
      fluencyAvailable: false,
      fluencyUnavailableReason: 'discourse_task',
    });
    
    // Update history with skip
    if (currentPrompt) {
      const updatedHistory = updateSessionHistory(
        sessionHistory,
        stuckResult.stuckType,
        null,
        narrowingLevel,
        currentPrompt.theme,
        currentPrompt.intentType,
        false
      );
      setSessionHistory(updatedHistory);
      setPreviousStuckType(stuckResult.stuckType);
    }
    
    moveToNextPrompt();
  }, [narrowingLevel, currentPrompt, sessionHistory, logFinalAnalysis, moveToNextPrompt, stopListening, stopRecording]);

  const handleHintRequest = useCallback(() => {
    if (!currentPrompt) return;
    
    const nextLevel = narrowingLevel + 1;
    if (nextLevel <= currentPrompt.narrowingSteps.length) {
      const step = currentPrompt.narrowingSteps[nextLevel - 1];
      setFeedbackMessage(step.text);
      setNarrowingLevel(nextLevel);
      setPhase('narrowing');
      narrowingTriggerRef.current = 'user_request';
    } else {
      // No more hints, just encourage
      setFeedbackMessage("Take your time. Any thought is fine.");
    }
  }, [currentPrompt, narrowingLevel]);

  const handleNudge = useCallback(() => {
    setFeedbackMessage(getRandomNudge());
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  if (!currentPrompt) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading prompts...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto p-4">
      {/* Purpose banner — first prompt only */}
      {promptCount <= 1 && (
        <ExercisePurposeBanner exerciseSlug="thought-continuation" />
      )}
      {/* Progress indicator */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{promptCount} of {PROMPTS_PER_SESSION}</span>
        <div className="flex items-center gap-2">
          <LevelBadge
            descriptor={describeLevel(tierToLevel(adaptation.level, { min: 1, max: 5 }))}
            compact
          />
          {streak > 0 && (
            <span className="text-primary font-medium">
              🔥 {streak} in a row
            </span>
          )}
          {DEV_MODE && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="h-6 w-6 p-0"
            >
              <Bug className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Visible adaptation cue — shown when difficulty actually shifts */}
      {adaptation.shiftDirection && (
        <div className="flex justify-center">
          <AdaptationBadge
            direction={adaptation.shiftDirection}
            reason={adaptation.shiftReason}
            variant="card"
          />
        </div>
      )}

      {showDebug && DEV_MODE && (
        <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono space-y-1">
          <div><strong>Session:</strong> {sessionHistory.attemptCount} attempts, {sessionHistory.completionCount} complete</div>
          <div><strong>Previous stuck:</strong> {previousStuckType || 'none'}</div>
          <div><strong>Last stuck:</strong> {lastStuckType ? getStuckTypeLabel(lastStuckType) : 'n/a'}</div>
          <div><strong>Prompt strategy:</strong> tier {currentPrompt.difficultyTier}, {currentPrompt.intentType}</div>
          <div><strong>History:</strong> {sessionHistory.stuckTypes.slice(-3).join(' → ') || 'none'}</div>
        </div>
      )}

      {/* Main prompt card */}
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardContent className="p-6 space-y-6">
          {/* Entry instruction — shown only on first prompt */}
          {promptCount <= 1 && (
            <p className="text-sm text-center text-muted-foreground">Finish the thought</p>
          )}
          {/* Prompt text */}
          <div className="text-center">
            <p className="text-xl md:text-2xl font-medium text-foreground leading-relaxed">
              {currentPrompt.promptText}
            </p>
          </div>

          {/* Always-listening indicator with encouragement */}
          <div className="flex flex-col items-center gap-2">
            <div className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
              ${phase === 'processing'
                ? 'bg-yellow-500/20'
                : phase === 'celebrated'
                  ? 'bg-green-500/20'
                  : 'bg-primary/10'
              }
            `}>
              {phase === 'processing' ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              ) : phase === 'celebrated' ? (
                <Check className="w-10 h-10 text-green-600" />
              ) : (
                <div className="relative">
                  <Mic className="w-10 h-10 text-primary" />
                  {/* Pulsing ring to show always listening */}
                  <div className="absolute inset-0 rounded-full border-2 border-primary/50 animate-ping" />
                </div>
              )}
            </div>
            {phase !== 'processing' && phase !== 'celebrated' && (
              <p className="text-sm text-muted-foreground">
                Take your time...
              </p>
            )}
          </div>

          {/* Live transcript display */}
          {transcript && (
            <div className="bg-muted/50 rounded-lg p-4 min-h-[60px]">
              <p className="text-sm text-muted-foreground mb-1">You said:</p>
              <p className="text-foreground">{transcript}</p>
            </div>
          )}

          {/* Feedback/hint message */}
          {feedbackMessage && (
            <div className={`
              text-center p-4 rounded-lg
              ${phase === 'celebrated' 
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
              }
            `}>
              <p className="text-lg font-medium">{feedbackMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optional manual override — hidden until 1s of post-speech silence,
          and primary auto-advance kicks in at 2s. Tap commits immediately. */}
      {phase !== 'processing' && phase !== 'celebrated' && showDoneButton && transcript.trim() && (
        <div
          className="flex justify-center animate-in fade-in duration-300"
          aria-live="polite"
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={processUtterance}
            className="gap-2"
          >
            <Check className="w-4 h-4" />
            Done
          </Button>
        </div>
      )}

      {/* Secondary action buttons */}
      <div className="flex gap-3 justify-center">
        <Button
          variant="outline"
          onClick={handleNudge}
          disabled={phase === 'processing' || phase === 'celebrated'}
          className="gap-2"
        >
          <ChevronRight className="w-4 h-4" />
          Go on...
        </Button>
        
        <Button
          variant="outline"
          onClick={handleHintRequest}
          disabled={phase === 'processing' || phase === 'celebrated'}
          className="gap-2"
        >
          <Lightbulb className="w-4 h-4" />
          Give me a hint
        </Button>
      </div>

      {/* Skip/next button */}
      <div className="flex justify-center">
        {phase === 'celebrated' ? (
          <Button onClick={moveToNextPrompt} className="gap-2">
            Next Thought <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button 
            variant="ghost" 
            onClick={handleSkipPrompt}
            className="text-muted-foreground"
          >
            Skip this one
          </Button>
        )}
      </div>

      {/* Exit button */}
      {onExit && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onExit}>
            End session
          </Button>
        </div>
      )}
    </div>
  );
}
