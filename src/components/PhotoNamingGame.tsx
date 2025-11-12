import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Camera, TrendingUp, TrendingDown, Clock, Lightbulb, Mic, MicOff } from 'lucide-react';
import { usePhotoNamingGame } from '@/hooks/usePhotoNamingGame';
import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';
import { TrialTimer } from '@/components/TrialTimer';
import { getCueText } from '@/lib/cueGenerator';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useToast } from '@/hooks/use-toast';
import { useGameSounds } from '@/hooks/useGameSounds';

interface PhotoNamingGameProps {
  totalTrials: number;
  initialDifficulty: number;
  onTrialComplete: (result: {
    correct: boolean;
    reactionTimeMs: number;
    errorType?: string;
    difficultyLevel: number;
    cueLevel: number;
  }) => void;
  onGameComplete: (finalScore: number) => void;
  onDifficultyChange?: (newLevel: number, reason: string) => void;
}

export const PhotoNamingGame = ({
  totalTrials,
  initialDifficulty,
  onTrialComplete,
  onGameComplete,
  onDifficultyChange,
}: PhotoNamingGameProps) => {
  const { state, selectAnswer, nextTrial } = usePhotoNamingGame(totalTrials, initialDifficulty);
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
  const [useVoice, setUseVoice] = useState(true); // Toggle voice mode
  const { toast } = useToast();
  const { playSuccess, playError, playLevelUp, playLevelDown, playHint, playTimeout } = useGameSounds();
  
  // Adaptive controller (persists across renders)
  const controllerRef = useRef(new AdaptiveDifficultyController());
  
  // Helper function to match spoken words with choices
  const findMatchingChoice = (spokenWord: string): string | null => {
    if (!state.choices) return null;
    
    const normalized = spokenWord.toLowerCase().trim();
    
    // Direct match
    const directMatch = state.choices.find(choice => 
      choice.toLowerCase() === normalized
    );
    if (directMatch) return directMatch;
    
    // Partial match (spoken word contains choice or vice versa)
    const partialMatch = state.choices.find(choice => {
      const choiceLower = choice.toLowerCase();
      return normalized.includes(choiceLower) || choiceLower.includes(normalized);
    });
    
    return partialMatch || null;
  };
  
  // Handle speech recognition results
  const handleSpeechResult = (transcript: string) => {
    if (showFeedback || selectedAnswer || timedOut) return;
    
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
      // Restart listening
      if (useVoice) {
        setTimeout(() => startListening(), 500);
      }
    }
  };
  
  // Speech recognition hook
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    isSupported,
    error: speechError 
  } = useSpeechRecognition(handleSpeechResult, false);
  
  // Hard mode settings
  const isHardMode = currentDifficulty >= 8;
  const timeLimit = 5; // seconds for hard mode
  const allowManualHints = currentDifficulty >= 6;

  // Start timing new trial and reset cue state
  useEffect(() => {
    if (state.currentTrial && !showFeedback) {
      setTrialStartTime(Date.now());
      setSelectedAnswer(null);
      setTimedOut(false);
      setCueLevel(0);
      setShowCue(false);
      
      // Auto-show cue after 2 consecutive errors
      if (consecutiveErrors >= 2 && currentDifficulty >= 4) {
        setCueLevel(1); // Semantic cue
        setShowCue(true);
      }
      
      // Start voice listening when new trial begins
      if (useVoice && isSupported) {
        setTimeout(() => startListening(), 500);
      }
    }
    
    // Stop listening when showing feedback
    if (showFeedback && isListening) {
      stopListening();
    }
  }, [state.currentTrial, showFeedback, consecutiveErrors, currentDifficulty, useVoice, isSupported, startListening, isListening, stopListening]);

  // Handle game completion
  useEffect(() => {
    if (state.isComplete) {
      onGameComplete(state.score);
    }
  }, [state.isComplete, state.score, onGameComplete]);

  const handleTimeout = () => {
    if (showFeedback || selectedAnswer || timedOut) return;
    
    setTimedOut(true);
    const reactionTime = Date.now() - trialStartTime;
    
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

    // Log telemetry with cue level
    onTrialComplete({
      correct: false,
      reactionTimeMs: reactionTime,
      errorType: 'timeout',
      difficultyLevel: currentDifficulty,
      cueLevel: cueLevel,
    });

    // Auto-advance after 2 seconds
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
      nextTrial(currentDifficulty);
    }, 2000);
  };

  const handleRequestHint = () => {
    if (cueLevel >= 3) return; // Already at max cue
    
    const newCueLevel = cueLevel + 1;
    setCueLevel(newCueLevel);
    setShowCue(true);
    
    // Play hint sound
    playHint();
  };

  const handleAnswerSelect = (word: string) => {
    if (showFeedback || selectedAnswer || timedOut) return;

    // Stop listening when answer is selected
    if (isListening) {
      stopListening();
    }

    const reactionTime = Date.now() - trialStartTime;
    setSelectedAnswer(word);
    
    const result = selectAnswer(word);
    setFeedbackData(result);
    setShowFeedback(true);
    
    // Play sound based on result
    if (result.correct) {
      playSuccess();
    } else {
      playError();
    }
    
    // Track consecutive errors
    if (result.correct) {
      setConsecutiveErrors(0);
    } else {
      setConsecutiveErrors((prev) => prev + 1);
    }

    // Update adaptive controller
    const controller = controllerRef.current;
    controller.update(result.correct);
    
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

    // Log telemetry with cue level
    onTrialComplete({
      correct: result.correct,
      reactionTimeMs: reactionTime,
      errorType: result.errorType,
      difficultyLevel: currentDifficulty,
      cueLevel: cueLevel,
    });

    // Auto-advance after 1.5 seconds
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
      nextTrial(currentDifficulty);
    }, 1500);
  };

  if (!state.currentTrial) {
    return (
      <div className="text-center py-12">
        <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Loading exercise...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Trial {state.trialNumber} of {state.totalTrials}
          </span>
          <span className="font-medium text-primary">
            Score: {state.score}
          </span>
        </div>
        <Progress
          value={(state.trialNumber / state.totalTrials) * 100}
          className="h-2"
        />
      </div>

      {/* Image Display */}
      <div className="relative">
        <div className="w-full max-w-md mx-auto aspect-square bg-muted rounded-xl flex items-center justify-center border-4 border-primary shadow-glow overflow-hidden">
          <img
            src={state.currentTrial.imageUrl}
            alt="Name this object"
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Difficulty indicator with change animation */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {difficultyChanged && (
            <div className={`
              px-2 py-1 rounded-full text-xs font-medium animate-slide-up
              ${difficultyChanged === 'up' ? 'bg-success text-white' : 'bg-warning text-white'}
            `}>
              {difficultyChanged === 'up' ? (
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Leveling up!
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Adjusting
                </span>
              )}
            </div>
          )}
          <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
            Level {currentDifficulty}
          </div>
        </div>
      </div>

      {/* Timer for hard mode */}
      {isHardMode && !showFeedback && (
        <TrialTimer
          duration={timeLimit}
          onTimeout={handleTimeout}
          isActive={!showFeedback}
        />
      )}
      
      {/* Cue Display */}
      {showCue && cueLevel > 0 && state.currentTrial && !showFeedback && (
        <div className="bg-accent/20 border-2 border-accent rounded-lg p-4 animate-slide-up">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-accent mb-1">
                {cueLevel === 1 ? 'Hint (Category)' : cueLevel === 2 ? 'Hint (Sound)' : 'Full Answer'}
              </p>
              <p className="text-sm text-foreground">
                {getCueText(cueLevel, state.currentTrial.category, state.currentTrial.target)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Voice/Button Mode Toggle */}
      {isSupported && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUseVoice(!useVoice);
              if (useVoice && isListening) {
                stopListening();
              } else if (!useVoice) {
                startListening();
              }
            }}
            className="gap-2"
          >
            {useVoice ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            {useVoice ? 'Voice Mode' : 'Button Mode'}
          </Button>
        </div>
      )}

      {/* Instruction */}
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-1">What is this?</h3>
        <p className="text-sm text-muted-foreground">
          {isHardMode ? (
            <span className="flex items-center justify-center gap-1">
              <Clock className="w-4 h-4" />
              {useVoice ? 'Say it quickly' : 'Choose quickly'} - {timeLimit} second limit!
            </span>
          ) : useVoice ? (
            <span className="flex items-center justify-center gap-1">
              <Mic className="w-4 h-4" />
              Say the word out loud
            </span>
          ) : (
            'Choose the correct word'
          )}
        </p>
        
        {/* Speech feedback */}
        {useVoice && (
          <div className="mt-2">
            {isListening && (
              <div className="flex items-center justify-center gap-2 text-primary animate-pulse">
                <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                <span className="text-sm font-medium">Listening...</span>
              </div>
            )}
            {transcript && !showFeedback && (
              <div className="text-sm text-muted-foreground">
                Heard: "{transcript}"
              </div>
            )}
            {speechError && !showFeedback && (
              <div className="text-sm text-destructive">
                {speechError}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Manual Hint Button */}
      {allowManualHints && !showFeedback && cueLevel < 3 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRequestHint}
            className="gap-2 border-accent text-accent hover:bg-accent/10"
          >
            <Lightbulb className="w-4 h-4" />
            {cueLevel === 0 ? 'Give me a hint' : cueLevel === 1 ? 'Another hint?' : 'Show answer'}
          </Button>
        </div>
      )}

      {/* Answer Choices */}
      <div className="grid grid-cols-2 gap-4">
        {!isSupported && (
          <div className="col-span-2 text-center text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            💡 Voice recognition is not supported in this browser. Using button mode.
          </div>
        )}
        {state.choices.map((word) => {
          const isSelected = selectedAnswer === word;
          const isCorrect = word === state.currentTrial?.target;
          const showCorrect = showFeedback && isCorrect;
          const showIncorrect = showFeedback && isSelected && !isCorrect;

          return (
            <Button
              key={word}
              size="lg"
              variant={showFeedback ? (showCorrect ? 'default' : 'outline') : 'outline'}
              className={`
                h-20 text-lg font-medium transition-all
                ${showCorrect ? 'bg-success border-success text-white' : ''}
                ${showIncorrect ? 'bg-destructive border-destructive text-white' : ''}
                ${!showFeedback ? 'hover:border-primary hover:bg-primary/10' : ''}
              `}
              onClick={() => handleAnswerSelect(word)}
              disabled={showFeedback}
            >
              <span className="flex items-center gap-2">
                {showCorrect && <CheckCircle2 className="w-5 h-5" />}
                {showIncorrect && <XCircle className="w-5 h-5" />}
                {word.charAt(0).toUpperCase() + word.slice(1)}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Feedback Message */}
      {showFeedback && feedbackData && (
        <div
          className={`
            text-center p-4 rounded-lg animate-slide-up
            ${feedbackData.correct ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}
          `}
        >
          <p className="font-semibold">
            {feedbackData.correct
              ? '✓ Correct! Great job!'
              : feedbackData.errorType === 'timeout'
              ? `⏱ Time's up! The answer was "${state.currentTrial?.target}"`
              : `✗ The correct answer was "${state.currentTrial?.target}"`}
          </p>
        </div>
      )}
    </div>
  );
};
