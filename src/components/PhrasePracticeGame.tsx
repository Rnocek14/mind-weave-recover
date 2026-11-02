import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Volume2, Mic, MicOff, Lightbulb, RotateCcw, MessageSquare, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useGameSounds } from '@/hooks/useGameSounds';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { LevelBadge } from '@/components/exercise/LevelBadge';
import { usePronunciationAnalysis } from '@/hooks/usePronunciationAnalysis';
import { getCapabilityDifficultyBounds } from '@/lib/difficultyBounds';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePhraseAudio } from '@/hooks/usePhraseAudio';
import { getTrialsForLevel, evaluatePhraseMatch, type PhraseTrial } from '@/data/phraseBank';
import { buildShadowEvent, toUtteranceAnalysis, type UtteranceAnalysis, type ShadowEvent } from '@/types/utteranceAnalysis';
import { classifySpeechError } from '@/lib/errorClassifier';
import { calculateEncouragementScore } from '@/lib/feedbackGenerator';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useProfile } from '@/hooks/useProfile';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { ExercisePurposeBanner } from '@/components/ExercisePurposeBanner';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useShadowEventLogger } from '@/hooks/useShadowEventLogger';
import { buildManualPhraseConfirmation, VISIBLE_PHRASE_CUE_LEVEL } from '@/lib/phrasePractice/manualConfirmation';
import { verifyPhrasePracticeWrites } from '@/lib/phrasePractice/verifyPhrasePracticeWrites';
import { usePhrasePracticeTrainingStage } from '@/hooks/usePhrasePracticeTrainingStage';
import { getPhraseTrainingPrompt } from '@/lib/phrasePractice/trainingStages';
import { PhraseTrainingScriptCard } from '@/components/phrasePractice/PhraseTrainingScriptCard';
import { useNavigate } from 'react-router-dom';

interface PhrasePracticeGameProps {
  totalTrials: number;
  initialDifficulty: number;
  autoListen?: boolean;
  listenDelayMs?: number;
  sessionId?: string | null;
  onTrialComplete?: (data: {
    correct: boolean;
    timeMs: number;
    cueLevel: number;
    difficulty: number;
    phraseId: string;
    wordAccuracy: number | null;
    repetitions: number;
    /** User reported this exercise was done, not verified by speech recognition. */
    manualConfirmed?: boolean;
    trainingStage?: 1 | 2 | 3 | null;
    scriptSupport?: 'visible_script' | 'partial_script' | 'word_clues';
    fullScriptRevealed?: boolean;
    whisperTranscript?: string;
    whisperConfidence?: number;
    encouragementScore?: number;
    effortfulSpeech?: boolean;
    utteranceAnalysis?: UtteranceAnalysis;
    shadowEvent?: ShadowEvent;
    audioStoragePath?: string;
  }) => Promise<boolean | void> | boolean | void;
  onGameComplete?: (finalScore: number, finalLevel: number) => void;
  onDifficultyChange?: (newLevel: number) => void;
}

export interface PhrasePracticeGameHandle {
  /** Mark current phrase as correctly said (manual override) */
  markCorrect: () => void;
  /** Skip current phrase as too hard — lowers difficulty and advances */
  skipTooHard: () => void;
  /** Pause the game (stop mic, freeze state) */
  pause: () => void;
  /** Resume the game (restart mic) */
  resume: () => void;
}

// Debounced mic status - only show "mic paused" after 2s of being off
const useDebouncedMicStatus = (isListening: boolean, delayMs = 2000) => {
  const [showMicPaused, setShowMicPaused] = useState(false);
  
  useEffect(() => {
    if (isListening) {
      setShowMicPaused(false);
      return;
    }
    
    const timer = setTimeout(() => {
      setShowMicPaused(true);
    }, delayMs);
    
    return () => clearTimeout(timer);
  }, [isListening, delayMs]);
  
  return showMicPaused;
};

