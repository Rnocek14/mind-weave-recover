import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Camera, TrendingUp, TrendingDown, Clock, Lightbulb, Mic, MicOff, Volume2, AlertCircle, Loader2 } from 'lucide-react';
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
  
  // Refs to avoid stale closures
  const isPlayingChoicesRef = useRef(false);
  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoListenInitiatedRef = useRef<number | null>(null); // Track which trial initiated auto-listen
  
  const { toast } = useToast();
  const { playSuccess, playError, playLevelUp, playLevelDown, playHint, playTimeout } = useGameSounds();
  const { user } = useAuth();
  const { playPhrase, isPlaying: isAudioPlaying } = usePhraseAudio();
  const { profile: speechProfile, loading: profileLoading } = useUserSpeechProfile(user?.id);
  
  // FIX 1: Auto-create session for standalone games
  const { activeSessionId, isCreatingSession } = useStandaloneSession(
    user?.id,
    sessionId,
    'photo_naming'
  );
  
  // Proper attempt-based utterance logging (no duplicates)
  const { 
    currentAttemptId, 
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
  } | null>(null);
  
  // Adaptive controller (persists across renders)
  const controllerRef = useRef(new AdaptiveDifficultyController());
  
  // Ref to trigger voice restart after no-match
  const needsVoiceRestartRef = useRef(false);
  
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
      const similarity = calculateSimilarity(normalized, choiceLower);
      console.log(`🔍 Similarity "${normalized}" vs "${choiceLower}": ${similarity}`);
      return similarity > 0.7;
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
    
    // Log browser transcript (no duplicates - just updates the attempt context)
    logBrowserTranscript(transcript);
    
    const matchedChoice = findMatchingChoice(transcript);
    
    if (matchedChoice) {
      console.log('Matched choice:', matchedChoice);
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

  // Async speech analysis (doesn't block trial logging)
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

  // Start timing new trial and reset state
  useEffect(() => {
    if (state.currentTrial && !showFeedback) {
      setTrialStartTime(Date.now());
      setSelectedAnswer(null);
      setTimedOut(false);
      setCueLevel(0);
      setShowCue(false);
      setCurrentCueText('');
      
      // Start a new attempt for utterance logging (no duplicates!)
      if (activeSessionId && user?.id) {
        startAttempt({
          sessionId: activeSessionId,
          userId: user.id,
          exerciseSlug: 'photo_naming',
          trialIndex: state.trialNumber,
          attemptNumber: 1,
          targetWord: state.currentTrial.target,
          category: state.currentTrial.category
        });
      }
      
      // Start audio recording if supported - USE activeSessionId for standalone mode
      if (isRecordingSupported && user && activeSessionId) {
        startRecording();
        console.log('🎙️ Recording started for session:', activeSessionId);
      }
      
      // Auto-show cue after 2 consecutive errors
      if (consecutiveErrors >= 2 && currentDifficulty >= 4) {
        const autoCueDecision = selectOptimalCue(
          errorHistory,
          state.currentTrial.target,
          state.currentTrial.category,
          state.currentTrial.features,
          0 // First cue level
        );
        setCueLevel(1);
        setCurrentCueText(autoCueDecision.cueText);
        setShowCue(true);
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
        };
      }
    }
    
    // Stop listening when showing feedback
    if (showFeedback && isListening) {
      stopListening();
    }
  }, [state.currentTrial, state.trialNumber, showFeedback, useVoice, isSupported, startListening, isListening, stopListening, isRecordingSupported, user, activeSessionId, startRecording, consecutiveErrors, currentDifficulty, startAttempt]);

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

    // Log final analysis for timeout (critical for pattern analysis!)
    logFinalAnalysis({
      transcript: whisperTranscript,
      transcriptSource: whisperTranscript ? 'whisper' : 'browser',
      asrConfidence: whisperConfidence,
      isCorrect: false,
      errorType: 'timeout',
      speechRateWpm: acousticMetrics?.speechRateWPM,
      pauseCount: acousticMetrics?.pauseCount,
      totalPauseMs: acousticMetrics?.totalPauseMs,
      avgPauseDurationMs: acousticMetrics?.averagePauseDuration,
      effortfulSpeech: timeoutEffortfulSpeech,
      cueTypeGiven: cueLevel > 0 ? (cueState?.type || 'semantic') : undefined,
      audioStoragePath: uploadedPath,
      recordingDurationMs: duration
    });

    // Auto-advance after 2 seconds
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
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
      shownAt: Date.now()
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
        speechRateWpm: acousticMetrics.speechRateWPM,
        pauseCount: acousticMetrics.pauseCount,
        avgPauseDurationMs: acousticMetrics.averagePauseDuration
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

    if (cueState) {
      cueTypeGiven = cueState.type;
      if (correct) {
        cueWasEffective = true;
        timeToSuccessAfterCueMs = Date.now() - cueState.shownAt;
      } else {
        cueWasEffective = false;
        timeToSuccessAfterCueMs = null;
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
      speechRateWpm: acousticMetrics?.speechRateWPM,
      pauseCount: acousticMetrics?.pauseCount,
      totalPauseMs: acousticMetrics?.totalPauseMs,
      avgPauseDurationMs: acousticMetrics?.averagePauseDuration,
      effortfulSpeech: utteranceAnalysis.effortfulSpeech,
      cueTypeGiven: cueTypeGiven === 'none' ? undefined : cueTypeGiven,
      cueWasEffective: cueWasEffective ?? undefined,
      timeToSuccessAfterCueMs: timeToSuccessAfterCueMs ?? undefined,
      audioStoragePath: uploadedPath,
      recordingDurationMs: duration
    });

    // Reset cue state for next trial
    setCueState(null);

    // Auto-advance after 1.5 seconds
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
      resetAttempt(); // Reset for next trial
      nextTrial(currentDifficulty);
    }, 1500);
  };

  const handleCaregiverResponse = (responseType: 'looked' | 'tried' | 'said_roughly' | 'no_response') => {
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
    }, state.currentTrial);

    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
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

      {/* Recording/Analyzing indicator */}
      {(isRecording || isAnalyzing || isCreatingSession) && (
        <div className="flex items-center gap-2 text-sm">
          {isCreatingSession && (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Setting up session...</span>
            </>
          )}
          {isRecording && !isAnalyzing && (
            <>
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <span className="text-destructive">🎙️ Recording</span>
            </>
          )}
          {isAnalyzing && (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-primary">🧠 Analyzing speech...</span>
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
    </div>
  );
};
