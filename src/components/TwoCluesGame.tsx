/**
 * Two Clues Word Association Game - Main Game Component
 * 
 * Key design decisions for stroke survivors:
 * - 3s debounce after last speech event before scoring (waits for full utterance)
 * - Scoring via handleSpeechResult callback (Photo Naming pattern), not useEffect on transcript
 * - Patient mode listening: unlimited restarts, no auto-end on silence
 * - Processing guard with 10s failsafe to prevent mic deadlock
 * - All exit paths use try/finally with local shouldHoldProcessing flag
 * - 2s cooldown after scoring to prevent re-scoring loops
 * - Pre-computed result passed to submitAnswer (no double-scoring)
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTwoCluesGame, TwoCluesTrialResult } from '@/hooks/useTwoCluesGame';
import { getTierColor, getTierBgColor, getTierEmoji, getTierMessage, scoreAnswer, ScoringResult } from '@/lib/twoCluesScorer';
import { extractAnswerFromTranscript, getContentWordCount, removeClueWords } from '@/lib/speechNormalizer';
import { validateSpokenResponse } from '@/lib/evaluation/responseValidation';
import { trackValidation, logValidationDetail } from '@/lib/evaluation/validationTelemetry';
import { speakMayaCoaching, resetCoachingState } from '@/lib/evaluation/mayaCoachingResponses';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { useAdaptationTrialLogger } from '@/hooks/useAdaptationTrialLogger';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { usePronunciationAnalysis } from '@/hooks/usePronunciationAnalysis';
import { useAdaptationEventLogger } from '@/hooks/useAdaptationEventLogger';
import { getCapabilityDifficultyBounds } from '@/lib/difficultyBounds';
import { Mic, MicOff, SkipForward, Volume2, RotateCcw, Loader2, TrendingUp, TrendingDown, Lightbulb } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useGameSounds } from '@/hooks/useGameSounds';
import { cn } from '@/lib/utils';
import { ExercisePurposeBanner } from '@/components/ExercisePurposeBanner';
import { AdaptationBadge } from '@/components/AdaptationBadge';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';

// ── Constants ──────────────────────────────────────────────────────────
const SCORING_DEBOUNCE_MS = 750;
const SCORING_COOLDOWN_MS = 2000;
const PROCESSING_FAILSAFE_MS = 10000;
const AUTO_ADVANCE_DELAY_MS = 2000;
const STALL_TIMER_DELAY_MS = 7000; // 7s before auto-cue (matches Photo Naming)
const CONSECUTIVE_ERROR_THRESHOLD = 3; // Errors before auto-cue

interface TwoCluesGameProps {
  onTrialComplete?: (result: TwoCluesTrialResult) => void;
  onGameComplete?: (results: TwoCluesTrialResult[]) => void;
  roundCount?: number;
  sessionId?: string | null;
  userId?: string;
  profileId?: string;
  focusPhonemes?: string[];
  /** Profile-recommended first cue type (personalizes cue ladder order) */
  recommendedCueType?: 'semantic' | 'phonemic' | 'full_word' | 'none';
}

/**
 * Quick local match check - no async, instant feedback for obvious matches
 */
function quickLocalMatch(
  spoken: string,
  anchors: string[],
  cluster: string[],
  anchorAliases?: Record<string, string[]>,
  clusterAliases?: Record<string, string[]>
): { tier: 'strong' | 'related'; matchedWord: string } | null {
  const normalized = spoken.toLowerCase().trim().replace(/[^a-z\s]/g, '');
  if (!normalized || normalized.length < 2) return null;

  for (const anchor of anchors) {
    const a = anchor.toLowerCase();
    if (normalized === a || normalized === a + 's' || normalized + 's' === a) {
      return { tier: 'strong', matchedWord: anchor };
    }
  }
  
  if (anchorAliases) {
    for (const [canonical, aliases] of Object.entries(anchorAliases)) {
      for (const alias of aliases) {
        const al = alias.toLowerCase();
        if (normalized === al || normalized === al + 's' || normalized + 's' === al) {
          return { tier: 'strong', matchedWord: canonical };
        }
      }
    }
  }

  for (const word of cluster) {
    const w = word.toLowerCase();
    if (normalized === w || normalized === w + 's' || normalized + 's' === w) {
      return { tier: 'related', matchedWord: word };
    }
  }
  
  if (clusterAliases) {
    for (const [canonical, aliases] of Object.entries(clusterAliases)) {
      for (const alias of aliases) {
        const al = alias.toLowerCase();
        if (normalized === al || normalized === al + 's' || normalized + 's' === al) {
          return { tier: 'related', matchedWord: canonical };
        }
      }
    }
  }

  return null;
}