export const PhrasePracticeGame = forwardRef<PhrasePracticeGameHandle, PhrasePracticeGameProps>(({
  totalTrials,
  initialDifficulty,
  autoListen = true, // Default ON for stroke survivors
  listenDelayMs = 800, // 800ms warmup before mic opens
  sessionId,
  onTrialComplete,
  onGameComplete,
  onDifficultyChange
}, ref) => {
  const { toast } = useToast();
  const { playSuccess, playError } = useGameSounds();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const navigate = useNavigate();
  const isOfflineMode = typeof window !== 'undefined' && localStorage.getItem('offlineMode') === 'true';
  const vg = useVoiceGuidance('phrase-practice');
  const hasSpokenPPIntroRef = useRef(false);
  const stallTimerPPRef = useRef<NodeJS.Timeout | null>(null);
  
  const [trials, setTrials] = useState<PhraseTrial[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const pendingTrialWritesRef = useRef<Promise<boolean | void>[]>([]);
  const [saveError, setSaveError] = useState(false);
  const [scriptRevealed, setScriptRevealed] = useState(false);
  const scriptRevealedRef = useRef(false);
  const finalizationRef = useRef(false);
  // The full printed phrase is lexical support on every trial.
  const [cueLevel, setCueLevel] = useState<number>(VISIBLE_PHRASE_CUE_LEVEL); // 1=visual, 2=audio, 3=both
  const [showFeedback, _setShowFeedback] = useState(false);
  const setShowFeedback = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    _setShowFeedback(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      showFeedbackRef.current = next;
      return next;
    });
  }, []);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [manualConfirmationFeedback, setManualConfirmationFeedback] = useState(false);
  const [trialStartTime, setTrialStartTime] = useState<number>(0);
  const [sessionStartTime] = useState<number>(Date.now()); // For session duration tracking
  const [attempts, setAttempts] = useState(0);
  const [isListeningMode, setIsListeningMode] = useState(true);
  const [currentWordAccuracy, setCurrentWordAccuracy] = useState(0);
  const [voicePreference, setVoicePreference] = useState<string>('alloy');
  const [lastHeardText, setLastHeardText] = useState<string>('');
  const [processingAnswer, setProcessingAnswer] = useState(false);
  const [showRecoveryActions, setShowRecoveryActions] = useState(false);
  
  // Ref to prevent duplicate processing
  const processingResultRef = useRef(false);
  const showFeedbackRef = useRef(false);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveStallCountRef = useRef(0);
  const currentAttemptIdRef = useRef<string | null>(null);
  const currentTrialIndexRef = useRef(0);
  const currentDifficultyRef = useRef(initialDifficulty);
  const manualMicOffRef = useRef(false);
  // Track phrases completed correctly on first/second attempt — never repeat these
  const masteredPhraseIdsRef = useRef<Set<string>>(new Set());
  
  // Shadow Mode: log events for future co-pilot/research (gated by feature flag)
  const { logShadowEvent } = useShadowEventLogger({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId,
    runtimeConfig: activeProfile?.runtime_config as Record<string, any> | null,
  });

  // Auto-create session for standalone games
  const { activeSessionId, isCreatingSession, profileId: standaloneProfileId } = useStandaloneSession(
    user?.id,
    sessionId,
    CANONICAL_SLUGS.PHRASE_PRACTICE
  );
  const training = usePhrasePracticeTrainingStage({
    userId: user?.id,
    profileId: standaloneProfileId || activeProfile?.id,
    offline: isOfflineMode,
  });

  // Session lifecycle - guaranteed cleanup on unmount, pagehide, visibility timeout
  const { completeSession } = useSessionLifecycle({
    sessionId: activeSessionId,
    userId: user?.id,
    profileId: standaloneProfileId || activeProfile?.id,
    exerciseSlug: CANONICAL_SLUGS.PHRASE_PRACTICE,
    getSessionStats: useCallback(() => ({
      score,
      totalTrials: currentTrialIndex + 1,
      startTime: sessionStartTime,
    }), [score, currentTrialIndex, sessionStartTime]),
  });

  // Proper attempt-based utterance logging (no duplicates)
  const { 
    currentAttemptId, 
    isFinalized,
    startAttempt, 
    logBrowserTranscript, 
    logFinalAnalysis, 
    resetAttempt 
  } = useUtteranceLogger();
  
  // Audio recording
  const { 
    isRecording, 
    isSupported: isRecordingSupported,
    startRecording, 
    stopRecording, 
    uploadRecording 
  } = useAudioRecorder();
  
  // Engine emits levels 1..10. The phraseBank selector now centrally maps
  // engine level → content tier (5 motor-graded tiers). Do NOT clamp to 5
  // here — that silently throws away the engine's L6-L10 signal and forces
  // every "hard" user back into tier 5 content.
  const safeInitialDifficulty = useMemo(
    () => Math.max(1, Math.min(training.stage?.engineLevel ?? initialDifficulty, 10)),
    [initialDifficulty, training.stage?.engineLevel]
  );

  // Capability-based difficulty bounds (full 1..10 engine range)
  const bounds = useMemo(() => {
    return getCapabilityDifficultyBounds(CANONICAL_SLUGS.PHRASE_PRACTICE, null);
  }, []);

  // Layer 2: In-Game Adaptation (replaces basic useAdaptiveDifficulty)
  const {
    currentDifficulty,
    levelDescriptor: ppLevelDescriptor,
    recordTrial: recordAdaptiveTrial,
    getCueLevel: getAdaptiveCueLevel,
    frustrationLevel,
    reset: resetAdaptation,
  } = useInGameAdaptation({
    exerciseSlug: CANONICAL_SLUGS.PHRASE_PRACTICE,
    sessionId: activeSessionId,
    initialDifficulty: safeInitialDifficulty,
    bounds,
    windowSize: 5,
    targetSuccessRate: 0.75,
    enableDifficultyAutoStepDown: true,
    enableDifficultyToasts: true,
    enableAutoHints: false,
    onDifficultyChange: (newLevel) => {
      if (import.meta.env.DEV) {
        console.log(`[PhrasePractice] L${currentDifficultyRef.current} → L${newLevel}, reason: adaptive`);
      }
      currentDifficultyRef.current = newLevel;
      onDifficultyChange?.(newLevel);
    },
  });

  // Azure Pronunciation Assessment (shared hook)
  const { analyzePronunciation } = usePronunciationAnalysis();

  // ── Imperative handle for parent bottom-bar buttons ──
  const [isPaused, setIsPaused] = useState(false);

  useImperativeHandle(ref, () => ({
    markCorrect: () => {
      if (showFeedbackRef.current || processingResultRef.current || !currentTrial) return;
      handleManualConfirmation();
    },
    skipTooHard: () => {
      if (showFeedbackRef.current || processingResultRef.current || !currentTrial) return;
      // Record as failed trial, then step down difficulty and advance
      recordAdaptiveTrial({ correct: false, reactionTimeMs: 0 });
      toast({
        title: "No problem!",
        description: "Switching to an easier phrase.",
        duration: 2000,
      });
      handleIncorrectAnswer(lastHeardText || '', { advanceAfterFeedback: true });
    },
    pause: () => {
      manualMicOffRef.current = true;
      setIsPaused(true);
      setIsListeningMode(false);
      if (isListening) stopListening();
    },
    resume: () => {
      manualMicOffRef.current = false;
      setIsPaused(false);
      setIsListeningMode(true); // Re-enables auto-listen effect
    },
  }));
  // Voice guidance: speak intro on first mount
  useEffect(() => {
    if (!hasSpokenPPIntroRef.current && vg.shouldAutoSpeak) {
      hasSpokenPPIntroRef.current = true;
      vg.speakIntro();
    }
  }, [vg.shouldAutoSpeak]);

  const initializedRef = useRef(false);
  useEffect(() => {
    if (!training.loaded || training.loadUnavailable || initializedRef.current) return;
    initializedRef.current = true;

    const newTrials = getTrialsForLevel(safeInitialDifficulty, totalTrials);
    setTrials(newTrials);
    setTrialStartTime(Date.now());
    
    // Load user's voice preference
    const loadVoicePreference = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('accessibility_prefs')
        .eq('user_id', user.id)
        .single();
      
      if (data?.accessibility_prefs) {
        const prefs = data.accessibility_prefs as any;
        const voicePref = prefs?.voicePreference || 'neutral';
        
        const voiceMap = {
          'neutral': 'alloy',
          'male': 'onyx',
          'female': 'nova'
        };
        setVoicePreference(voiceMap[voicePref as keyof typeof voiceMap] || 'alloy');
      }
    };
    
    loadVoicePreference();
  }, [initialDifficulty, totalTrials, user, training.loaded, training.loadUnavailable, safeInitialDifficulty]);

  const currentTrial = trials[currentTrialIndex] || null;

  // Enqueue the event as soon as speech/tap outcome is observed. The separate
  // audio analyzer is deliberately not allowed to delay clinical raw inserts.
  const recordTrialForCompletion = (data: Parameters<NonNullable<PhrasePracticeGameProps['onTrialComplete']>>[0]) => {
    if (!onTrialComplete) return;
    try {
      const script = currentTrial
        ? getPhraseTrainingPrompt(currentTrial, training.stage, scriptRevealedRef.current)
        : null;
      pendingTrialWritesRef.current.push(
        Promise.resolve(onTrialComplete({
          ...data,
          trainingStage: training.stage?.level ?? null,
          scriptSupport: script?.evidenceSupport ?? 'visible_script',
          fullScriptRevealed: script?.fullPhraseRevealed ?? true,
        })).catch((error) => {
          console.warn('[PhrasePractice] Raw trial failed:', error);
          return false;
        }),
      );
    } catch (error) {
      console.warn('[PhrasePractice] Raw trial threw:', error);
      pendingTrialWritesRef.current.push(Promise.resolve(false));
    }
  };

  useEffect(() => {
    currentAttemptIdRef.current = currentAttemptId;
  }, [currentAttemptId]);

  useEffect(() => {
    currentTrialIndexRef.current = currentTrialIndex;
  }, [currentTrialIndex]);

  useEffect(() => {
    currentDifficultyRef.current = currentDifficulty;
  }, [currentDifficulty]);

  // Start attempt and recording when trial becomes active
  useEffect(() => {
    if (currentTrial && !showFeedback && activeSessionId && user?.id) {
      // Start a new attempt for utterance logging
      startAttempt({
        sessionId: activeSessionId,
        userId: user.id,
        exerciseSlug: CANONICAL_SLUGS.PHRASE_PRACTICE,
        trialIndex: currentTrialIndex + 1,
        attemptNumber: attempts + 1,
        targetWord: currentTrial.phrase,
        category: currentTrial.category
      });
      
      // Start audio recording if supported
      if (isRecordingSupported) {
        startRecording();
        console.log('🎙️ Recording started for phrase practice');
      }
    }
  }, [currentTrial?.id, showFeedback, activeSessionId, user?.id]);

  // Unmount cleanup - log abandoned trials
  useEffect(() => {
    return () => {
      if (currentAttemptId && !isFinalized && currentTrial) {
        console.log('⚠️ Unmount with active attempt - logging as abandoned');
        logFinalAnalysis({
          transcriptSource: 'browser',
          isCorrect: false,
          errorType: 'abandoned',
        });
      }
    };
  }, [currentAttemptId, isFinalized, currentTrial, logFinalAnalysis]);

  // Guard: ignore speech results briefly after trial transitions
  const trialTransitionRef = useRef(false);

  const MAX_ATTEMPTS_BEFORE_SKIP = 5;

  const handleSpeechResult = (transcript: string) => {
    // Use refs for guards to avoid stale-closure issues with the speech hook's onResultRef
    if (!currentTrial || showFeedbackRef.current || processingResultRef.current) {
      console.log('🎤 handleSpeechResult blocked:', {
        noTrial: !currentTrial,
        showFeedback: showFeedbackRef.current,
        processing: processingResultRef.current,
        transition: trialTransitionRef.current,
      });
      return;
    }
    // Ignore stale results right after a trial transition
    if (trialTransitionRef.current) return;

    console.log('Speech recognized:', transcript);
    setLastHeardText(transcript);
    
    // Log browser transcript (interim - no duplicates)
    logBrowserTranscript(transcript);
    
    // Require minimum transcript length to avoid noise triggers
    const trimmed = transcript.trim();
    if (trimmed.length < 2) return;
    
    const evaluation = evaluatePhraseMatch(transcript, currentTrial);
    setCurrentWordAccuracy(evaluation.wordAccuracy);
    
    if (evaluation.match) {
      handleCorrectAnswer(evaluation.wordAccuracy, transcript);
    } else if (evaluation.wordAccuracy > 0.3) {
      const newAttempts = attempts + 1;
      // After max attempts with partial matches, auto-advance with encouragement
      if (newAttempts >= MAX_ATTEMPTS_BEFORE_SKIP) {
        toast({
          title: "Good effort! 💪",
          description: "Let's move on to the next phrase.",
          duration: 2500,
        });
        // This was NOT a target match; preserve the attempt and move on
        // without awarding independent naming or speech-mastery credit.
        handleIncorrectAnswer(transcript, { advanceAfterFeedback: true });
      } else {
        setAttempts(newAttempts);
        toast({
          title: "Almost there!",
          description: `You got ${Math.round(evaluation.wordAccuracy * 100)}% of the words. Try again.`,
        });
      }
    }
    // Low match (<= 30%) — do nothing, let user keep trying
    // instead of auto-advancing on noise/stale transcripts
  };

  const { isListening, transcript, startListening, stopListening, isSupported, error } = 
    useSpeechRecognition({
      onResult: handleSpeechResult,
      autoStart: false,
      continuousListening: true,
      patientMode: true,
      discourseMode: true,
    });

  // Safety valve: if processingResultRef is stuck for >4s, reset it
  useEffect(() => {
    if (!processingResultRef.current) return;
    const safety = setTimeout(() => {
      if (processingResultRef.current) {
        console.warn('⚠️ processingResultRef stuck - force resetting');
        processingResultRef.current = false;
      }
    }, 4000);
    return () => clearTimeout(safety);
  }, [showFeedback, currentTrialIndex]);

  useEffect(() => {
    if (transcript || lastHeardText) {
      consecutiveStallCountRef.current = 0;
      setShowRecoveryActions(false);
    }
  }, [transcript, lastHeardText]);

  useEffect(() => {
    if (error && !showFeedback) {
      setShowRecoveryActions(true);
    }
  }, [error, showFeedback]);
  
  // Debounce mic status to prevent flickering during auto-restart cycles
  const showMicPausedHint = useDebouncedMicStatus(isListening, 2000);
  
  // Bulletproof audio playback (declare before useEffect that uses it)
  const { playPhrase, isPlaying: isAudioPlaying, lastError: audioError } = usePhraseAudio();
  
  // AUTO-LISTEN MODE: Open mic automatically on new trial
  // Gated by isListeningMode — user can toggle it off manually
  useEffect(() => {
    if (!autoListen || !isListeningMode || !currentTrial || showFeedback) return;
    
    // Don't compete with audio playback
    if (isAudioPlaying) return;
    
    // Don't restart if already listening
    if (isListening) return;
    
    const timer = setTimeout(() => {
      if (isSupported && !isListening && isListeningMode) {
        console.log('[Auto-Listen] Starting mic after warmup delay');
        startListening();
      }
    }, listenDelayMs);
    
    return () => {
      clearTimeout(timer);
    };
  }, [autoListen, isListeningMode, listenDelayMs, currentTrial, showFeedback, isAudioPlaying, isListening, isSupported, startListening]);

  // Toggle listening — also controls auto-listen mode
  const toggleListening = () => {
    if (isListening) {
      manualMicOffRef.current = true;
      setIsListeningMode(false); // Disable auto-restart
      stopListening();
    } else {
      manualMicOffRef.current = false;
      setIsListeningMode(true); // Re-enable auto-listen
      startListening();
    }
  };
  
  const handlePlayAudio = async () => {
    if (!currentTrial || isAudioPlaying) return;
    
    // Stop listening while audio plays to prevent it from hearing the playback
    if (isListening) stopListening();
    
    await playPhrase(currentTrial.phrase, { voice: voicePreference });
    setCueLevel(prev => Math.max(prev, 2)); // Mark that audio cue was used
    
    // Re-open mic after audio finishes (if auto-listen enabled)
    // Use longer delay to avoid picking up audio tail
    if (autoListen && isSupported) {
      setTimeout(() => {
        if (manualMicOffRef.current) return;
        if (!isListening && !showFeedback && !processingResultRef.current && isListeningMode) {
          console.log('[Auto-Listen] Restarting mic after audio playback');
          startListening();
        }
      }, 1200);
    }
  };

  // Stage 1: a modeled phrase, using the existing mic/TTS interlock.
  // Reading after the model is supported practice, not independent speech.
  const modeledPhraseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!training.stage?.autoModel || !training.loaded || !currentTrial ||
        (!activeSessionId && !isOfflineMode) || saveError) return;
    if (modeledPhraseRef.current === currentTrial.id) return;
    modeledPhraseRef.current = currentTrial.id;
    void handlePlayAudio().catch(err =>
      console.warn('[PhrasePractice] full model unavailable; Hear It remains available', err),
    );
    // The model is tied to a trial id, not ephemeral audio status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training.stage?.autoModel, training.loaded, currentTrial?.id, activeSessionId, isOfflineMode, saveError]);

  const revealWholePhrase = () => {
    scriptRevealedRef.current = true;
    setScriptRevealed(true);
    // Do not fabricate an audio cue; track exact visual help per trial.
  };

  // Show visual cue
  const handleShowCue = () => {
    setCueLevel(prev => {
      if (prev === 0) return 1; // First time: show text
      if (prev === 1) return 3; // Second time: show text + play audio
      return 3;
    });
    
    if (cueLevel === 1) {
      handlePlayAudio(); // Auto-play audio on second cue request
    }
    
    toast({
      title: "Hint",
      description: cueLevel === 0 
        ? "Try saying the phrase shown above" 
        : "Listen to how it sounds",
      duration: 3000,
    });
  };

  /** User confirmation counts as practice, never as ASR-matched speech. */
  const handleManualConfirmation = () => {
    if (processingResultRef.current || showFeedbackRef.current || !currentTrial) return;
    processingResultRef.current = true;
    const trial = currentTrial;
    setManualConfirmationFeedback(true);
    setFeedbackCorrect(true);
    setShowFeedback(true);
    if (isListening) stopListening();
    if (isRecording) {
      void stopRecording().catch(err =>
        console.warn('[PhrasePractice] Stopping recording after manual confirmation failed', err),
      );
    }
    // No fabricated transcript, phoneme scores, adaptation success, or learned
    // phrase suppression. Explicit manual source enables a clinician to tell.
    void logFinalAnalysis({
      transcriptSource: 'manual',
      isCorrect: null,
      errorType: 'manual_confirmed',
      reasoning: 'User confirmed practice. Speech accuracy was not automatically assessed.',
      fluencyAvailable: false,
      fluencyUnavailableReason: 'no_recording',
    });
    recordTrialForCompletion(buildManualPhraseConfirmation({
      phraseId: trial.id,
      difficulty: currentDifficulty,
      cueLevel,
      timeMs: Date.now() - trialStartTime,
      attempts,
    }));
    setTimeout(() => nextTrial(), 1200);
  };

  const handleCorrectAnswer = async (wordAccuracy: number, spokenTranscript: string) => {
    // Prevent duplicate processing
    if (processingResultRef.current) return;
    processingResultRef.current = true;
    setManualConfirmationFeedback(false);
    
    const reactionTime = Date.now() - trialStartTime;
    const trialData = currentTrial!;
    const trialIdx = currentTrialIndex;
    const currentCueLevel = cueLevel;
    const currentDiff = currentDifficulty;
    const attemptCount = attempts;
    const attemptIdAtStart = currentAttemptIdRef.current;
    
    // ===== INSTANT FEEDBACK (< 100ms) =====
    playSuccess();
    scoreRef.current += 100;
    setScore(scoreRef.current);
    setFeedbackCorrect(true);
    // Mark phrase as mastered if answered correctly within 2 attempts — don't repeat it
    if (attemptCount <= 2 && trialData.id) {
      masteredPhraseIdsRef.current.add(trialData.id);
    }
    setShowFeedback(true);
    setProcessingAnswer(true);
    
    // Stop listening immediately
    if (isListening) stopListening();
    
    // Update adaptive difficulty tracking (fast, local)
    recordAdaptiveTrial({ correct: true, reactionTimeMs: reactionTime });
    recordTrialForCompletion({
      correct: true,
      timeMs: reactionTime,
      cueLevel: currentCueLevel,
      difficulty: currentDiff,
      phraseId: trialData.id,
      wordAccuracy,
      repetitions: attemptCount + 1,
      whisperTranscript: spokenTranscript,
      effortfulSpeech: false,
    });
    
    // ===== BACKGROUND ANALYSIS (fire-and-forget) =====
    const runBackgroundAnalysis = async () => {
      try {
        // Stop recording and upload audio
        let uploadedPath: string | undefined;
        let duration: number | undefined;
        let pronunciationData: any = null;
        
        if (isRecording && user && activeSessionId) {
          const recordingResult = await stopRecording();
          if (recordingResult) {
            duration = recordingResult.duration;
            
            // Run upload and Azure pronunciation in parallel
            // referenceText = full target phrase (not a single word)
            const [path, pronResult] = await Promise.all([
              uploadRecording(
                recordingResult.audioBlob,
                user.id,
                activeSessionId,
                trialIdx + 1,
                recordingResult.mimeType
              ),
              analyzePronunciation(recordingResult.audioBlob, trialData.phrase).catch((err: any) => {
                console.warn('[PhrasePractice] Pronunciation analysis failed (non-blocking):', err);
                return null;
              }),
            ]);
            
            if (path) uploadedPath = path;
            if (pronResult?.ok) {
              pronunciationData = pronResult.data;
              console.log('[PhrasePractice] Pronunciation scores:', {
                pronunciation: pronResult.data.pronunciationScore,
                accuracy: pronResult.data.accuracyScore,
                fluency: pronResult.data.fluencyScore,
              });
            }
          }
        }
        
        // Build UtteranceAnalysis for phrase practice
        const errorClassification = await classifySpeechError(
          spokenTranscript || trialData.phrase,
          trialData.phrase,
          0.9,
          { 
            trialNumber: trialIdx + 1,
            previousErrors: [],
            category: trialData.category 
          }
        );
        
        const encouragementScore = calculateEncouragementScore(errorClassification.errorType);
        
        const utteranceAnalysis: UtteranceAnalysis = {
          transcript: spokenTranscript || trialData.phrase,
          asrConfidence: errorClassification.confidence,
          errorType: 'correct',
          meaningAccuracy: wordAccuracy,
          semanticSimilarity: errorClassification.semantic_similarity,
          phonologicalSimilarity: errorClassification.phonological_similarity,
          phonemeAccuracy: errorClassification.phonemeAccuracy,
          encouragementScore,
          encouragementLevel: errorClassification.errorType === 'correct' ? 'excellent' : 'good',
          reasoning: `Phrase match: ${Math.round(wordAccuracy * 100)}% word accuracy`,
        };
        
        const shadowEvent: ShadowEvent | undefined = user?.id ? buildShadowEvent(
          user.id,
          activeSessionId,
          {
            taskType: 'phrase_practice',
            domain: trialData.category as any,
            cueLevel: currentCueLevel, // target phrase was visible, never uncued
            targetPhrase: trialData.phrase,
          },
          utteranceAnalysis
        ) : undefined;
        
        // Persist shadow event (fire-and-forget, gated by feature flag)
        if (shadowEvent) {
          logShadowEvent(shadowEvent, undefined, {
            cueTypeCandidate: currentCueLevel > 0 ? 'visual' : undefined,
            triggerReason: currentCueLevel > 0 ? 'cue_level_active' : undefined,
            userSelfRecovered: false,
            environment: 'structured',
          });
        }

        // Raw trial was already submitted before background analysis.

        // Log final analysis to utterance_analyses (TERMINAL OUTCOME: correct)
        // Include gopData + alignmentData for word/phoneme-level analysis
        if (attemptIdAtStart && currentAttemptIdRef.current !== attemptIdAtStart) {
          console.warn('[PhrasePractice] Skipping stale correct analysis write');
          return;
        }

        logFinalAnalysis({
          transcript: spokenTranscript,
          transcriptSource: 'browser',
          isCorrect: true,
          errorType: 'correct',
          phonologicalSimilarity: errorClassification.phonological_similarity,
          semanticSimilarity: errorClassification.semantic_similarity,
          classificationConfidence: errorClassification.confidence,
          reasoning: `Phrase match: ${Math.round(wordAccuracy * 100)}% word accuracy`,
          audioStoragePath: uploadedPath,
          recordingDurationMs: duration,
          // Azure pronunciation metrics + full gopData
          ...(pronunciationData ? {
            pronunciationScore: pronunciationData.pronunciationScore,
            accuracyScore: pronunciationData.accuracyScore,
            fluencyScore: pronunciationData.fluencyScore,
            completenessScore: pronunciationData.completenessScore,
            prosodyScore: pronunciationData.prosodyScore,
            gopData: pronunciationData,
            alignmentData: pronunciationData.alignmentData,
          } : {}),
        });
      } catch (err) {
        console.error('Background analysis error:', err);
      } finally {
        setProcessingAnswer(false);
      }
    };
    
    // Fire and forget - don't block UI
    runBackgroundAnalysis();

    // Auto-advance after brief feedback display
    setTimeout(() => {
      nextTrial();
    }, 1200);
  };

  const handleIncorrectAnswer = async (
    spokenTranscript: string,
    options?: { advanceAfterFeedback?: boolean }
  ) => {
    // Prevent duplicate processing
    if (processingResultRef.current) return;
    processingResultRef.current = true;
    setManualConfirmationFeedback(false);
    setShowRecoveryActions(false);
    consecutiveStallCountRef.current = 0;
    
    const reactionTime = Date.now() - trialStartTime;
    const trialData = currentTrial!;
    const currentCueLevel = cueLevel;
    const currentDiff = currentDifficulty;
    const attemptCount = attempts;
    const currentAccuracy = currentWordAccuracy;
    const attemptIdAtStart = currentAttemptIdRef.current;

    const trialIdx = currentTrialIndex;
    const capturedPhrase = currentTrial?.phrase || '';
    
    // ===== INSTANT FEEDBACK (< 100ms) =====
    playError();
    setFeedbackCorrect(false);
    setShowFeedback(true);
    setAttempts(prev => prev + 1);
    setProcessingAnswer(true);
    
    if (isListening) stopListening();
    
    // Update adaptive difficulty tracking (fast, local)
    recordAdaptiveTrial({ correct: false });

    recordTrialForCompletion({
      correct: false,
      timeMs: reactionTime,
      cueLevel: currentCueLevel,
      difficulty: currentDiff,
      phraseId: trialData.id,
      wordAccuracy: currentAccuracy,
      repetitions: attemptCount + 1,
      whisperTranscript: spokenTranscript || undefined,
      encouragementScore: calculateEncouragementScore('unrelated'),
      effortfulSpeech: false,
    });
    
    // ===== BACKGROUND ANALYSIS (fire-and-forget) =====
    const runBackgroundAnalysis = async () => {
      try {
        // Stop recording and upload audio
        let uploadedPath: string | undefined;
        let duration: number | undefined;
        let pronunciationData: any = null;
        
        if (isRecording && user && activeSessionId) {
          const recordingResult = await stopRecording();
          if (recordingResult) {
            duration = recordingResult.duration;
            
            const [path, pronResult] = await Promise.all([
              uploadRecording(
                recordingResult.audioBlob,
                user.id,
                activeSessionId,
                trialIdx + 1,
                recordingResult.mimeType
              ),
              analyzePronunciation(recordingResult.audioBlob, capturedPhrase).catch(() => null),
            ]);
            
            if (path) uploadedPath = path;
            if (pronResult?.ok) pronunciationData = pronResult.data;
          }
        }
        
        // Log final analysis (TERMINAL OUTCOME: incorrect)
        if (attemptIdAtStart && currentAttemptIdRef.current !== attemptIdAtStart) {
          console.warn('[PhrasePractice] Skipping stale incorrect analysis write');
          return;
        }

        logFinalAnalysis({
          transcript: spokenTranscript,
          transcriptSource: 'browser',
          isCorrect: false,
          errorType: 'incorrect',
          audioStoragePath: uploadedPath,
          recordingDurationMs: duration,
          ...(pronunciationData ? {
            pronunciationScore: pronunciationData.pronunciationScore,
            accuracyScore: pronunciationData.accuracyScore,
            fluencyScore: pronunciationData.fluencyScore,
            completenessScore: pronunciationData.completenessScore,
            prosodyScore: pronunciationData.prosodyScore,
            gopData: pronunciationData,
            alignmentData: pronunciationData.alignmentData,
          } : {}),
        });
      } catch (err) {
        console.error('Background analysis error:', err);
      } finally {
        setProcessingAnswer(false);
      }
    };
    
    // Fire and forget
    runBackgroundAnalysis();
    
    setTimeout(() => {
      if (options?.advanceAfterFeedback) {
        nextTrial();
        return;
      }

      setShowFeedback(false);
      processingResultRef.current = false;
      setProcessingAnswer(false);
    }, 1200);
  };

  const handleRestartListening = () => {
    manualMicOffRef.current = false;
    setShowRecoveryActions(false);
    consecutiveStallCountRef.current = 0;
    setIsListeningMode(true); // Re-enable auto-listen

    if (isListening) {
      stopListening();
      setTimeout(() => {
        if (manualMicOffRef.current) return;
        setIsListeningMode(true);
        startListening();
      }, 400);
      return;
    }

    startListening();
  };

  const handleMoveOn = () => {
    toast({
      title: 'Moving on',
      description: 'You can come back to this phrase later.',
      duration: 2000,
    });
    handleIncorrectAnswer(lastHeardText || transcript || '', { advanceAfterFeedback: true });
  };

  useEffect(() => {
    if (!currentTrial || showFeedback || processingAnswer) {
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
      return;
    }

    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
    }

    const recoveryDelayMs = isListening ? 12000 : 5000;

    recoveryTimerRef.current = setTimeout(() => {
      if (showFeedback || processingResultRef.current || manualMicOffRef.current) return;

      const nextStallCount = consecutiveStallCountRef.current + 1;
      consecutiveStallCountRef.current = nextStallCount;

      if (nextStallCount >= 3) {
        toast({
          title: "Let\u2019s keep going",
          description: 'Moving to the next phrase for now.',
          duration: 2500,
        });
        handleIncorrectAnswer(lastHeardText || transcript || '', { advanceAfterFeedback: true });
      }
    }, recoveryDelayMs);

    return () => {
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };
  }, [currentTrial?.id, isListening, transcript, lastHeardText, showFeedback, processingAnswer, startListening, stopListening, toast]);

  const nextTrial = () => {
    // Stop mic during transition to prevent stale transcripts
    if (isListening) stopListening();
    trialTransitionRef.current = true;
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    setShowRecoveryActions(false);
    consecutiveStallCountRef.current = 0;

    // Reset attempt for next trial
    resetAttempt();
    processingResultRef.current = false;
    
    const currentIndex = currentTrialIndexRef.current;

    if (currentIndex + 1 >= trials.length) {
      if (finalizationRef.current) return;
      finalizationRef.current = true;
      void (async () => {
        const result = await verifyPhrasePracticeWrites(
          pendingTrialWritesRef.current,
          totalTrials,
          Boolean(onTrialComplete),
        );
        if (!result.ok) {
          setSaveError(true);
          console.warn('[PhrasePractice] Completion withheld:', 'reason' in result ? result.reason : 'Raw attempt save failed');
          toast({
            title: 'Practice not fully saved',
            description: 'Please ask a care partner for help. Results are not marked complete.',
            variant: 'destructive',
          });
          return;
        }
        await completeSession();
        onGameComplete?.(scoreRef.current, currentDifficultyRef.current);
      })().catch((error) => {
        setSaveError(true);
        console.error('[PhrasePractice] Completion failed:', error);
      });
      return;
    }

    const remainingTrials = totalTrials - currentIndex - 1;
    if (remainingTrials > 0) {
      const regeneratedTrials = getTrialsForLevel(
        training.stage?.engineLevel ?? currentDifficultyRef.current,
        remainingTrials + 5,
      );
      // Exclude current phrase AND any phrases the user already mastered
      const mastered = masteredPhraseIdsRef.current;
      const filteredTrials = regeneratedTrials.filter(trial =>
        trial.id !== currentTrial?.id && !mastered.has(trial.id)
      );
      const nextTrials = (filteredTrials.length >= remainingTrials ? filteredTrials : regeneratedTrials)
        .slice(0, remainingTrials);

      setTrials(prev => [...prev.slice(0, currentIndex + 1), ...nextTrials]);
    }

    setCurrentTrialIndex(prev => prev + 1);
    setShowFeedback(false);
    setManualConfirmationFeedback(false);
    setCueLevel(VISIBLE_PHRASE_CUE_LEVEL);
    scriptRevealedRef.current = false;
    setScriptRevealed(false);
    setAttempts(0);
    setCurrentWordAccuracy(0);
    setLastHeardText('');
    setProcessingAnswer(false);
    setTrialStartTime(Date.now());
    // Re-enable auto-listen for the new trial
    manualMicOffRef.current = false;
    setIsListeningMode(true);

    // Allow speech results again after a short delay
    setTimeout(() => {
      trialTransitionRef.current = false;
    }, 800);
  };

  const reset = () => {
    setCurrentTrialIndex(0);
    scoreRef.current = 0;
    pendingTrialWritesRef.current = [];
    finalizationRef.current = false;
    setSaveError(false);
    setScore(0);
    setCueLevel(VISIBLE_PHRASE_CUE_LEVEL);
    scriptRevealedRef.current = false;
    setScriptRevealed(false);
    setAttempts(0);
    setShowFeedback(false);
    setManualConfirmationFeedback(false);
    setLastHeardText('');
    setProcessingAnswer(false);
    setShowRecoveryActions(false);
    processingResultRef.current = false;
    consecutiveStallCountRef.current = 0;
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    modeledPhraseRef.current = null;
    const newTrials = getTrialsForLevel(safeInitialDifficulty, totalTrials);
    setTrials(newTrials);
    setTrialStartTime(Date.now());
  };

  if (!training.loaded || isCreatingSession) {
    return (
      <Card role="status" className="w-full max-w-2xl mx-auto p-8 text-center">
        Preparing your phrase practice…
      </Card>
    );
  }
  if (training.loadUnavailable) {
    return (
      <Card role="alert" className="w-full max-w-2xl mx-auto p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold">Practice level unavailable</h2>
        <p>We couldn't load your saved practice level. Please ask a care partner for help.</p>
        <Button size="lg" onClick={() => navigate('/today')}>Return to Today</Button>
      </Card>
    );
  }
  if (!currentTrial) {
    return (
      <Card className="w-full max-w-2xl mx-auto p-8 text-center">
        <p className="text-muted-foreground mb-4">Loading phrases...</p>
      </Card>
    );
  }

  const progress = ((currentTrialIndex + 1) / trials.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-20">
      {/* Purpose banner — first trial only */}
      {currentTrialIndex === 0 && !showFeedback && (
        <ExercisePurposeBanner exerciseSlug="phrase-practice" />
      )}
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-lg px-4 py-2">
            <MessageSquare className="w-4 h-4 mr-2" />
            Phrase {currentTrialIndex + 1} / {trials.length}
          </Badge>
          <LevelBadge descriptor={ppLevelDescriptor} />
        </div>
        <div className="text-2xl font-bold text-primary">
          {score} pts
        </div>
      </div>

      {saveError && (
        <Card role="alert" className="p-4 border-destructive">
          Your practice ended, but some attempts were not saved. Please ask a care partner for help.
        </Card>
      )}

      {/* Progress Bar */}
      <Progress value={progress} className="h-3" />

      {!training.stage && training.persistedLevel != null && (
        <div role="status" className="rounded-lg border p-3 text-sm">
          Your saved level is {training.persistedLevel}. Higher-stage script
          tasks are still being developed. You can continue general phrase
          practice without changing your saved level.
        </div>
      )}

      {/* Main Phrase Card */}
      <Card className="p-8 text-center space-y-6">
        <PhraseTrainingScriptCard
          trial={currentTrial}
          trainingStage={training.stage}
          revealed={scriptRevealed}
          onReveal={revealWholePhrase}
        />

        {/* Speech Recognition Status */}
        {(
          <div className="flex flex-col items-center gap-3 py-4">
            {autoListen && isListeningMode && (
              <p className="text-sm text-muted-foreground">
                🎤 Auto-listen enabled - speak when ready
              </p>
            )}
            <Button
              size="lg"
              variant={isListening ? "destructive" : "default"}
              onClick={toggleListening}
              className="w-48 h-16 text-lg"
            >
              {isListening ? (
                <>
                  <MicOff className="w-6 h-6 mr-2" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6 mr-2" />
                  {autoListen ? 'Restart Mic' : 'Start Speaking'}
                </>
              )}
            </Button>
            
            {isListening && !processingAnswer && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                Listening...
              </div>
            )}
            
            {/* Mic stopped indicator with recovery hint - debounced to prevent flickering */}
            {showMicPausedHint && !showFeedback && !isAudioPlaying && !processingAnswer && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 animate-fade-in">
                <MicOff className="w-4 h-4" />
                Mic paused – tap above to restart
              </div>
            )}
            
            {processingAnswer && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing your answer...
              </div>
            )}
            
            {lastHeardText && !processingAnswer && (
              <div className="text-sm text-muted-foreground mt-2">
                You said: "{lastHeardText}"
              </div>
            )}

            {currentWordAccuracy > 0 && currentWordAccuracy < 0.8 && !showFeedback && (
              <div className="text-sm text-amber-600 dark:text-amber-400">
                {Math.round(currentWordAccuracy * 100)}% correct - keep trying!
              </div>
            )}
          </div>
        )}

        {/* Hint Buttons */}
        <div className="flex gap-3 justify-center flex-wrap">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePlayAudio}
            disabled={isAudioPlaying}
          >
            <Volume2 className="w-5 h-5 mr-2" />
            {isAudioPlaying ? 'Playing...' : 'Hear It'}
          </Button>
          
          {audioError && (
            <p className="text-sm text-muted-foreground">
              Audio unavailable - read and speak the phrase
            </p>
          )}
        </div>
      </Card>

      {/* Attempts Counter */}
      {attempts > 0 && (
        <div className="text-sm text-muted-foreground">
          Attempts: {attempts + 1}
        </div>
      )}


      {/* Feedback */}
      {showFeedback && (
        <Card className={`p-6 text-center ${manualConfirmationFeedback ? 'bg-muted/40 border-border' : feedbackCorrect ? 'bg-green-50 dark:bg-green-950/20 border-green-500' : 'bg-red-50 dark:bg-red-950/20 border-red-500'}`}>
          <div className="text-2xl font-bold mb-2">
            {manualConfirmationFeedback ? 'Practice noted' : feedbackCorrect ? '✓ Excellent!' : '✗ Try Again'}
          </div>
          <div className="text-sm text-muted-foreground">
            {manualConfirmationFeedback
              ? 'You confirmed the phrase. Speech accuracy was not checked.'
              : feedbackCorrect
                ? `Great job! ${currentWordAccuracy >= 0.95 ? 'Perfect!' : 'Well done!'}`
                : 'Keep practicing - you can do it!'}
          </div>
        </Card>
      )}

      {/* Instructions */}
      {!isSupported && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-500">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.
          </p>
        </Card>
      )}

      {error && (
        <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-500">
          <p className="text-sm text-red-800 dark:text-red-200">
            {error}
          </p>
        </Card>
      )}
    </div>
  );
});

PhrasePracticeGame.displayName = 'PhrasePracticeGame';
