/**
 * Describe & Guess Game Component
 * 
 * The flagship circumlocution training exercise.
 * Shows a picture, user describes it, app "guesses" using 2-of-3 rule.
 * 
 * Features:
 * - Prompt chips for deterministic feature tracking
 * - Cooldown timers on structured prompts (6s → 10s → 14s)
 * - Communication Win for any meaningful speech
 * - Embeddings only evaluated on speech-end
 * - Min speech duration gate to prevent false positives
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { classifySpeechState } from '@/lib/speechStateClassifier';
import { TIMING_PROFILES, getProfileMultiplier } from '@/lib/speechTimingProfiles';
import { SpeechNudge } from '@/components/SpeechNudge';
import { useDescribeGuessGame, DescribeGuessTrialResult, getStarCount } from '@/hooks/useDescribeGuessGame';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { usePronunciationAnalysis } from '@/hooks/usePronunciationAnalysis';
import { getCapabilityDifficultyBounds } from '@/lib/difficultyBounds';
import { extractAnswerFromTranscript, getContentWordCount } from '@/lib/speechNormalizer';
import { validateSpokenResponse } from '@/lib/evaluation/responseValidation';
import { gateResponse } from '@/lib/evaluation/gateResponse';
import { broadcastGateDecision } from '@/components/dev/VoiceGateHud';
import { useVoiceState } from '@/hooks/useVoiceState';
import { trackValidation, logValidationDetail } from '@/lib/evaluation/validationTelemetry';
import { speakMayaCoaching, resetCoachingState } from '@/lib/evaluation/mayaCoachingResponses';
import { PHOTO_BANK } from '@/data/photoBank';
import { FeatureType } from '@/data/describeGuessBank';
import { Mic, MicOff, SkipForward, Volume2, Star, Wrench, Eye, MapPin, Box, Tag, Check, Keyboard } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ExercisePurposeBanner } from '@/components/ExercisePurposeBanner';
import { StructuredFeedbackSummary } from '@/components/StructuredFeedbackSummary';
import { MicFailureRecovery } from '@/components/MicFailureRecovery';
import { useMayaExerciseFrame } from '@/hooks/useMayaExerciseFrame';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { AdaptationBadge, useAdaptationShift } from '@/components/AdaptationBadge';
import { LevelBadge } from '@/components/exercise/LevelBadge';

const PROMPT_COOLDOWNS = [6000, 10000, 14000]; // ms before each prompt appears
// Speech timing now driven by TIMING_PROFILES.discourse
const MIN_SPEECH_CONTENT_WORDS = 2; // Minimum content words to trigger evaluation
const MIN_LISTENING_DURATION_MS = 2000; // At least 2s of mic time before evaluating

interface PromptChip {
  featureType: FeatureType;
  label: string;
  question: string;
  icon: React.ReactNode;
}

const PROMPT_CHIPS: PromptChip[] = [
  { featureType: 'function', label: 'Use', question: 'What do you use it for?', icon: <Wrench className="h-3.5 w-3.5" /> },
  { featureType: 'location', label: 'Where', question: 'Where do you see it?', icon: <MapPin className="h-3.5 w-3.5" /> },
  { featureType: 'appearance', label: 'Looks like', question: 'What does it look like?', icon: <Eye className="h-3.5 w-3.5" /> },
  { featureType: 'material', label: 'Made of', question: 'What is it made of?', icon: <Box className="h-3.5 w-3.5" /> },
  { featureType: 'category', label: 'Kind of', question: 'What kind of thing is it?', icon: <Tag className="h-3.5 w-3.5" /> },
];

interface DescribeGuessGameProps {
  onTrialComplete?: (result: DescribeGuessTrialResult) => void;
  onGameComplete?: (results: DescribeGuessTrialResult[]) => void;
  trialCount?: number;
  sessionId?: string | null;
  userId?: string;
  profileId?: string;
}

export function DescribeGuessGame({
  onTrialComplete,
  onGameComplete,
  trialCount = 8,
  sessionId,
  userId,
  profileId,
}: DescribeGuessGameProps) {
  const [isListening, setIsListening] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [displayTranscript, setDisplayTranscript] = useState('');
  // Typing fallback — when mic fails or user opts in. Persisted across trials.
  const [useTyping, setUseTyping] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('preferTypingInput') === 'true'
  );
  const [typedAnswer, setTypedAnswer] = useState('');
  const speechErrorCountRef = useRef(0);
  const [visiblePrompts, setVisiblePrompts] = useState<number>(0);
  const [guessMessage, setGuessMessage] = useState<string | null>(null);
  const [awaitingWordAttempt, setAwaitingWordAttempt] = useState(false);
  const [wordSaidRedirect, setWordSaidRedirect] = useState(false);
  const wordSaidRedirectFiredRef = useRef(false);

  const debounceTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const promptTimersRef = useRef<NodeJS.Timeout[]>([]);
  const rawTranscriptRef = useRef<string>('');
  const processingRef = useRef(false);
  const evaluatedRef = useRef(false);
  const wordAttemptContextRef = useRef<{
    originalTranscript: string;
    guessResult: any;
    audioPromise: Promise<void>;
    audioStoragePath?: string;
    recordingDurationMs?: number;
    pronunciationData?: any;
  } | null>(null);
  const stopListeningRef = useRef<() => void>(() => {});
  const cancelRecordingRef = useRef<() => void>(() => {});
  const listeningStartRef = useRef<number>(0);
  const lastTranscriptChangeRef = useRef<number>(0);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);
  const autoRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const micRecoveryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const runEvaluationRef = useRef<() => void>(() => {});
  const [nudgeHint, setNudgeHint] = useState<string | null>(null);
  // True from trial-start until the mic actually opens. Suppresses the
  // "Microphone unavailable" recovery banner during the legitimate wait
  // window while Maya is still speaking the intro/clue.
  const [micOpening, setMicOpening] = useState(false);
  const [micRecoveryReady, setMicRecoveryReady] = useState(false);
  const scheduleMicRecoveryCheck = useCallback(() => {
    if (micRecoveryTimerRef.current) clearTimeout(micRecoveryTimerRef.current);
    micRecoveryTimerRef.current = setTimeout(() => {
      if (!isListeningRef.current) setMicRecoveryReady(true);
    }, 2500);
  }, []);

  const { speak } = useTextToSpeech();
  const { awaitMicSafe } = useVoiceState();
  const { analyzePronunciation } = usePronunciationAnalysis();
  const { buildReflection } = useMayaExerciseFrame({ exerciseSlug: 'describe-guess' });
  const vg = useVoiceGuidance('describe-guess');
  const hasSpokenIntroRef = useRef(false);
  const stallTimerVgRef = useRef<NodeJS.Timeout | null>(null);

  const bounds = getCapabilityDifficultyBounds('describe_guess', null);

  const { direction: shiftDirection, reason: shiftReason, signal: signalShift } = useAdaptationShift();

  // Phase 2: engagement monitor — describe & guess relies on prompts as implicit cues.
  const engagement = useEngagementMonitor(sessionId || null);

  // Forward-ref so onDifficultyChange can call game.setActiveDifficulty
  // (which is declared below this hook).
  const setActiveDifficultyRef = useRef<((lvl: number) => void) | null>(null);
  const prevLevelLogRef = useRef<number>(bounds.suggestedStart);

  const {
    currentDifficulty,
    levelDescriptor: dgLevelDescriptor,
    recordTrial: recordAdaptiveTrial,
  } = useInGameAdaptation({
    exerciseSlug: 'describe_guess',
    sessionId: sessionId || null,
    initialDifficulty: bounds.suggestedStart,
    bounds,
    windowSize: 5,
    targetSuccessRate: 0.75,
    enableDifficultyAutoStepDown: true,
    enableDifficultyToasts: false,
    enableAutoHints: false,
    // Cue dependency proxy: structured prompts shown count as soft cues.
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.debug('[describe_guess] escalation blocked', { reason, cueDependencyScore, trialsAtLevel });
      void engagement.logIntervention('cue_dependency_gate', 'hold_and_fade_prompts', 'auto');
    },
    onDifficultyChange: (newLvl, reason, dir) => {
      const narration = narrateAdaptation({ direction: dir, reasonKind: classifyReason(reason) });
      signalShift(dir, narration || reason);
      // Repool upcoming trials at the new tier
      const tier = Math.min(3, Math.max(1, Math.ceil(newLvl / 3.5)));
      setActiveDifficultyRef.current?.(tier);
      if (import.meta.env.DEV) {
        console.log(`[DescribeGuess] L${prevLevelLogRef.current} → L${newLvl}, reason: ${reason}`);
        prevLevelLogRef.current = newLvl;
      }
    },
  });

  const {
    startAttempt,
    logBrowserTranscript,
    logFinalAnalysis,
    resetAttempt,
    currentAttemptId,
    isFinalized,
  } = useUtteranceLogger();

  const {
    isRecording,
    isSupported: isRecordingSupported,
    startRecording,
    stopRecording,
    uploadRecording,
    cancelRecording,
  } = useAudioRecorder();

  const game = useDescribeGuessGame({
    trialCount,
    difficulty: Math.min(3, Math.max(1, Math.ceil(currentDifficulty / 3.5))),
    onTrialComplete,
    onGameComplete,
  });

  // Bind ref so onDifficultyChange (above) can repool trials.
  useEffect(() => {
    setActiveDifficultyRef.current = game.setActiveDifficulty;
  }, [game.setActiveDifficulty]);

  // Get photo image for current trial
  const currentImage = useMemo(() => {
    if (!game.currentTrial) return null;
    const photo = PHOTO_BANK.find(p => p.id === game.currentTrial!.photoBankId);
    return photo?.imageUrl ?? null;
  }, [game.currentTrial]);


  const currentTrialRef = useRef(game.currentTrial);
  useEffect(() => { currentTrialRef.current = game.currentTrial; }, [game.currentTrial]);

  const handleSpeechResult = useCallback((result: string) => {
    logBrowserTranscript(result);
  }, [logBrowserTranscript]);

  const {
    transcript,
    fullTranscript,
    isListening: speechIsListening,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error: speechError,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    autoStart: false,
    continuousListening: true,
    patientMode: true,
    discourseMode: true, // CRITICAL: Accumulate across recognition restarts
  });

  useEffect(() => { stopListeningRef.current = stopListening; }, [stopListening]);
  useEffect(() => { cancelRecordingRef.current = cancelRecording; }, [cancelRecording]);
  useEffect(() => {
    setIsListening(speechIsListening);
    isListeningRef.current = speechIsListening;
    if (speechIsListening) {
      setMicOpening(false);
      setMicRecoveryReady(false);
      if (micRecoveryTimerRef.current) {
        clearTimeout(micRecoveryTimerRef.current);
        micRecoveryTimerRef.current = null;
      }
    }
  }, [speechIsListening]);

  // Auto-flip to typing when mic permission is denied or after 2 speech errors.
  // Mirrors the safety pattern in CategoryFluencyGame so a stroke patient is
  // never stuck staring at "Mic off / Use typing instead" with nowhere to type.
  useEffect(() => {
    if (!speechError) return;
    speechErrorCountRef.current += 1;
    const isPermissionDenied = /denied|not-allowed|permission/i.test(speechError);
    if ((isPermissionDenied || speechErrorCountRef.current >= 2) && !useTyping) {
      setUseTyping(true);
      try { sessionStorage.setItem('preferTypingInput', 'true'); } catch { /* noop */ }
    }
  }, [speechError, useTyping]);

  // When user switches to typing, stop the mic so the two inputs don't fight.
  useEffect(() => {
    if (useTyping && speechIsListening) {
      stopListening();
      setIsListening(false);
    }
  }, [useTyping, speechIsListening, stopListening]);

  const handleTypedSubmit = useCallback(() => {
    const text = typedAnswer.trim();
    if (text.length < 3) return;
    setDisplayTranscript(text);
    rawTranscriptRef.current = text;
    runEvaluationRef.current();
  }, [typedAnswer]);

  // Start prompt cooldown timers when trial begins
  const startPromptTimers = useCallback(() => {
    promptTimersRef.current.forEach(t => clearTimeout(t));
    promptTimersRef.current = [];
    setVisiblePrompts(0);

    PROMPT_COOLDOWNS.forEach((delay, i) => {
      const timer = setTimeout(() => {
        setVisiblePrompts(prev => Math.max(prev, i + 1));
      }, delay);
      promptTimersRef.current.push(timer);
    });
  }, []);

  /**
   * Check if transcript has enough substance to evaluate.
   * Prevents false positives from empty/filler-only speech.
   */
  const [validationHint, setValidationHint] = useState<string | null>(null);

  const hasSubstantialSpeech = useCallback((text: string): boolean => {
    if (!text || text.trim().length === 0) return false;
    // Skip duplicate validation — the hook's evaluateGuess already validates.
    // Only check minimum content words and listening duration here.
    const contentWords = getContentWordCount(text);
    if (contentWords < MIN_SPEECH_CONTENT_WORDS) return false;
    const listeningDuration = Date.now() - listeningStartRef.current;
    if (listeningDuration < MIN_LISTENING_DURATION_MS) return false;
    return true;
  }, []);

  // Voice guidance: speak intro on first trial
  useEffect(() => {
    if (!game.currentTrial || game.isComplete) return;
    if (game.currentIndex === 0 && !hasSpokenIntroRef.current && vg.shouldAutoSpeak) {
      hasSpokenIntroRef.current = true;
      vg.speakIntro().then(() => {
        // After intro, speak the task
        vg.speakIfVoiceLed('Tell me about it. Describe what you see.');
      });
    }
  }, [game.currentTrial, game.isComplete, game.currentIndex, vg]);

  // Voice guidance: stall reminder if no speech for ~8s
  useEffect(() => {
    if (!game.currentTrial || game.isComplete || showFeedback) return;
    if (stallTimerVgRef.current) clearTimeout(stallTimerVgRef.current);
    stallTimerVgRef.current = setTimeout(() => {
      if (vg.shouldAutoSpeak && !displayTranscript) {
        vg.speakReminder();
      }
    }, 8000);
    return () => { if (stallTimerVgRef.current) clearTimeout(stallTimerVgRef.current); };
  }, [game.currentTrial?.id, game.isComplete, showFeedback, vg, displayTranscript]);

  // Begin new trial
  useEffect(() => {
    if (!game.currentTrial || game.isComplete) return;

    game.startRound();
    evaluatedRef.current = false;
    setShowFeedback(false);
    setGuessMessage(null);
    setAwaitingWordAttempt(false);
    setWordSaidRedirect(false);
    wordSaidRedirectFiredRef.current = false;
    setDisplayTranscript('');
    rawTranscriptRef.current = '';
    processingRef.current = false;
    setMicRecoveryReady(false);
    if (micRecoveryTimerRef.current) {
      clearTimeout(micRecoveryTimerRef.current);
      micRecoveryTimerRef.current = null;
    }
    setIsEvaluating(false);
    // Clear the speech hook's accumulated transcript so leftover text from
    // the previous trial (or text captured while Maya was still speaking the
    // intro) cannot show up as "Heard: <instruction>" on the new trial.
    resetTranscript();

    // Clear any pending feedback timer from previous trial
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    if (sessionId && userId) {
      startAttempt({
        sessionId,
        userId,
        exerciseSlug: 'describe_guess',
        trialIndex: game.currentIndex,
        attemptNumber: game.currentAttempt,
        targetWord: game.currentTrial.target,
        category: game.currentTrial.category,
      });
    }

    // Start listening — but skip when the user is using the typing fallback,
    // otherwise the mic would activate every trial and overwrite typed input.
    // Sync-Wait: VoiceController-driven gate guarantees Maya isn't speaking
    // (and we're past the 400ms tail-lock) before the mic opens.
    if (!useTyping) {
      // Hard-stop any in-flight recognition from the previous trial so it
      // can't keep appending Maya's next instruction into fullTranscript.
      try { stopListening(); } catch { /* noop */ }
      setIsListening(false);
      setMicOpening(true);
      void (async () => {
        // Tiny yield so the intro-TTS effect has a chance to flip
        // voiceController.isSpeaking=true before we poll it.
        await new Promise((r) => setTimeout(r, 50));
        await awaitMicSafe(8000);
        // Bail out if the trial advanced or feedback opened during the wait
        if (!currentTrialRef.current || showFeedback) {
          setMicOpening(false);
          return;
        }
        // Final clear right before opening the mic — guarantees the first
        // visible "Heard:" text is the patient's actual answer.
        resetTranscript();
        setDisplayTranscript('');
        rawTranscriptRef.current = '';
        startListening();
        setIsListening(true);
        listeningStartRef.current = Date.now();
        if (isRecordingSupported) startRecording();
        setMicOpening(false);
        scheduleMicRecoveryCheck();
      })();
    } else {
      setTypedAnswer('');
    }

    startPromptTimers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentTrial?.id, game.isComplete]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearInterval(debounceTimeoutRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
      if (micRecoveryTimerRef.current) clearTimeout(micRecoveryTimerRef.current);
      promptTimersRef.current.forEach(t => clearTimeout(t));
      cancelRecordingRef.current();
      stopListeningRef.current();
    };
  }, []);

  // Update display — use fullTranscript (accumulated) for display and evaluation
  useEffect(() => {
    if (fullTranscript) {
      setDisplayTranscript(fullTranscript);
      rawTranscriptRef.current = fullTranscript;
    }
  }, [fullTranscript]);

  // Check for direct word match in real-time — redirect user to describe instead
  useEffect(() => {
    const trial = currentTrialRef.current;
    const textToCheck = fullTranscript || transcript;
    if (!textToCheck || !trial || evaluatedRef.current || awaitingWordAttempt) return;
    if (wordSaidRedirectFiredRef.current) return; // Only redirect once per trial

    if (game.checkWordMatch(textToCheck, trial)) {
      game.recordWordRetrieval();

      // Check if they already produced descriptive content — if so, fast-track evaluation
      const contentWords = getContentWordCount(textToCheck);
      const targetWordCount = trial.target.split(/\s+/).length;
      const wordsExcludingTarget = contentWords - targetWordCount;
      if (wordsExcludingTarget >= 3 || game.featureTypesUsed.size >= 1) {
        // They described AND said the word — immediately evaluate (no silence wait)
        console.log('[DescribeGuess] Word said after description — fast-tracking evaluation');
        runEvaluationRef.current();
        return;
      }

      // They blurted the word without describing — redirect them
      wordSaidRedirectFiredRef.current = true;
      setWordSaidRedirect(true);
      stopListening();
      setIsListening(false);

      const redirectMsg = `That's the word! Now try describing "${trial.target}" without saying it — what does it look like, what is it used for?`;
      setGuessMessage(redirectMsg);

      speak(redirectMsg).then(async () => {
        // Reset transcript so their description attempt is clean
        rawTranscriptRef.current = '';
        setDisplayTranscript('');
        setWordSaidRedirect(false);
        setGuessMessage(null);
        setMicOpening(true);
        setMicRecoveryReady(false);

        // Resume listening — Sync-Wait via VoiceController
        await awaitMicSafe(5000);
        if (!currentTrialRef.current || showFeedback) {
          setMicOpening(false);
          return;
        }
        startListening();
        setIsListening(true);
        listeningStartRef.current = Date.now();
        setMicOpening(false);
        scheduleMicRecoveryCheck();
      });
    }
  }, [fullTranscript, transcript, game, awaitingWordAttempt, stopListening, startListening, speak, scheduleMicRecoveryCheck]);

  // Real-time word detection during "say the word" phase — finalize early
  useEffect(() => {
    if (!awaitingWordAttempt) return;
    const trial = currentTrialRef.current;
    const textToCheck = fullTranscript || transcript;
    if (!textToCheck || !trial) return;

    if (game.checkWordMatch(textToCheck, trial)) {
      game.recordWordRetrieval();
      // Early finalize — cancel the 6s timer
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
      stopListening();
      setIsListening(false);
      
      const ctx = wordAttemptContextRef.current;
      if (ctx) {
        const finalResult = game.finalizeTrial(ctx.originalTranscript, ctx.guessResult, true);
        if (finalResult) {
          logFinalAnalysis({
            transcript: ctx.originalTranscript,
            transcriptSource: 'browser',
            isCorrect: true,
            errorType: 'word_retrieved',
            semanticSimilarity: ctx.guessResult.confidence,
          });
          recordAdaptiveTrial({ correct: true, reactionTimeMs: finalResult.reactionTimeMs });
          engagement.recordTrial({ correct: true, reactionTimeMs: finalResult.reactionTimeMs, timeout: false, cueLevel: visiblePrompts, timestamp: Date.now() });
        }
        wordAttemptContextRef.current = null;
        setShowFeedback(true);
        setAwaitingWordAttempt(false);

        // Success — short feedback, advance quickly
        feedbackTimerRef.current = setTimeout(() => {
          resetAttempt();
          game.nextTrial();
        }, 2000);
      }
    }
  }, [fullTranscript, transcript, awaitingWordAttempt, game, stopListening, logFinalAnalysis, recordAdaptiveTrial, resetAttempt]);

  /**
   * Core evaluation function — extracted so it can be awaited properly.
   * Stops mic, evaluates speech, shows feedback, then advances.
   */
  const runEvaluation = useCallback(async () => {
    const trial = currentTrialRef.current;
    if (!trial || evaluatedRef.current || processingRef.current || wordSaidRedirect) return;

    const currentTranscript = rawTranscriptRef.current;

    // CRITICAL: Gate on substantial speech to prevent false positives
    if (!hasSubstantialSpeech(currentTranscript)) {
      // Not enough speech — don't evaluate, let them keep talking
      return;
    }

    // ─── MANDATORY PRE-SCORING GATE ───────────────────────────────
    // Rejects echoes of Maya's instructions, fillers, prompt repeats, etc.
    // Nothing reaches game.evaluateGuess until this passes.
    const gate = gateResponse({
      transcript: currentTranscript,
      promptText: 'Describe what you see without saying the word',
      expectedMode: 'description',
      // Feed the visible chip prompts so "what do you use it for?" parroting
      // is caught even though it was a button label, not a Maya utterance.
      extraSpokenContext: PROMPT_CHIPS.map(c => c.question),
    });

    broadcastGateDecision('describe_guess', gate, currentTranscript);

    if (!gate.ok) {
      // Soft-reject: clear the bad transcript, show coaching, keep mic open.
      console.log('[DescribeGuess] gate REJECT', {
        classification: gate.classification,
        reason: gate.rejectionReason,
        echoMatched: gate.echoMatched,
      });
      evaluatedRef.current = false;
      processingRef.current = false;
      rawTranscriptRef.current = '';
      setDisplayTranscript('');
      setValidationHint(gate.coachingText);
      // Auto-clear the hint after 4s so it doesn't linger
      setTimeout(() => setValidationHint(null), 4000);
      // Keep listening — the patient will try again. Reset the listen-start
      // clock so the min-duration gate isn't unfairly short on retry.
      listeningStartRef.current = Date.now();
      return;
    }

    processingRef.current = true;
    evaluatedRef.current = true;
    setIsEvaluating(true);

    try {
      // Check word match
      const wordWin = game.checkWordMatch(currentTranscript, trial);
      if (wordWin) game.recordWordRetrieval();

      // Evaluate guess (2-of-3 rule) — embeddings called here only
      const guessResult = await game.evaluateGuess(currentTranscript, trial);

      // Stop mic AFTER evaluation completes (not before)
      stopListening();
      setIsListening(false);

      // Handle audio upload in background (don't block feedback)
      let audioStoragePath: string | undefined;
      let recordingDurationMs: number | undefined;
      let pronunciationData: any = null;

      const audioPromise = (async () => {
        if (isRecording) {
          const recResult = await stopRecording();
          if (recResult && sessionId && userId) {
            recordingDurationMs = recResult.duration;
            const [uploaded, pronResult] = await Promise.all([
              uploadRecording(recResult.audioBlob, userId, sessionId, game.currentIndex + 1, recResult.mimeType),
              analyzePronunciation(recResult.audioBlob, trial.target).catch(() => null),
            ]);
            if (uploaded) audioStoragePath = uploaded;
            if (pronResult?.ok) pronunciationData = pronResult.data;
          }
        }
      })();

      setIsEvaluating(false);

      if (guessResult.guessed && !wordWin) {
        // App guessed correctly — celebrate, then optionally let them try saying it
        setGuessMessage(`I got it! It's "${trial.target}"! 🎉 Now try saying the word.`);
        setAwaitingWordAttempt(true);

        // Store context so real-time word detection can finalize early
        wordAttemptContextRef.current = {
          originalTranscript: currentTranscript,
          guessResult,
          audioPromise,
        };

        // Clear transcript so only post-guess speech is evaluated for word match
        rawTranscriptRef.current = '';
        setDisplayTranscript('');

        // Speak with mic off, then re-enable mic after TTS finishes (+tail-lock).
        speak(`I got it! It's ${trial.target}! Now try saying the word.`).then(async () => {
          // Reset transcript again in case speech recognition fired during TTS
          rawTranscriptRef.current = '';
          setMicOpening(true);
          setMicRecoveryReady(false);

          // Sync-Wait: VoiceController guarantees Maya is fully done.
          await awaitMicSafe(5000);
          if (!awaitingWordAttempt && !wordAttemptContextRef.current) {
            setMicOpening(false);
            return;
          }
          startListening();
          setIsListening(true);
          listeningStartRef.current = Date.now();
          setMicOpening(false);
          scheduleMicRecoveryCheck();

          // Start the word-attempt timer AFTER TTS finishes
          const wordAttemptStart = Date.now();
          feedbackTimerRef.current = setTimeout(async () => {
            stopListening();
            setIsListening(false);
            await audioPromise;
            const postGuessTranscript = rawTranscriptRef.current;
            const saidWord = game.checkWordMatch(postGuessTranscript, trial);
            if (saidWord) game.recordWordRetrieval();
            const finalResult = game.finalizeTrial(currentTranscript, guessResult, saidWord);
            if (finalResult) {
              logFinalAnalysis({
                transcript: currentTranscript,
                transcriptSource: 'browser',
                isCorrect: finalResult.meaningWin || finalResult.wordWin,
                errorType: finalResult.meaningWin ? 'meaning_conveyed' : 'no_guess',
                semanticSimilarity: guessResult.confidence,
                audioStoragePath,
                recordingDurationMs,
                ...(pronunciationData ? {
                  pronunciationScore: pronunciationData.pronunciationScore,
                  gopData: pronunciationData,
                } : {}),
              });
              recordAdaptiveTrial({ correct: finalResult.meaningWin || finalResult.wordWin, reactionTimeMs: finalResult.reactionTimeMs });
              engagement.recordTrial({ correct: finalResult.meaningWin || finalResult.wordWin, reactionTimeMs: finalResult.reactionTimeMs, timeout: false, cueLevel: visiblePrompts, timestamp: Date.now() });
            }
            setShowFeedback(true);
            setAwaitingWordAttempt(false);

            feedbackTimerRef.current = setTimeout(() => {
              resetAttempt();
              game.nextTrial();
            }, 6000);
          }, 6000);
        });
      } else {
        // Finalize immediately — show feedback first, THEN advance
        await audioPromise; // Ensure audio is done
        const finalResult = game.finalizeTrial(currentTranscript, guessResult, wordWin);
        if (finalResult) {
          await logFinalAnalysis({
            transcript: currentTranscript,
            transcriptSource: 'browser',
            isCorrect: finalResult.meaningWin || finalResult.wordWin,
            errorType: wordWin ? 'word_retrieved' : (finalResult.meaningWin ? 'meaning_conveyed' : 'no_guess'),
            semanticSimilarity: guessResult.confidence,
            audioStoragePath,
            recordingDurationMs,
            ...(pronunciationData ? {
              pronunciationScore: pronunciationData.pronunciationScore,
              gopData: pronunciationData,
            } : {}),
          });
          recordAdaptiveTrial({ correct: finalResult.meaningWin || finalResult.wordWin, reactionTimeMs: finalResult.reactionTimeMs });
          engagement.recordTrial({ correct: finalResult.meaningWin || finalResult.wordWin, reactionTimeMs: finalResult.reactionTimeMs, timeout: false, cueLevel: visiblePrompts, timestamp: Date.now() });
        }
        setShowFeedback(true);

        // Wait for user to see feedback before advancing
        feedbackTimerRef.current = setTimeout(() => {
          resetAttempt();
          game.nextTrial();
        }, 6000);
      }
    } catch (err) {
      console.error('Evaluation error:', err);
      setIsEvaluating(false);
    } finally {
      processingRef.current = false;
    }
  }, [game, stopListening, isRecording, stopRecording, uploadRecording, sessionId, userId,
      analyzePronunciation, speak, logFinalAnalysis, recordAdaptiveTrial, resetAttempt, hasSubstantialSpeech,
      startListening, speechIsListening, wordSaidRedirect]);

  // Keep ref in sync so pre-declaration useEffects can call runEvaluation
  useEffect(() => { runEvaluationRef.current = runEvaluation; }, [runEvaluation]);

  useEffect(() => {
    if (fullTranscript) lastTranscriptChangeRef.current = Date.now();
  }, [fullTranscript]);

  // Adaptive speech-end evaluation using speech state classifier
  useEffect(() => {
    if (!isListening || showFeedback) return;

    if (debounceTimeoutRef.current) clearInterval(debounceTimeoutRef.current);

    debounceTimeoutRef.current = setInterval(() => {
      if (!fullTranscript || !currentTrialRef.current || evaluatedRef.current || processingRef.current) return;
      
      const silenceMs = Date.now() - lastTranscriptChangeRef.current;
      const elapsedMs = Date.now() - listeningStartRef.current;
      const trial = currentTrialRef.current;
      
      const state = classifySpeechState({
        transcript: fullTranscript,
        elapsedMs,
        silenceDurationMs: silenceMs,
        promptText: trial?.target,
      });

      setNudgeHint(state.nudgeHint);

      if (state.suppressAutoSubmit) return;

      const profile = TIMING_PROFILES.discourse;
      const multiplier = getProfileMultiplier(profile, state.state, state.confidence);
      const threshold = Math.round(profile.baseSilenceMs * multiplier);

      if (silenceMs >= threshold) {
        runEvaluation();
      }
    }, 200);

    return () => { if (debounceTimeoutRef.current) clearInterval(debounceTimeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, showFeedback, fullTranscript]);

  const handleChipTap = useCallback((chip: PromptChip) => {
    game.recordFeatureChip(chip.featureType, chip.question);
    speak(chip.question);
  }, [game, speak]);

  const handleDismissFeedback = useCallback(() => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = null;
    resetAttempt();
    game.nextTrial();
    setShowFeedback(false);
  }, [resetAttempt, game]);

  const handleSkip = useCallback(() => {
    if (debounceTimeoutRef.current) clearInterval(debounceTimeoutRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    promptTimersRef.current.forEach(t => clearTimeout(t));
    if (micRecoveryTimerRef.current) clearTimeout(micRecoveryTimerRef.current);
    setMicRecoveryReady(false);
    setMicOpening(false);
    stopListening();
    setIsListening(false);
    setIsEvaluating(false);
    setAwaitingWordAttempt(false);
    if (isRecording) stopRecording();
    resetAttempt();
    game.nextTrial();
    setShowFeedback(false);
  }, [stopListening, isRecording, stopRecording, resetAttempt, game]);

  // Completion screen
  if (game.isComplete) {
    const totalTrialsCompleted = game.meaningWins + game.wordWins + (game.totalTrials - game.meaningWins - game.wordWins);
    const accuracy = totalTrialsCompleted > 0 ? (game.meaningWins + game.wordWins) / totalTrialsCompleted : 0;
    const maya = buildReflection(accuracy);

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (game.meaningWins > 0) strengths.push(`${game.meaningWins} descriptions understood by meaning`);
    if (game.wordWins > 0) strengths.push(`${game.wordWins} exact words retrieved`);
    if (game.strategyWins > 0) strengths.push(`Used ${game.strategyWins} describing strategies`);
    if (game.meaningWins === 0 && game.wordWins === 0) weaknesses.push('Try describing what the item does and where you find it');
    if (game.strategyWins < 2) weaknesses.push('Try using more feature types: category, use, appearance');

    return (
      <div className="max-w-md mx-auto space-y-4 py-4">
        <div className="text-center space-y-2">
          <div className="text-5xl">🎉</div>
          <h2 className="text-2xl font-bold">Describing practice done!</h2>
        </div>
        <div className="flex justify-center gap-6 text-lg">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">{game.meaningWins}</div>
            <div className="text-sm text-muted-foreground">Meaning</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">{game.wordWins}</div>
            <div className="text-sm text-muted-foreground">Word</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">{game.strategyWins}</div>
            <div className="text-sm text-muted-foreground">Strategy</div>
          </div>
        </div>

        <StructuredFeedbackSummary
          strengths={strengths}
          weaknesses={weaknesses}
          nextStep={maya.nextStep}
          mayaReflection={maya.reflection}
          realLifeLine={maya.realLifeLine}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col gap-2">
      {/* Purpose banner — first trial only */}
      {game.currentIndex === 0 && !showFeedback && (
        <ExercisePurposeBanner exerciseSlug="describe-guess" />
      )}
      {/* Progress — compact */}
      <div className="shrink-0">
        <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
          <span>{game.currentIndex + 1}/{game.totalTrials}</span>
          <div className="flex items-center gap-2">
            <LevelBadge descriptor={dgLevelDescriptor} compact />
            <AdaptationBadge direction={shiftDirection} reason={shiftReason} />
            <span>🎯{game.meaningWins}</span>
            <span>💬{game.wordWins}</span>
            <span>⭐{game.strategyWins}</span>
          </div>
        </div>
        <Progress value={game.progress} className="h-1.5" />
      </div>

      {/* Instruction — clear Taboo-style */}
      <div className="text-center shrink-0 space-y-1">
        <p className="text-sm font-medium text-foreground">
          🚫 Describe this <strong>without</strong> saying the word!
        </p>
        <p className="text-xs text-muted-foreground">
          Tell me what it looks like, where you find it, or what it's used for — I'll try to guess.
        </p>
      </div>

      {/* Image Card — fills available space. Hard-block render if no image resolves. */}
      <Card className="border-2 overflow-hidden flex-1 min-h-0">
        <CardContent className="p-0 h-full">
          {currentImage ? (
            <div className="h-full flex items-center justify-center bg-muted/30">
              <img
                src={currentImage}
                alt="Describe this"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-full min-h-[180px] flex flex-col items-center justify-center gap-3 bg-muted/30 text-muted-foreground p-6 text-center">
              <p className="text-sm">This one didn't load — let's skip to the next.</p>
              <Button size="sm" variant="outline" onClick={handleSkip}>
                <SkipForward className="h-4 w-4 mr-1.5" /> Next item
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prompt Chips (appear on cooldown) */}
      {!showFeedback && !awaitingWordAttempt && (
        <div className="flex flex-wrap justify-center gap-1.5 shrink-0">
          {PROMPT_CHIPS.slice(0, Math.min(visiblePrompts + 2, PROMPT_CHIPS.length)).map((chip, i) => {
            const isVisible = i < visiblePrompts + 2;
            if (i > 1 && i >= visiblePrompts + 2) return null;
            return (
              <Button
                key={chip.featureType}
                variant={game.featureTypesUsed.has(chip.featureType) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleChipTap(chip)}
                className={cn(
                  'transition-all text-xs h-8',
                  i > 1 && i >= visiblePrompts ? 'opacity-0 pointer-events-none' : 'opacity-100',
                  game.featureTypesUsed.has(chip.featureType) && 'ring-2 ring-primary/50',
                )}
              >
                {chip.icon}
                <span className="ml-1">{chip.label}</span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Transcript */}
      {displayTranscript && !showFeedback && (
        <div className="text-center text-sm sm:text-lg text-muted-foreground shrink-0">
          Heard: "<span className="font-medium text-foreground">{displayTranscript}</span>"
        </div>
      )}

      {/* Validation coaching hint */}
      {validationHint && !showFeedback && !guessMessage && (
        <div className="text-center text-sm text-muted-foreground italic shrink-0">
          💡 {validationHint}
        </div>
      )}

      {/* Guess message */}
      {guessMessage && !showFeedback && (
        <Card className="border-2 border-primary bg-primary/5 shrink-0">
          <CardContent className="py-3 text-center">
            <p className="text-base font-medium text-primary">{guessMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      {showFeedback && game.lastResult && (
        <Card className="border-2 border-primary/50 bg-primary/5 shrink-0">
          <CardContent className="py-3 text-center space-y-2">
            <div className="flex justify-center gap-1">
              {Array.from({ length: getStarCount(game.lastResult) }, (_, i) => (
                <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
              ))}
              {Array.from({ length: 3 - getStarCount(game.lastResult) }, (_, i) => (
                <Star key={`empty-${i}`} className="h-5 w-5 text-muted-foreground/30" />
              ))}
            </div>
            
            <div className="flex flex-wrap justify-center gap-1.5 text-xs">
              {game.lastResult.meaningWin && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  🎯 Meaning
                </Badge>
              )}
              {game.lastResult.wordWin && (
                <Badge className="bg-primary/20 text-primary">
                  💬 Word
                </Badge>
              )}
              {game.lastResult.strategyWin && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  ⭐ Strategy
                </Badge>
              )}
              {game.lastResult.communicationWin && !game.lastResult.meaningWin && !game.lastResult.wordWin && (
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  🗣️ Clear
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              The word was: <strong className="text-foreground">{game.lastResult.target}</strong>
            </p>
            <Button size="sm" variant="ghost" onClick={handleDismissFeedback} className="text-xs">
              ✕ Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Speech nudge - gentle encouragement */}
      {isListening && !showFeedback && (
        <SpeechNudge nudgeHint={nudgeHint} isSpeaking={!!(displayTranscript)} className="px-4" />
      )}

      {/* Mic failure recovery — shows on explicit error OR when the mic
          silently failed to start (no error fired but not listening either).
          Hidden during typing mode, evaluation, feedback, and Maya's TTS. */}
      <MicFailureRecovery
        visible={
          !showFeedback &&
          !isEvaluating &&
          !useTyping &&
          !awaitingWordAttempt &&
          !isListening &&
          !speechIsListening &&
          !vg.isSpeaking &&
          !micOpening &&
          micRecoveryReady &&
          isSupported
        }
        onRetry={() => {
          setMicOpening(true);
          setMicRecoveryReady(false);
          resetTranscript();
          setTimeout(() => {
            startListening();
            setIsListening(true);
            listeningStartRef.current = Date.now();
            setMicOpening(false);
            scheduleMicRecoveryCheck();
          }, 350);
        }}
        compact
      />

      {/* Typing fallback — appears when mic fails or user opts in */}
      {useTyping && !showFeedback && !awaitingWordAttempt && !isEvaluating && (
        <div className="px-4 space-y-2">
          <Textarea
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            placeholder="Type your description here…"
            className="min-h-[88px] text-base"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleTypedSubmit();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Press <kbd className="rounded border bg-muted px-1">⌘/Ctrl + Enter</kbd> or tap “I'm done”.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center gap-3 shrink-0 pb-1 flex-wrap">
        {isEvaluating ? (
          <Badge variant="secondary" className="text-sm px-3 py-1.5 animate-pulse">
            🤔 Guessing...
          </Badge>
        ) : !showFeedback && !awaitingWordAttempt ? (
          <>
            {/* Done button — primary action */}
            <Button
              size="sm"
              onClick={() => {
                if (debounceTimeoutRef.current) clearInterval(debounceTimeoutRef.current);
                if (useTyping) {
                  handleTypedSubmit();
                } else {
                  runEvaluation();
                }
              }}
              disabled={
                useTyping
                  ? typedAnswer.trim().length < 3
                  : !displayTranscript || displayTranscript.trim().length < 3
              }
              className="h-9"
            >
              <Check className="h-4 w-4 mr-1" /> I'm done
            </Button>

            {/* Typing toggle — REAL button, not a status pill.
                Always available so the patient can switch even before mic fails. */}
            {useTyping ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUseTyping(false);
                  try { sessionStorage.setItem('preferTypingInput', 'false'); } catch { /* noop */ }
                  speechErrorCountRef.current = 0;
                  setMicOpening(true);
                  setMicRecoveryReady(false);
                  setTimeout(() => {
                    startListening();
                    setIsListening(true);
                    listeningStartRef.current = Date.now();
                    setMicOpening(false);
                    scheduleMicRecoveryCheck();
                  }, 350);
                }}
                className="h-9"
              >
                <Mic className="h-3.5 w-3.5 mr-1" /> Use mic
              </Button>
            ) : (
              <Button
                variant={speechError ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setUseTyping(true);
                  try { sessionStorage.setItem('preferTypingInput', 'true'); } catch { /* noop */ }
                  if (speechIsListening) stopListening();
                }}
                className="h-9"
              >
                <Keyboard className="h-3.5 w-3.5 mr-1" />
                {speechError ? 'Use typing instead' : 'Type instead'}
              </Button>
            )}

            {/* Mic status pill — visual only, not interactive */}
            {!useTyping && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs',
                isListening ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'
              )}>
                {isListening ? <Mic className="h-3.5 w-3.5 animate-pulse" /> : <MicOff className="h-3.5 w-3.5" />}
                {isListening ? 'Listening...' : 'Mic off'}
              </div>
            )}

            <Button variant="ghost" size="sm" onClick={handleSkip} className="h-9">
              <SkipForward className="h-4 w-4 mr-1" /> Skip
            </Button>
          </>
        ) : awaitingWordAttempt ? (
          <>
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
              isListening ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'
            )}>
              {isListening ? <Mic className="h-4 w-4 animate-pulse" /> : <MicOff className="h-4 w-4" />}
              {isListening ? 'Say the word...' : 'Mic off'}
            </div>
            <Button variant="ghost" size="sm" onClick={handleSkip} className="h-9">
              <SkipForward className="h-4 w-4 mr-1" /> Skip
            </Button>
          </>
        ) : awaitingWordAttempt ? (
          <>
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
              isListening ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'
            )}>
              {isListening ? <Mic className="h-4 w-4 animate-pulse" /> : <MicOff className="h-4 w-4" />}
              {isListening ? 'Say the word...' : 'Mic off'}
            </div>
            <Button variant="ghost" size="sm" onClick={handleSkip} className="h-9">
              <SkipForward className="h-4 w-4 mr-1" /> Skip
            </Button>
          </>
        ) : (
          <Badge variant="secondary" className="text-sm px-3 py-1.5">
            Next up...
          </Badge>
        )}
      </div>
    </div>
  );
}
