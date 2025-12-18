import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Camera, TrendingUp, TrendingDown, Clock, Lightbulb, Mic, MicOff, Volume2, AlertCircle, Loader2, Zap } from 'lucide-react';
import { usePhotoNamingGame } from '@/hooks/usePhotoNamingGame';
import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';
import { TrialTimer } from '@/components/TrialTimer';
import { getCueText, selectOptimalCue } from '@/lib/cueGenerator';
import { selectOptimalCue as selectPersonalizedCue } from '@/lib/cueSelector';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useGameSounds } from '@/hooks/useGameSounds';
import { classifySpeechError, type ErrorClassificationResult } from '@/lib/errorClassifier';
import { generateGentleFeedback, calculateEncouragementScore } from '@/lib/feedbackGenerator';
import { toUtteranceAnalysis, buildShadowEvent, type UtteranceAnalysis, type ExtendedErrorType } from '@/types/utteranceAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { normalizeASROutput, areHomophones } from '@/lib/speechNormalizer';
import { usePhraseAudio } from '@/hooks/usePhraseAudio';
import { useUserSpeechProfile } from '@/hooks/useUserSpeechProfile';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { CueDebugOverlay } from '@/components/CueDebugOverlay';
import { useUserPermissions } from '@/hooks/useUserPermissions';

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
  }, trial: any) => void;
  onGameComplete?: (finalScore: number) => void;
  onDifficultyChange?: (newLevel: number, reason: string) => void;
}

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
  const { state, nextTrial } = usePhotoNamingGame(totalTrials, initialDifficulty, customTrials);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());
  const [feedbackData, setFeedbackData] = useState<{
    correct: boolean;
    errorType?: string;
    semanticSimilarity?: number;
    phonemeAccuracy?: number;
  } | null>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState(initialDifficulty);
  const [difficultyChanged, setDifficultyChanged] = useState<'up' | 'down' | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [cueLevel, setCueLevel] = useState(0); // 0=none, 1=semantic, 2=phonemic, 3=full
  const [showCue, setShowCue] = useState(false);
  const [currentCueText, setCurrentCueText] = useState('');
  const [useVoice, setUseVoice] = useState(true); // Toggle voice mode
  const [isPlayingChoices, setIsPlayingChoices] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.75); // Default slower for accessibility
  const [playingChoice, setPlayingChoice] = useState<string | null>(null);
  const [stallDetected, setStallDetected] = useState(false); // Stall-based cue trigger
  const [lastHeardText, setLastHeardText] = useState<string | null>(null); // Last ASR result
  const [processingAnswer, setProcessingAnswer] = useState(false); // Visual: processing selected answer
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
  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoListenInitiatedRef = useRef<number | null>(null); // Track which trial initiated auto-listen
  const processingResultRef = useRef(false); // Track if we're processing a result (prevents abandoned race)
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null); // Stall detection timer
  const autoCueShownThisTrialRef = useRef(false); // Prevent auto-cue spam per trial
  
  // Refs for stall timer closure safety (avoid reading stale state)
  const showFeedbackRef = useRef(showFeedback);
  const selectedAnswerRef = useRef(selectedAnswer);
  const timedOutRef = useRef(timedOut);
  const showCueRef = useRef(showCue);
  
  const { toast } = useToast();
  const { playSuccess, playError, playLevelUp, playLevelDown, playHint, playTimeout } = useGameSounds();
  const { user } = useAuth();
  const { playPhrase, isPlaying: isAudioPlaying } = usePhraseAudio();
  const { profile: speechProfile, loading: profileLoading } = useUserSpeechProfile(user?.id);
  
  // FIX 1: Auto-create session for standalone games (use canonical slug)
  const { activeSessionId, isCreatingSession } = useStandaloneSession(
    user?.id,
    sessionId,
    CANONICAL_SLUGS.PHOTO_NAMING
  );
  
  // Proper attempt-based utterance logging (no duplicates)
  const { 
    currentAttemptId, 
    isFinalized,
    startAttempt, 
    logBrowserTranscript, 
    logFinalAnalysis, 
    resetAttempt 
  } = useUtteranceLogger();
  
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
  
  // Adaptive controller (persists across renders)
  const controllerRef = useRef(new AdaptiveDifficultyController());
  
  // Ref to trigger voice restart after no-match
  const needsVoiceRestartRef = useRef(false);
  
  // Keep refs in sync with state for stall timer closure safety
  useEffect(() => { showFeedbackRef.current = showFeedback; }, [showFeedback]);
  useEffect(() => { selectedAnswerRef.current = selectedAnswer; }, [selectedAnswer]);
  useEffect(() => { timedOutRef.current = timedOut; }, [timedOut]);
  useEffect(() => { showCueRef.current = showCue; }, [showCue]);
  
  // CRITICAL: Clean up stall timer on trial change and unmount
  // Use trialNumber as dependency (unique per trial, unlike target which may repeat)
  useEffect(() => {
    return () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };
  }, [state.trialNumber]); // Use trialNumber for unique trial identity

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
    
    // Play hint sound
    playHint?.();
    
    console.log('✅ Auto-cue delivered:', { trigger, cueType, cueText: autoCueDecision.cueText });
    return true;
  }, [state.currentTrial, errorHistory, playHint]);

  // =============================================================================
  // Watch consecutive errors and trigger cue if >= 2 errors
  // =============================================================================
  useEffect(() => {
    if (consecutiveErrors >= 2 && !autoCueShownThisTrialRef.current && !showFeedback && !timedOut) {
      console.log('🔥 Consecutive errors threshold reached:', consecutiveErrors);
      triggerAutoCue('consecutive_errors');
    }
  }, [consecutiveErrors, showFeedback, timedOut, triggerAutoCue]);
  
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
  
  // Handle speech recognition results - MUST be declared before hook
  const handleSpeechResult = useCallback(async (transcript: string) => {
    // Use REF to avoid stale closure bug!
    if (showFeedback || selectedAnswer || timedOut || isPlayingChoicesRef.current) return;
    
    // Guard: Ensure we have choices before trying to match
    if (!state.choices || state.choices.length === 0 || !state.currentTrial) {
      console.warn('⚠️ Speech result received but game not ready:', {
        hasChoices: !!state.choices,
        choicesLength: state.choices?.length,
        hasTrial: !!state.currentTrial,
        transcript
      });
      return;
    }
    
    console.log('Speech result:', transcript);
    
    // Update lastHeardText for visual feedback
    setLastHeardText(transcript);
    
    // Log browser transcript (no duplicates - just updates the attempt context)
    logBrowserTranscript(transcript);
    
    const matchedChoice = findMatchingChoice(transcript);
    
    if (matchedChoice) {
      console.log('Matched choice:', matchedChoice);
      setProcessingAnswer(true); // Show "Processing your answer..." immediately
      handleAnswerSelect(matchedChoice);
    } else {
      console.log('No match found for:', transcript);
      toast({
        title: "Didn't catch that",
        description: `Heard: "${transcript}". Try saying one of the words shown.`,
        variant: "destructive",
        duration: 2000,
      });
      
      // Phase 1 Fix: Flag for voice restart after no-match
      needsVoiceRestartRef.current = true;
    }
  }, [showFeedback, selectedAnswer, timedOut, state.choices, state.currentTrial, toast, logBrowserTranscript]);
  
  // Speech recognition hook - uses handleSpeechResult callback
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    isSupported,
    error: speechError 
  } = useSpeechRecognition(handleSpeechResult, false, true); // Enable continuous listening
  
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

  // Azure Pronunciation Assessment (real pronunciation scores)
  const analyzePronunciationAsync = async (
    audioBlob: Blob,
    _mimeType: string, // Original mimeType ignored - we convert to WAV
    targetWord: string
  ): Promise<{
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
  } | null> => {
    try {
      // Convert to WAV format for Azure (WebM/Opus has poor phoneme support)
      const { convertBlobToWav } = await import('@/lib/convertToWav');
      const wavBlob = await convertBlobToWav(audioBlob);
      
      // Convert WAV blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Audio = result.split(',')[1];
          resolve(base64Audio);
        };
      });
      
      reader.readAsDataURL(wavBlob);
      const base64Audio = await base64Promise;

      console.log('🎯 [PhotoNaming] Calling Azure Pronunciation Assessment for:', targetWord);

      const { data, error } = await supabase.functions.invoke('analyze-pronunciation', {
        body: { 
          audioBlob: base64Audio, 
          mimeType: 'audio/wav', // Always send as WAV now
          referenceText: targetWord 
        },
      });

      if (error) {
        console.error('Pronunciation analysis error:', error);
        return null;
      }

      console.log('🎯 Azure Pronunciation result:', {
        pronunciationScore: data.pronunciationScore,
        accuracyScore: data.accuracyScore,
        fluencyScore: data.fluencyScore,
        transcript: data.transcript,
      });

      return {
        pronunciationScore: data.pronunciationScore || 0,
        accuracyScore: data.accuracyScore || 0,
        fluencyScore: data.fluencyScore || 0,
        completenessScore: data.completenessScore || 0,
        prosodyScore: data.prosodyScore,
        transcript: data.transcript || '',
        words: data.words || [],
        alignmentData: data.alignmentData,
      };
    } catch (error) {
      console.error('Failed to analyze pronunciation:', error);
      return null;
    }
  };


  // Start timing new trial and reset state
  useEffect(() => {
    if (state.currentTrial && !showFeedback) {
      setTrialStartTime(Date.now());
      setSelectedAnswer(null);
      setTimedOut(false);
      setCueLevel(0);
      setShowCue(false);
      setCurrentCueText('');
      setLastHeardText(null); // Reset "last heard" for new trial
      setProcessingAnswer(false); // Reset processing state
      
      // Start a new attempt for utterance logging (no duplicates!)
      console.log('🎯 [PhotoNaming] New trial starting:', {
        target: state.currentTrial.target,
        trialNumber: state.trialNumber,
        activeSessionId,
        userId: user?.id,
        hasSession: !!activeSessionId,
        hasUser: !!user?.id
      });
      
      if (activeSessionId && user?.id) {
        const attemptId = startAttempt({
          sessionId: activeSessionId,
          userId: user.id,
          exerciseSlug: CANONICAL_SLUGS.PHOTO_NAMING,
          trialIndex: state.trialNumber,
          attemptNumber: 1,
          targetWord: state.currentTrial.target,
          category: state.currentTrial.category
        });
        console.log('✅ [PhotoNaming] Attempt started:', attemptId);
      } else {
        console.warn('⚠️ [PhotoNaming] Cannot start attempt - missing session or user:', {
          activeSessionId,
          userId: user?.id
        });
      }
      
      // Start audio recording if supported - USE activeSessionId for standalone mode
      if (isRecordingSupported && user && activeSessionId) {
        startRecording();
        console.log('🎙️ Recording started for session:', activeSessionId);
      }
      
      // Reset per-trial cue tracking on new trial
      autoCueShownThisTrialRef.current = false;
      setStallDetected(false);
      
      // Start stall detection timer (3 seconds of hesitation)
      // Only start when trial is ready for user response
      const trialIsReady = state.currentTrial && 
                           !showFeedback && 
                           !isPlayingChoices && 
                           !isCreatingSession;
      
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
      }
      
      if (trialIsReady) {
        stallTimerRef.current = setTimeout(() => {
          // Read from refs to avoid stale closure
          const isIdle = !showFeedbackRef.current && 
                         !selectedAnswerRef.current && 
                         !timedOutRef.current && 
                         !showCueRef.current &&
                         !isPlayingChoicesRef.current; // Don't stall during audio playback
          
          if (isIdle && !autoCueShownThisTrialRef.current) {
            // CRITICAL FIX: Call triggerAutoCue DIRECTLY instead of setStallDetected
            // This eliminates the two-phase state relay that was causing cues to never fire
            console.log('🕐 Stall detected - triggering cue directly');
            triggerAutoCue('stall');
          }
        }, 3000);
      }
      
      // Auto-listen: Only initiate once per trial
      if (useVoice && isSupported && autoListenInitiatedRef.current !== state.trialNumber) {
        autoListenInitiatedRef.current = state.trialNumber;
        
        const timeoutId = setTimeout(() => {
          console.log('🎤 Auto-listen timeout executed for new trial', state.trialNumber);
          if (!isPlayingChoicesRef.current && !showFeedback) {
            try {
              startListening();
            } catch (err) {
              console.error('🎤 Error auto-starting listening:', err);
            }
          }
        }, 800);
        
        return () => {
          clearTimeout(timeoutId);
          if (stallTimerRef.current) {
            clearTimeout(stallTimerRef.current);
          }
        };
      } else {
        // If not auto-listening, still need to cleanup stall timer
        return () => {
          if (stallTimerRef.current) {
            clearTimeout(stallTimerRef.current);
          }
        };
      }
    }
    
    // Stop listening when showing feedback
    if (showFeedback && isListening) {
      stopListening();
    }
  }, [state.currentTrial, state.trialNumber, showFeedback, useVoice, isSupported, startListening, isListening, stopListening, isRecordingSupported, user, activeSessionId, startRecording, startAttempt, triggerAutoCue, isPlayingChoices, isCreatingSession]);

  // Handle game completion
  useEffect(() => {
    if (state.isComplete) {
      console.log('[PhotoNamingGame] ✅ onGameComplete firing', {
        score: state.score,
        gameType: 'PhotoNaming'
      });
      onGameComplete(state.score);
    }
  }, [state.isComplete, state.score, onGameComplete]);

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
    
    // Track consecutive errors
    setConsecutiveErrors((prev) => prev + 1);

    // Update adaptive controller
    const controller = controllerRef.current;
    controller.update(false);
    
    // Check if difficulty should adjust
    const newLevel = controller.adjustLevel(currentDifficulty);
    if (newLevel !== currentDifficulty) {
      const direction = newLevel > currentDifficulty ? 'up' : 'down';
      setDifficultyChanged(direction);
      setCurrentDifficulty(newLevel);
      
      const reason = direction === 'up' 
        ? `Success rate ${(controller.getSuccessRate() * 100).toFixed(0)}% - increasing challenge`
        : `Success rate ${(controller.getSuccessRate() * 100).toFixed(0)}% - providing support`;
      
      onDifficultyChange?.(newLevel, reason);
      
      setTimeout(() => setDifficultyChanged(null), 2000);
    }

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
      nextTrial(currentDifficulty);
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
      
      // Restart listening after all audio finishes
      if (useVoice && !showFeedback && !timedOut && !selectedAnswer) {
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
    
    // Stop recording and upload
    let uploadedPath: string | undefined;
    let duration: number | undefined;
    let mimeType: string | undefined;
    let whisperTranscript: string | undefined;
    let whisperConfidence: number | undefined;
    let acousticMetrics: any | undefined;
    let pronunciationResult: {
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
    } | null = null;
    
    if (isRecording && user && activeSessionId) {
      setIsAnalyzing(true);
      const recordingResult = await stopRecording();
      if (recordingResult) {
        console.log('🎙️ [PhotoNaming] Recording blob ready:', { 
          size: recordingResult.audioBlob.size, 
          type: recordingResult.mimeType, 
          targetWord: state.currentTrial.target 
        });
        
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

        // Run Whisper transcription and Azure Pronunciation Assessment in parallel
        console.log('➡️ [PhotoNaming] Invoking analyze-speech + analyze-pronunciation in parallel');
        const [analysisResult, pronResult] = await Promise.all([
          analyzeSpeechAsync(recordingResult.audioBlob, recordingResult.mimeType),
          analyzePronunciationAsync(
            recordingResult.audioBlob, 
            recordingResult.mimeType,
            state.currentTrial.target
          )
        ]);
        
        if (analysisResult) {
          whisperTranscript = analysisResult.transcript;
          whisperConfidence = analysisResult.confidence;
          acousticMetrics = analysisResult.acousticMetrics;
          console.log('✅ [PhotoNaming] Whisper returned:', { 
            transcript: whisperTranscript, 
            confidence: whisperConfidence 
          });
        } else {
          console.log('❌ [PhotoNaming] Whisper returned null');
        }
        
        if (pronResult) {
          pronunciationResult = pronResult;
          console.log('✅ [PhotoNaming] Azure Pronunciation returned:', {
            overall: pronResult.pronunciationScore,
            accuracy: pronResult.accuracyScore,
            fluency: pronResult.fluencyScore,
            completeness: pronResult.completenessScore
          });
        } else {
          console.log('❌ [PhotoNaming] Azure Pronunciation returned null');
        }
      }
      setIsAnalyzing(false);
    } else {
      console.log('⚠️ [PhotoNaming] Skipping speech analysis:', { 
        isRecording, 
        hasUser: !!user, 
        hasSession: !!activeSessionId 
      });
    }
    
    // Advanced error classification with acoustic metrics
    const errorClassification = await classifySpeechError(
      word,
      state.currentTrial.target,
      0.8, // TODO: Get actual ASR confidence when using voice
      {
        trialNumber: state.trialNumber,
        previousErrors: errorHistory.map(e => e.errorType),
        category: state.currentTrial.category,
        features: state.currentTrial.features
      },
      acousticMetrics ? {
        speechRateWpm: acousticMetrics.speechRateWpm,
        pauseCount: acousticMetrics.pauseCount,
        avgPauseDurationMs: acousticMetrics.avgPauseDurationMs
      } : undefined
    );
    
    const correct = errorClassification.errorType === 'correct' || 
                    errorClassification.errorType === 'self_corrected';
    
    // Calculate encouragement score based on error type
    const encouragementScore = calculateEncouragementScore(errorClassification.errorType);
    
    // Add to error history for adaptive cueing
    setErrorHistory(prev => [...prev, errorClassification]);
    
    // Log detailed classification for debugging
    console.log('Error classification:', {
      spoken: word,
      target: state.currentTrial.target,
      result: errorClassification
    });
    
    setFeedbackData({ 
      correct, 
      errorType: errorClassification.errorType,
      semanticSimilarity: errorClassification.semantic_similarity,
      phonemeAccuracy: errorClassification.phonemeAccuracy
    });
    setShowFeedback(true);
    setProcessingAnswer(false); // Clear processing state when showing feedback
    
    // Play sound based on result
    if (correct) {
      playSuccess();
    } else {
      playError();
    }
    
    // Track consecutive errors
    if (correct) {
      setConsecutiveErrors(0);
    } else {
      setConsecutiveErrors((prev) => prev + 1);
    }

    // Update adaptive controller
    const controller = controllerRef.current;
    controller.update(correct);
    
    // Check if difficulty should adjust
    const newLevel = controller.adjustLevel(currentDifficulty);
    if (newLevel !== currentDifficulty) {
      const direction = newLevel > currentDifficulty ? 'up' : 'down';
      setDifficultyChanged(direction);
      setCurrentDifficulty(newLevel);
      
      // Play level change sound
      setTimeout(() => {
        if (direction === 'up') {
          playLevelUp();
        } else {
          playLevelDown();
        }
      }, 500);
      
      const reason = direction === 'up' 
        ? `Success rate ${(controller.getSuccessRate() * 100).toFixed(0)}% - increasing challenge`
        : `Success rate ${(controller.getSuccessRate() * 100).toFixed(0)}% - providing support`;
      
      onDifficultyChange?.(newLevel, reason);
      
      // Clear difficulty change indicator after 2 seconds
      setTimeout(() => setDifficultyChanged(null), 2000);
    }

    // Compute cue efficacy before resetting state
    let cueTypeGiven: 'none' | 'semantic' | 'phonemic' | 'full_word' = 'none';
    let cueWasEffective: boolean | null = null;
    let timeToSuccessAfterCueMs: number | null = null;

    // Cue efficacy with 6s attribution window
    // - Correct within 6s: cue was effective
    // - Incorrect: cue was ineffective
    // - Correct but >6s: ambiguous (null) - can't confidently attribute to cue
    // EXTENDED: 15 seconds for stroke survivors (was 6s - too short)
    const CUE_ATTRIBUTION_WINDOW_MS = 15000;
    
    if (cueState) {
      cueTypeGiven = cueState.type;
      const dt = Date.now() - cueState.shownAt;
      
      if (correct && dt <= CUE_ATTRIBUTION_WINDOW_MS) {
        cueWasEffective = true;
        timeToSuccessAfterCueMs = dt;
      } else if (!correct) {
        cueWasEffective = false;
        timeToSuccessAfterCueMs = null;
      } else {
        // Correct but too late to attribute confidently
        cueWasEffective = null;
        timeToSuccessAfterCueMs = dt; // Keep timing for analysis
      }
    }

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
        difficultyLevel: currentDifficulty,
        cueLevel: cueLevel,
        targetWord: state.currentTrial?.target,
        category: state.currentTrial?.category,
      },
      utteranceAnalysis,
      {
        storagePath: uploadedPath,
        mimeType: mimeType,
        durationMs: duration,
      }
    ) : null;
    
    // Log telemetry with unified analysis
    onTrialComplete?.({
      correct,
      reactionTimeMs: reactionTime,
      errorType: errorClassification.errorType,
      difficultyLevel: currentDifficulty,
      cueLevel: cueLevel,
      errorClassification,
      audioStoragePath: uploadedPath,
      recordingDurationMs: duration,
      audioMimeType: mimeType,
      whisperTranscript,
      whisperConfidence,
      acousticMetrics,
      encouragementScore: speechEncouragementScore,
      effortfulSpeech: utteranceAnalysis.effortfulSpeech || false,
      utteranceAnalysis, // NEW: unified analysis object
      shadowEvent,       // NEW: for future co-pilot
      cueTypeGiven,      // NEW: cue efficacy tracking
      cueWasEffective,   // NEW: cue efficacy tracking
      timeToSuccessAfterCueMs, // NEW: cue efficacy tracking
    }, state.currentTrial);

    // Log final analysis to utterance_analyses table (clean analytics)
    console.log('📊 [PhotoNaming] Logging final analysis:', {
      target: state.currentTrial.target,
      isCorrect: correct,
      errorType: errorClassification.errorType,
      hasTranscript: !!whisperTranscript,
      phonemeAccuracy: errorClassification.phonemeAccuracy,
      semanticSimilarity: errorClassification.semantic_similarity
    });
    
    // Determine fluency availability and reason
    const fluencyAvailable = !!acousticMetrics?.speechRateWpm;
    let fluencyUnavailableReason: 'no_recording' | 'no_session' | 'not_authed' | 'analysis_error' | undefined;
    if (!fluencyAvailable) {
      if (!user) fluencyUnavailableReason = 'not_authed';
      else if (!activeSessionId) fluencyUnavailableReason = 'no_session';
      else if (!isRecording) fluencyUnavailableReason = 'no_recording';
      else fluencyUnavailableReason = 'analysis_error';
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
      cueTrigger: cueState?.trigger,
      audioStoragePath: uploadedPath,
      recordingDurationMs: duration,
      // Azure Pronunciation Assessment scores
      pronunciationScore: pronunciationResult?.pronunciationScore,
      accuracyScore: pronunciationResult?.accuracyScore,
      fluencyScore: pronunciationResult?.fluencyScore,
      completenessScore: pronunciationResult?.completenessScore,
      prosodyScore: pronunciationResult?.prosodyScore,
      gopData: pronunciationResult ? {
        words: pronunciationResult.words,
        transcript: pronunciationResult.transcript,
        alignmentData: pronunciationResult.alignmentData
      } : undefined,
      alignmentData: pronunciationResult?.alignmentData
    });

    // Reset cue state for next trial
    setCueState(null);

    // Auto-advance after 1.5 seconds
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
      processingResultRef.current = false; // Allow abandoned logging again
      resetAttempt(); // Reset for next trial
      nextTrial(currentDifficulty);
    }, 1500);
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

    // Update adaptive controller
    const controller = controllerRef.current;
    controller.update(correct);
    
    const newLevel = controller.adjustLevel(currentDifficulty);
    if (newLevel !== currentDifficulty) {
      const direction = newLevel > currentDifficulty ? 'up' : 'down';
      setDifficultyChanged(direction);
      setCurrentDifficulty(newLevel);
      
      const reason = direction === 'up' 
        ? 'Performance improving - increasing challenge'
        : 'Providing more support';
      
      onDifficultyChange?.(newLevel, reason);
      
      setTimeout(() => setDifficultyChanged(null), 2000);
    }

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
      nextTrial(currentDifficulty);
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
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Trial {state.trialNumber} of {state.totalTrials}</span>
          <span>Score: {state.score}</span>
        </div>
        <Progress 
          value={(state.trialNumber / state.totalTrials) * 100} 
          className="h-2"
        />
      </div>

      {/* Difficulty indicator */}
      {difficultyChanged && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border ${
          difficultyChanged === 'up' ? 'bg-success/10 border-success' : 'bg-warning/10 border-warning'
        }`}>
          {difficultyChanged === 'up' ? (
            <>
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">Level increased!</span>
            </>
          ) : (
            <>
              <TrendingDown className="w-5 h-5" />
              <span className="text-sm font-medium">Adjusting to help</span>
            </>
          )}
        </div>
      )}

      {/* Recording/Analyzing/Processing indicator - Enhanced */}
      {(isRecording || isAnalyzing || isCreatingSession || processingAnswer) && (
        <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-muted/50 border border-border">
          {isCreatingSession && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Setting up session...</span>
            </>
          )}
          {isRecording && !isAnalyzing && !processingAnswer && (
            <>
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              <span className="text-destructive font-medium">🎙️ Listening... say the word!</span>
            </>
          )}
          {processingAnswer && !isAnalyzing && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <div className="flex flex-col">
                <span className="text-primary font-medium">Processing your answer...</span>
                {lastHeardText && (
                  <span className="text-muted-foreground text-xs">Heard: "{lastHeardText}"</span>
                )}
              </div>
            </>
          )}
          {isAnalyzing && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <div className="flex flex-col">
                <span className="text-primary font-medium">🧠 Analyzing pronunciation...</span>
                {lastHeardText && (
                  <span className="text-muted-foreground text-xs">Heard: "{lastHeardText}"</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Image */}
      <div className="relative">
        <img
          src={state.currentTrial.imageUrl}
          alt="Naming task"
          className="w-full h-64 object-contain rounded-lg bg-muted"
        />
        <div className="absolute top-2 right-2">
          <Camera className="w-6 h-6 text-muted-foreground" />
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
      </div>

      {/* Cue display */}
      {showCue && currentCueText && (
        <div className="bg-accent/10 border border-accent p-4 rounded-lg flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-accent mb-1">Hint (Level {cueLevel}/3)</p>
            <p className="text-sm">{currentCueText}</p>
          </div>
        </div>
      )}

      {/* Voice mode toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {useVoice ? "Say the word or tap an answer" : "Tap your answer"}
        </p>
        
        <div className="relative">
          {/* Listening pulse ring */}
          {isListening && (
            <div className="absolute inset-0 rounded-md animate-pulse">
              <div className="absolute inset-0 rounded-md bg-primary/20 animate-ping" />
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUseVoice(!useVoice);
              if (!useVoice && isSupported) {
                setTimeout(() => startListening(), 500);
              } else if (isListening) {
                stopListening();
              }
            }}
            className={`gap-2 relative z-10 ${isListening ? 'ring-2 ring-primary/50 ring-offset-2' : ''}`}
          >
            <div className={isListening ? 'animate-pulse' : ''}>
              {useVoice ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </div>
            {useVoice ? "Voice On" : "Voice Off"}
          </Button>
        </div>
      </div>

      {/* Show transcript when listening */}
      {useVoice && isListening && transcript && (
        <div className="text-sm text-center p-2 bg-muted rounded">
          Heard: "{transcript}"
        </div>
      )}
      
      {/* Phase 3: Visual indicator when voice is unexpectedly off */}
      {useVoice && !isListening && !showFeedback && !timedOut && !selectedAnswer && !isPlayingChoicesRef.current && (
        <div className="flex items-center justify-center gap-2 p-3 bg-warning/10 border border-warning rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 text-warning" />
          <span className="text-warning">Voice paused - tap the mic to restart</span>
        </div>
      )}

      {/* Answer choices */}
      {!assistMode ? (
        <div className="space-y-3">
          {/* Hear All Choices Button with Speed Control */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePlayAllChoices}
              disabled={isPlayingChoices || showFeedback || timedOut}
              variant="secondary"
              size="sm"
              className="flex-1"
            >
              <Volume2 className="w-4 h-4 mr-2" />
              {isPlayingChoices ? 'Playing choices...' : 'Hear all choices'}
            </Button>
            
            <div className="flex items-center gap-1 text-sm">
              <label htmlFor="speed-control" className="text-muted-foreground text-xs whitespace-nowrap">Speed:</label>
              <select
                id="speed-control"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                className="px-2 py-1 rounded border border-border bg-background text-foreground text-xs"
                disabled={isPlayingChoices}
              >
                <option value={0.5}>0.5×</option>
                <option value={0.75}>0.75×</option>
                <option value={1.0}>1×</option>
                <option value={1.25}>1.25×</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {state.choices.map((choice, idx) => (
              <div key={idx} className="relative">
                <Button
                  variant={selectedAnswer === choice ? "default" : "outline"}
                  size="lg"
                  className="w-full h-16 text-lg pr-12"
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

      {/* Admin-only Force Cue buttons for pipeline testing */}
      {isAdmin && !showFeedback && !timedOut && !showCue && state.currentTrial && (
        <div className="flex justify-center gap-2 mt-2 p-2 border border-dashed border-amber-500 rounded bg-amber-50 dark:bg-amber-950/30">
          <span className="text-xs text-amber-700 dark:text-amber-400 self-center">Admin:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerAutoCue('user_request')}
            className="gap-1 text-xs"
          >
            <Zap className="w-3 h-3" />
            Force Cue (test)
          </Button>
        </div>
      )}

      {/* Feedback */}
      {showFeedback && feedbackData && (
        <div className={`p-6 rounded-lg text-center transition-all ${
          feedbackData.correct 
            ? 'bg-success/10 border border-success/20' 
            : 'bg-accent/10 border border-accent/20'
        }`}>
          {feedbackData.correct ? (
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success animate-bounce" />
          ) : (
            <div className="w-12 h-12 mx-auto mb-3 text-accent flex items-center justify-center text-3xl">
              💪
            </div>
          )}
          <p className="text-lg font-semibold mb-3">
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
        consecutiveErrors={consecutiveErrors}
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
