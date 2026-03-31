import { useState, useEffect } from 'react';
import { useSemanticFeatureGame } from '@/hooks/useSemanticFeatureGame';
import { useExerciseDifficulty } from '@/hooks/useExerciseDifficulty';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, X, Brain, Sparkles, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGameSounds } from '@/hooks/useGameSounds';
import { PHOTO_BANK } from '@/data/photoBank';
import type { ExerciseConfig } from '@/lib/clinicalProfileMapper';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import type { ExerciseAdaptation } from '@/lib/exerciseGating';
import { cn } from '@/lib/utils';

import type { SemanticFeatureTrial } from '@/data/semanticFeatureBank';

interface SemanticFeatureGameProps {
  totalTrials?: number;
  config: ExerciseConfig;
  bounds: DifficultyBounds;
  adaptations?: ExerciseAdaptation | null;
  customTrials?: SemanticFeatureTrial[];
  onTrialComplete?: (data: any) => void;
  onGameComplete?: (finalScore: number, totalTrials: number) => void;
  onDifficultyChange?: (newLevel: number) => void;
  userId?: string;
  sessionId?: string;
}

export const SemanticFeatureGame = ({
  totalTrials = 10,
  config,
  bounds,
  adaptations,
  customTrials,
  onTrialComplete,
  onGameComplete,
  onDifficultyChange,
  userId,
  sessionId,
}: SemanticFeatureGameProps) => {
  const { saveLevel } = useExerciseDifficulty(userId, undefined, 'semantic-features');
  const { startTrial, logTrial, calculateReactionTime } = useExerciseTelemetry(sessionId || null, 'semantic-features');
  const { toast } = useToast();
  const { playSuccess, playError, playLevelUp } = useGameSounds();
  
  const {
    currentDifficulty,
    updateTrial,
    checkAndAdjust,
  } = useAdaptiveDifficulty({
    initialDifficulty: config.startDifficulty || 1,
    bounds,
    onDifficultyChange: (newLevel) => {
      saveLevel(newLevel);
      setShowDifficultyChange(true);
      playLevelUp();
      onDifficultyChange?.(newLevel);
      setTimeout(() => setShowDifficultyChange(false), 2000);
    },
    userId,
    sessionId: sessionId || undefined,
    exerciseSlug: 'semantic-features',
  });
  
  const game = useSemanticFeatureGame(totalTrials, currentDifficulty, customTrials);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showDifficultyChange, setShowDifficultyChange] = useState(false);

  useEffect(() => {
    if (!game.completed && !game.showFeedback) {
      startTrial();
      setHasSubmitted(false);
    }
  }, [game.currentTrial, game.completed]);

  useEffect(() => {
    if (game.completed && onGameComplete) {
      onGameComplete(game.score, totalTrials);
    }
  }, [game.completed, game.score, totalTrials, onGameComplete]);

  const handleSubmit = async () => {
    if (hasSubmitted || game.selectedFeatures.size === 0) return;
    setHasSubmitted(true);
    const result = game.submitAnswer();
    const reactionTime = calculateReactionTime();
    updateTrial(result.correct);
    if (result.correct) { playSuccess(); } else { playError(); }
    
    await logTrial({
      correct: result.correct,
      reactionTimeMs: reactionTime,
      cueLevel: 0,
      errorType: result.correct ? null : 'semantic_error',
      taskParameters: {
        difficulty: currentDifficulty,
        word: game.getCurrentTrial()?.word,
        feature_count: game.getCurrentTrial()?.correctFeatures.length,
        total_correct: result.totalCorrect,
        total_missed: result.totalMissed,
        total_incorrect: result.totalIncorrect,
        error_analysis: result.errorAnalysis,
      },
      adaptationsActive: adaptations ? {
        extended_time: adaptations.adaptations.extendedTimeouts || false,
        audio_cues: adaptations.adaptations.useAudioCues || false,
        high_contrast: adaptations.adaptations.highContrast || false,
        larger_targets: adaptations.adaptations.largeTargets || false,
      } : undefined,
    });
    
    if (onTrialComplete) {
      onTrialComplete({ correct: result.correct, reactionTime, errorAnalysis: result.errorAnalysis });
    }
  };

  const handleNext = () => {
    const { adjusted, newLevel } = checkAndAdjust();
    game.nextTrial(newLevel);
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
  const photoPath = photo ? photo.imageUrl : null;

  if (game.completed) {
    const accuracy = game.trials.length > 0 ? (game.score / (game.currentTrial + (game.showFeedback ? 1 : 0))) * 100 : 0;
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <Sparkles className="h-8 w-8 text-primary mx-auto" />
          <h2 className="text-xl font-bold">Session Complete!</h2>
          <p className="text-2xl font-bold text-primary">{game.score} / {totalTrials}</p>
          <p className="text-sm text-muted-foreground">
            {accuracy >= 80 ? 'Excellent' : accuracy >= 60 ? 'Good progress' : 'Keep practicing'} — {accuracy.toFixed(0)}%
          </p>
          <Button size="lg" className="w-full min-h-[48px]" onClick={() => window.dispatchEvent(new CustomEvent('exercise-complete'))}>
            Continue
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Compact progress */}
      <div className="flex justify-between items-center text-xs sm:text-sm">
        <span className="text-muted-foreground">{game.currentTrial + 1} of {totalTrials}</span>
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="text-xs">Lv {currentDifficulty}</Badge>
          <span className="font-medium">{game.score} correct</span>
        </div>
      </div>
      <Progress value={game.progress} className="h-1.5" />

      {showDifficultyChange && (
        <div className="text-center text-sm font-medium text-primary flex items-center justify-center gap-1 py-1">
          <Target className="h-3.5 w-3.5" /> Level {currentDifficulty}
        </div>
      )}

      {/* Target word with optional image */}
      <div className="flex flex-col items-center gap-2 py-2">
        {photoPath && (
          <img src={photoPath} alt={trial.word} className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-lg shadow-md" />
        )}
        <div className="text-3xl font-bold text-primary">{trial.word}</div>
        <p className="text-xs text-muted-foreground text-center">
          Select features that describe this word
        </p>
      </div>

      {/* Feature options grid — large touch targets */}
      <div className="grid grid-cols-2 gap-2">
        {game.currentOptions.map((feature) => {
          const isCorrect = game.isFeatureCorrect(feature.text);
          const isSelected = game.isFeatureSelected(feature.text);
          
          return (
            <button
              key={feature.text}
              onClick={() => game.toggleFeature(feature.text)}
              disabled={game.showFeedback}
              className={cn(
                "relative p-3 rounded-lg border-2 transition-all",
                "text-sm font-medium text-left min-h-[48px]",
                getFeatureStyle(feature.text),
                "disabled:cursor-not-allowed"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span>{feature.text}</span>
                {game.showFeedback && (
                  <span className="flex-shrink-0">
                    {isCorrect && isSelected && <Check className="h-4 w-4 text-green-600" />}
                    {isCorrect && !isSelected && <Check className="h-4 w-4 text-green-400 opacity-60" />}
                    {!isCorrect && isSelected && <X className="h-4 w-4 text-destructive" />}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Action button */}
      <div className="flex justify-center pt-1">
        {!game.showFeedback ? (
          <Button onClick={handleSubmit} disabled={game.selectedFeatures.size === 0 || hasSubmitted} size="lg" className="min-h-[48px] min-w-32">
            Submit
          </Button>
        ) : (
          <Button onClick={handleNext} size="lg" className="min-h-[48px] min-w-32">
            Next
          </Button>
        )}
      </div>

      {/* Feedback — compact */}
      {game.showFeedback && (
        <div className={cn(
          "p-3 rounded-lg text-center text-sm font-medium",
          game.feedbackCorrect
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-orange-50 text-orange-700 border border-orange-200'
        )}>
          {game.feedbackCorrect ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="h-4 w-4" /> Great job!
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Brain className="h-4 w-4" /> Review the green features above.
            </span>
          )}
        </div>
      )}
    </div>
  );
};
