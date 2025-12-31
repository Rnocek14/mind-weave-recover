import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ExerciseConfig } from '@/lib/clinicalProfileMapper';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import {
  CheckCircle2,
  XCircle,
  Volume2,
  RotateCcw,
  ArrowRight,
  Trash2,
  Lightbulb
} from "lucide-react";
import { useSentenceGame } from "@/hooks/useSentenceGame";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { cn } from "@/lib/utils";
import { AdaptationBadges } from '@/components/AdaptationBadges';

interface SentenceConstructionGameProps {
  config: ExerciseConfig;
  bounds: DifficultyBounds;
  adaptations?: ExerciseAdaptation | null;
  onTrialComplete?: (data: {
    correct: boolean;
    reactionTime: number;
    errorType: string | null;
    grammarFocus: string;
  }) => void;
  onGameComplete?: (finalScore: number, totalTrials: number) => void;
}

interface ExerciseAdaptation {
  exerciseId: string;
  adaptations: {
    useAudioCues?: boolean;
    eliminateText?: boolean;
    simplifiedUI?: boolean;
    extendedTimeouts?: boolean;
    largeTargets?: boolean;
    highContrast?: boolean;
  };
  reason: string;
}

export const SentenceConstructionGame = ({
  config,
  bounds,
  adaptations,
  onTrialComplete,
  onGameComplete
}: SentenceConstructionGameProps) => {
  const difficultyLevel = config.startDifficulty || 1;
  const {
    currentTrial,
    trials,
    currentAnswer,
    score,
    completed,
    showFeedback,
    feedbackCorrect,
    getCurrentTrial,
    selectWord,
    removeLastWord,
    clearAnswer,
    submitAnswer,
    nextTrial,
    getWeakestGrammarArea,
    getAnswerAsWords
  } = useSentenceGame(10, difficultyLevel);

  const { speak, stop, isLoading, error } = useTextToSpeech();
  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());
  const [showHint, setShowHint] = useState(false);

  const trial = getCurrentTrial();

  useEffect(() => {
    setTrialStartTime(Date.now());
    setShowHint(false);
  }, [currentTrial]);

  useEffect(() => {
    if (completed && onGameComplete) {
      onGameComplete(score, trials.length);
    }
  }, [completed]);

  const handlePlayAudio = () => {
    if (trial?.modelAudio) {
      speak(trial.modelAudio);
    }
  };

  const handleSubmit = () => {
    const result = submitAnswer();
    if (!result) return;

    const reactionTime = Date.now() - trialStartTime;

    if (onTrialComplete) {
      onTrialComplete({
        correct: result.correct,
        reactionTime,
        errorType: result.errorAnalysis.errorType,
        grammarFocus: result.trial.grammarFocus
      });
    }
  };

  const handleNext = () => {
    nextTrial(difficultyLevel);
  };

  // Returns available words with their original indices (handles duplicate words correctly)
  const getAvailableWords = (): Array<{ word: string; index: number }> => {
    if (!trial) return [];

    // For reordering tasks, show words whose INDEX hasn't been selected
    if (trial.taskType === "word_order" || trial.taskType === "sentence_reorder") {
      return trial.options
        .map((word, index) => ({ word, index }))
        .filter(item => !currentAnswer.includes(item.index));
    }

    // For other tasks, show all options with indices
    return trial.options.map((word, index) => ({ word, index }));
  };

  const renderSentenceTemplate = () => {
    if (!trial) return null;

    // Get words from indices for display
    const answerWords = getAnswerAsWords();

    if (trial.sentenceTemplate) {
      const parts = trial.sentenceTemplate.split("___");
      return (
        <div className="flex flex-wrap items-center gap-2 text-lg md:text-xl font-medium">
          {parts.map((part, idx) => (
            <span key={idx}>
              {part}
              {idx < parts.length - 1 && (
                <span className="inline-flex items-center justify-center min-w-[120px] h-10 px-4 mx-2 bg-muted border-2 border-dashed border-primary rounded-lg">
                  {answerWords[0] || "___"}
                </span>
              )}
            </span>
          ))}
        </div>
      );
    }

    // For reordering tasks, show constructed sentence using actual words
    return (
      <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-muted border-2 border-dashed border-primary rounded-lg">
        {answerWords.length === 0 ? (
          <span className="text-muted-foreground">Tap words below to build your sentence</span>
        ) : (
          answerWords.map((word, idx) => (
            <Badge key={idx} variant="secondary" className="text-base px-3 py-1">
              {word}
            </Badge>
          ))
        )}
      </div>
    );
  };

  if (!trial) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  if (completed) {
    const accuracy = Math.round((score / trials.length) * 100);
    const weakestArea = getWeakestGrammarArea();

    return (
      <Card className="p-8">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-primary flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-2">Session Complete!</h2>
            <p className="text-xl text-muted-foreground">
              Score: {score} / {trials.length} ({accuracy}%)
            </p>
          </div>

          {weakestArea && (
            <div className="p-4 bg-warning/10 border border-warning rounded-lg">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-warning flex-shrink-0 mt-1" />
                <div className="text-left">
                  <p className="font-medium mb-1">Area to focus on:</p>
                  <p className="text-sm text-muted-foreground">
                    {weakestArea.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => window.history.back()}>
              Back to Dashboard
            </Button>
            <Button onClick={() => nextTrial(difficultyLevel)}>
              Continue Training
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const progress = ((currentTrial + 1) / trials.length) * 100;
  const canSubmit = currentAnswer.length > 0;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Trial {currentTrial + 1} of {trials.length}
          </span>
          <span className="font-medium">Score: {score}</span>
        </div>
        <Progress value={progress} className="h-2" />
        {adaptations && (
          <div className="pt-2">
            <AdaptationBadges adaptations={adaptations} />
          </div>
        )}
      </div>

      {/* Task Type Badge */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-sm">
          {trial.grammarFocus.replace(/_/g, " ")}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlayAudio}
          disabled={isLoading}
        >
          <Volume2 className="w-4 h-4 mr-2" />
          Play Model
        </Button>
      </div>

      {/* Main Task Card */}
      <Card className="p-6 md:p-8">
        <div className="space-y-6">
          {/* Sentence Template / Answer Area */}
          <div className="text-center">
            {renderSentenceTemplate()}
          </div>

          {/* Word Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              {trial.taskType === "word_order" || trial.taskType === "sentence_reorder"
                ? "Select words in order:"
                : "Select the correct word:"}
            </p>
            <div className="flex flex-wrap gap-3">
              {getAvailableWords().map((item) => (
                <Button
                  key={item.index}
                  variant={currentAnswer.includes(item.index) ? "default" : "outline"}
                  size="lg"
                  onClick={() => selectWord(item.index)}
                  disabled={
                    showFeedback ||
                    (currentAnswer.includes(item.index) && 
                      (trial.taskType === "fill_function" || 
                       trial.taskType === "verb_agreement" || 
                       trial.taskType === "cloze_picture"))
                  }
                  className="text-base"
                >
                  {item.word}
                </Button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-3 pt-4">
            {(trial.taskType === "word_order" || trial.taskType === "sentence_reorder") && (
              <>
                <Button
                  variant="outline"
                  onClick={removeLastWord}
                  disabled={currentAnswer.length === 0 || showFeedback}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Undo
                </Button>
                <Button
                  variant="outline"
                  onClick={clearAnswer}
                  disabled={currentAnswer.length === 0 || showFeedback}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </>
            )}
            <Button
              className="ml-auto"
              onClick={showFeedback ? handleNext : handleSubmit}
              disabled={!canSubmit && !showFeedback}
            >
              {showFeedback ? (
                <>
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>

          {/* Feedback */}
          {showFeedback && (
            <div
              className={cn(
                "p-4 rounded-lg border-2 animate-in fade-in slide-in-from-bottom-2",
                feedbackCorrect
                  ? "bg-success/10 border-success"
                  : "bg-destructive/10 border-destructive"
              )}
            >
              <div className="flex items-center gap-3">
                {feedbackCorrect ? (
                  <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium mb-1">
                    {feedbackCorrect ? "Correct!" : "Not quite right"}
                  </p>
                  {!feedbackCorrect && (
                    <p className="text-sm">
                      Correct answer: <span className="font-medium">{trial.targetSentence}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
