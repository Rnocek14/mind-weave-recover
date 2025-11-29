import { useState, useEffect } from 'react';
import { usePhonoGame } from '@/hooks/usePhonoGame';
import { useExerciseDifficulty } from '@/hooks/useExerciseDifficulty';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, X, Volume2, Ear, Sparkles, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGameSounds } from '@/hooks/useGameSounds';
import type { ExerciseConfig } from '@/lib/clinicalProfileMapper';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import type { ExerciseAdaptation } from '@/lib/exerciseGating';
import { AdaptationBadges } from '@/components/AdaptationBadges';

interface PhonologicalGameProps {
  totalTrials?: number;
  config: ExerciseConfig;
  bounds: DifficultyBounds;
  adaptations?: ExerciseAdaptation | null;
  onTrialComplete?: (data: any) => void;
  onGameComplete?: (finalScore: number, totalTrials: number) => void;
  onDifficultyChange?: (newLevel: number) => void;
  userId?: string;
  sessionId?: string;
}

export const PhonologicalGame = ({
  totalTrials = 10,
  config,
  bounds,
  adaptations,
  onTrialComplete,
  onGameComplete,
  onDifficultyChange,
  userId,
  sessionId,
}: PhonologicalGameProps) => {
  const { saveLevel } = useExerciseDifficulty(
    userId,
    'phonological-awareness',
    undefined
  );
  const { startTrial, logTrial, calculateReactionTime } = useExerciseTelemetry(
    sessionId || null,
    'phonological-awareness'
  );
  const { toast } = useToast();
  const { playSuccess, playError, playLevelUp } = useGameSounds();
  const { speak, isLoading: isSpeaking } = useTextToSpeech();
  
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
  });
  
  const game = usePhonoGame(totalTrials, currentDifficulty);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showDifficultyChange, setShowDifficultyChange] = useState(false);
  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);

  // Start trial and play audio when new trial begins
  useEffect(() => {
    if (!game.completed && !game.showFeedback && game.getCurrentTrial()) {
      startTrial();
      setHasSubmitted(false);
      setHasPlayedAudio(false);
      
      // Auto-play audio after short delay
      setTimeout(() => {
        handlePlayAudio();
      }, 500);
    }
  }, [game.currentTrial, game.completed]);

  const handlePlayAudio = async () => {
    const trial = game.getCurrentTrial();
    if (!trial || isSpeaking) return;

    // Speak both words with a pause between
    await speak(trial.word1);
    await new Promise(resolve => setTimeout(resolve, 800));
    await speak(trial.word2);
    
    setHasPlayedAudio(true);
  };

  const handleAnswer = async (answer: 'same' | 'different') => {
    if (hasSubmitted) return;
    
    setHasSubmitted(true);
    const result = game.submitAnswer(answer);
    const reactionTime = calculateReactionTime();
    
    // Update adaptive difficulty tracking
    updateTrial(result.correct);
    
    // Play feedback sound
    if (result.correct) {
      playSuccess();
    } else {
      playError();
    }
    
    // Log trial data
    const trial = game.getCurrentTrial();
    await logTrial({
      correct: result.correct,
      reactionTimeMs: reactionTime,
      cueLevel: 0,
      errorType: result.correct ? null : 'phonological_error',
      taskParameters: {
        difficulty: currentDifficulty,
        word1: trial?.word1,
        word2: trial?.word2,
        relationType: result.relationType,
        expectedAnswer: result.expectedAnswer,
        userAnswer: answer,
        phonemeDifferences: trial?.phonemeDifferences,
      },
      adaptationsActive: adaptations ? {
        extended_time: adaptations.adaptations.extendedTimeouts || false,
        audio_cues: adaptations.adaptations.useAudioCues || false,
        high_contrast: adaptations.adaptations.highContrast || false,
        larger_targets: adaptations.adaptations.largeTargets || false,
      } : undefined,
    });
    
    // Callback
    if (onTrialComplete) {
      onTrialComplete({
        correct: result.correct,
        reactionTime,
        relationType: result.relationType,
      });
    }
  };

  const handleNext = () => {
    // Check and adjust difficulty if needed
    checkAndAdjust();
    
    game.nextTrial();
    
    // Check if game is complete
    if (game.currentTrial + 1 >= totalTrials) {
      if (onGameComplete) {
        onGameComplete(game.score, totalTrials);
      }
    }
  };

  const trial = game.getCurrentTrial();
  if (!trial) return null;

  const accuracy = game.trials.length > 0 
    ? (game.score / (game.currentTrial + (game.showFeedback ? 1 : 0))) * 100 
    : 0;

  if (game.completed) {
    const errorAnalysis = game.getErrorAnalysis();
    
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
          
          {errorAnalysis.weakestPosition && (
            <div className="bg-accent/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Ear className="h-4 w-4" />
                Phonological Insights
              </h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Weakest position: <span className="font-medium">{errorAnalysis.weakestPosition}</span></p>
                {errorAnalysis.confusableContrasts.length > 0 && (
                  <p>Most confused sounds: <span className="font-medium">
                    {errorAnalysis.confusableContrasts.map(c => `${c.from}→${c.to}`).join(', ')}
                  </span></p>
                )}
              </div>
            </div>
          )}
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
                <Badge variant="outline">Level {currentDifficulty}</Badge>
                <Badge variant="secondary">{game.score} correct</Badge>
              </div>
            </div>
            <Progress value={game.progress} />
            {adaptations && (
              <div className="pt-2">
                <AdaptationBadges adaptations={adaptations} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Difficulty change notification */}
      {showDifficultyChange && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-center font-medium flex items-center justify-center gap-2">
              <Target className="h-4 w-4" />
              Difficulty adjusted to Level {currentDifficulty}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main game area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Ear className="h-5 w-5 text-primary" />
            Do these words sound the same or different?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Word display with audio */}
          <div className="flex flex-col items-center space-y-6">
            <div className="grid grid-cols-2 gap-8 w-full max-w-md">
              <div className="flex flex-col items-center space-y-2">
                <div className="text-4xl font-bold text-primary">
                  {trial.word1}
                </div>
                {trial.isNonword && (
                  <Badge variant="outline" className="text-xs">
                    nonword
                  </Badge>
                )}
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="text-4xl font-bold text-primary">
                  {trial.word2}
                </div>
                {trial.isNonword && (
                  <Badge variant="outline" className="text-xs">
                    nonword
                  </Badge>
                )}
              </div>
            </div>

            {/* Replay audio button */}
            <Button
              variant="outline"
              size="lg"
              onClick={handlePlayAudio}
              disabled={isSpeaking || game.showFeedback}
              className="gap-2"
            >
              <Volume2 className="h-5 w-5" />
              {!hasPlayedAudio ? 'Listen' : 'Replay Audio'}
            </Button>

            <p className="text-sm text-muted-foreground text-center max-w-md">
              Listen carefully to both words. Do they sound the same or different?
            </p>
          </div>

          {/* Answer buttons */}
          <div className="flex gap-4 justify-center pt-4">
            {!game.showFeedback ? (
              <>
                <Button
                  onClick={() => handleAnswer('same')}
                  disabled={hasSubmitted}
                  size="lg"
                  variant="outline"
                  className="min-w-32"
                >
                  Same Sound
                </Button>
                <Button
                  onClick={() => handleAnswer('different')}
                  disabled={hasSubmitted}
                  size="lg"
                  variant="outline"
                  className="min-w-32"
                >
                  Different Sound
                </Button>
              </>
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
                  Correct! Great listening!
                </span>
              ) : (
                <div className="space-y-2">
                  <span className="flex items-center justify-center gap-2">
                    <X className="h-5 w-5" />
                    Not quite. These words sound {trial.areSame ? 'the same' : 'different'}.
                  </span>
                  <p className="text-sm opacity-80">
                    Relationship: {trial.relationType.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
