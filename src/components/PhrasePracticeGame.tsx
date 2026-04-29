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
    wordAccuracy: number;
    repetitions: number;
    whisperTranscript?: string;
    whisperConfidence?: number;
    encouragementScore?: number;
    effortfulSpeech?: boolean;
    utteranceAnalysis?: UtteranceAnalysis;
    shadowEvent?: ShadowEvent;
    audioStoragePath?: string;
  }) => void;
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
  const vg = useVoiceGuidance('phrase-practice');
  const hasSpokenPPIntroRef = useRef(false);
  const stallTimerPPRef = useRef<NodeJS.Timeout | null>(null);
  
  const [trials, setTrials] = useState<PhraseTrial[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [cueLevel, setCueLevel] = useState(1); // Start with phrase visible for better UX // 0=none, 1=visual, 2=audio, 3=both
  const [showFeedback, _setShowFeedback] = useState(false);
  const setShowFeedback = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    _setShowFeedback(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      showFeedbackRef.current = next;
      return next;
    });
  }, []);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
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
  
  const safeInitialDifficulty = useMemo(
    () => Math.max(1, Math.min(initialDifficulty, 5)),
    [initialDifficulty]
  );

  // Capability-based difficulty bounds
  const bounds = useMemo(() => {
    const baseBounds = getCapabilityDifficultyBounds(CANONICAL_SLUGS.PHRASE_PRACTICE, null);
    return {
      ...baseBounds,
      suggestedStart: Math.max(1, Math.min(baseBounds.suggestedStart, 5)),
      ceiling: Math.min(baseBounds.ceiling, 5),
    };
  }, []);

  // Layer 2: In-Game Adaptation (replaces basic useAdaptiveDifficulty)
  const {
    currentDifficulty,
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
      handleCorrectAnswer(1.0, currentTrial.phrase);
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
    if (initializedRef.current) return;
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
  }, [initialDifficulty, totalTrials, user]);

  const currentTrial = trials[currentTrialIndex] || null;

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
      setAttempts(newAttempts);
      
      // After max attempts with partial matches, auto-advance with encouragement
      if (newAttempts >= MAX_ATTEMPTS_BEFORE_SKIP) {
        toast({
          title: "Good effort! 💪",
          description: "Let's move on to the next phrase.",
          duration: 2500,
        });
        // Treat as a partial-credit correct to advance
        handleCorrectAnswer(evaluation.wordAccuracy, transcript);
      } else {
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

  const handleCorrectAnswer = async (wordAccuracy: number, spokenTranscript: string) => {
    // Prevent duplicate processing
    if (processingResultRef.current) return;
    processingResultRef.current = true;
    
    const reactionTime = Date.now() - trialStartTime;
    const trialData = currentTrial!;
    const trialIdx = currentTrialIndex;
    const currentCueLevel = cueLevel;
    const currentDiff = currentDifficulty;
    const attemptCount = attempts;
    const attemptIdAtStart = currentAttemptIdRef.current;
    
    // ===== INSTANT FEEDBACK (< 100ms) =====
    playSuccess();
    setScore(prev => prev + 100);
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
            interactionMode: 'independent',
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

        // Log trial
        onTrialComplete?.({
          correct: true,
          timeMs: reactionTime,
          cueLevel: currentCueLevel,
          difficulty: currentDiff,
          phraseId: trialData.id,
          wordAccuracy,
          repetitions: attemptCount + 1,
          whisperTranscript: spokenTranscript,
          encouragementScore,
          effortfulSpeech: false,
          utteranceAnalysis,
          shadowEvent,
          audioStoragePath: uploadedPath,
        });

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

    onTrialComplete?.({
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
      completeSession();
      onGameComplete?.(score, currentDifficulty);
      return;
    }

    const remainingTrials = totalTrials - currentIndex - 1;
    if (remainingTrials > 0) {
      const regeneratedTrials = getTrialsForLevel(currentDifficultyRef.current, remainingTrials + 5);
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
    setCueLevel(0);
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
    setScore(0);
    setCueLevel(0);
    setAttempts(0);
    setShowFeedback(false);
    setLastHeardText('');
    setProcessingAnswer(false);
    setShowRecoveryActions(false);
    processingResultRef.current = false;
    consecutiveStallCountRef.current = 0;
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    const newTrials = getTrialsForLevel(initialDifficulty, totalTrials);
    setTrials(newTrials);
    setTrialStartTime(Date.now());
  };

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
          <Badge 
            variant={currentDifficulty <= 2 ? "secondary" : currentDifficulty <= 4 ? "default" : "destructive"}
            className="text-lg px-4 py-2"
          >
            Level {currentDifficulty}
          </Badge>
        </div>
        <div className="text-2xl font-bold text-primary">
          {score} pts
        </div>
      </div>

      {/* Progress Bar */}
      <Progress value={progress} className="h-3" />

      {/* Main Phrase Card */}
      <Card className="p-8 text-center space-y-6">
        {/* Phrase Display */}
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground uppercase tracking-wide">
            Practice this phrase:
          </div>
          
          <div className="text-4xl font-bold text-foreground leading-relaxed py-6 px-4 bg-accent/20 rounded-lg">
            {currentTrial.phrase}
          </div>
          
          <Badge variant="outline" className="text-sm">
            {currentTrial.category.replace('_', ' ')}
          </Badge>
        </div>

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
        <Card className={`p-6 text-center ${feedbackCorrect ? 'bg-green-50 dark:bg-green-950/20 border-green-500' : 'bg-red-50 dark:bg-red-950/20 border-red-500'}`}>
          <div className="text-2xl font-bold mb-2">
            {feedbackCorrect ? '✓ Excellent!' : '✗ Try Again'}
          </div>
          <div className="text-sm text-muted-foreground">
            {feedbackCorrect 
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
