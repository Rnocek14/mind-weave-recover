import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Camera, TrendingUp, TrendingDown, Clock, Lightbulb, Mic, MicOff, Volume2 } from 'lucide-react';
import { usePhotoNamingGame } from '@/hooks/usePhotoNamingGame';
import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';
import { TrialTimer } from '@/components/TrialTimer';
import { getCueText, selectOptimalCue } from '@/lib/cueGenerator';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useGameSounds } from '@/hooks/useGameSounds';
import { classifySpeechError, type ErrorClassificationResult } from '@/lib/errorClassifier';
import { supabase } from '@/integrations/supabase/client';
import { normalizeASROutput } from '@/lib/speechNormalizer';
import { usePhraseAudio } from '@/hooks/usePhraseAudio';

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
  
  // Refs to avoid stale closures
  const isPlayingChoicesRef = useRef(false);
  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  const { playSuccess, playError, playLevelUp, playLevelDown, playHint, playTimeout } = useGameSounds();
  const { user } = useAuth();
  const { playPhrase, isPlaying: isAudioPlaying } = usePhraseAudio();
  
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
  
  // Adaptive controller (persists across renders)
  const controllerRef = useRef(new AdaptiveDifficultyController());
  
  // Helper function to match spoken words with choices (WITH NORMALIZATION)
  const findMatchingChoice = (spokenWord: string): string | null => {
    if (!state.choices) return null;
    
    // Clean up fillers and noise FIRST
    const normalized = normalizeASROutput(spokenWord).toLowerCase().trim();
    
    if (!normalized) return null;
    
    // Direct match
    const directMatch = state.choices.find(choice => 
      choice.toLowerCase() === normalized
    );
    if (directMatch) return directMatch;
    
    // Fuzzy match with phonetic tolerance
    const fuzzyMatch = state.choices.find(choice => {
      const choiceLower = choice.toLowerCase();
      
      // Contains match
      if (normalized.includes(choiceLower) || choiceLower.includes(normalized)) {
        return true;
      }
      
      // Levenshtein similarity for phonetic variations (e.g., "dawg" → "dog")
      const similarity = calculateSimilarity(normalized, choiceLower);
      return similarity > 0.7;
    });
    
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
  const handleSpeechResult = useCallback((transcript: string) => {
    // Use REF to avoid stale closure bug!
    if (showFeedback || selectedAnswer || timedOut || isPlayingChoicesRef.current) return;
    
    console.log('Speech result:', transcript);
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
    }
  }, [showFeedback, selectedAnswer, timedOut, toast]);
  
  // Speech recognition hook - uses handleSpeechResult callback
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    isSupported,
    error: speechError 
  } = useSpeechRecognition(handleSpeechResult, false);
  
  // Centralized safe startListening to prevent race conditions
  const safeStartListening = useCallback((delayMs: number = 0) => {
    // Clear any pending timeout
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
    
    // Don't start if audio is playing
    if (isPlayingChoicesRef.current) {
      console.log('Blocked startListening: audio is playing');
      return;
    }
    
    if (delayMs > 0) {
      listeningTimeoutRef.current = setTimeout(() => {
        if (!isPlayingChoicesRef.current && !showFeedback && !timedOut) {
          startListening();
        }
      }, delayMs);
    } else {
      if (!showFeedback && !timedOut) {
        startListening();
      }
    }
  }, [startListening, showFeedback, timedOut]);
  
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
      
      // Start audio recording if supported
      if (isRecordingSupported && user && sessionId) {
        startRecording();
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
      
      // Auto-listen: Start voice listening when new trial begins using safe method
      if (useVoice && isSupported) {
        safeStartListening(800); // Auto-listen delay for accessibility
      }
    }
    
    // Stop listening when showing feedback
    if (showFeedback && isListening) {
      stopListening();
    }
    
    // Cleanup function to clear pending timeouts
    return () => {
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
        listeningTimeoutRef.current = null;
      }
    };
  }, [state.currentTrial, showFeedback, consecutiveErrors, currentDifficulty, useVoice, isSupported, safeStartListening, isListening, stopListening, isRecordingSupported, user, sessionId, startRecording, errorHistory]);

  // Handle game completion
  useEffect(() => {
    if (state.isComplete) {
      onGameComplete(state.score);
    }
  }, [state.isComplete, state.score, onGameComplete]);

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
    
    if (isRecording && user && sessionId) {
      const recordingResult = await stopRecording();
      if (recordingResult) {
        duration = recordingResult.duration;
        mimeType = recordingResult.mimeType;
        
        const path = await uploadRecording(
          recordingResult.audioBlob,
          user.id,
          sessionId,
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
    }, state.currentTrial);

    // Auto-advance after 2 seconds
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
      nextTrial(currentDifficulty);
    }, 2000);
  };

  const handleRequestHint = () => {
    if (cueLevel >= 3 || !state.currentTrial) return; // Already at max cue
    
    playHint();
    const newCueLevel = cueLevel + 1;
    
    // Use enhanced cue selection with error pattern adaptation
    const cueDecision = selectOptimalCue(
      errorHistory,
      state.currentTrial.target,
      state.currentTrial.category,
      state.currentTrial.features,
      newCueLevel - 1 // Convert to 0-indexed
    );
    
    console.log('Cue decision:', cueDecision);
    
    setCueLevel(newCueLevel);
    setCurrentCueText(cueDecision.cueText);
    setShowCue(true);
    
    // Show reasoning in toast for transparency
    toast({
      title: "Hint provided",
      description: cueDecision.reasoning,
      duration: 3000
    });
  };

  const handlePlayAllChoices = async () => {
    if (!state.choices || isPlayingChoices) return;
    
    // Update BOTH ref and state
    isPlayingChoicesRef.current = true;
    setIsPlayingChoices(true);
    
    // Stop listening FIRST and wait a moment before playing
    if (isListening) {
      stopListening();
      // Wait for mic to fully stop before playing audio
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
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
      
      // Resume listening after audio if voice mode is on using safe method
      if (useVoice && isSupported && !showFeedback) {
        safeStartListening(1200);
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
    
    if (isRecording && user && sessionId) {
      const recordingResult = await stopRecording();
      if (recordingResult) {
        duration = recordingResult.duration;
        mimeType = recordingResult.mimeType;
        
        const path = await uploadRecording(
          recordingResult.audioBlob,
          user.id,
          sessionId,
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
    }
    
    // Advanced error classification
    const errorClassification = await classifySpeechError(
      word,
      state.currentTrial.target,
      0.8, // TODO: Get actual ASR confidence when using voice
      {
        trialNumber: state.trialNumber,
        previousErrors: errorHistory.map(e => e.errorType),
        category: state.currentTrial.category,
        features: state.currentTrial.features
      }
    );
    
    const correct = errorClassification.errorType === 'correct' || 
                    errorClassification.errorType === 'self_corrected';
    
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
      errorType: errorClassification.errorType 
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

    // Log telemetry with cue level, detailed error classification, and audio
    onTrialComplete?.({
      correct,
      reactionTimeMs: reactionTime,
      errorType: errorClassification.errorType,
      difficultyLevel: currentDifficulty,
      cueLevel: cueLevel,
      errorClassification, // Pass full classification for rich analytics
      audioStoragePath: uploadedPath,
      recordingDurationMs: duration,
      audioMimeType: mimeType,
      whisperTranscript,
      whisperConfidence,
      acousticMetrics,
    }, state.currentTrial);

    // Auto-advance after 1.5 seconds
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
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

    onTrialComplete?.({
      correct,
      reactionTimeMs: reactionTime,
      errorType,
      difficultyLevel: currentDifficulty,
      cueLevel: cueLevel,
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

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          Recording
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
          className="gap-2"
        >
          {useVoice ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          {useVoice ? "Voice On" : "Voice Off"}
        </Button>
      </div>

      {/* Show transcript when listening */}
      {useVoice && isListening && transcript && (
        <div className="text-sm text-center p-2 bg-muted rounded">
          Heard: "{transcript}"
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
              <Button
                key={idx}
                variant={selectedAnswer === choice ? "default" : "outline"}
                size="lg"
                className="h-16 text-lg"
                onClick={() => handleAnswerSelect(choice)}
                disabled={showFeedback || timedOut || isPlayingChoices}
              >
                {choice}
              </Button>
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
        <div className={`p-6 rounded-lg text-center ${
          feedbackData.correct ? 'bg-success/10' : 'bg-destructive/10'
        }`}>
          {feedbackData.correct ? (
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success" />
          ) : (
            <XCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
          )}
          <p className="text-lg font-semibold mb-2">
            {feedbackData.correct ? "Correct!" : timedOut ? "Time's up!" : "Not quite"}
          </p>
          {!feedbackData.correct && state.currentTrial && (
            <p className="text-sm text-muted-foreground">
              The answer was: <span className="font-medium">{state.currentTrial.target}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
