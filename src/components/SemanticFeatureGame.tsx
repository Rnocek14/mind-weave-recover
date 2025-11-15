import { useState, useEffect, useRef } from 'react';
import { useSemanticFeatureGame } from '@/hooks/useSemanticFeatureGame';
import { useExerciseDifficulty } from '@/hooks/useExerciseDifficulty';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, X, Brain, Sparkles, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGameSounds } from '@/hooks/useGameSounds';
import { PHOTO_BANK } from '@/data/photoBank';

interface SemanticFeatureGameProps {
  totalTrials?: number;
  initialDifficulty?: number;
  onTrialComplete?: (data: any) => void;
  onGameComplete?: (finalScore: number, totalTrials: number) => void;
  onDifficultyChange?: (newLevel: number) => void;
  userId?: string;
  sessionId?: string;
}

export const SemanticFeatureGame = ({
  totalTrials = 10,
  initialDifficulty = 1,
  onTrialComplete,
  onGameComplete,
  onDifficultyChange,
  userId,
  sessionId,
}: SemanticFeatureGameProps) => {
  const { level: difficulty, saveLevel } = useExerciseDifficulty(
    userId,
    'semantic-features'
  );
  const { startTrial, logTrial, calculateReactionTime } = useExerciseTelemetry(
    sessionId || null,
    'semantic-features'
  );
  const { toast } = useToast();
  const { playSuccess, playError, playLevelUp } = useGameSounds();
  
  const game = useSemanticFeatureGame(totalTrials, difficulty || initialDifficulty);
  const adaptiveController = useRef(new AdaptiveDifficultyController(5, 0.80, 0.15));
  
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showDifficultyChange, setShowDifficultyChange] = useState(false);

  // Start trial when component mounts or new trial begins
  useEffect(() => {
    if (!game.completed && !game.showFeedback) {
      startTrial();
      setHasSubmitted(false);
    }
  }, [game.currentTrial, game.completed]);

  const handleSubmit = async () => {
    if (hasSubmitted || game.selectedFeatures.size === 0) return;
    
    setHasSubmitted(true);
    const result = game.submitAnswer();
    const reactionTime = calculateReactionTime();
    
    // Update adaptive controller
    adaptiveController.current.update(result.correct);
    
    // Play feedback sound
    if (result.correct) {
      playSuccess();
    } else {
      playError();
    }
    
    // Log trial data
    await logTrial({
      correct: result.correct,
      reactionTimeMs: reactionTime,
      cueLevel: 0, // No cues in this game
      errorType: result.correct ? null : 'semantic_error',
      taskParameters: {
        difficulty: difficulty,
        word: game.getCurrentTrial()?.word,
        feature_count: game.getCurrentTrial()?.correctFeatures.length,
        total_correct: result.totalCorrect,
        total_missed: result.totalMissed,
        total_incorrect: result.totalIncorrect,
        error_analysis: result.errorAnalysis,
      },
    });
    
    // Callback
    if (onTrialComplete) {
      onTrialComplete({
        correct: result.correct,
        reactionTime,
        errorAnalysis: result.errorAnalysis,
      });
    }
  };

  const handleNext = async () => {
    // Check if difficulty should adjust
    const newLevel = adaptiveController.current.adjustLevel(difficulty);
    
    if (newLevel !== difficulty) {
      await saveLevel(newLevel);
      setShowDifficultyChange(true);
      playLevelUp();
      
      if (onDifficultyChange) {
        onDifficultyChange(newLevel);
      }
      
      setTimeout(() => setShowDifficultyChange(false), 2000);
    }
    
    game.nextTrial(newLevel);
    
    // Check if game is complete
    if (game.currentTrial + 1 >= totalTrials) {
      if (onGameComplete) {
        onGameComplete(game.score, totalTrials);
      }
    }
  };

  const trial = game.getCurrentTrial();
  if (!trial) return null;

  const getFeatureStyle = (featureText: string) => {
    const isSelected = game.isFeatureSelected(featureText);
    const isCorrect = game.isFeatureCorrect(featureText);
    
    if (!game.showFeedback) {
      return isSelected
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border hover:border-primary/50 hover:bg-accent';
    }
    
    if (isCorrect === true) {
      return isSelected
        ? 'border-green-500 bg-green-500/10 text-green-700'
        : 'border-green-300 bg-green-50 text-green-600 opacity-60';
    }
    
    if (isSelected && isCorrect === false) {
      return 'border-destructive bg-destructive/10 text-destructive';
    }
    
    return 'border-border opacity-50';
  };

  const photo = PHOTO_BANK.find(p => p.category === trial.imageCategory);
  const accuracy = game.trials.length > 0 ? (game.score / (game.currentTrial + (game.showFeedback ? 1 : 0))) * 100 : 0;
  const photoPath = photo ? photo.imageUrl : null;

  if (game.completed) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Session Complete!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-3xl font-bold text-primary">
              {game.score} / {totalTrials}
            </p>
            <p className="text-muted-foreground">
              {accuracy >= 80 ? 'Excellent' : accuracy >= 60 ? 'Good progress' : 'Keep practicing'} - {accuracy.toFixed(0)}% accuracy
            </p>
          </div>
          
          <div className="bg-accent/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Your Semantic Strengths
            </h3>
            <p className="text-sm text-muted-foreground">
              Great work strengthening semantic networks! Continue practicing to improve word retrieval.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Header with progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                Trial {game.currentTrial + 1} of {totalTrials}
              </span>
              <div className="flex gap-2 items-center">
                <Badge variant="outline">Level {difficulty}</Badge>
                <Badge variant="secondary">{game.score} correct</Badge>
              </div>
            </div>
            <Progress value={game.progress} />
          </div>
        </CardContent>
      </Card>

      {/* Difficulty change notification */}
      {showDifficultyChange && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-center font-medium flex items-center justify-center gap-2">
              <Target className="h-4 w-4" />
              Difficulty adjusted to Level {difficulty}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main game area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Which features describe this word?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Target word with image */}
          <div className="flex flex-col items-center space-y-4">
            {photoPath && (
              <img
                src={photoPath}
                alt={trial.word}
                className="w-48 h-48 object-cover rounded-lg shadow-md"
              />
            )}
            <div className="text-4xl font-bold text-primary">
              {trial.word}
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Select all the features that describe this word. The more accurate you are, the better!
            </p>
          </div>

          {/* Feature options grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {game.currentOptions.map((feature) => {
              const isCorrect = game.isFeatureCorrect(feature.text);
              const isSelected = game.isFeatureSelected(feature.text);
              
              return (
                <button
                  key={feature.text}
                  onClick={() => game.toggleFeature(feature.text)}
                  disabled={game.showFeedback}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all
                    text-sm font-medium text-left
                    ${getFeatureStyle(feature.text)}
                    disabled:cursor-not-allowed
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span>{feature.text}</span>
                    {game.showFeedback && (
                      <span className="flex-shrink-0">
                        {isCorrect && isSelected && (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                        {isCorrect && !isSelected && (
                          <Check className="h-4 w-4 text-green-400 opacity-60" />
                        )}
                        {!isCorrect && isSelected && (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                      </span>
                    )}
                  </div>
                  
                  {game.showFeedback && (
                    <Badge
                      variant="outline"
                      className="mt-2 text-xs"
                    >
                      {feature.category}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-center pt-4">
            {!game.showFeedback ? (
              <Button
                onClick={handleSubmit}
                disabled={game.selectedFeatures.size === 0 || hasSubmitted}
                size="lg"
                className="min-w-32"
              >
                Submit
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                size="lg"
                className="min-w-32"
              >
                Next Trial
              </Button>
            )}
          </div>

          {/* Feedback */}
          {game.showFeedback && (
            <div
              className={`
                p-4 rounded-lg text-center font-medium
                ${game.feedbackCorrect
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-orange-50 text-orange-700 border border-orange-200'
                }
              `}
            >
              {game.feedbackCorrect ? (
                <span className="flex items-center justify-center gap-2">
                  <Check className="h-5 w-5" />
                  Great job! You identified the key features.
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Brain className="h-5 w-5" />
                  Review the correct features highlighted in green.
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
