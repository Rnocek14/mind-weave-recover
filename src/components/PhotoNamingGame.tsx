import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Camera, TrendingUp, TrendingDown } from 'lucide-react';
import { usePhotoNamingGame } from '@/hooks/usePhotoNamingGame';
import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';

interface PhotoNamingGameProps {
  totalTrials: number;
  initialDifficulty: number;
  onTrialComplete: (result: {
    correct: boolean;
    reactionTimeMs: number;
    errorType?: string;
    difficultyLevel: number;
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
  const { state, selectAnswer, nextTrial } = usePhotoNamingGame(totalTrials);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());
  const [feedbackData, setFeedbackData] = useState<{
    correct: boolean;
    errorType?: string;
  } | null>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState(initialDifficulty);
  const [difficultyChanged, setDifficultyChanged] = useState<'up' | 'down' | null>(null);
  
  // Adaptive controller (persists across renders)
  const controllerRef = useRef(new AdaptiveDifficultyController());

  // Start timing new trial
  useEffect(() => {
    if (state.currentTrial && !showFeedback) {
      setTrialStartTime(Date.now());
      setSelectedAnswer(null);
    }
  }, [state.currentTrial, showFeedback]);

  // Handle game completion
  useEffect(() => {
    if (state.isComplete) {
      onGameComplete(state.score);
    }
  }, [state.isComplete, state.score, onGameComplete]);

  const handleAnswerSelect = (word: string) => {
    if (showFeedback || selectedAnswer) return;

    const reactionTime = Date.now() - trialStartTime;
    setSelectedAnswer(word);
    
    const result = selectAnswer(word);
    setFeedbackData(result);
    setShowFeedback(true);

    // Update adaptive controller
    const controller = controllerRef.current;
    controller.update(result.correct);
    
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
      
      // Clear difficulty change indicator after 2 seconds
      setTimeout(() => setDifficultyChanged(null), 2000);
    }

    // Log telemetry with current difficulty
    onTrialComplete({
      correct: result.correct,
      reactionTimeMs: reactionTime,
      errorType: result.errorType,
      difficultyLevel: currentDifficulty,
    });

    // Auto-advance after 1.5 seconds
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackData(null);
      nextTrial();
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

      {/* Instruction */}
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-1">What is this?</h3>
        <p className="text-sm text-muted-foreground">
          Choose the correct word
        </p>
      </div>

      {/* Answer Choices */}
      <div className="grid grid-cols-2 gap-4">
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
              : `✗ The correct answer was "${state.currentTrial?.target}"`}
          </p>
        </div>
      )}
    </div>
  );
};
