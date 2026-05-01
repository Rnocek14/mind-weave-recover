import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Camera, TrendingUp, TrendingDown, Clock, Lightbulb, Mic, MicOff, Volume2, AlertCircle, Loader2, Zap } from 'lucide-react';
import { usePhotoNamingGame } from '@/hooks/usePhotoNamingGame';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { useAdaptationTrialLogger } from '@/hooks/useAdaptationTrialLogger';
import { LevelBadge } from '@/components/exercise/LevelBadge';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { getCapabilityDifficultyBounds, type DifficultyBounds } from '@/lib/difficultyBounds';
import { TrialTimer } from '@/components/TrialTimer';
import { getCueText, selectOptimalCue } from '@/lib/cueGenerator';
import { selectOptimalCue as selectPersonalizedCue } from '@/lib/cueSelector';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { useGameSounds } from '@/hooks/useGameSounds';
import { classifySpeechError, type ErrorClassificationResult } from '@/lib/errorClassifier';
import { generateGentleFeedback, calculateEncouragementScore } from '@/lib/feedbackGenerator';
import { toUtteranceAnalysis, buildShadowEvent, type UtteranceAnalysis, type ExtendedErrorType } from '@/types/utteranceAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { normalizeASROutput, areHomophones } from '@/lib/speechNormalizer';
import { validateSpokenResponse } from '@/lib/evaluation/responseValidation';
import { trackValidation, logValidationDetail } from '@/lib/evaluation/validationTelemetry';
import { speakMayaCoaching, resetCoachingState } from '@/lib/evaluation/mayaCoachingResponses';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { usePhraseAudio } from '@/hooks/usePhraseAudio';
import { useUserSpeechProfile } from '@/hooks/useUserSpeechProfile';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { CueDebugOverlay } from '@/components/CueDebugOverlay';
import { ExercisePurposeBanner } from '@/components/ExercisePurposeBanner';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { useAdaptationEventLogger } from '@/hooks/useAdaptationEventLogger';
import { useLiveAnalysis } from '@/contexts/LiveAnalysisContext';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useShadowEventLogger } from '@/hooks/useShadowEventLogger';

interface PhotoNamingGameProps {
  totalTrials?: number;
  initialDifficulty?: number;
  customTrials?: any[];
  assistMode?: boolean;
  sessionId?: string | null;
  onTrialComplete?: (result: {
    correct: boolean;
    reactionTimeMs: number;
    errorType?: string;
    difficultyLevel: number;
    cueLevel: number;
    errorClassification?: ErrorClassificationResult;
    audioStoragePath?: string;
    recordingDurationMs?: number;
    audioMimeType?: string;
    whisperTranscript?: string;
    whisperConfidence?: number;
    acousticMetrics?: any;
    encouragementScore?: number;
    effortfulSpeech?: boolean;
    utteranceAnalysis?: UtteranceAnalysis;
    shadowEvent?: any;
    cueTypeGiven?: 'none' | 'semantic' | 'phonemic' | 'full_word';
    cueWasEffective?: boolean | null;
    timeToSuccessAfterCueMs?: number | null;
    // Adaptation state for Live Analysis
    latencyMs?: number;
    consecutiveErrors?: number;
    frustrationLevel?: string;
    recentSuccessRate?: number;
    trialCount?: number;
  }, trial: any) => void;
  onGameComplete?: (finalScore: number) => void;
  onDifficultyChange?: (newLevel: number, reason: string) => void;
}

// Debounced mic status - only show "mic paused" after a fresh grace window for the current trial/start cycle
const useDebouncedMicStatus = (
  isListening: boolean,
  shouldExpectListening: boolean,
  resetKey: string | number,
  delayMs = 5000
) => {
  const [showMicPaused, setShowMicPaused] = useState(false);
  
  useEffect(() => {
    // Always clear stale warning state when a new listening cycle begins
    setShowMicPaused(false);

    if (isListening || !shouldExpectListening) {
      return;
    }
    
    const timer = setTimeout(() => {
      setShowMicPaused(true);
    }, delayMs);
    
    return () => clearTimeout(timer);
  }, [isListening, shouldExpectListening, resetKey, delayMs]);
  
  return showMicPaused;
};

