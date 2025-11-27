import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Volume2, Mic, MicOff, Lightbulb, RotateCcw, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useGameSounds } from '@/hooks/useGameSounds';
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { getTrialsForLevel, evaluatePhraseMatch, type PhraseTrial } from '@/data/phraseBank';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePhraseAudio } from '@/hooks/usePhraseAudio';
import type { DifficultyBounds } from '@/lib/difficultyBounds';

interface PhrasePracticeGameProps {
  totalTrials: number;
  initialDifficulty: number;
  autoListen?: boolean; // Auto-open mic after delay
  listenDelayMs?: number; // Delay before auto-listen
  onTrialComplete?: (data: {
    correct: boolean;
    timeMs: number;
    cueLevel: number;
    difficulty: number;
    phraseId: string;
    wordAccuracy: number;
    repetitions: number;
  }) => void;
  onGameComplete?: (finalScore: number, finalLevel: number) => void;
  onDifficultyChange?: (newLevel: number) => void;
}

export const PhrasePracticeGame = ({
  totalTrials,
  initialDifficulty,
  autoListen = true, // Default ON for stroke survivors
  listenDelayMs = 800, // 800ms warmup before mic opens
  onTrialComplete,
  onGameComplete,
  onDifficultyChange
}: PhrasePracticeGameProps) => {
  const { toast } = useToast();
  const { playSuccess, playError } = useGameSounds();
  const { user } = useAuth();
  
  const [trials, setTrials] = useState<PhraseTrial[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [cueLevel, setCueLevel] = useState(1); // Start with phrase visible for better UX // 0=none, 1=visual, 2=audio, 3=both
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [trialStartTime, setTrialStartTime] = useState<number>(0);
  const [attempts, setAttempts] = useState(0);
  const [isListeningMode, setIsListeningMode] = useState(true);
  const [currentWordAccuracy, setCurrentWordAccuracy] = useState(0);
  const [voicePreference, setVoicePreference] = useState<string>('alloy');
  
  const {
    currentDifficulty,
    updateTrial,
    checkAndAdjust,
    getCueLevel: getAdaptiveCueLevel,
  } = useAdaptiveDifficulty({
    initialDifficulty,
    bounds: { floor: 1, ceiling: 10, suggestedStart: 5 },
    windowSize: 5,
    targetSuccessRate: 0.75,
    adjustmentThreshold: 0.15,
    onDifficultyChange: (newLevel) => {
      onDifficultyChange?.(newLevel);
    },
  });

  // Initialize trials and load voice preference
  useEffect(() => {
    const newTrials = getTrialsForLevel(currentDifficulty, totalTrials);
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
        
        // Map voice preference to OpenAI voice
        const voiceMap = {
          'neutral': 'alloy',
          'male': 'onyx',
          'female': 'nova'
        };
        setVoicePreference(voiceMap[voicePref as keyof typeof voiceMap] || 'alloy');
      }
    };
    
    loadVoicePreference();
  }, [currentDifficulty, totalTrials, user]);

  const currentTrial = trials[currentTrialIndex] || null;

  // Speech recognition
  const handleSpeechResult = (transcript: string) => {
    if (!currentTrial || showFeedback) return;

    console.log('Speech recognized:', transcript);
    
    const evaluation = evaluatePhraseMatch(transcript, currentTrial);
    setCurrentWordAccuracy(evaluation.wordAccuracy);
    
    if (evaluation.match) {
      handleCorrectAnswer(evaluation.wordAccuracy);
    } else if (evaluation.wordAccuracy > 0.3) {
      // Partial match - give feedback
      toast({
        title: "Almost there!",
        description: `You got ${Math.round(evaluation.wordAccuracy * 100)}% of the words. Try again.`,
      });
      setAttempts(prev => prev + 1);
    } else {
      handleIncorrectAnswer();
    }
  };

  const { isListening, transcript, startListening, stopListening, isSupported, error } = 
    useSpeechRecognition(handleSpeechResult, false);
  
  // Bulletproof audio playback (declare before useEffect that uses it)
  const { playPhrase, isPlaying: isAudioPlaying, lastError: audioError } = usePhraseAudio();
  
  // AUTO-LISTEN MODE: Open mic automatically on new trial
  useEffect(() => {
    if (!autoListen || !currentTrial || showFeedback) return;
    
    // Don't compete with audio playback
    if (isAudioPlaying) return;
    
    // Don't restart if already listening
    if (isListening) return;
    
    const timer = setTimeout(() => {
      if (isSupported && !isListening) {
        console.log('[Auto-Listen] Starting mic after warmup delay');
        startListening();
      }
    }, listenDelayMs);
    
    return () => clearTimeout(timer);
  }, [autoListen, listenDelayMs, currentTrial, showFeedback, isAudioPlaying, isListening, isSupported, startListening]);

  // Toggle listening
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  
  const handlePlayAudio = async () => {
    if (!currentTrial || isAudioPlaying) return;
    
    // Stop listening while audio plays
    if (isListening) stopListening();
    
    await playPhrase(currentTrial.phrase, { voice: voicePreference });
    setCueLevel(prev => Math.max(prev, 2)); // Mark that audio cue was used
    
    // Re-open mic after audio finishes (if auto-listen enabled)
    if (autoListen && isSupported) {
      setTimeout(() => {
        if (!isListening && !showFeedback) {
          console.log('[Auto-Listen] Restarting mic after audio playback');
          startListening();
        }
      }, 500);
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

  const handleCorrectAnswer = (wordAccuracy: number) => {
    const reactionTime = Date.now() - trialStartTime;
    
    playSuccess();
    setScore(prev => prev + 100);
    setFeedbackCorrect(true);
    setShowFeedback(true);
    
    // Update adaptive difficulty tracking
    updateTrial(true);
    
    // Log trial (Note: Phrase practice adaptations tracked separately via cueLevel)
    onTrialComplete?.({
      correct: true,
      timeMs: reactionTime,
      cueLevel,
      difficulty: currentDifficulty,
      phraseId: currentTrial!.id,
      wordAccuracy,
      repetitions: attempts + 1
    });

    setTimeout(() => {
      nextTrial();
    }, 1500);
  };

  const handleIncorrectAnswer = () => {
    playError();
    setFeedbackCorrect(false);
    setShowFeedback(true);
    setAttempts(prev => prev + 1);
    
    // Update adaptive difficulty tracking
    updateTrial(false);
    
    setTimeout(() => {
      setShowFeedback(false);
    }, 1500);
  };

  const nextTrial = () => {
    if (currentTrialIndex + 1 >= trials.length) {
      // Game complete
      onGameComplete?.(score, currentDifficulty);
      return;
    }

    // Check and adjust difficulty
    const { adjusted, newLevel } = checkAndAdjust();
    
    if (adjusted) {
      // Regenerate trials at new difficulty
      const newTrials = getTrialsForLevel(newLevel, totalTrials - currentTrialIndex - 1);
      setTrials(prev => [...prev.slice(0, currentTrialIndex + 1), ...newTrials]);
    }

    setCurrentTrialIndex(prev => prev + 1);
    setShowFeedback(false);
    setCueLevel(0);
    setAttempts(0);
    setCurrentWordAccuracy(0);
    setTrialStartTime(Date.now());
  };

  const reset = () => {
    setCurrentTrialIndex(0);
    setScore(0);
    setCueLevel(0);
    setAttempts(0);
    setShowFeedback(false);
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
    <div className="w-full max-w-2xl mx-auto space-y-6">
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
          
          {cueLevel >= 1 ? (
            <div className="text-4xl font-bold text-foreground leading-relaxed py-6 px-4 bg-accent/20 rounded-lg">
              {currentTrial.phrase}
            </div>
          ) : (
            <div className="text-2xl text-muted-foreground italic py-6">
              (Click "Show Phrase" for help)
            </div>
          )}
          
          <Badge variant="outline" className="text-sm">
            {currentTrial.category.replace('_', ' ')}
          </Badge>
        </div>

        {/* Speech Recognition Status */}
        {isListeningMode && (
          <div className="flex flex-col items-center gap-3 py-4">
            {autoListen && (
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
            
            {isListening && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                Listening...
              </div>
            )}
            
            {transcript && (
              <div className="text-sm text-muted-foreground mt-2">
                You said: "{transcript}"
              </div>
            )}

            {currentWordAccuracy > 0 && currentWordAccuracy < 0.8 && (
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
            onClick={handleShowCue}
            disabled={cueLevel >= 3}
          >
            <Lightbulb className="w-5 h-5 mr-2" />
            {cueLevel === 0 ? "Show Phrase" : cueLevel === 1 ? "Hear It" : "Max Hints"}
          </Button>
          
          {cueLevel >= 1 && (
            <Button
              variant="outline"
              size="lg"
              onClick={handlePlayAudio}
              disabled={isAudioPlaying}
            >
              <Volume2 className="w-5 h-5 mr-2" />
              {isAudioPlaying ? 'Playing...' : 'Play Audio'}
            </Button>
          )}
          
          {audioError && (
            <p className="text-sm text-muted-foreground">
              Audio unavailable - read and speak the phrase
            </p>
          )}
        </div>

        {/* Attempts Counter */}
        {attempts > 0 && (
          <div className="text-sm text-muted-foreground">
            Attempts: {attempts + 1}
          </div>
        )}
      </Card>

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
};