export function TwoCluesGame({
  onTrialComplete,
  onGameComplete,
  roundCount = 10,
  sessionId,
  userId,
  profileId,
  focusPhonemes,
  recommendedCueType,
}: TwoCluesGameProps) {
  const [isListening, setIsListening] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayTranscript, setDisplayTranscript] = useState('');
  const [filteredDisplay, setFilteredDisplay] = useState('');
  const [scoringPhase, setScoringPhase] = useState<'idle' | 'checking' | 'scoring'>('idle');
  const [showThinkingHint, setShowThinkingHint] = useState(false);
  const [validationHint, setValidationHint] = useState<string | null>(null);
  const [difficultyChanged, setDifficultyChanged] = useState<'up' | 'down' | null>(null);
  
  // Cue ladder state
  const [cueLevel, setCueLevel] = useState(0); // 0=none, 1=semantic, 2=phonemic, 3=full
  const [showCue, setShowCue] = useState(false);
  const [currentCueText, setCurrentCueText] = useState('');
  const [cueState, setCueState] = useState<{
    type: 'semantic' | 'phonemic' | 'full_word';
    level: number;
    shownAt: number;
    trigger: 'stall' | 'consecutive_errors' | 'user_request';
  } | null>(null);
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScoredCandidateRef = useRef<string>('');
  const rawTranscriptRef = useRef<string>('');
  const finalizingRef = useRef(false);
  const processingRef = useRef(false);
  const processingSetAtRef = useRef<number>(0);
  const lastScoredAtRef = useRef<number>(0);
  const thinkingHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attemptStartTimeRef = useRef<number>(Date.now());
  
  // Cue tracking refs
  const autoCueShownThisTrialRef = useRef(false);
  const showCueRef = useRef(false);
  const showFeedbackRef = useRef(false);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const stopListeningRef = useRef<() => void>(() => {});
  const cancelRecordingRef = useRef<() => void>(() => {});
  const finalizeAttemptRef = useRef<(errorType: 'cancelled' | 'skipped' | 'abandoned') => Promise<void>>(async () => {});
  const beginAttemptRef = useRef<(attemptNumber?: number) => void>(() => {});
  
  const { speak } = useTextToSpeech();
  const { playHint } = useGameSounds();
  const vg = useVoiceGuidance('two-clues');
  const hasSpokenIntroRef = useRef(false);
  const stallTimerVgRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs for stale-closure safety
  useEffect(() => { showCueRef.current = showCue; }, [showCue]);
  useEffect(() => { showFeedbackRef.current = showFeedback; }, [showFeedback]);

  // Capability-based difficulty bounds (null scores = safe defaults)
  const bounds = useMemo(() => getCapabilityDifficultyBounds('two_clues', null), []);

  // Phase 2: engagement monitor — feeds cue dependency into the safety gate.
  const engagement = useEngagementMonitor(sessionId || null);
  const [adaptationNarration, setAdaptationNarration] = useState<string | undefined>();

  // Phase 4 — live trial logger.
  const { logTrial: logAdaptationTrial } = useAdaptationTrialLogger({
    userId,
    sessionId: sessionId || null,
    exerciseSlug: 'two_clues',
  });

  // Layer 2: In-Game Adaptation
  const {
    currentDifficulty,
    recordTrial: recordAdaptiveTrial,
    frustrationLevel,
    consecutiveErrors: adaptiveConsecutiveErrors,
    startStallTimer,
    clearStallTimer,
    reset: resetAdaptation,
  } = useInGameAdaptation({
    autoLog: false, // we forward via onTrialLogged below

    exerciseSlug: 'two_clues',
    sessionId: sessionId || null,
    initialDifficulty: bounds.suggestedStart,
    bounds,
    windowSize: 5,
    targetSuccessRate: 0.75,
    enableDifficultyAutoStepDown: true,
    enableDifficultyToasts: true,
    enableAutoHints: false, // Cue ladder managed locally
    // Phase 2 safety gate: block UP-escalations when the cue ladder is doing the work.
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.debug('[two_clues] escalation blocked', { reason, cueDependencyScore, trialsAtLevel });
      void engagement.logIntervention('cue_dependency_gate', 'hold_and_fade_cues', 'auto');
    },
    onDifficultyChange: (level, reason, direction) => {
      setDifficultyChanged(direction);
      const narration = narrateAdaptation({
        direction,
        reasonKind: classifyReason(reason),
      });
      setAdaptationNarration(narration || reason);
      setTimeout(() => {
        setDifficultyChanged(null);
        setAdaptationNarration(undefined);
      }, 4000);
    },
    onTrialLogged: (snap) => {
      logAdaptationTrial({
        trialIndex: snap.trialIndex,
        difficulty: snap.difficulty,
        cueLevel,
        cueDependency: snap.cueDependency,
        successRate: snap.successRate,
        correct: snap.correct,
        reactionTimeMs: snap.reactionTimeMs,
        frustration: snap.frustration,
        trialsAtLevel: snap.trialsAtLevel,
        difficultyChange: snap.difficultyChange,
        escalationBlocked: snap.escalationBlocked,
      });
    },
  });

  // Adaptation event logger for cue telemetry
  const {
    logCueDelivered,
  } = useAdaptationEventLogger({ userId, profileId });

  // Azure Pronunciation Assessment (shared hook)
  const { analyzePronunciation } = usePronunciationAnalysis();

  const {
    currentAttemptId,
    isFinalized,
    startAttempt,
    logBrowserTranscript,
    logFinalAnalysis,
    resetAttempt,
  } = useUtteranceLogger();

  const {
    isRecording,
    isSupported: isRecordingSupported,
    startRecording,
    stopRecording,
    uploadRecording,
    cancelRecording,
  } = useAudioRecorder();

  const game = useTwoCluesGame({
    roundCount,
    focusPhonemes,
    onTrialComplete,
    onGameComplete,
  });

  // Stable refs for game values used in effects (avoids re-triggering on game object identity)
  const currentPuzzleRef = useRef(game.currentPuzzle);
  const currentIndexRef = useRef(game.currentIndex);
  const currentAttemptNumRef = useRef(game.currentAttempt);
  useEffect(() => { currentPuzzleRef.current = game.currentPuzzle; }, [game.currentPuzzle]);
  useEffect(() => { currentIndexRef.current = game.currentIndex; }, [game.currentIndex]);
  useEffect(() => { currentAttemptNumRef.current = game.currentAttempt; }, [game.currentAttempt]);

  // Speech result callback — placeholder, will be replaced after dependencies are declared
  const processStableTranscriptRef = useRef<(t: string) => void>(() => {});
  
  const handleSpeechResult = useCallback((result: string) => {
    console.log('[TwoClues] Speech result (will debounce):', result);

    // Update raw transcript immediately
    rawTranscriptRef.current = result;
    setDisplayTranscript(result);
    logBrowserTranscript(result);

    // Update filtered display
    if (currentPuzzleRef.current) {
      const withoutClues = removeClueWords(result, currentPuzzleRef.current.clues);
      const answer = extractAnswerFromTranscript(withoutClues);
      setFilteredDisplay(answer);
    }

    // Clear existing debounce timer — every new speech event resets the clock
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Only score after SCORING_DEBOUNCE_MS of silence (no new speech events)
    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null;
      processStableTranscriptRef.current(result);
    }, SCORING_DEBOUNCE_MS);
  }, [logBrowserTranscript]);

  // Use PATIENT MODE: unlimited restarts, no auto-end on silence
  const {
    transcript,
    isListening: speechIsListening,
    startListening,
    stopListening,
    isSupported,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    autoStart: false,
    continuousListening: true,
    patientMode: true, // Unlimited restarts, no restart cap
  });

  useEffect(() => { stopListeningRef.current = stopListening; }, [stopListening]);
  useEffect(() => { cancelRecordingRef.current = cancelRecording; }, [cancelRecording]);

  useEffect(() => {
    setIsListening(speechIsListening);
  }, [speechIsListening]);

  // ── Processing guard failsafe (10s auto-reset) ────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (processingRef.current && processingSetAtRef.current > 0) {
        const elapsed = Date.now() - processingSetAtRef.current;
        if (elapsed > PROCESSING_FAILSAFE_MS) {
          console.warn('[TwoClues] Processing guard failsafe triggered after', elapsed, 'ms');
          processingRef.current = false;
          processingSetAtRef.current = 0;
          setIsProcessing(false);
          setScoringPhase('idle');
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Thinking hint (10s with no content) ────────────────────────────
  useEffect(() => {
    if (thinkingHintTimeoutRef.current) clearTimeout(thinkingHintTimeoutRef.current);
    
    if (isListening && !showFeedback && !isProcessing) {
      setShowThinkingHint(false);
      thinkingHintTimeoutRef.current = setTimeout(() => {
        setShowThinkingHint(true);
      }, 10000);
    } else {
      setShowThinkingHint(false);
    }

    return () => {
      if (thinkingHintTimeoutRef.current) clearTimeout(thinkingHintTimeoutRef.current);
    };
  }, [isListening, showFeedback, isProcessing, filteredDisplay]);

  const setProcessingGuard = useCallback((value: boolean) => {
    processingRef.current = value;
    processingSetAtRef.current = value ? Date.now() : 0;
  }, []);

  const beginAttempt = useCallback((attemptNumber: number = 1) => {
    if (!sessionId || !userId || !currentPuzzleRef.current) return;
    
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    lastScoredCandidateRef.current = '';
    rawTranscriptRef.current = '';
    setDisplayTranscript('');
    setFilteredDisplay('');
    setScoringPhase('idle');
    setProcessingGuard(false);
    attemptStartTimeRef.current = Date.now();
    
    const targetWord = currentPuzzleRef.current.anchors[0] || 'unknown';
    startAttempt({
      sessionId,
      userId,
      exerciseSlug: 'two_clues',
      trialIndex: currentIndexRef.current,
      attemptNumber,
      targetWord,
      category: currentPuzzleRef.current.category,
    });
    
    setIsListening(true);
    startListening();
    if (isRecordingSupported) {
      startRecording();
    }
  }, [sessionId, userId, startAttempt, startListening, isRecordingSupported, startRecording, setProcessingGuard]);

  useEffect(() => { beginAttemptRef.current = beginAttempt; }, [beginAttempt]);

  const finalizeAttempt = useCallback(async (
    errorType: 'cancelled' | 'skipped' | 'abandoned',
    extra?: Record<string, any>
  ): Promise<void> => {
    if (!currentAttemptId || isFinalized) return;
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    try {
      // Use actual cue state for finalization
      const activeCue = cueState;
      await logFinalAnalysis({
        transcript: rawTranscriptRef.current || undefined,
        transcriptSource: 'browser',
        isCorrect: false,
        errorType,
        cueTypeGiven: activeCue ? activeCue.type : 'none',
        cueWasEffective: activeCue ? false : undefined, // Had a cue but didn't help
        cueTrigger: activeCue?.trigger,
        ...extra,
      });
    } finally {
      finalizingRef.current = false;
      resetAttempt();
    }
  }, [currentAttemptId, isFinalized, logFinalAnalysis, resetAttempt]);

  useEffect(() => { finalizeAttemptRef.current = finalizeAttempt; }, [finalizeAttempt]);

  const clearTranscriptState = useCallback(() => {
    setDisplayTranscript('');
    setFilteredDisplay('');
    lastScoredCandidateRef.current = '';
    rawTranscriptRef.current = '';
    setScoringPhase('idle');
  }, []);

  // Voice guidance: speak intro on first trial, then ALWAYS speak the actual
  // clues for the visible puzzle so what the user HEARS matches what they SEE.
  // (Bug fix: previously on puzzle 0 we only spoke the example "animal/barks/dog"
  // from the intro, which didn't match the on-screen clues.)
  const introTtsCompleteRef = useRef(false);
  useEffect(() => {
    if (!game.currentPuzzle || game.isComplete || showFeedback) return;
    if (!vg.shouldAutoSpeak) return;

    const puzzle = game.currentPuzzle;
    const clueText = puzzle.clues.join(', and ');
    introTtsCompleteRef.current = false;

    const speakPuzzleClues = () => vg.speakIfVoiceLed(clueText);

    let p: Promise<void>;
    if (game.currentIndex === 0 && !hasSpokenIntroRef.current) {
      hasSpokenIntroRef.current = true;
      p = vg
        .speakIntro()
        .then(() => speakPuzzleClues());
    } else {
      p = speakPuzzleClues();
    }

    Promise.resolve(p).finally(() => {
      introTtsCompleteRef.current = true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentPuzzle?.id, game.isComplete, showFeedback]);

  // Voice guidance: stall reminder if no speech for ~8s
  useEffect(() => {
    if (!game.currentPuzzle || game.isComplete || showFeedback) return;
    if (stallTimerVgRef.current) clearTimeout(stallTimerVgRef.current);
    stallTimerVgRef.current = setTimeout(() => {
      if (vg.shouldAutoSpeak && !displayTranscript) {
        vg.speakReminder();
      }
    }, 8000);
    return () => { if (stallTimerVgRef.current) clearTimeout(stallTimerVgRef.current); };
  }, [game.currentPuzzle?.id, game.isComplete, showFeedback, vg, displayTranscript]);

  // Auto-start listening when puzzle changes.
  // SYNC-WAIT: do not open the mic while Maya/TTS is still speaking the intro
  // or the clues — otherwise the recogniser captures Maya's own voice as the
  // user's answer (the "Two Clues is listening to its own audio" bug).
  useEffect(() => {
    if (!game.currentPuzzle || game.isComplete) return;

    game.startRound();
    if (!(sessionId && userId)) return;

    let cancelled = false;

    // No auto-TTS (e.g. Games-Only mode) — safe to start immediately.
    if (!vg.shouldAutoSpeak) {
      beginAttemptRef.current(1);
      return () => { cancelled = true; };
    }

    const tryStart = () => {
      if (cancelled) return;
      if (!introTtsCompleteRef.current || vg.isSpeaking) {
        setTimeout(tryStart, 200);
        return;
      }
      // Small grace pad so the audio tail doesn't bleed into the recogniser.
      setTimeout(() => {
        if (!cancelled) beginAttemptRef.current(1);
      }, 250);
    };
    tryStart();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentPuzzle?.id, game.isComplete, sessionId, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      if (thinkingHintTimeoutRef.current) clearTimeout(thinkingHintTimeoutRef.current);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
      cancelRecordingRef.current();
      stopListeningRef.current();
      void finalizeAttemptRef.current('abandoned');
    };
  }, []);

  // ==========================================================================
  // Two Clues Cue Generation
  // Semantic: category hint, Phonemic: first letter of anchor, Full: reveal
  // ==========================================================================
  const generateTwoCluesCue = useCallback((level: number): { type: 'semantic' | 'phonemic' | 'full_word'; text: string } => {
    const puzzle = currentPuzzleRef.current;
    if (!puzzle) return { type: 'semantic', text: 'Think about what connects the clues.' };

    const anchor = puzzle.anchors[0] || '';

    // Personalized cue ladder: if profile recommends phonemic first, swap levels 1 and 2
    const preferPhonemic = recommendedCueType === 'phonemic';
    const effectiveLevel = preferPhonemic
      ? (level === 1 ? 2 : level === 2 ? 1 : level)
      : level;

    switch (effectiveLevel) {
      case 1: {
        // Semantic: category-based hint
        const categoryHints: Record<string, string> = {
          animals: "Think of an animal",
          food: "Think of something you eat",
          kitchen: "Think of something in the kitchen",
          transport: "Think of a way to travel",
          body: "Think of a body part",
          nature: "Think of something in nature",
          home: "Think of something around the house",
          clothing: "Think of something you wear",
          weather: "Think of something about the weather",
          tools: "Think of a tool or instrument",
        };
        const hint = categoryHints[puzzle.category] || `Think about ${puzzle.category}`;
        return { type: 'semantic', text: hint };
      }
      case 2: {
        // Phonemic: first letter + syllable count
        const firstLetter = anchor.charAt(0).toUpperCase();
        const syllables = anchor.replace(/[^aeiouy]/gi, '').length || 1;
        return {
          type: 'phonemic',
          text: `It starts with "${firstLetter}" and has ${syllables === 1 ? 'one syllable' : `${syllables} syllables`}`,
        };
      }
      case 3:
      default:
        // Full reveal
        return { type: 'full_word', text: `The word is "${anchor}"` };
    }
  }, [recommendedCueType]);

  // ==========================================================================
  // Auto-Cue Trigger (stall or consecutive errors)
  // ==========================================================================
  const triggerAutoCue = useCallback((trigger: 'stall' | 'consecutive_errors') => {
    if (showCueRef.current || autoCueShownThisTrialRef.current) return false;
    if (!currentPuzzleRef.current) return false;
    if (showFeedbackRef.current) return false;

    console.log('[TwoClues] 💡 triggerAutoCue FIRING:', trigger);

    const cue = generateTwoCluesCue(1);
    setCueLevel(1);
    setCurrentCueText(cue.text);
    setShowCue(true);
    autoCueShownThisTrialRef.current = true;
    showCueRef.current = true;

    setCueState({
      type: cue.type,
      level: 1,
      shownAt: Date.now(),
      trigger,
    });

    logCueDelivered(
      cue.type,
      1,
      trigger,
      adaptiveConsecutiveErrors,
      sessionId,
      'two_clues',
      currentIndexRef.current
    );

    return true;
  }, [generateTwoCluesCue, logCueDelivered, adaptiveConsecutiveErrors, sessionId]);

  // ==========================================================================
  // Reset cue state on trial change
  // ==========================================================================
  useEffect(() => {
    setCueLevel(0);
    setShowCue(false);
    setCurrentCueText('');
    setCueState(null);
    autoCueShownThisTrialRef.current = false;
    showCueRef.current = false;
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    // Safety net: ensure last puzzle's heard text/answer never lingers on screen.
    setDisplayTranscript('');
    setFilteredDisplay('');
    rawTranscriptRef.current = '';
    lastScoredCandidateRef.current = '';
  }, [game.currentIndex]);

  // ==========================================================================
  // Stall detection: 7s of silence → auto-cue
  // ==========================================================================
  useEffect(() => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);

    const trialReady = isListening && !showFeedback && !isProcessing && !showCue;
    if (trialReady) {
      stallTimerRef.current = setTimeout(() => {
        if (!showCueRef.current && !showFeedbackRef.current && !autoCueShownThisTrialRef.current) {
          triggerAutoCue('stall');
        }
      }, STALL_TIMER_DELAY_MS);
    }

    return () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, [isListening, showFeedback, isProcessing, showCue, triggerAutoCue]);

  // ==========================================================================
  // Consecutive errors → auto-cue
  // ==========================================================================
  useEffect(() => {
    if (
      adaptiveConsecutiveErrors >= CONSECUTIVE_ERROR_THRESHOLD &&
      !autoCueShownThisTrialRef.current &&
      !showFeedback
    ) {
      triggerAutoCue('consecutive_errors');
    }
  }, [adaptiveConsecutiveErrors, showFeedback, triggerAutoCue]);

  // ==========================================================================
  // Manual hint request (user clicks "Need a hint?")
  // ==========================================================================
  const handleRequestHint = useCallback(() => {
    if (cueLevel >= 3 || !currentPuzzleRef.current) return;

    playHint?.();
    const newLevel = cueLevel + 1;
    const cue = generateTwoCluesCue(newLevel);

    setCueLevel(newLevel);
    setCurrentCueText(cue.text);
    setShowCue(true);
    showCueRef.current = true;

    setCueState({
      type: cue.type,
      level: newLevel,
      shownAt: Date.now(),
      trigger: 'user_request',
    });

    logCueDelivered(
      cue.type,
      newLevel,
      'user_request',
      adaptiveConsecutiveErrors,
      sessionId,
      'two_clues',
      currentIndexRef.current
    );
  }, [cueLevel, generateTwoCluesCue, playHint, logCueDelivered, adaptiveConsecutiveErrors, sessionId]);

  // Reset stall timer when speech is detected
  useEffect(() => {
    if (displayTranscript && stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, [displayTranscript]);

  // ==========================================================================
  // Stable transcript scoring (Photo Naming pattern)
  // Only scores after SCORING_DEBOUNCE_MS of no new speech events
  // ==========================================================================
  const processStableTranscript = useCallback(async (stableTranscript: string) => {
    const currentPuzzle = currentPuzzleRef.current;
    if (!currentPuzzle) return;

    // Re-extract from the latest raw transcript
    const latestRaw = rawTranscriptRef.current;
    const latestWithoutClues = removeClueWords(latestRaw, currentPuzzle.clues);
    const candidate = extractAnswerFromTranscript(latestWithoutClues);

    // GUARD: Already processing or showing feedback
    if (processingRef.current) {
      console.log('[TwoClues] processStableTranscript blocked - already processing');
      return;
    }

    // GUARD: Same candidate already scored
    if (candidate === lastScoredCandidateRef.current && candidate.length > 0) {
      console.log('[TwoClues] processStableTranscript blocked - same candidate');
      return;
    }

    // GUARD: Universal validation pipeline
    const validation = validateSpokenResponse({ transcript: latestWithoutClues, expectedMode: 'naming' });
    trackValidation('two_clues', validation);
    logValidationDetail('two_clues', latestWithoutClues, validation);
    if (!validation.valid || candidate.length < 2) {
      console.log('[TwoClues] processStableTranscript blocked -', validation.rejectionReason || 'too short', JSON.stringify(candidate));
      if (validation.rejectionReason) {
        speakMayaCoaching(validation.rejectionReason, speak, { exerciseKey: 'two_clues' }).then(line => setValidationHint(line));
      }
      return;
    }
    setValidationHint(null);
    resetCoachingState('two_clues', speak);

    // GUARD: Cooldown
    const timeSinceLastScore = Date.now() - lastScoredAtRef.current;
    if (timeSinceLastScore < SCORING_COOLDOWN_MS && lastScoredCandidateRef.current) {
      console.log('[TwoClues] processStableTranscript blocked - cooldown');
      return;
    }

    console.log('[TwoClues] ✅ Transcript stable, scoring:', candidate, '(full:', latestRaw, ')');

    // Lock processing
    setProcessingGuard(true);
    setIsProcessing(true);
    setScoringPhase('checking');

    const rawTranscript = latestRaw;
    let shouldHoldProcessing = false;

    try {
      // Quick local match first (instant)
      const quickMatch = quickLocalMatch(
        candidate,
        currentPuzzle.anchors,
        currentPuzzle.cluster,
        currentPuzzle.anchorAliases,
        currentPuzzle.clusterAliases
      );

      let result: ScoringResult;

      if (quickMatch) {
        console.log('[TwoClues] Quick match:', quickMatch);
        result = {
          tier: quickMatch.tier,
          score: quickMatch.tier === 'strong' ? 100 : 75,
          matchedWord: quickMatch.matchedWord,
          reachedAnchor: quickMatch.tier === 'strong',
          semanticSimilarity: quickMatch.tier === 'strong' ? 1.0 : 0.85,
          reasoning: quickMatch.tier === 'strong' ? 'Perfect match!' : 'Great related word!',
        };
      } else {
        console.log('[TwoClues] Semantic scoring for:', candidate);
        setScoringPhase('scoring');
        result = await scoreAnswer(candidate, currentPuzzle);
      }

      // Mark scored
      lastScoredCandidateRef.current = candidate;
      lastScoredAtRef.current = Date.now();

      // Stop mic + recording
      stopListening();
      setIsListening(false);

      let recordingDurationMs: number | undefined;
      let audioStoragePath: string | undefined;
      let pronunciationData: any = null;

      if (isRecording) {
        const recordingResult = await stopRecording();
        if (recordingResult && sessionId && userId) {
          recordingDurationMs = recordingResult.duration;

          const [uploadedPath, pronResult] = await Promise.all([
            uploadRecording(
              recordingResult.audioBlob,
              userId,
              sessionId,
              currentIndexRef.current + 1,
              recordingResult.mimeType
            ),
            analyzePronunciation(recordingResult.audioBlob, result.matchedWord || candidate).catch(err => {
              console.warn('[TwoClues] Pronunciation analysis failed (non-blocking):', err);
              return null;
            }),
          ]);

          if (uploadedPath) audioStoragePath = uploadedPath;
          if (pronResult?.ok) {
            pronunciationData = pronResult.data;
          }
        }
      }

      // Pass pre-computed result to game state
      game.submitAnswer(candidate, result);

      // Adaptive difficulty
      const isSuccess = result.tier === 'strong' || result.tier === 'related';
      recordAdaptiveTrial({
        correct: isSuccess,
        reactionTimeMs: Date.now() - attemptStartTimeRef.current,
        errorType: result.tier === 'uncertain' ? 'no_match' :
                   result.tier === 'creative' ? 'creative_link' : undefined,
      });
      // Phase 2: feed engagement monitor with the actual cue level used this trial.
      engagement.recordTrial({
        correct: isSuccess,
        reactionTimeMs: Date.now() - attemptStartTimeRef.current,
        timeout: false,
        cueLevel,
        timestamp: Date.now(),
      });

      // Compute cue efficacy before resetting cue state
      let cueTypeGiven: 'none' | 'semantic' | 'phonemic' | 'full_word' = 'none';
      let cueWasEffective: boolean | null = null;
      let timeToSuccessAfterCueMs: number | null = null;
      const CUE_ATTRIBUTION_WINDOW_MS = 15000;
      const capturedCueState = cueState;

      if (capturedCueState) {
        cueTypeGiven = capturedCueState.type;
        const dt = Date.now() - capturedCueState.shownAt;

        if (isSuccess && dt <= CUE_ATTRIBUTION_WINDOW_MS) {
          cueWasEffective = true;
          timeToSuccessAfterCueMs = dt;
        } else if (isSuccess && dt > CUE_ATTRIBUTION_WINDOW_MS) {
          cueWasEffective = null; // Ambiguous - too long after cue
        } else {
          cueWasEffective = false;
        }
      }

      // Reset cue state after capturing
      setCueState(null);

      // Log utterance
      if (sessionId && currentAttemptId) {
        const contentWordCount = getContentWordCount(rawTranscript);

        await logFinalAnalysis({
          transcript: rawTranscript,
          transcriptSource: 'browser',
          isCorrect: isSuccess,
          errorType: result.tier === 'uncertain' ? 'no_match' :
                     result.tier === 'creative' ? 'creative_link' :
                     result.tier === 'related' ? 'semantic_paraphasia' : undefined,
          semanticSimilarity: result.semanticSimilarity ?? undefined,
          recordingDurationMs,
          audioStoragePath,
          ...(pronunciationData ? {
            pronunciationScore: pronunciationData.pronunciationScore,
            accuracyScore: pronunciationData.accuracyScore,
            fluencyScore: pronunciationData.fluencyScore,
            completenessScore: pronunciationData.completenessScore,
            prosodyScore: pronunciationData.prosodyScore,
            gopData: pronunciationData,
            alignmentData: pronunciationData.alignmentData,
          } : {}),
          reasoning: JSON.stringify({
            rawTranscript,
            cluesFiltered: currentPuzzle.clues,
            afterClueRemoval: latestWithoutClues,
            cleanedAnswer: candidate,
            matchedWord: result.matchedWord,
            tier: result.tier,
            score: result.score,
            reachedAnchor: result.reachedAnchor,
            puzzleId: currentPuzzle.id,
            contentWordCount,
          }),
          cueTypeGiven,
          cueWasEffective: cueWasEffective ?? undefined,
          timeToSuccessAfterCueMs: timeToSuccessAfterCueMs ?? undefined,
          cueTrigger: capturedCueState?.trigger,
          fluencyAvailable: !!audioStoragePath,
          fluencyUnavailableReason: !audioStoragePath ? 'no_recording' : undefined,
        });
      }

      // Show feedback
      const message = getTierMessage(result.tier, result.matchedWord);
      setFeedbackMessage(result.coachResponse || message);
      setShowFeedback(true);
      clearTranscriptState();

      if (result.tier === 'strong' || result.tier === 'related') {
        shouldHoldProcessing = true;
        // Stop the mic immediately so a late onResult event from the
        // previous attempt cannot repopulate the transcript on the next puzzle
        // (Bug fix: "answer stays in from first answer").
        try { stopListeningRef.current?.(); } catch {}
        setIsListening(false);
        setTimeout(() => {
          if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
          setShowFeedback(false);
          resetAttempt();
          setProcessingGuard(false);
          clearTranscriptState();
          game.nextRound();
        }, AUTO_ADVANCE_DELAY_MS);
      } else {
        // Wrong answer: auto-retry after brief feedback
        shouldHoldProcessing = true;
        const currentAttemptNum = currentAttemptNumRef.current || 1;
        autoRetryTimerRef.current = setTimeout(() => {
          autoRetryTimerRef.current = null;
          setShowFeedback(false);
          resetAttempt();
          setProcessingGuard(false);
          beginAttempt(currentAttemptNum + 1);
        }, 6000);
      }
    } catch (error) {
      console.error('[TwoClues] Scoring error:', error);
      shouldHoldProcessing = false;
    } finally {
      setIsProcessing(false);
      setScoringPhase('idle');
      if (!shouldHoldProcessing) {
        setProcessingGuard(false);
      }
    }
  }, [stopListening, sessionId, userId, currentAttemptId, logFinalAnalysis, isRecording, stopRecording, uploadRecording, resetAttempt, clearTranscriptState, recordAdaptiveTrial, setProcessingGuard, game, analyzePronunciation, cueState]);

  // Keep ref updated for use in handleSpeechResult's setTimeout
  useEffect(() => { processStableTranscriptRef.current = processStableTranscript; }, [processStableTranscript]);

  const handleToggleMic = useCallback(async () => {
    if (isListening) {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      stopListening();
      setIsListening(false);
      cancelRecording();
      clearTranscriptState();
      await finalizeAttempt('cancelled');
    } else {
      beginAttempt((currentAttemptNumRef.current || 0) + 1);
    }
  }, [isListening, stopListening, cancelRecording, clearTranscriptState, finalizeAttempt, beginAttempt]);

  const handleReadClues = useCallback(() => {
    if (currentPuzzleRef.current) {
      speak(currentPuzzleRef.current.clues.join(' and '));
    }
  }, [speak]);

  const handleTryAgain = useCallback(() => {
    if (autoRetryTimerRef.current) {
      clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    setShowFeedback(false);
    setProcessingGuard(false);
    resetAttempt();
    setTimeout(() => {
      beginAttempt((currentAttemptNumRef.current || 0) + 1);
    }, 100);
  }, [resetAttempt, beginAttempt, setProcessingGuard]);

  const handleSkip = useCallback(async () => {
    if (autoRetryTimerRef.current) { clearTimeout(autoRetryTimerRef.current); autoRetryTimerRef.current = null; }
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    cancelRecording();
    stopListening();
    setIsListening(false);
    clearTranscriptState();
    setShowFeedback(false);
    setProcessingGuard(false);
    await finalizeAttempt('skipped');
    game.skipRound();
  }, [game, cancelRecording, stopListening, clearTranscriptState, finalizeAttempt, setProcessingGuard]);

  const handleContinue = useCallback(() => {
    if (autoRetryTimerRef.current) { clearTimeout(autoRetryTimerRef.current); autoRetryTimerRef.current = null; }
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    clearTranscriptState();
    setShowFeedback(false);
    setProcessingGuard(false);
    resetAttempt();
    game.nextRound();
  }, [game, resetAttempt, clearTranscriptState, setProcessingGuard]);

  // ── Render ─────────────────────────────────────────────────────────

  if (game.isComplete) {
    const totalAttempts = game.strongCount + game.relatedCount + game.creativeCount;
    const strongRatio = totalAttempts > 0 ? game.strongCount / totalAttempts : 0;
    const headline = strongRatio >= 0.5
      ? 'Nice Work!'
      : totalAttempts > 0
      ? 'Session complete'
      : 'Good effort — keep practicing';
    const emoji = strongRatio >= 0.5 ? '🎉' : totalAttempts > 0 ? '✅' : '💪';
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-center space-y-4">
          <div className="text-4xl">{emoji}</div>
          <h2 className="text-2xl font-bold">{headline}</h2>
          <div className="space-y-2 text-sm">
            <p className="text-lg font-semibold">
              Total Score: {game.totalScore} points
            </p>
            <div className="flex justify-center gap-4">
              <Badge className="bg-primary/10 text-primary">
                ✅ Strong: {game.strongCount}
              </Badge>
              <Badge className="bg-secondary text-secondary-foreground">
                🟨 Related: {game.relatedCount}
              </Badge>
              <Badge className="bg-accent text-accent-foreground">
                🟦 Creative: {game.creativeCount}
              </Badge>
            </div>
          </div>
          <Button onClick={game.resetGame} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Play Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { currentPuzzle, currentIndex, totalRounds, lastResult, progress } = game;

  if (!currentPuzzle) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Loading puzzle...</p>
        </CardContent>
      </Card>
    );
  }

  // Build token-level display: dim clue tokens, bold answer candidate
  const renderTranscriptTokens = () => {
    if (!displayTranscript || !currentPuzzle) return null;
    
    const clueSet = new Set<string>();
    for (const clue of currentPuzzle.clues) {
      for (const token of clue.toLowerCase().split(/\s+/)) {
        const clean = token.replace(/[^a-z']/g, '');
        if (clean.length >= 2) {
          clueSet.add(clean);
          clueSet.add(clean + 's');
          const canStripS = clean.length > 3 && clean.endsWith('s') &&
            !clean.endsWith('ss') && !clean.endsWith('us') &&
            !clean.endsWith('is') && !clean.endsWith('as');
          if (canStripS) clueSet.add(clean.slice(0, -1));
        }
      }
    }
    
    // Build answer token set for bolding (with safe plural variants)
    const answerTokens = new Set<string>();
    if (filteredDisplay) {
      for (const t of filteredDisplay.toLowerCase().split(/\s+/)) {
        const c = t.replace(/[^a-z']/g, '');
        if (c.length >= 2) {
          answerTokens.add(c);
          answerTokens.add(c + 's');
          const canStripS = c.length > 3 && c.endsWith('s') &&
            !c.endsWith('ss') && !c.endsWith('us') &&
            !c.endsWith('is') && !c.endsWith('as');
          if (canStripS) answerTokens.add(c.slice(0, -1));
        }
      }
    }
    
    const FILLER_SET = new Set(['um', 'uh', 'umm', 'uhh', 'er', 'erm', 'ah', 'hmm', 'mm', 'like', 'well', 'so', 'okay', 'ok']);
    
    const tokens = displayTranscript.split(/\s+/);
    return (
      <span>
        {tokens.map((token, i) => {
          const clean = token.toLowerCase().replace(/[^a-z']/g, '');
          const isClue = clueSet.has(clean);
          const isFiller = FILLER_SET.has(clean);
          const isAnswer = answerTokens.has(clean);
          
          return (
            <span key={i}>
              {i > 0 && ' '}
              <span className={cn(
                isClue && 'text-muted-foreground/50 line-through',
                isFiller && 'text-muted-foreground/40 italic',
                isAnswer && !isClue && 'font-bold text-primary',
                !isClue && !isFiller && !isAnswer && 'text-foreground'
              )}>
                {token}
              </span>
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-6">
        {/* Purpose banner — first trial only */}
        {currentIndex === 0 && !showFeedback && (
          <ExercisePurposeBanner exerciseSlug="two-clues" />
        )}
        {/* Header */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {currentIndex + 1}/{totalRounds}
          </Badge>
          <AdaptationBadge direction={difficultyChanged} reason={adaptationNarration} />
          <Badge variant="secondary" className="text-xs">
            {game.totalScore} pts
          </Badge>
        </div>

        <Progress value={progress} className="h-1.5" />

        {/* Clue words */}
        <div className="text-center space-y-2 sm:space-y-4">
          <p className="text-base sm:text-lg font-medium text-foreground">What word connects these clues?</p>
          <div className="flex justify-center gap-3 flex-wrap">
            {currentPuzzle.clues.map((clue, i) => (
              <div
                key={i}
                className="px-4 py-3 bg-primary/10 rounded-xl border-2 border-primary/20 text-lg font-medium"
              >
                {clue}
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReadClues}
            className="gap-2 text-muted-foreground"
          >
            <Volume2 className="h-4 w-4" />
            Hear clues
          </Button>
        </div>

        {/* Transcript display */}
        {(isListening || speechIsListening || scoringPhase !== 'idle') && (
          <div className="text-center p-4 bg-muted/50 rounded-lg min-h-[60px] flex flex-col items-center justify-center gap-2">
            {scoringPhase === 'checking' ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Checking answer...</span>
              </div>
            ) : scoringPhase === 'scoring' ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Finding connections...</span>
              </div>
            ) : (
              <>
                <p className="text-lg">
                  {displayTranscript ? (
                    <>
                      <span className="text-sm">Heard: "</span>
                      {renderTranscriptTokens()}
                      <span className="text-sm">"</span>
                      {filteredDisplay && (
                        <span className="block mt-1 text-sm text-muted-foreground">
                          Answer: <span className="font-bold text-foreground">{filteredDisplay}</span>
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground animate-pulse">Listening...</span>
                  )}
                </p>
                {showThinkingHint && !filteredDisplay && (
                  <p className="text-base text-muted-foreground italic animate-in fade-in duration-500">
                    Take your time. What connects these clues?
                  </p>
                )}
                {validationHint && !showFeedback && !filteredDisplay && (
                  <p className="text-sm text-muted-foreground italic animate-in fade-in duration-300">
                    💡 {validationHint}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Cue display */}
        {showCue && currentCueText && !showFeedback && (
          <div className="bg-accent/10 border border-accent p-4 rounded-lg flex items-start gap-3 animate-in fade-in duration-300">
            <Lightbulb className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-base font-medium text-accent-foreground">{currentCueText}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {cueLevel === 1 ? 'Category hint' : cueLevel === 2 ? 'Sound hint' : 'Answer revealed'}
              </p>
            </div>
            {cueLevel < 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRequestHint}
                className="text-xs text-muted-foreground hover:text-accent-foreground"
              >
                More help
              </Button>
            )}
          </div>
        )}

        {/* Hint button (when no cue showing yet) */}
        {!showFeedback && !showCue && isListening && (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRequestHint}
              className="gap-2 text-muted-foreground hover:text-primary"
            >
              <Lightbulb className="w-4 h-4" />
              Need a hint?
            </Button>
          </div>
        )}

        {/* Feedback */}
        {showFeedback && lastResult && (
          <div className={cn(
            "p-5 rounded-xl text-center space-y-3 border-2",
            (lastResult.tier === 'strong' || lastResult.tier === 'related') && 'border-green-500 bg-green-50 dark:bg-green-950/30',
            lastResult.tier === 'creative' && 'border-amber-500 bg-amber-50 dark:bg-amber-950/30',
            lastResult.tier === 'uncertain' && 'border-destructive bg-destructive/10',
          )}>
            {/* Big clear icon */}
            <div className="text-5xl">
              {(lastResult.tier === 'strong' || lastResult.tier === 'related') ? '✅' :
               lastResult.tier === 'creative' ? '🤔' : '❌'}
            </div>
            
            {/* Clear verdict */}
            <p className={cn(
              "text-xl font-bold",
              (lastResult.tier === 'strong' || lastResult.tier === 'related') && 'text-green-700 dark:text-green-400',
              lastResult.tier === 'creative' && 'text-amber-700 dark:text-amber-400',
              lastResult.tier === 'uncertain' && 'text-destructive',
            )}>
              {lastResult.tier === 'strong' ? 'Correct!' : 
               lastResult.tier === 'related' ? 'Correct — great word!' :
               lastResult.tier === 'creative' ? 'Close, but not quite' : 'Not quite right'}
            </p>

            {/* Show matched word for correct answers */}
            {(lastResult.tier === 'strong' || lastResult.tier === 'related') && lastResult.matchedWord && (
              <p className="text-base text-green-600 dark:text-green-300">
                "<span className="font-semibold">{lastResult.matchedWord}</span>" connects the clues!
              </p>
            )}

            {/* Show hint for wrong answers */}
            {lastResult.tier === 'uncertain' && (
              <p className="text-sm text-muted-foreground">
                Think about what word connects all the clues together.
              </p>
            )}
            {lastResult.tier === 'creative' && (
              <p className="text-sm text-muted-foreground">
                Interesting connection! Try to find the main word that fits both clues.
              </p>
            )}

            <p className="text-sm text-muted-foreground">{feedbackMessage}</p>

            <div className="flex justify-center gap-2 pt-2">
              {(lastResult.tier === 'creative' || lastResult.tier === 'uncertain') && (
                <>
                  <Button size="sm" variant="outline" onClick={handleTryAgain} className="gap-1">
                    <Mic className="h-4 w-4" /> Try Again
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleContinue}>
                    Skip →
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleTryAgain} className="text-muted-foreground">
                    ✕ Dismiss
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        {!showFeedback && (
          <div className="flex justify-center gap-3 items-center">
            {isSupported ? (
              <div className="relative">
                {/* Listening pulse ring — matches PhotoNaming */}
                {isListening && (
                  <div className="absolute inset-0 rounded-lg animate-pulse">
                    <div className="absolute inset-0 rounded-lg bg-primary/20 animate-ping" />
                  </div>
                )}
                <Button
                  size="lg"
                  onClick={handleToggleMic}
                  disabled={isProcessing}
                  className={cn(
                    "gap-2 min-w-[140px] relative z-10",
                    isListening && "ring-2 ring-primary/50 ring-offset-2 bg-destructive hover:bg-destructive/90"
                  )}
                >
                  <div className={isListening ? 'animate-pulse' : ''}>
                    {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </div>
                  {isListening ? 'Stop' : 'Speak'}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Speech recognition not supported in this browser
              </p>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={handleSkip}
              disabled={isProcessing}
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Mic recovery button - prominent when mic dies */}
        {!isListening && !isProcessing && !showFeedback && !speechIsListening && isSupported && (
          <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
              Microphone stopped — tap to continue
            </p>
            <Button
              variant="outline"
              size="default"
              onClick={() => beginAttempt((currentAttemptNumRef.current || 0) + 1)}
              className="gap-2 border-amber-300 dark:border-amber-700"
            >
              <Mic className="h-4 w-4" />
              Restart Microphone
            </Button>
          </div>
        )}

        {game.uniqueAnswersThisRound.size >= 3 && !showFeedback && (
          <div className="text-center">
            <Badge className="bg-primary text-primary-foreground">
              🌟 Bonus: {game.uniqueAnswersThisRound.size} unique answers!
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