export const PhotoNamingGame = ({
  totalTrials = 10,
  initialDifficulty = 1,
  customTrials,
  assistMode = false,
  sessionId,
  onTrialComplete,
  onGameComplete,
  onDifficultyChange,
}: PhotoNamingGameProps) => {
  const { state, currentLane, nextTrial: nextTrialData, advanceTrial, selectAnswer } = usePhotoNamingGame(
    totalTrials, 
    initialDifficulty, 
    customTrials
  );
  
  // Preload next image to eliminate delay when advancing
  useImagePreloader(state.currentTrial?.imageUrl, nextTrialData?.imageUrl);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());
  const [sessionStartTime] = useState<number>(Date.now()); // For session duration tracking
  const micStartTimeRef = useRef<number>(0); // For latency measurement
  const { setLiveSnapshot } = useLiveAnalysis();
  const vg = useVoiceGuidance('photo-naming');
  const hasSpokenIntroRef = useRef(false);
  const [feedbackData, setFeedbackData] = useState<{
    correct: boolean;
    errorType?: string;
    semanticSimilarity?: number;
    phonemeAccuracy?: number;
  } | null>(null);
  // NOTE: currentDifficulty and consecutiveErrors now managed by useInGameAdaptation hook
  // BUT we keep local timedOut state for UI control
  const [difficultyChanged, setDifficultyChanged] = useState<'up' | 'down' | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [cueLevel, setCueLevel] = useState(0); // 0=none, 1=semantic, 2=phonemic, 3=full
  const [showCue, setShowCue] = useState(false);
  const [currentCueText, setCurrentCueText] = useState('');
  const [useVoice, setUseVoice] = useState(true); // Auto-start mic
  const [isPlayingChoices, setIsPlayingChoices] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.75); // Default slower for accessibility
  const [playingChoice, setPlayingChoice] = useState<string | null>(null);
  const [stallDetected, setStallDetected] = useState(false); // Stall-based cue trigger
  const [lastHeardText, setLastHeardText] = useState<string | null>(null); // Last ASR result
  const [processingAnswer, setProcessingAnswer] = useState(false); // Visual: processing selected answer
  const [micAutoStartPending, setMicAutoStartPending] = useState(false);
  const [autoHintsEnabled, setAutoHintsEnabled] = useState(true); // Toggle for automatic hints
  
  // Phase 2: Utterance state for delayed scoring
  // 'idle' - waiting for speech
  // 'listening' - actively capturing speech (interim transcripts)
  // 'processing' - analyzing final utterance
  // 'scored' - showing feedback
  const [utteranceState, setUtteranceState] = useState<'idle' | 'listening' | 'processing' | 'scored'>('idle');
  const [retryPrompt, setRetryPrompt] = useState<string | null>(null); // Gentle retry message
  
  // Phase 2 Fix: Debounced transcript scoring
  // Don't score until transcript is stable (no changes for 750ms)
  const transcriptDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTranscriptRef = useRef<string | null>(null);
  const lastRetryToastTimeRef = useRef<number>(0);
  const TRANSCRIPT_STABLE_DELAY_MS = 750; // Wait 750ms of no changes before scoring
  const RETRY_TOAST_THROTTLE_MS = 3000; // Only show retry toast every 3s
  const STALL_TIMER_DELAY_MS = 7000; // Wait 7s before auto-cue (was 3s - too aggressive)
  const CONSECUTIVE_ERROR_THRESHOLD = 3; // Errors before auto-cue (was 2 - too aggressive)
  
  const [showDebugOverlay, setShowDebugOverlay] = useState(() => {
    // Enable via URL param ?debug=cue or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debug') === 'cue' || localStorage.getItem('cue-debug') === 'true';
  });

  const { toast: showToast } = useToast();

  // Keyboard shortcut for debug overlay (Ctrl+Shift+D or Cmd+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'd') {
        e.preventDefault();
        setShowDebugOverlay(prev => {
          const newVal = !prev;
          if (newVal) {
            localStorage.setItem('cue-debug', 'true');
            showToast({
              title: "🐛 Cue debug overlay enabled",
              description: "Persisted for this browser",
            });
          } else {
            localStorage.removeItem('cue-debug');
            showToast({
              title: "Cue debug overlay disabled",
            });
          }
          return newVal;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showToast]);
  
  // Refs to avoid stale closures in timers
  const isPlayingChoicesRef = useRef(false);
  const isListeningRef = useRef(false);
  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trialRecordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoListenInitiatedRef = useRef<number | null>(null); // Track which trial initiated auto-listen
  const attemptStartedTrialRef = useRef<number | null>(null);
  const recordingStartedTrialRef = useRef<number | null>(null);
  const processingResultRef = useRef(false); // Track if we're processing a result (prevents abandoned race)
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null); // Stall detection timer
  const autoCueShownThisTrialRef = useRef(false); // Prevent auto-cue spam per trial
  const cueVisibleRef = useRef(false); // Track if cue should stay visible this trial (sticky cues)
  
  // Refs for stall timer closure safety (avoid reading stale state)
  const showFeedbackRef = useRef(showFeedback);
  const selectedAnswerRef = useRef(selectedAnswer);
  const timedOutRef = useRef(timedOut);
  const showCueRef = useRef(showCue);
  
  const { toast } = useToast();
  const { playSuccess, playError, playLevelUp, playLevelDown, playHint, playTimeout } = useGameSounds();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { playPhrase, isPlaying: isAudioPlaying } = usePhraseAudio();
  const { speak: speakMaya, isSpeaking: isMayaSpeaking } = useTextToSpeech();
  const { profile: speechProfile, loading: profileLoading } = useUserSpeechProfile(user?.id, { profileId: activeProfile?.id });
  
  // Shadow Mode: log events for future co-pilot/research (gated by feature flag)
  const { logShadowEvent } = useShadowEventLogger({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId,
    runtimeConfig: activeProfile?.runtime_config as Record<string, any> | null,
  });
  
  // FIX 1: Auto-create session for standalone games (use canonical slug)
  const { activeSessionId, isCreatingSession, profileId: standaloneProfileId } = useStandaloneSession(
    user?.id,
    sessionId,
    CANONICAL_SLUGS.PHOTO_NAMING
  );
  
  // FIX 2: Session lifecycle - guaranteed cleanup on unmount, pagehide, visibility timeout
  const { completeSession } = useSessionLifecycle({
    sessionId: activeSessionId,
    userId: user?.id,
    profileId: standaloneProfileId || activeProfile?.id,
    exerciseSlug: CANONICAL_SLUGS.PHOTO_NAMING,
    getSessionStats: useCallback(() => ({
      score: state.score,
      totalTrials: state.trialNumber,
      startTime: sessionStartTime,
    }), [state.score, state.trialNumber, sessionStartTime]),
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
  
  // Track current pronRequestId for correlation (persists across async operations)
  const currentPronRequestIdRef = useRef<string | null>(null);
  
  // Track analysis state for UI feedback
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Audio recording
  const { 
    isRecording, 
    isSupported: isRecordingSupported,
    startRecording, 
    stopRecording, 
    uploadRecording 
  } = useAudioRecorder();
  
  // Error history tracking for adaptive cueing
  const [errorHistory, setErrorHistory] = useState<ErrorClassificationResult[]>([]);
  
  // Track cue state for efficacy logging
  const [cueState, setCueState] = useState<{
    type: 'semantic' | 'phonemic' | 'full_word';
    level: number;
    shownAt: number;
    trigger: 'stall' | 'consecutive_errors' | 'user_request';
  } | null>(null);
  // Default bounds (will be overridden if capability data available)
  const defaultBounds: DifficultyBounds = { floor: 1, ceiling: 10, suggestedStart: initialDifficulty };
  
  // ==========================================================================
  // Adaptation Event Logger - tracks difficulty/cue events for analytics
  // ==========================================================================
  const {
    logDifficultyChange,
    logCueDelivered,
    logLaneSwitch,
    flushBatch,
    resetSession: resetLoggerSession,
  } = useAdaptationEventLogger({
    userId: user?.id,
    profileId: activeProfile?.id,
    maxEventsPerSession: 50,
  });

  // Track previous difficulty to detect changes
  const previousDifficultyRef = useRef(initialDifficulty);

  // Engagement monitor — tracks fatigue/frustration signals at a session-window scale.
  // Feeds the cue-dependency safety gate inside useInGameAdaptation.
  const engagement = useEngagementMonitor(activeSessionId);

  // Phase 4 — live per-trial logging for real-world adaptive validation.
  const { logTrial: logAdaptationTrial } = useAdaptationTrialLogger({
    userId: user?.id,
    sessionId: activeSessionId,
    exerciseSlug: 'photo_naming',
  });

  // NEW: In-game adaptive layer - replaces manual AdaptiveDifficultyController
  const {
    currentDifficulty,
    frustrationLevel,
    consecutiveErrors: hookConsecutiveErrors,
    recentSuccessRate,
    recordTrial,
    stepDown,
    reset: resetAdaptation,
    controller: adaptiveController,
    levelDescriptor,
  } = useInGameAdaptation({
    autoLog: false, // we forward via onTrialLogged below

    exerciseSlug: 'photo_naming',
    sessionId: activeSessionId,
    initialDifficulty,
    bounds: defaultBounds,
    enableAutoHints: autoHintsEnabled,
    enableDifficultyToasts: true,
    enableDifficultyAutoStepDown: true,
    enableInterventionUI: false,
    // Cue-dependency safety gate — block escalations when avg cue use is high.
    // engagement.signals.cueDependency is avg cue level (0..3) → normalize to 0..1.
    getCueDependencyScore: () => {
      const avg = engagement.getState().signals.cueDependency;
      if (!Number.isFinite(avg) || avg <= 0) return 0;
      return Math.min(1, avg / 3);
    },
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.info('[PhotoNaming] escalation blocked', { reason, cueDependencyScore, trialsAtLevel });
      void engagement.logIntervention('cue_dependency_gate', 'hold_and_fade_cues', 'auto');
    },
    onDifficultyChange: (level, reason, direction) => {
      const prevLevel = previousDifficultyRef.current;
      logDifficultyChange(
        direction,
        prevLevel,
        level,
        recentSuccessRate,
        hookConsecutiveErrors,
        activeSessionId,
        CANONICAL_SLUGS.PHOTO_NAMING,
        state.trialNumber
      );
      previousDifficultyRef.current = level;

      setDifficultyChanged(direction);
      if (direction === 'up') {
        playLevelUp?.();
      } else {
        playLevelDown?.();
      }

      // Phase 2: patient-facing narration of the change (rendered by parent / Maya).
      const narration = narrateAdaptation({
        direction: level === prevLevel ? 'hold' : direction,
        reasonKind: classifyReason(reason),
        context: { successRate: recentSuccessRate },
      });
      onDifficultyChange?.(level, narration || reason);
      setTimeout(() => setDifficultyChanged(null), 2000);
    },
    onTrialLogged: (snap) => {
      logAdaptationTrial({
        trialIndex: snap.trialIndex,
        difficulty: snap.difficulty,
        cueLevel: showCueRef.current ? 1 : 0,
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

  // Ref to trigger voice restart after no-match
  const needsVoiceRestartRef = useRef(false);
  
  // Keep refs in sync with state for stall timer closure safety
  useEffect(() => { showFeedbackRef.current = showFeedback; }, [showFeedback]);
  useEffect(() => { selectedAnswerRef.current = selectedAnswer; }, [selectedAnswer]);
  useEffect(() => { timedOutRef.current = timedOut; }, [timedOut]);
  useEffect(() => { showCueRef.current = showCue; }, [showCue]);
  
  // Track lane switches using ACTUAL lane from hook (not inferred from difficulty)
  const previousActualLaneRef = useRef<'easy' | 'mid' | 'hard' | null>(null);
  useEffect(() => {
    if (!currentLane) return;
    
    if (previousActualLaneRef.current && previousActualLaneRef.current !== currentLane) {
      // Lane switch occurred - log it (batched via queueEvent)
      logLaneSwitch(
        previousActualLaneRef.current,
        currentLane,
        currentDifficulty,
        activeSessionId,
        CANONICAL_SLUGS.PHOTO_NAMING,
        state.trialNumber
      );
    }
    previousActualLaneRef.current = currentLane;
  }, [currentLane, currentDifficulty, activeSessionId, state.trialNumber, logLaneSwitch]);
  
  // CRITICAL: Clean up stall timer AND debounce timer on trial change and unmount
  // Use trialNumber as dependency (unique per trial, unlike target which may repeat)
  useEffect(() => {
    return () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      // Also clear debounce timer on trial change to prevent stale scoring
      if (transcriptDebounceRef.current) {
        clearTimeout(transcriptDebounceRef.current);
        transcriptDebounceRef.current = null;
      }
      pendingTranscriptRef.current = null;
    };
  }, [state.trialNumber]); // Use trialNumber for unique trial identity
  
  // Voice guidance: speak intro on first trial
  useEffect(() => {
    if (state.isComplete || state.trialNumber !== 1) return;
    if (!hasSpokenIntroRef.current && vg.shouldAutoSpeak) {
      hasSpokenIntroRef.current = true;
      vg.speakIntro().then(() => {
        vg.speakIfVoiceLed('Say what you see.');
      });
    }
  }, [state.trialNumber, state.isComplete, vg]);

  // Reset logger counters when session starts/changes
  useEffect(() => {
    if (activeSessionId) {
      resetLoggerSession(activeSessionId);
    }
  }, [activeSessionId, resetLoggerSession]);
  
  // Flush adaptation events on session end
  useEffect(() => {
    if (state.isComplete) {
      flushBatch();
    }
  }, [state.isComplete, flushBatch]);

  // Admin permissions for debug features
  const { isAdmin } = useUserPermissions(user?.id);

  // =============================================================================
  // CRITICAL FIX: Direct cue trigger function (replaces broken flag-based approach)
  // This is called DIRECTLY from the stall timer and consecutive errors effect,
  // eliminating the two-phase state relay that was causing cues to never fire.
  // =============================================================================
  const triggerAutoCue = useCallback((trigger: 'stall' | 'consecutive_errors' | 'user_request') => {
    // Guard: already showing cue or already shown this trial
    if (showCueRef.current || autoCueShownThisTrialRef.current) {
      console.log('🚫 triggerAutoCue blocked - already showing or shown this trial');
      return false;
    }
    
    // Guard: no current trial
    if (!state.currentTrial) {
      console.log('🚫 triggerAutoCue blocked - no current trial');
      return false;
    }
    
    // Guard: feedback or timeout already showing
    if (showFeedbackRef.current || timedOutRef.current) {
      console.log('🚫 triggerAutoCue blocked - feedback or timeout showing');
      return false;
    }

    console.log('💡 triggerAutoCue FIRING:', trigger);
    
    // Select optimal cue using error history and speech profile
    const autoCueDecision = selectOptimalCue(
      errorHistory,
      state.currentTrial.target,
      state.currentTrial.category,
      state.currentTrial.features,
      0 // First cue level - least invasive
    );
    
    // Update UI state
    setCueLevel(1);
    setCurrentCueText(autoCueDecision.cueText);
    setShowCue(true);
    setStallDetected(false);
    autoCueShownThisTrialRef.current = true;
    cueVisibleRef.current = true; // Mark cue as sticky - prevents effect from hiding it
    
    // Map cueType for logging
    const cueType: 'semantic' | 'phonemic' | 'full_word' = 
      autoCueDecision.cueType === 'phonemic' ? 'phonemic' : 
      autoCueDecision.cueType === 'full' ? 'full_word' : 'semantic';
    
    // Set cue state for efficacy tracking
    setCueState({
      type: cueType,
      level: 1,
      shownAt: Date.now(),
      trigger
    });
    
    // Log cue delivery to adaptation_events
    logCueDelivered(
      cueType,
      1, // cue level
      trigger,
      hookConsecutiveErrors,
      activeSessionId,
      CANONICAL_SLUGS.PHOTO_NAMING,
      state.trialNumber
    );
    
    // Only play hint sound for user-requested hints (not auto-cues)
    if (trigger === 'user_request') {
      playHint?.();
    }
    
    console.log('✅ Auto-cue delivered:', { trigger, cueType, cueText: autoCueDecision.cueText });
    return true;
  }, [state.currentTrial, errorHistory, playHint, logCueDelivered, hookConsecutiveErrors, activeSessionId, state.trialNumber]);

  // =============================================================================
  // Watch consecutive errors and trigger cue if threshold reached
  // =============================================================================
  useEffect(() => {
    if (autoHintsEnabled && hookConsecutiveErrors >= CONSECUTIVE_ERROR_THRESHOLD && !autoCueShownThisTrialRef.current && !showFeedback && !timedOut) {
      console.log('🔥 Consecutive errors threshold reached:', hookConsecutiveErrors);
      triggerAutoCue('consecutive_errors');
    }
  }, [autoHintsEnabled, hookConsecutiveErrors, showFeedback, timedOut, triggerAutoCue]);
  
  // Helper function to match spoken words with choices (WITH NORMALIZATION)
  const findMatchingChoice = (spokenWord: string): string | null => {
    console.log('🔍 findMatchingChoice called:', {
      spokenWord,
      currentTrial: state.currentTrial?.target,
      choices: state.choices,
      choicesLength: state.choices?.length
    });
    
    if (!state.choices || state.choices.length === 0) {
      console.error('❌ No choices available!');
      return null;
    }
    
    // Clean up fillers and noise FIRST
    const normalized = normalizeASROutput(spokenWord).toLowerCase().trim();
    
    console.log('🔍 Normalized spoken word:', normalized);
    
    if (!normalized) return null;
    
    // Direct match
    const directMatch = state.choices.find(choice => 
      choice.toLowerCase() === normalized
    );
    if (directMatch) {
      console.log('✅ Direct match found:', directMatch);
      return directMatch;
    }
    
    // Homophone match (e.g., "I" → "eye")
    const homophoneMatch = state.choices.find(choice => 
      areHomophones(choice, normalized)
    );
    if (homophoneMatch) {
      console.log('✅ Homophone match found:', homophoneMatch, 'for spoken:', normalized);
      return homophoneMatch;
    }
    
    // Fuzzy match with phonetic tolerance
    const fuzzyMatch = state.choices.find(choice => {
      const choiceLower = choice.toLowerCase();
      
      // Contains match
      if (normalized.includes(choiceLower) || choiceLower.includes(normalized)) {
        return true;
      }
      
      // Levenshtein similarity for phonetic variations (e.g., "dawg" → "dog")
      // Threshold lowered from 0.7 to 0.6 for better ASR tolerance
      const similarity = calculateSimilarity(normalized, choiceLower);
      console.log(`🔍 Similarity "${normalized}" vs "${choiceLower}": ${similarity}`);
      return similarity > 0.6;
    });
    
    if (fuzzyMatch) {
      console.log('✅ Fuzzy match found:', fuzzyMatch);
    } else {
      console.log('❌ No match found. Choices were:', state.choices.map(c => c.toLowerCase()));
    }
    
    return fuzzyMatch || null;
  };
  
  // Calculate word similarity for fuzzy matching
  const calculateSimilarity = (word1: string, word2: string): number => {
    const longer = word1.length > word2.length ? word1 : word2;
    const shorter = word1.length > word2.length ? word2 : word1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };
  
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };
  
  // =========================================================================
  // PHASE 2 FIX: True Debounced Scoring
  // Only score when transcript is STABLE (no changes for 750ms)
  // This prevents scoring on interim/partial transcripts
  // =========================================================================
  
  // Helper: Check if transcript is high enough quality to score
  const isTranscriptScoreable = useCallback((transcript: string): boolean => {
    const validation = validateSpokenResponse({ transcript, expectedMode: 'naming' });
    trackValidation('photo_naming', validation);
    logValidationDetail('photo_naming', transcript, validation);
    if (!validation.valid && validation.rejectionReason) {
      speakMayaCoaching(validation.rejectionReason, speakMaya, { exerciseKey: 'photo_naming' }).then(line => setRetryPrompt(line));
    }
    if (validation.valid) resetCoachingState('photo_naming', speakMaya);
    return validation.valid;
  }, []);
  
  // Helper: Debounced scoring logic (called after transcript stabilizes)
  const processStableTranscript = useCallback((transcript: string) => {
    // Double-check guards at execution time
    if (showFeedbackRef.current || selectedAnswerRef.current || timedOutRef.current) {
      console.log('🎤 processStableTranscript blocked - feedback/answer/timeout active');
      return;
    }
    
    if (!state.choices || state.choices.length === 0 || !state.currentTrial) {
      console.log('🎤 processStableTranscript blocked - game not ready');
      return;
    }
    
    console.log('✅ Transcript stable, scoring:', transcript);
    
    const matchedChoice = findMatchingChoice(transcript);
    
    if (matchedChoice) {
      console.log('✅ Matched choice:', matchedChoice);
      setUtteranceState('processing');
      setProcessingAnswer(true);
      handleAnswerSelect(matchedChoice);
    } else {
      console.log('❌ No match for stable transcript:', transcript);
      
      // Quality heuristic: is this a real attempt or just noise?
      const isRealAttempt = isTranscriptScoreable(transcript);
      
      if (isRealAttempt) {
        // Real attempt that didn't match - show gentle retry
        setRetryPrompt(`Heard: "${transcript}" - try again or tap a word`);
        setUtteranceState('idle');
        
        // Throttle retry toasts to prevent spam
        const now = Date.now();
        if (now - lastRetryToastTimeRef.current > RETRY_TOAST_THROTTLE_MS) {
          lastRetryToastTimeRef.current = now;
          toast({
            title: "Keep going!",
            description: `I heard "${transcript}". Try saying one of the words shown.`,
            duration: 2500,
          });
        }
      } else {
        // Low quality - just update "heard" text silently, don't toast
        setLastHeardText(transcript);
        setUtteranceState('listening');
      }
      
      needsVoiceRestartRef.current = true;
    }
  }, [state.choices, state.currentTrial, toast, isTranscriptScoreable]);
  
  // Handle speech recognition results - DEBOUNCED SCORING
  const handleSpeechResult = useCallback((transcript: string) => {
    // Guard: ignore if already processing/scored
    if (showFeedback || selectedAnswer || timedOut || isPlayingChoicesRef.current) {
      console.log('🎤 handleSpeechResult blocked - state guard');
      return;
    }
    
    if (utteranceState === 'processing' || utteranceState === 'scored') {
      console.log('🎤 handleSpeechResult blocked - already processing/scored');
      return;
    }
    
    // Guard: game must be ready
    if (!state.choices || state.choices.length === 0 || !state.currentTrial) {
      console.warn('⚠️ Speech result received but game not ready');
      return;
    }
    
    console.log('🎤 Speech result (will debounce):', transcript);
    
    // Update UI immediately to show we're listening
    setUtteranceState('listening');
    setLastHeardText(transcript);
    setRetryPrompt(null);
    
    // Log browser transcript
    logBrowserTranscript(transcript);
    
    // Store pending transcript
    pendingTranscriptRef.current = transcript;
    
    // Clear existing debounce timer
    if (transcriptDebounceRef.current) {
      clearTimeout(transcriptDebounceRef.current);
    }
    
    // Set new debounce timer - only score if no new transcript for 750ms
    transcriptDebounceRef.current = setTimeout(() => {
      const stableTranscript = pendingTranscriptRef.current;
      transcriptDebounceRef.current = null;
      pendingTranscriptRef.current = null;
      
      if (stableTranscript) {
        processStableTranscript(stableTranscript);
      }
    }, TRANSCRIPT_STABLE_DELAY_MS);
    
  }, [showFeedback, selectedAnswer, timedOut, utteranceState, state.choices, state.currentTrial, logBrowserTranscript, processStableTranscript]);
  
  // Speech recognition hook - use patient mode like the other mobile exercises to avoid mic flicker
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    isSupported,
    error: speechError 
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    autoStart: false,
    continuousListening: true,
    patientMode: true,
  });

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const micErrorMessage =
    speechError && !speechError.toLowerCase().includes('no speech detected')
      ? speechError.includes('Microphone access denied')
        ? 'Microphone access is blocked — allow it in Safari settings.'
        : speechError.includes('Failed to start speech recognition')
          ? 'Microphone couldn’t start — tap Voice Off, then On.'
          : speechError
      : null;
  
  // Reset stall timer whenever speech activity is detected (prevents cue spam during active speech)
  useEffect(() => {
    if (transcript && stallTimerRef.current) {
      console.log('🎤 Speech activity detected - resetting stall timer');
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, [transcript]);
  
  // Push micState transitions to Live Analysis panel
  useEffect(() => {
    if (isListening) {
      micStartTimeRef.current = Date.now();
      setLiveSnapshot({ micState: 'listening' });
    } else if (utteranceState === 'processing') {
      setLiveSnapshot({ micState: 'processing' });
    } else {
      setLiveSnapshot({ micState: 'idle' });
    }
  }, [isListening, utteranceState, setLiveSnapshot]);

  // Centralized safe startListening to prevent race conditions
  const safeStartListening = useCallback((delayMs: number = 0) => {
    // Clear any pending timeout
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
    
    if (delayMs > 0) {
      // Schedule the listening attempt - check conditions WHEN it executes, not now
      console.log(`🎤 Scheduling startListening in ${delayMs}ms`);
      listeningTimeoutRef.current = setTimeout(() => {
        listeningTimeoutRef.current = null; // Clear ref after execution
        console.log('🎤 Timeout executed, checking conditions...');
        
        // Check all conditions at execution time
        if (!isPlayingChoicesRef.current && !showFeedback && !timedOut && !selectedAnswer) {
          console.log('🎤 Conditions met, calling startListening()');
          try {
            startListening();
          } catch (err) {
            console.error('🎤 Error starting listening:', err);
          }
        } else {
          console.log('🎤 Conditions not met:', {
            isPlayingChoices: isPlayingChoicesRef.current,
            showFeedback,
            timedOut,
            selectedAnswer
          });
        }
      }, delayMs);
    } else {
      // Immediate call - check conditions now including audio state
      if (!isPlayingChoicesRef.current && !showFeedback && !timedOut && !selectedAnswer) {
        console.log('🎤 Starting listening immediately');
        try {
          startListening();
        } catch (err) {
          console.error('🎤 Error starting listening:', err);
        }
      } else {
        console.log('🎤 Blocked immediate start:', {
          isPlayingChoices: isPlayingChoicesRef.current,
          showFeedback,
          timedOut,
          selectedAnswer
        });
      }
    }
  }, [startListening, showFeedback, timedOut, selectedAnswer]);
  
  // Hard mode settings
  const isHardMode = currentDifficulty >= 8;
  const timeLimit = 5; // seconds for hard mode
  const allowManualHints = currentDifficulty >= 6;

  // Async speech analysis with Whisper (transcript + acoustic metrics)
  const analyzeSpeechAsync = async (
    audioBlob: Blob,
    mimeType: string
  ): Promise<{ transcript: string; confidence: number; acousticMetrics: any } | null> => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Audio = result.split(',')[1];
          resolve(base64Audio);
        };
      });
      
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      const { data, error } = await supabase.functions.invoke('analyze-speech', {
        body: { audioBlob: base64Audio, mimeType },
      });

      if (error) {
        console.error('Speech analysis error:', error);
        return null;
      }

      console.log('Speech analysis complete:', {
        transcript: data.transcript,
        confidence: data.confidence,
        metrics: data.acousticMetrics,
      });

      return {
        transcript: data.transcript,
        confidence: data.confidence,
        acousticMetrics: data.acousticMetrics,
      };
    } catch (error) {
      console.error('Failed to analyze speech:', error);
      return null;
    }
  };

  // =========================================================================
  // Pronunciation Analysis Types - Explicit success/failure for bulletproof diagnostics
  // =========================================================================
  type PronunciationSuccessResult = {
    ok: true;
    data: {
      pronunciationScore: number;
      accuracyScore: number;
      fluencyScore: number;
      completenessScore: number;
      prosodyScore?: number;
      transcript: string;
      words: any[];
      alignmentData?: {
        word_segments: { word: string; start: number; end: number }[];
        phone_segments: { phone: string; start: number; end: number }[];
      };
    };
    // Correlation ID + timings for debugging
    pronRequestId: string;
    timingsMs: { wav: number; base64: number; edge: number; total: number };
    audioMeta: { originalMime: string; originalSize: number; wavSize: number; base64Len: number };
  };

  type PronunciationErrorResult = {
    ok: false;
    error: {
      stage: 'wav_conversion' | 'base64_encoding' | 'edge_function' | 'azure_api' | 'unexpected';
      message: string;
      details?: any;
    };
    pronRequestId: string;
    timingsMs: { wav?: number; base64?: number; edge?: number; total: number };
    audioMeta: { originalMime: string; originalSize: number; wavSize?: number; base64Len?: number };
  };

  type PronunciationResult = PronunciationSuccessResult | PronunciationErrorResult;

  // Azure Pronunciation Assessment (real pronunciation scores)
  const analyzePronunciationAsync = async (
    audioBlob: Blob,
    _mimeType: string, // Original mimeType ignored - we convert to WAV
    targetWord: string
  ): Promise<PronunciationResult> => {
    const pronRequestId = crypto.randomUUID();
    const startTime = Date.now();
    const audioMeta = { 
      originalMime: audioBlob.type, 
      originalSize: audioBlob.size, 
      wavSize: 0 as number | undefined, 
      base64Len: 0 as number | undefined 
    };
    const timings = { wav: 0, base64: 0, edge: 0, total: 0 };
    
    console.log('🎯 [Pronunciation] Starting analysis', { 
      pronRequestId,
      blobSize: audioBlob.size, 
      blobType: audioBlob.type,
      targetWord 
    });
    
    try {
      // Step 1: Convert to WAV format for Azure (WebM/Opus has poor phoneme support)
      console.log('🎯 [Pronunciation] Step 1: Converting to WAV...', { pronRequestId });
      const wavStartTime = Date.now();
      
      let wavBlob: Blob;
      try {
        const { convertBlobToWav } = await import('@/lib/convertToWav');
        wavBlob = await convertBlobToWav(audioBlob);
        timings.wav = Date.now() - wavStartTime;
        audioMeta.wavSize = wavBlob.size;
        console.log('🎯 [Pronunciation] WAV conversion success', { 
          pronRequestId,
          wavSize: wavBlob.size, 
          durationMs: timings.wav 
        });
      } catch (wavError) {
        timings.total = Date.now() - startTime;
        console.error('🎯 [Pronunciation] WAV conversion FAILED:', { pronRequestId, error: wavError });
        return { 
          ok: false,
          error: {
            stage: 'wav_conversion',
            message: wavError instanceof Error ? wavError.message : 'Unknown error',
            details: { errorType: wavError?.constructor?.name }
          },
          pronRequestId,
          timingsMs: { wav: Date.now() - wavStartTime, total: timings.total },
          audioMeta: { originalMime: audioMeta.originalMime, originalSize: audioMeta.originalSize }
        };
      }
      
      // Step 2: Convert WAV blob to base64
      console.log('🎯 [Pronunciation] Step 2: Encoding to base64...', { pronRequestId });
      const base64StartTime = Date.now();
      
      let base64Audio: string;
      try {
        const reader = new FileReader();
        base64Audio = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            if (!result) {
              reject(new Error('FileReader returned empty result'));
              return;
            }
            const base64 = result.split(',')[1];
            if (!base64) {
              reject(new Error('Failed to extract base64 from data URL'));
              return;
            }
            resolve(base64);
          };
          reader.onerror = () => reject(new Error(`FileReader error: ${reader.error?.message || 'Unknown'}`));
          reader.readAsDataURL(wavBlob);
        });
        timings.base64 = Date.now() - base64StartTime;
        audioMeta.base64Len = base64Audio.length;
        console.log('🎯 [Pronunciation] Base64 encoding success', { 
          pronRequestId,
          base64Length: base64Audio.length,
          durationMs: timings.base64 
        });
      } catch (encodeError) {
        timings.total = Date.now() - startTime;
        console.error('🎯 [Pronunciation] Base64 encoding FAILED:', { pronRequestId, error: encodeError });
        return { 
          ok: false,
          error: {
            stage: 'base64_encoding',
            message: encodeError instanceof Error ? encodeError.message : 'Unknown error'
          },
          pronRequestId,
          timingsMs: { wav: timings.wav, base64: Date.now() - base64StartTime, total: timings.total },
          audioMeta: { originalMime: audioMeta.originalMime, originalSize: audioMeta.originalSize, wavSize: audioMeta.wavSize }
        };
      }

      // Step 3: Call edge function
      console.log('🎯 [Pronunciation] Step 3: Calling Azure edge function', { pronRequestId, targetWord });
      const edgeStartTime = Date.now();

      const { data, error } = await supabase.functions.invoke('analyze-pronunciation', {
        body: { 
          audioBlob: base64Audio, 
          mimeType: 'audio/wav',
          referenceText: targetWord,
          pronRequestId // Pass correlation ID to edge function
        },
      });

      timings.edge = Date.now() - edgeStartTime;
      timings.total = Date.now() - startTime;

      if (error) {
        console.error('🎯 [Pronunciation] Edge function FAILED:', { pronRequestId, error });
        return { 
          ok: false,
          error: {
            stage: 'edge_function',
            message: error.message || 'Unknown error',
            details: { context: error.context }
          },
          pronRequestId,
          timingsMs: timings,
          audioMeta: audioMeta as any
        };
      }

      // Check for structured error response from edge function
      if (data?.ok === false) {
        console.error('🎯 [Pronunciation] Azure API returned error:', { pronRequestId, error: data.error });
        return { 
          ok: false,
          error: {
            stage: data.error?.stage || 'azure_api',
            message: data.error?.message || 'Unknown Azure error',
            details: data.error?.details
          },
          pronRequestId,
          timingsMs: timings,
          audioMeta: audioMeta as any
        };
      }

      // Legacy fallback: check for error string (backward compatibility)
      if (data?.error && typeof data.error === 'string') {
        console.error('🎯 [Pronunciation] Azure API returned legacy error:', { pronRequestId, error: data.error });
        return { 
          ok: false,
          error: {
            stage: 'azure_api',
            message: data.error
          },
          pronRequestId,
          timingsMs: timings,
          audioMeta: audioMeta as any
        };
      }

      console.log('🎯 [Pronunciation] SUCCESS!', {
        pronRequestId,
        pronunciationScore: data.pronunciationScore ?? data.data?.pronunciationScore,
        accuracyScore: data.accuracyScore ?? data.data?.accuracyScore,
        fluencyScore: data.fluencyScore ?? data.data?.fluencyScore,
        transcript: data.transcript ?? data.data?.transcript,
        timingsMs: timings,
      });

      // Handle both new structured response and legacy response
      const responseData = data.data || data;

      return {
        ok: true,
        data: {
          pronunciationScore: responseData.pronunciationScore || 0,
          accuracyScore: responseData.accuracyScore || 0,
          fluencyScore: responseData.fluencyScore || 0,
          completenessScore: responseData.completenessScore || 0,
          prosodyScore: responseData.prosodyScore,
          transcript: responseData.transcript || '',
          words: responseData.words || [],
          alignmentData: responseData.alignmentData,
        },
        pronRequestId,
        timingsMs: timings,
        audioMeta: audioMeta as any
      };
    } catch (error) {
      timings.total = Date.now() - startTime;
      console.error('🎯 [Pronunciation] Unexpected error:', { pronRequestId, error });
      return { 
        ok: false,
        error: {
          stage: 'unexpected',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { errorType: error?.constructor?.name }
        },
        pronRequestId,
        timingsMs: timings,
        audioMeta: audioMeta as any
      };
    }
  };


  // =========================================================================
  // SEPARATE EFFECT: Reset cue state ONLY when trial number changes
  // This prevents the main trial effect from hiding cues on every re-render
  // =========================================================================
  useEffect(() => {
    console.log('🔄 Trial number changed - resetting cue state for trial:', state.trialNumber);
    currentPronRequestIdRef.current = null;
    setCueLevel(0);
    setShowCue(false);
    setCurrentCueText('');
    autoCueShownThisTrialRef.current = false;
    cueVisibleRef.current = false;
    setStallDetected(false);
  }, [state.trialNumber]); // ONLY trialNumber - no other dependencies

  // Start timing the new trial and reset visible state without coupling it to mic state
  useEffect(() => {
    if (!state.currentTrial) return;

    setTrialStartTime(Date.now());
    setSelectedAnswer(null);
    setTimedOut(false);
    setLastHeardText(null);
    setProcessingAnswer(false);
    setUtteranceState('idle');
    setRetryPrompt(null);

    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }

    if (autoHintsEnabled && !isPlayingChoicesRef.current) {
      stallTimerRef.current = setTimeout(() => {
        const isIdle = !showFeedbackRef.current &&
                       !selectedAnswerRef.current &&
                       !timedOutRef.current &&
                       !showCueRef.current &&
                       !isPlayingChoicesRef.current;

        if (isIdle && !autoCueShownThisTrialRef.current) {
          console.log('🕐 Stall detected - triggering cue directly');
          triggerAutoCue('stall');
        }
      }, STALL_TIMER_DELAY_MS);
    }

    return () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };
  }, [state.currentTrial, state.trialNumber, triggerAutoCue]);

  // Start attempt logging and recording once per trial, even if session data finishes loading later
  useEffect(() => {
    if (!state.currentTrial || showFeedback || !activeSessionId || !user?.id) return;

    if (attemptStartedTrialRef.current !== state.trialNumber) {
      console.log('🎯 [PhotoNaming] New trial starting:', {
        target: state.currentTrial.target,
        trialNumber: state.trialNumber,
        activeSessionId,
        userId: user.id,
        hasSession: true,
        hasUser: true
      });

      const { attemptId, pronRequestId } = startAttempt({
        sessionId: activeSessionId,
        userId: user.id,
        exerciseSlug: CANONICAL_SLUGS.PHOTO_NAMING,
        trialIndex: state.trialNumber,
        attemptNumber: 1,
        targetWord: state.currentTrial.target,
        category: state.currentTrial.category
      });

      attemptStartedTrialRef.current = state.trialNumber;
      currentPronRequestIdRef.current = pronRequestId;
      console.log('✅ [PhotoNaming] Attempt started:', { attemptId, pronRequestId });
    }

    if (isRecordingSupported && recordingStartedTrialRef.current !== state.trialNumber) {
      if (trialRecordingTimeoutRef.current) {
        clearTimeout(trialRecordingTimeoutRef.current);
      }

      trialRecordingTimeoutRef.current = setTimeout(() => {
        trialRecordingTimeoutRef.current = null;

        if (recordingStartedTrialRef.current === state.trialNumber) return;

        void startRecording().then((started) => {
          if (!started) return;
          recordingStartedTrialRef.current = state.trialNumber;
          console.log('🎙️ Recording started for session:', activeSessionId);
        });
      }, 900);
    }

    return () => {
      if (trialRecordingTimeoutRef.current) {
        clearTimeout(trialRecordingTimeoutRef.current);
        trialRecordingTimeoutRef.current = null;
      }
    };
  }, [state.currentTrial, state.trialNumber, showFeedback, activeSessionId, user?.id, isRecordingSupported, startRecording, startAttempt]);

  // Auto-start listening once per trial without retriggering trial initialization
  useEffect(() => {
    if (!state.currentTrial || showFeedback || !useVoice || !isSupported) {
      setMicAutoStartPending(false);
      return;
    }

    if (autoListenInitiatedRef.current === state.trialNumber) {
      return;
    }

    autoListenInitiatedRef.current = state.trialNumber;
    setMicAutoStartPending(true);

    let retryCount = 0;
    const maxRetries = 5;

    const tryStart = () => {
      retryCount++;
      console.log(`🎤 Auto-listen attempt ${retryCount}/${maxRetries} for trial ${state.trialNumber}`);

      // Sync-Wait: never open mic while Maya/TTS is still speaking — prevents audio overlap
      if (isMayaSpeaking) {
        console.log('🎤 Deferring auto-listen: TTS still speaking');
      } else if (!isPlayingChoicesRef.current && !showFeedbackRef.current) {
        try {
          startListening();
        } catch (err) {
          console.error('🎤 Error auto-starting listening:', err);
        }
      }

      if (retryCount < maxRetries) {
        const delay = retryCount === 1 ? 400 : retryCount === 2 ? 700 : retryCount === 3 ? 1000 : 1400;
        listeningTimeoutRef.current = setTimeout(() => {
          if (!isListeningRef.current && !isPlayingChoicesRef.current && !showFeedbackRef.current) {
            tryStart();
          } else {
            setMicAutoStartPending(false);
          }
        }, delay);
      } else {
        setMicAutoStartPending(false);
      }
    };

    const timeoutId = setTimeout(tryStart, 250);

    return () => {
      clearTimeout(timeoutId);
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
        listeningTimeoutRef.current = null;
      }
      setMicAutoStartPending(false);
    };
  }, [state.currentTrial, state.trialNumber, showFeedback, useVoice, isSupported, startListening]);

  useEffect(() => {
    if (showFeedback && isListening) {
      stopListening();
    }
  }, [showFeedback, isListening, stopListening]);

  useEffect(() => {
    if (isListening || speechError) {
      setMicAutoStartPending(false);
    }
  }, [isListening, speechError]);

  // Handle game completion - end session properly
  useEffect(() => {
    if (state.isComplete) {
      console.log('[PhotoNamingGame] ✅ onGameComplete firing', {
        score: state.score,
        gameType: 'PhotoNaming'
      });
      // End session with proper reason tracking
      completeSession();
      onGameComplete(state.score);
    }
  }, [state.isComplete, state.score, onGameComplete, completeSession]);

  // NOTE: Removed unmount cleanup for abandoned trials - it caused race conditions
  // where the cleanup would fire before handleAnswerSelect could complete.
  // Abandoned trials are properly logged via:
  // 1. handleTimeout - logs timeout/no_response errors
  // 2. Game completion - no logging needed for unfinished trials on game end
  // The unmount was seeing stale isFinalized state from the closure.
  
  // Phase 1 Fix: Restart voice after no-match toast
  useEffect(() => {
    if (needsVoiceRestartRef.current && useVoice && !showFeedback && !timedOut && !selectedAnswer && !isListening) {
      console.log('🎤 Restarting voice after no-match');
      needsVoiceRestartRef.current = false;
      setTimeout(() => {
        startListening();
      }, 500);
    }
  }, [useVoice, showFeedback, timedOut, selectedAnswer, isListening, startListening]);

  const handleTimeout = async () => {
    if (showFeedback || selectedAnswer || timedOut) return;
    
    // RACE CONDITION FIX: Mark that we're processing a result BEFORE any async work
    processingResultRef.current = true;
    
    // Clear stall timer on timeout
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    setStallDetected(false);
    
    setTimedOut(true);
    const reactionTime = Date.now() - trialStartTime;
    
    // Stop recording and upload
    let uploadedPath: string | undefined;
    let duration: number | undefined;
    let mimeType: string | undefined;
    let whisperTranscript: string | undefined;
    let whisperConfidence: number | undefined;
    let acousticMetrics: any | undefined;
    
    if (isRecording && user && activeSessionId) {
      setIsAnalyzing(true);
      const recordingResult = await stopRecording();
      if (recordingResult) {
        duration = recordingResult.duration;
        mimeType = recordingResult.mimeType;
        
        const path = await uploadRecording(
          recordingResult.audioBlob,
          user.id,
          activeSessionId,
          state.trialNumber,
          recordingResult.mimeType
        );
        
        if (path) {
          uploadedPath = path;
        }

        // Analyze speech with Whisper (async, but we await to include in telemetry)
        const analysisResult = await analyzeSpeechAsync(
          recordingResult.audioBlob,
          recordingResult.mimeType
        );
        
        if (analysisResult) {
          whisperTranscript = analysisResult.transcript;
          whisperConfidence = analysisResult.confidence;
          acousticMetrics = analysisResult.acousticMetrics;
        }
      }
      setIsAnalyzing(false);
    }
    
    // Treat timeout as incorrect answer
    const result = { correct: false, errorType: 'timeout' };
    setFeedbackData(result);
    setShowFeedback(true);
    
    // Play timeout sound
    playTimeout();
    
    
    // Track trial via in-game adaptation hook (handles consecutive errors + difficulty)
    const adaptationResult = recordTrial({ correct: false, timedOut: true });
    engagement.recordTrial({
      correct: false,
      reactionTimeMs: 0,
      timeout: true,
      cueLevel,
      timestamp: Date.now(),
    });
    console.log('⏱️ Timeout recorded via adaptation hook:', adaptationResult);

    // Log telemetry with cue level and audio
    const timeoutEncouragementScore = calculateEncouragementScore('timeout');
    const timeoutEffortfulSpeech = acousticMetrics ? (
      (acousticMetrics.speechRateWpm !== undefined && acousticMetrics.speechRateWpm < 30) ||
      (acousticMetrics.pauseCount !== undefined && acousticMetrics.pauseCount > 3) ||
      (acousticMetrics.avgPauseDurationMs !== undefined && acousticMetrics.avgPauseDurationMs > 2000)
    ) : false;
    
    onTrialComplete?.({
      correct: false,
      reactionTimeMs: reactionTime,
      errorType: 'timeout',
      difficultyLevel: currentDifficulty,
      cueLevel: cueLevel,
      audioStoragePath: uploadedPath,
      recordingDurationMs: duration,
      audioMimeType: mimeType,
      whisperTranscript,
      whisperConfidence,
      acousticMetrics,
      encouragementScore: timeoutEncouragementScore,
      effortfulSpeech: timeoutEffortfulSpeech,
      latencyMs: micStartTimeRef.current > 0 ? Date.now() - micStartTimeRef.current : undefined,
      consecutiveErrors: hookConsecutiveErrors,
      frustrationLevel,
      recentSuccessRate,
      trialCount: state.trialNumber,
    }, state.currentTrial);

    // Compute cue efficacy for timeout (cue was NOT effective since user didn't respond)
    const timeoutCueTypeGiven = cueState ? cueState.type : 'none';
    const timeoutCueWasEffective = cueState ? false : null; // Had a cue but didn't help

    // Log final analysis for timeout (critical for pattern analysis!)
    logFinalAnalysis({
      transcript: whisperTranscript,
      transcriptSource: whisperTranscript ? 'whisper' : 'browser',
      asrConfidence: whisperConfidence,
      isCorrect: false,
      errorType: 'timeout',
      speechRateWpm: acousticMetrics?.speechRateWpm,
      pauseCount: acousticMetrics?.pauseCount,
      totalPauseMs: acousticMetrics?.totalPauseDurationSec ? Math.round(acousticMetrics.totalPauseDurationSec * 1000) : undefined,
      avgPauseDurationMs: acousticMetrics?.avgPauseDurationMs,
      effortfulSpeech: timeoutEffortfulSpeech,
      cueTypeGiven: timeoutCueTypeGiven, // Always log, even 'none'
      cueWasEffective: timeoutCueWasEffective ?? undefined,
      cueTrigger: cueState?.trigger, // FIX: Was missing - required for cue learning loop
      audioStoragePath: uploadedPath,
      recordingDurationMs: duration
    });

    // Auto-advance after 2 seconds
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
      processingResultRef.current = false; // Allow abandoned logging again
      resetAttempt(); // Reset for next trial
      advanceTrial(currentDifficulty);
    }, 2000);
  };

  const handleRequestHint = () => {
    if (cueLevel >= 3 || !state.currentTrial) return; // Already at max cue
    
    playHint();
    const newCueLevel = cueLevel + 1;
    
    // First: check if user speech profile suggests a better cue type
    // (based on long-term personalization data)
    let personalizedCueType: 'semantic' | 'phonemic' | 'full_word' | null = null;
    let personalizedReasoning: string | null = null;
    
    if (speechProfile && !profileLoading) {
      // Get the last error type if available
      const lastErrorType = errorHistory.length > 0 
        ? (errorHistory[errorHistory.length - 1].errorType as any) 
        : 'other';
      
      const recommendation = selectPersonalizedCue(lastErrorType, speechProfile);
      
      // Only use personalized cue if confidence is high enough and it's not 'none'
      if (recommendation.confidence > 0.6 && recommendation.cueType !== 'none') {
        personalizedCueType = recommendation.cueType;
        personalizedReasoning = recommendation.reasoning;
        console.log('🎯 Using personalized cue:', recommendation);
      }
    }
    
    // Second: fall back to error-history-based adaptive cueing if no personalization
    let cueDecision;
    if (personalizedCueType && personalizedReasoning) {
      // Use personalized recommendation
      cueDecision = {
        cueType: personalizedCueType,
        cueText: personalizedCueType === 'semantic' 
          ? getCueText(1, state.currentTrial.category, state.currentTrial.target)
          : personalizedCueType === 'phonemic'
          ? getCueText(2, state.currentTrial.category, state.currentTrial.target)
          : getCueText(3, state.currentTrial.category, state.currentTrial.target),
        reasoning: personalizedReasoning
      };
    } else {
      // Use error-history-based adaptive cueing (existing logic)
      cueDecision = selectOptimalCue(
        errorHistory,
        state.currentTrial.target,
        state.currentTrial.category,
        state.currentTrial.features,
        newCueLevel - 1 // Convert to 0-indexed
      );
    }
    
    console.log('Cue decision:', cueDecision);
    
    setCueLevel(newCueLevel);
    setCurrentCueText(cueDecision.cueText);
    setShowCue(true);
    
    // Track cue for efficacy logging
    // Infer cue type from cue decision
    let cueType: 'semantic' | 'phonemic' | 'full_word' = 'semantic';
    if (cueDecision.cueType === 'phonemic') {
      cueType = 'phonemic';
    } else if (cueDecision.cueType === 'full') {
      cueType = 'full_word';
    } else if (cueDecision.cueType === 'semantic') {
      cueType = 'semantic';
    }
    
    setCueState({
      type: cueType,
      level: newCueLevel,
      shownAt: Date.now(),
      trigger: 'user_request'
    });
    
    // Show reasoning in toast for transparency
    toast({
      title: personalizedCueType ? "Personalized Hint" : "Hint provided",
      description: cueDecision.reasoning,
      duration: 3000
    });
  };

  const handlePlaySingleChoice = async (choice: string) => {
    if (isPlayingChoices || playingChoice || showFeedback || timedOut) return;
    
    // Stop listening and ensure it's fully stopped
    if (isListening) {
      stopListening();
    }
    
    // Update BOTH ref and state
    isPlayingChoicesRef.current = true;
    setIsPlayingChoices(true);
    setPlayingChoice(choice);
    
    // Wait for mic to fully stop before playing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      await playPhrase(choice, { voice: 'alloy', playbackSpeed });
      // Extra delay after audio finishes
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error playing choice:', error);
    } finally {
      // Update BOTH ref and state
      isPlayingChoicesRef.current = false;
      setIsPlayingChoices(false);
      setPlayingChoice(null);
      
      console.log('🎤 Audio finished, restarting listening');
      
      // Restart listening after audio finishes
      if (useVoice && !showFeedback && !timedOut && !selectedAnswer) {
        setMicAutoStartPending(true);
        setTimeout(() => {
          try {
            startListening();
          } catch (err) {
            console.error('🎤 Error restarting listening:', err);
          }
        }, 300);
      }
    }
  };

  const handlePlayAllChoices = async () => {
    if (!state.choices || isPlayingChoices) return;
    
    // Stop listening and ensure it's fully stopped
    if (isListening) {
      stopListening();
    }
    
    // Update BOTH ref and state
    isPlayingChoicesRef.current = true;
    setIsPlayingChoices(true);
    
    // Wait for mic to fully stop before playing audio
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      for (const choice of state.choices) {
        await playPhrase(choice, { voice: 'alloy', playbackSpeed });
        // Small pause between choices
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      
      // Extra delay after all audio finishes to ensure system audio stops
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error playing choices:', error);
    } finally {
      // Update BOTH ref and state
      isPlayingChoicesRef.current = false;
      setIsPlayingChoices(false);
      
      console.log('🎤 All choices audio finished, restarting listening');
      
      if (useVoice && !showFeedback && !timedOut && !selectedAnswer) {
        setMicAutoStartPending(true);
        setTimeout(() => {
          try {
            startListening();
          } catch (err) {
            console.error('🎤 Error restarting listening:', err);
          }
        }, 300);
      }
    }
  };

  const handleAnswerSelect = async (word: string) => {
    if (showFeedback || selectedAnswer || timedOut) return;

    // RACE CONDITION FIX: Mark that we're processing a result BEFORE any async work
    processingResultRef.current = true;
    
    // Clear stall timer when user answers
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    setStallDetected(false);

    // Stop listening when answer is selected
    if (isListening) {
      stopListening();
    }

    const reactionTime = Date.now() - trialStartTime;
    setSelectedAnswer(word);
    
    if (!state.currentTrial) return;
    
    // =====================================================================
    // INSTANT FEEDBACK: Determine correct/incorrect immediately
    // =====================================================================
    const isCorrectAnswer = word.toLowerCase() === state.currentTrial.target.toLowerCase();
    
    // CRITICAL FIX: Call the hook's selectAnswer to update state.score
    // Previously bypassed, causing onGameComplete to always report score=0
    selectAnswer(word);
    
    // Show feedback IMMEDIATELY (before any async work)
    setFeedbackData({ 
      correct: isCorrectAnswer, 
      errorType: isCorrectAnswer ? 'correct' : 'semantic_related',
    });
    setShowFeedback(true);
    setProcessingAnswer(false);
    setUtteranceState('scored');
    setRetryPrompt(null);
    
    // Play sound IMMEDIATELY
    if (isCorrectAnswer) {
      playSuccess();
    } else {
      playError();
    }
    
    // Update via in-game adaptation hook (handles consecutive errors + difficulty)
    const adaptationResult = recordTrial({ 
      correct: isCorrectAnswer, 
      reactionTimeMs: reactionTime,
      errorType: isCorrectAnswer ? undefined : 'semantic_related'
    });
    engagement.recordTrial({
      correct: isCorrectAnswer,
      reactionTimeMs: reactionTime,
      timeout: false,
      cueLevel,
      timestamp: Date.now(),
    });
    console.log('🎯 Trial recorded via adaptation hook:', adaptationResult);

    // Compute cue efficacy immediately (before cueState is reset)
    let cueTypeGiven: 'none' | 'semantic' | 'phonemic' | 'full_word' = 'none';
    let cueWasEffective: boolean | null = null;
    let timeToSuccessAfterCueMs: number | null = null;
    const CUE_ATTRIBUTION_WINDOW_MS = 15000;
    const capturedCueState = cueState; // Capture for background
    
    if (capturedCueState) {
      cueTypeGiven = capturedCueState.type;
      const dt = Date.now() - capturedCueState.shownAt;
      
      if (isCorrectAnswer && dt <= CUE_ATTRIBUTION_WINDOW_MS) {
        cueWasEffective = true;
        timeToSuccessAfterCueMs = dt;
      } else if (!isCorrectAnswer) {
        cueWasEffective = false;
      } else {
        cueWasEffective = null;
        timeToSuccessAfterCueMs = dt;
      }
    }

    // Reset cue state for next trial
    setCueState(null);

    // Auto-advance after 1.2 seconds (faster since feedback is instant)
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
      processingResultRef.current = false;
      resetAttempt();
      advanceTrial(currentDifficulty);
    }, 1200);

    // =====================================================================
    // BACKGROUND ANALYSIS: Fire-and-forget (doesn't block UI)
    // =====================================================================
    const capturedTrial = state.currentTrial;
    const capturedTrialNumber = state.trialNumber;
    const capturedDifficulty = currentDifficulty;
    const capturedCueLevel = cueLevel;
    const capturedErrorHistory = [...errorHistory];
    
    // Run analysis in background without blocking
    (async () => {
      try {
        let uploadedPath: string | undefined;
        let duration: number | undefined;
        let mimeType: string | undefined;
        let whisperTranscript: string | undefined;
        let whisperConfidence: number | undefined;
        let acousticMetrics: any | undefined;
        let pronunciationResult: any = null;
        
        // Stop recording and upload
        if (isRecording && user && activeSessionId) {
          const recordingResult = await stopRecording();
          if (recordingResult) {
            duration = recordingResult.duration;
            mimeType = recordingResult.mimeType;
            
            // Upload in parallel with analysis
            const [path, analysisResults] = await Promise.all([
              uploadRecording(
                recordingResult.audioBlob,
                user.id,
                activeSessionId,
                capturedTrialNumber,
                recordingResult.mimeType
              ),
              Promise.all([
                analyzeSpeechAsync(recordingResult.audioBlob, recordingResult.mimeType),
                analyzePronunciationAsync(recordingResult.audioBlob, recordingResult.mimeType, capturedTrial.target)
              ])
            ]);
            
            if (path) uploadedPath = path;
            
            const [analysisResult, pronResult] = analysisResults;
            if (analysisResult) {
              whisperTranscript = analysisResult.transcript;
              whisperConfidence = analysisResult.confidence;
              acousticMetrics = analysisResult.acousticMetrics;
            }
            if (pronResult) {
              pronunciationResult = pronResult;
            }
          }
        }
        
        // Advanced error classification with acoustic metrics
        const errorClassification = await classifySpeechError(
          word,
          capturedTrial.target,
          0.8,
          {
            trialNumber: capturedTrialNumber,
            previousErrors: capturedErrorHistory.map(e => e.errorType),
            category: capturedTrial.category,
            features: capturedTrial.features
          },
          acousticMetrics ? {
            speechRateWpm: acousticMetrics.speechRateWpm,
            pauseCount: acousticMetrics.pauseCount,
            avgPauseDurationMs: acousticMetrics.avgPauseDurationMs
          } : undefined
        );
        
        // Add to error history for adaptive cueing
        setErrorHistory(prev => [...prev, errorClassification]);
        
        const correct = errorClassification.errorType === 'correct' || 
                        errorClassification.errorType === 'self_corrected';
        
        // Build unified UtteranceAnalysis object
        const speechEncouragementScore = calculateEncouragementScore(errorClassification.errorType as ExtendedErrorType);
        const utteranceAnalysis = toUtteranceAnalysis(
          whisperTranscript || '',
          errorClassification,
          speechEncouragementScore,
          acousticMetrics
        );

        // Build ShadowEvent for future co-pilot integration
        const shadowEvent = user?.id ? buildShadowEvent(
          user.id,
          sessionId,
          {
            taskType: 'photo_naming',
            domain: 'general',
            interactionMode: assistMode ? 'caregiver_assisted' : 'independent',
            difficultyLevel: capturedDifficulty,
            cueLevel: capturedCueLevel,
            targetWord: capturedTrial.target,
            category: capturedTrial.category,
          },
          utteranceAnalysis,
          {
            storagePath: uploadedPath,
            mimeType: mimeType,
            durationMs: duration,
          }
        ) : null;
        
        // Persist shadow event (fire-and-forget, gated by feature flag)
        if (shadowEvent) {
          logShadowEvent(shadowEvent, undefined, {
            cueTypeCandidate: capturedCueLevel > 0 ? cueTypeGiven : undefined,
            triggerReason: capturedCueLevel > 0 ? 'cue_level_active' : undefined,
            userSelfRecovered: errorClassification.errorType === 'self_corrected',
            environment: 'structured',
          });
        }

        // Log telemetry with unified analysis
        onTrialComplete?.({
          correct,
          reactionTimeMs: reactionTime,
          errorType: errorClassification.errorType,
          difficultyLevel: capturedDifficulty,
          cueLevel: capturedCueLevel,
          errorClassification,
          audioStoragePath: uploadedPath,
          recordingDurationMs: duration,
          audioMimeType: mimeType,
          whisperTranscript,
          whisperConfidence,
          acousticMetrics,
          encouragementScore: speechEncouragementScore,
          effortfulSpeech: utteranceAnalysis.effortfulSpeech || false,
          utteranceAnalysis,
          shadowEvent,
          cueTypeGiven,
          cueWasEffective,
          timeToSuccessAfterCueMs,
          latencyMs: micStartTimeRef.current > 0 ? Date.now() - micStartTimeRef.current : undefined,
          consecutiveErrors: hookConsecutiveErrors,
          frustrationLevel,
          recentSuccessRate,
          trialCount: state.trialNumber,
        }, capturedTrial);

        // Determine fluency availability
        const fluencyAvailable = !!acousticMetrics?.speechRateWpm;
        let fluencyUnavailableReason: 'no_recording' | 'no_session' | 'not_authed' | 'analysis_error' | 'wav_conversion_failed' | 'azure_api_error' | undefined;
        if (!fluencyAvailable) {
          if (!user) fluencyUnavailableReason = 'not_authed';
          else if (!activeSessionId) fluencyUnavailableReason = 'no_session';
          else fluencyUnavailableReason = 'analysis_error';
        }

        // Extract pronunciation data from new ok/error result format
        const pronSuccess = pronunciationResult?.ok === true;
        const pronData = pronSuccess ? pronunciationResult.data : null;
        const pronError = pronunciationResult?.ok === false ? pronunciationResult.error : null;
        
        // Build structured diagnostics for DB persistence
        const pronunciationDiagnostics = pronunciationResult ? {
          pronRequestId: pronunciationResult.pronRequestId,
          pronunciationStatus: pronSuccess ? 'complete' as const : 'failed' as const,
          pronunciationErrorStage: pronError?.stage,
          pronunciationTimingsMs: pronunciationResult.timingsMs,
          audioMeta: pronunciationResult.audioMeta
        } : undefined;

        // Update fluency reason based on pronunciation error stage
        if (pronError) {
          console.warn('🎯 [Pronunciation] Analysis failed:', pronError);
          if (pronError.stage === 'wav_conversion') {
            fluencyUnavailableReason = 'wav_conversion_failed';
          } else if (pronError.stage === 'azure_api' || pronError.stage === 'edge_function') {
            fluencyUnavailableReason = 'azure_api_error';
          }
        }

        logFinalAnalysis({
          transcript: whisperTranscript,
          transcriptSource: whisperTranscript ? 'whisper' : 'browser',
          asrConfidence: whisperConfidence,
          isCorrect: correct,
          errorType: errorClassification.errorType,
          phonologicalSimilarity: errorClassification.phonemeAccuracy,
          semanticSimilarity: errorClassification.semantic_similarity,
          classificationConfidence: errorClassification.confidence,
          reasoning: errorClassification.reasoning,
          speechRateWpm: acousticMetrics?.speechRateWpm,
          pauseCount: acousticMetrics?.pauseCount,
          totalPauseMs: acousticMetrics?.totalPauseDurationSec ? Math.round(acousticMetrics.totalPauseDurationSec * 1000) : undefined,
          avgPauseDurationMs: acousticMetrics?.avgPauseDurationMs,
          effortfulSpeech: utteranceAnalysis.effortfulSpeech,
          fluencyAvailable,
          fluencyUnavailableReason,
          cueTypeGiven: cueTypeGiven,
          cueWasEffective: cueWasEffective ?? undefined,
          timeToSuccessAfterCueMs: timeToSuccessAfterCueMs ?? undefined,
          cueTrigger: capturedCueState?.trigger,
          audioStoragePath: uploadedPath,
          recordingDurationMs: duration,
          pronunciationScore: pronData?.pronunciationScore,
          accuracyScore: pronData?.accuracyScore,
          fluencyScore: pronData?.fluencyScore,
          completenessScore: pronData?.completenessScore,
          prosodyScore: pronData?.prosodyScore,
          gopData: pronData ? {
            words: pronData.words,
            transcript: pronData.transcript,
            alignmentData: pronData.alignmentData
          } : undefined,
          alignmentData: pronData?.alignmentData,
          pronunciationError: pronError ? `${pronError.stage}: ${pronError.message}` : undefined,
          pronunciationDiagnostics,
        });

        // ── Secondary Live Analysis push: Azure PA scores ──
        // onTrialComplete fires before pronunciation analysis finishes,
        // so we push Azure PA data to the panel as soon as it arrives.
        if (pronData) {
          setLiveSnapshot({
            pronunciationScore: pronData.pronunciationScore,
            accuracyScore: pronData.accuracyScore,
            fluencyScore: pronData.fluencyScore,
            completenessScore: pronData.completenessScore,
            prosodyScore: pronData.prosodyScore,
          });
          console.log('🎯 [LiveAnalysis] Azure PA scores pushed to panel', {
            pronunciationScore: pronData.pronunciationScore,
            accuracyScore: pronData.accuracyScore,
            fluencyScore: pronData.fluencyScore,
            completenessScore: pronData.completenessScore,
            prosodyScore: pronData.prosodyScore,
          });
        }
        
        console.log('✅ [PhotoNaming] Background analysis complete for:', capturedTrial.target);
      } catch (error) {
        console.error('❌ [PhotoNaming] Background analysis error:', error);

        // Fallback: still emit minimal trial telemetry so Live Analysis panel updates
        onTrialComplete?.({
          correct: isCorrectAnswer,
          reactionTimeMs: reactionTime,
          errorType: isCorrectAnswer ? 'correct' : 'analysis_unavailable',
          difficultyLevel: capturedDifficulty,
          cueLevel: capturedCueLevel,
          whisperTranscript: undefined,
          whisperConfidence: undefined,
          acousticMetrics: undefined,
          encouragementScore: undefined,
          effortfulSpeech: false,
          utteranceAnalysis: undefined,
          shadowEvent: undefined,
          cueTypeGiven,
          cueWasEffective,
          timeToSuccessAfterCueMs,
          latencyMs: micStartTimeRef.current > 0 ? Date.now() - micStartTimeRef.current : undefined,
          consecutiveErrors: hookConsecutiveErrors,
          frustrationLevel,
          recentSuccessRate,
          trialCount: state.trialNumber,
        }, capturedTrial);
      }
    })();
  };

  const handleCaregiverResponse = async (responseType: 'looked' | 'tried' | 'said_roughly' | 'no_response') => {
    if (!state.currentTrial) return;

    const reactionTime = Date.now() - trialStartTime;

    let score = 0;
    let errorType: string | undefined;
    let correct = false;

    switch (responseType) {
      case 'said_roughly':
        score = 100;
        correct = true;
        break;
      case 'tried':
        score = 50;
        errorType = 'phonological_approximation';
        break;
      case 'looked':
        score = 25;
        errorType = 'no_verbal_output';
        break;
      case 'no_response':
        score = 0;
        errorType = 'no_response';
        break;
    }

    // FIX: Stop recording and upload audio for caregiver mode too
    let uploadedPath: string | undefined;
    let duration: number | undefined;
    let mimeType: string | undefined;
    
    if (isRecording && user && activeSessionId) {
      const recordingResult = await stopRecording();
      if (recordingResult) {
        duration = recordingResult.duration;
        mimeType = recordingResult.mimeType;
        
        const path = await uploadRecording(
          recordingResult.audioBlob,
          user.id,
          activeSessionId,
          state.trialNumber,
          recordingResult.mimeType
        );
        
        if (path) {
          uploadedPath = path;
        }
      }
    }

    setFeedbackData({ 
      correct, 
      errorType 
    });
    setShowFeedback(true);
    
    // Play sound based on result
    if (correct) {
      playSuccess();
    } else {
      playError();
    }

    // Update via in-game adaptation hook (handles difficulty adjustment)
    const adaptationResult = recordTrial({ 
      correct,
      reactionTimeMs: reactionTime
    });
    engagement.recordTrial({
      correct,
      reactionTimeMs: reactionTime,
      timeout: false,
      cueLevel,
      timestamp: Date.now(),
    });
    console.log('🏥 Caregiver response recorded via adaptation hook:', adaptationResult);

    // Calculate encouragement score for caregiver response
    const caregiverEncouragementScore = correct ? 100 : (responseType === 'tried' ? 50 : (responseType === 'looked' ? 25 : 0));
    
    onTrialComplete?.({
      correct,
      reactionTimeMs: reactionTime,
      errorType,
      difficultyLevel: currentDifficulty,
      cueLevel: cueLevel,
      encouragementScore: caregiverEncouragementScore,
      effortfulSpeech: false, // Not applicable in caregiver assist mode
      audioStoragePath: uploadedPath,
      recordingDurationMs: duration,
      audioMimeType: mimeType,
      latencyMs: micStartTimeRef.current > 0 ? Date.now() - micStartTimeRef.current : undefined,
      consecutiveErrors: hookConsecutiveErrors,
      frustrationLevel,
      recentSuccessRate,
      trialCount: state.trialNumber,
    }, state.currentTrial);

    // FIX: Log final analysis for caregiver mode too (critical for pattern analysis!)
    // Compute cue efficacy for caregiver mode
    let caregiverCueTypeGiven: 'none' | 'semantic' | 'phonemic' | 'full_word' = 'none';
    let caregiverCueWasEffective: boolean | null = null;
    
    const CUE_ATTRIBUTION_WINDOW_MS = 6000;
    
    if (cueState) {
      caregiverCueTypeGiven = cueState.type;
      const dt = Date.now() - cueState.shownAt;
      
      if (correct && dt <= CUE_ATTRIBUTION_WINDOW_MS) {
        caregiverCueWasEffective = true;
      } else if (!correct) {
        caregiverCueWasEffective = false;
      } else {
        caregiverCueWasEffective = null; // Too late to attribute
      }
    }
    
    logFinalAnalysis({
      transcriptSource: 'manual',
      isCorrect: correct,
      errorType: errorType || 'correct',
      audioStoragePath: uploadedPath,
      recordingDurationMs: duration,
      cueTypeGiven: caregiverCueTypeGiven,
      cueWasEffective: caregiverCueWasEffective ?? undefined,
      cueTrigger: cueState?.trigger, // FIX: Was missing
    });

    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
      resetAttempt(); // Reset for next trial
      advanceTrial(currentDifficulty);
    }, 2000);
  };

  if (!state.currentTrial) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-1.5 sm:gap-3 h-full">
      {/* Progress bar - compact on mobile */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs sm:text-sm text-muted-foreground">
          <span>{state.trialNumber}/{state.totalTrials}</span>
          <div className="flex items-center gap-2">
            <LevelBadge descriptor={levelDescriptor} compact />
            {/* Score intentionally hidden from the patient view — it created
                pressure and a "test" feel. Score still flows to the clinician
                summary via onGameComplete / state.score. */}
          </div>
        </div>
        <Progress 
          value={(state.trialNumber / state.totalTrials) * 100} 
          className="h-1.5 sm:h-2"
        />
      </div>

      {/* Difficulty indicator */}
      {difficultyChanged && (
        <div className={`flex items-center gap-2 px-2 py-1.5 sm:p-3 rounded-lg border text-xs sm:text-sm ${
          difficultyChanged === 'up' ? 'bg-success/10 border-success' : 'bg-warning/10 border-warning'
        }`}>
          {difficultyChanged === 'up' ? (
            <>
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span className="font-medium">Level up!</span>
            </>
          ) : (
            <>
              <TrendingDown className="w-4 h-4 shrink-0" />
              <span className="font-medium">Adjusting to help</span>
            </>
          )}
        </div>
      )}

      {/* Recording/Analyzing/Processing indicator - Enhanced */}
      {(isRecording || isAnalyzing || isCreatingSession || processingAnswer) && (
        <div className="flex items-center gap-2 text-xs sm:text-sm px-2 py-1.5 sm:p-3 rounded-lg bg-muted/50 border border-border">
          {isCreatingSession && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Setting up...</span>
            </>
          )}
          {useVoice && isSupported && !micErrorMessage && !showFeedback && !timedOut && !selectedAnswer && !isPlayingChoices && !processingAnswer && !isAnalyzing && (
            <>
              <div className="w-2.5 h-2.5 bg-primary rounded-full shrink-0" />
              <span className="text-primary font-medium">🎙️ Mic on</span>
            </>
          )}
          {processingAnswer && !isAnalyzing && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              <span className="text-primary font-medium">Processing...</span>
              {lastHeardText && <span className="text-muted-foreground text-xs truncate">"{lastHeardText}"</span>}
            </>
          )}
          {isAnalyzing && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              <span className="text-primary font-medium">Analyzing...</span>
              {lastHeardText && <span className="text-muted-foreground text-xs truncate">"{lastHeardText}"</span>}
            </>
          )}
        </div>
      )}

      {/* Purpose banner + entry instruction — first trial only */}
      {state.trialNumber === 1 && !showFeedback && (
        <>
          <ExercisePurposeBanner exerciseSlug="photo-naming" className="mx-auto max-w-md" />
          <p className="text-center text-sm font-medium text-muted-foreground">Say what you see</p>
        </>
      )}

      {/* Image — grows to fill available space */}
      <div className="relative flex-1 min-h-[120px]">
        {state.currentTrial.imageUrl ? (
          <img
            src={state.currentTrial.imageUrl}
            alt="Naming task"
            className="w-full h-full object-contain rounded-lg bg-muted"
          />
        ) : (
          // Audio-only trial - show speaker icon and play button
          <div className="w-full h-44 sm:h-52 md:h-64 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
              <Volume2 className="w-10 h-10 text-primary" />
            </div>
            <p className="text-lg font-medium text-primary">Listen and say the word</p>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => playPhrase(state.currentTrial?.target || '', { voice: 'alloy', playbackSpeed })}
              disabled={isAudioPlaying}
              className="gap-2"
            >
              <Volume2 className="w-5 h-5" />
              {isAudioPlaying ? 'Playing...' : 'Hear the word'}
            </Button>
          </div>
        )}
        <div className="absolute top-1 right-1">
          <Camera className="w-5 h-5 text-muted-foreground/50" />
        </div>
        
        {/* Timer for hard mode */}
        {isHardMode && !showFeedback && (
          <div className="absolute bottom-2 right-2">
            <TrialTimer 
              duration={timeLimit}
              onTimeout={handleTimeout}
              isActive={!showFeedback && !timedOut}
            />
          </div>
        )}
        {/* Controls overlay on bottom of image */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-10">
          <button
            onClick={() => setAutoHintsEnabled(!autoHintsEnabled)}
            className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
              autoHintsEnabled 
                ? 'bg-yellow-500/80 text-white' 
                : 'bg-black/40 text-white/60 hover:bg-black/60'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
          </button>

          <button
            onClick={handlePlayAllChoices}
            disabled={isPlayingChoices || showFeedback || timedOut}
            className={`h-8 px-3 rounded-full flex items-center gap-1.5 backdrop-blur-sm text-xs font-medium transition-colors ${
              isPlayingChoices
                ? 'bg-primary/80 text-primary-foreground'
                : 'bg-black/40 text-white hover:bg-black/60'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            {isPlayingChoices ? 'Playing...' : 'Hear choices'}
          </button>

          <div className="relative">
            {useVoice && isSupported && !micErrorMessage && !showFeedback && !timedOut && !selectedAnswer && !isPlayingChoices && !processingAnswer && !isAnalyzing && (
              <div className="absolute inset-0 rounded-full bg-primary/10 ring-2 ring-primary/30 pointer-events-none" />
            )}
            <button
              type="button"
              onPointerUp={(event) => {
                event.preventDefault();
                const nextUseVoice = !useVoice;
                setUseVoice(nextUseVoice);
                if (nextUseVoice && isSupported) {
                  setMicAutoStartPending(true);
                  setTimeout(() => startListening(), 500);
                } else {
                  setMicAutoStartPending(false);
                  stopListening();
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                const nextUseVoice = !useVoice;
                setUseVoice(nextUseVoice);
                if (nextUseVoice && isSupported) {
                  setMicAutoStartPending(true);
                  setTimeout(() => startListening(), 500);
                } else {
                  setMicAutoStartPending(false);
                  stopListening();
                }
              }}
              onClick={(event) => {
                event.preventDefault();
              }}
              className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
                useVoice && isSupported && !micErrorMessage && !showFeedback && !timedOut && !selectedAnswer && !isPlayingChoices && !processingAnswer && !isAnalyzing
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/40'
                  : 'bg-black/40 text-white hover:bg-black/60'
              }`}
            >
              <div>
                {useVoice ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Show transcript while voice mode is active */}
      {useVoice && transcript && !showFeedback && !timedOut && !selectedAnswer && !isPlayingChoices && (
        <div className="text-xs text-center px-2 py-1 bg-muted rounded">
          Heard: "{transcript}"
        </div>
      )}
      
      {/* Retry prompt */}
      {retryPrompt && !showFeedback && !timedOut && (
        <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-xs animate-fade-in">
          <Mic className="w-3.5 h-3.5 text-primary animate-pulse shrink-0" />
          <span className="text-primary">{retryPrompt}</span>
        </div>
      )}
      
      {/* Only show real microphone errors, not normal restart gaps */}
      {useVoice && micErrorMessage && !showFeedback && !timedOut && !selectedAnswer && !isPlayingChoicesRef.current && (
        <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-warning/10 border border-warning rounded-lg text-xs animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0" />
          <span className="text-warning">{micErrorMessage}</span>
        </div>
      )}

      {/* Answer choices */}
      {!assistMode ? (
        <div className="space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2.5">
            {state.choices.map((choice, idx) => (
              <div key={idx} className="relative">
                <Button
                  variant={selectedAnswer === choice ? "default" : "outline"}
                  className="w-full h-[64px] sm:h-[72px] text-lg sm:text-xl font-medium pr-11"
                  onClick={() => handleAnswerSelect(choice)}
                  disabled={showFeedback || timedOut || isPlayingChoices}
                >
                  {choice}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlaySingleChoice(choice);
                  }}
                  disabled={showFeedback || timedOut || isPlayingChoices}
                >
                  <Volume2 
                    className={`w-4 h-4 ${playingChoice === choice ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} 
                  />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Caregiver assist mode controls
        <div className="space-y-3">
          <p className="text-sm font-medium text-center">What did they do?</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => handleCaregiverResponse('looked')}
              disabled={showFeedback}
            >
              👀 Looked
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCaregiverResponse('tried')}
              disabled={showFeedback}
            >
              🗣️ Tried
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCaregiverResponse('said_roughly')}
              disabled={showFeedback}
            >
              ✅ Said it
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCaregiverResponse('no_response')}
              disabled={showFeedback}
            >
              ⏸️ No response
            </Button>
          </div>
        </div>
      )}

      {/* Hint button */}
      {allowManualHints && !showFeedback && !timedOut && cueLevel < 3 && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRequestHint}
            className="gap-2"
          >
            <Lightbulb className="w-4 h-4" />
            Need a hint?
          </Button>
        </div>
      )}

      {/* Admin Force Cue - only via debug overlay (Ctrl+Shift+D), not inline */}

      {/* Feedback - compact on mobile */}
      {showFeedback && feedbackData && (
        <div className={`px-4 py-3 sm:p-6 rounded-lg text-center transition-all ${
          feedbackData.correct 
            ? 'bg-success/10 border border-success/20' 
            : 'bg-accent/10 border border-accent/20'
        }`}>
          {feedbackData.correct ? (
            <CheckCircle2 className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 text-success animate-bounce" />
          ) : (
            <div className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 text-accent flex items-center justify-center text-2xl sm:text-3xl">
              💪
            </div>
          )}
          <p className="text-sm sm:text-lg font-semibold">
            {state.currentTrial && generateGentleFeedback(
              feedbackData.errorType as any,
              state.currentTrial.target,
              selectedAnswer || undefined,
              feedbackData.semanticSimilarity,
              feedbackData.phonemeAccuracy
            )}
          </p>
        </div>
      )}

      {/* Debug Overlay (enable via ?debug=cue or localStorage.setItem('cue-debug', 'true')) */}
      <CueDebugOverlay
        visible={showDebugOverlay}
        stallDetected={stallDetected}
        consecutiveErrors={hookConsecutiveErrors}
        autoCueShownThisTrial={autoCueShownThisTrialRef.current}
        cueLevel={cueLevel}
        cueType={cueState?.type || null}
        cueTrigger={cueState?.trigger || null}
        cueShownAt={cueState?.shownAt || null}
        trialNumber={state.trialNumber}
      />
    </div>
  );
};
