import { useState, useEffect, useRef } from 'react';
import { usePhonoGame } from '@/hooks/usePhonoGame';
import { useExerciseDifficulty } from '@/hooks/useExerciseDifficulty';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, X, Volume2, Ear, Sparkles, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGameSounds } from '@/hooks/useGameSounds';
import { cn } from '@/lib/utils';
import type { ExerciseConfig } from '@/lib/clinicalProfileMapper';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import type { ExerciseAdaptation } from '@/lib/exerciseGating';
import type { PhonologicalTrial } from '@/data/phonologicalBank';

/**
 * Wave 3: trial-completion payload now carries the full per-trial detail
 * the exercise page needs to call the unified `submitTrial` (parent owns
 * the single writer for `exercise_events` + progression buffering).
 */
export interface PhonologicalTrialDetail {
  correct: boolean;
  reactionTime: number;
  difficulty: number;
  trial: PhonologicalTrial | null;
  userAnswer: 'same' | 'different';
  expectedAnswer: 'same' | 'different';
  relationType: string;
}

interface PhonologicalGameProps {
  totalTrials?: number;
  config: ExerciseConfig;
  bounds: DifficultyBounds;
  adaptations?: ExerciseAdaptation | null;
  customTrials?: PhonologicalTrial[];
  onTrialComplete?: (data: PhonologicalTrialDetail) => void;
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
  customTrials,
  onTrialComplete,
  onGameComplete,
  onDifficultyChange,
  userId,
  sessionId,
}: PhonologicalGameProps) => {
  const { saveLevel } = useExerciseDifficulty(userId, undefined, 'phonological-awareness');
  const { toast } = useToast();
  const { playSuccess, playError, playLevelUp } = useGameSounds();
  const { speak, stop: stopSpeech, isSpeaking } = useTextToSpeech();
  const isPlayingAudioRef = useRef(false);
  const trialStartRef = useRef<number>(Date.now());

  const game = usePhonoGame(totalTrials, config.startDifficulty || 1, customTrials);
  const engagement = useEngagementMonitor(sessionId || null);

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
      // Swap upcoming trials to new tier WITHOUT resetting score/progress
      game.setActiveDifficulty(newLevel);
      onDifficultyChange?.(newLevel);
      setTimeout(() => setShowDifficultyChange(false), 2000);
    },
    userId,
    sessionId: sessionId || undefined,
    exerciseSlug: 'phonological_awareness',
    autoLog: false, // Wave 3: PhonologicalExercise owns the unified submitTrial pathway.
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
  });

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showDifficultyChange, setShowDifficultyChange] = useState(false);
  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);

  useEffect(() => {
    if (!game.completed && !game.showFeedback && game.getCurrentTrial()) {
      trialStartRef.current = Date.now();
      setHasSubmitted(false);
      setHasPlayedAudio(false);
      const timer = setTimeout(() => { handlePlayAudio(); }, 500);
      return () => clearTimeout(timer);
    }
  }, [game.currentTrial, game.completed]);

  useEffect(() => {
    if (game.completed && onGameComplete) {
      onGameComplete(game.score, totalTrials);
    }
  }, [game.completed, game.score, totalTrials, onGameComplete]);

  const handlePlayAudio = async () => {
    const trial = game.getCurrentTrial();
    if (!trial || isPlayingAudioRef.current) return;
    stopSpeech();
    isPlayingAudioRef.current = true;
    try {
      await speak(trial.word1);
      await new Promise(resolve => setTimeout(resolve, 800));
      await speak(trial.word2);
      setHasPlayedAudio(true);
    } finally {
      isPlayingAudioRef.current = false;
    }
  };

  const handleAnswer = async (answer: 'same' | 'different') => {
    if (hasSubmitted) return;
    setHasSubmitted(true);
    const result = game.submitAnswer(answer);
    const reactionTime = Date.now() - trialStartRef.current;
    updateTrial(result.correct, reactionTime);
    engagement.recordTrial({ correct: result.correct, reactionTimeMs: reactionTime, timeout: false, cueLevel: 0, timestamp: Date.now() });
    if (result.correct) { playSuccess(); } else { playError(); }

    const trial = game.getCurrentTrial();
    // Wave 3: parent (PhonologicalExercise) is the single writer for
    // exercise_events + progression via useTrialSubmission. We just hand
    // off the trial detail.
    if (onTrialComplete) {
      onTrialComplete({
        correct: result.correct,
        reactionTime,
        difficulty: currentDifficulty,
        trial,
        userAnswer: answer,
        expectedAnswer: result.expectedAnswer as 'same' | 'different',
        relationType: result.relationType,
      });
    }
  };


  const handleNext = () => {
    checkAndAdjust();
    game.nextTrial();
  };

  const trial = game.getCurrentTrial();
  if (!trial) return null;

  const accuracy = game.trials.length > 0 
    ? (game.score / (game.currentTrial + (game.showFeedback ? 1 : 0))) * 100 
    : 0;

  if (game.completed) {
    const errorAnalysis = game.getErrorAnalysis();
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <Sparkles className="h-8 w-8 text-primary mx-auto" />
          <h2 className="text-xl font-bold">Session Complete!</h2>
          <p className="text-2xl font-bold text-primary">{game.score} / {totalTrials}</p>
          <p className="text-sm text-muted-foreground">
            {accuracy >= 80 ? 'Excellent' : accuracy >= 60 ? 'Good progress' : 'Keep practicing'} — {accuracy.toFixed(0)}%
          </p>
          {errorAnalysis.weakestPosition && (
            <div className="bg-accent/50 p-3 rounded-lg text-sm text-left">
              <div className="flex items-center gap-2 mb-1">
                <Ear className="h-4 w-4" />
                <span className="font-semibold">Phonological Insights</span>
              </div>
              <p className="text-muted-foreground">Weakest position: {errorAnalysis.weakestPosition}</p>
            </div>
          )}
          <Button size="lg" className="w-full min-h-[48px]" onClick={() => window.dispatchEvent(new CustomEvent('exercise-complete'))}>
            Continue
          </Button>
        </div>
      </Card>
    );
  }

  // Get question text based on relation type
  const questionText = trial.relationType.includes('onset') || trial.relationType === 'unrelated'
    ? 'Same starting sound?'
    : trial.relationType.includes('coda')
    ? 'Same ending sound?'
    : trial.relationType === 'rhyme'
    ? 'Do these rhyme?'
    : trial.relationType.includes('vowel')
    ? 'Same middle sound?'
    : 'Same or different?';

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

      {/* Question + words */}
      <div className="text-center space-y-3 py-2">
        <p className="text-base font-medium flex items-center justify-center gap-2">
          <Ear className="h-4 w-4 text-primary" />
          {questionText}
        </p>
        
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-primary">{trial.word1}</div>
            {trial.isNonword && <span className="text-xs text-muted-foreground">nonword</span>}
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-primary">{trial.word2}</div>
            {trial.isNonword && <span className="text-xs text-muted-foreground">nonword</span>}
          </div>
        </div>

        <Button
          variant="outline"
          onClick={handlePlayAudio}
          disabled={isSpeaking || game.showFeedback}
          className="gap-2 min-h-[44px]"
        >
          <Volume2 className="h-4 w-4" />
          {!hasPlayedAudio ? 'Listen' : 'Replay'}
        </Button>
      </div>

      {/* Answer buttons — large touch targets */}
      <div className="flex gap-3 justify-center">
        {!game.showFeedback ? (
          <>
            <Button
              onClick={() => handleAnswer('same')}
              disabled={hasSubmitted}
              size="lg"
              variant="outline"
              className="flex-1 max-w-[180px] min-h-[56px] text-base"
            >
              {trial.relationType === 'rhyme' ? 'Yes, rhyme' : 'Same'}
            </Button>
            <Button
              onClick={() => handleAnswer('different')}
              disabled={hasSubmitted}
              size="lg"
              variant="outline"
              className="flex-1 max-w-[180px] min-h-[56px] text-base"
            >
              {trial.relationType === 'rhyme' ? 'No' : 'Different'}
            </Button>
          </>
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
              <Check className="h-4 w-4" /> Correct!
            </span>
          ) : (
            <div className="space-y-1">
              <span className="flex items-center justify-center gap-2">
                <X className="h-4 w-4" /> These sound {trial.areSame ? 'the same' : 'different'}.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
