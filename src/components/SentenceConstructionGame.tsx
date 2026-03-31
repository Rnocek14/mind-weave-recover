import { useState, useEffect, useCallback, useRef } from "react";
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
  Lightbulb,
  Mic,
  MicOff,
  Keyboard
} from "lucide-react";
import { useSentenceGame } from "@/hooks/useSentenceGame";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";
import { AdaptationBadges } from '@/components/AdaptationBadges';

interface SentenceConstructionGameProps {
  config: ExerciseConfig;
  bounds: DifficultyBounds;
  difficultyLevel: number;
  focusPhonemes?: string[];
  adaptations?: ExerciseAdaptation | null;
  onTrialComplete?: (data: {
    correct: boolean;
    reactionTime: number;
    errorType: string | null;
    grammarFocus: string;
    trialSource: 'graded_sentence_bank' | 'standard_sentence_bank';
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
  difficultyLevel,
  focusPhonemes = [],
  adaptations,
  onTrialComplete,
  onGameComplete
}: SentenceConstructionGameProps) => {
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
  } = useSentenceGame(10, difficultyLevel, focusPhonemes);

  const { speak, stop, isSpeaking, isLoading } = useTextToSpeech();
  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());
  const [hintUsed, setHintUsed] = useState(false);
  

  const trial = getCurrentTrial();

  // Reset and auto-play audio when trial changes
  useEffect(() => {
    setTrialStartTime(Date.now());
    setHintUsed(false);
    stop();
    if (trial?.modelAudio && !completed) {
      const timer = setTimeout(() => {
        speak(trial.modelAudio!);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentTrial, completed]);

  useEffect(() => {
    if (completed && onGameComplete) {
      onGameComplete(score, trials.length);
    }
  }, [completed]);

  const handleHint = () => {
    setHintUsed(true);
    if (trial?.modelAudio) {
      speak(trial.modelAudio);
    }
  };

  const handlePlayAudio = () => {
    if (trial?.modelAudio) {
      speak(trial.modelAudio);
    }
  };

  const handleSubmit = () => {
    const result = submitAnswer();
    if (!result) return;
    const reactionTime = Date.now() - trialStartTime;
    if (trial?.modelAudio) {
      speak(trial.modelAudio);
    }
    if (onTrialComplete) {
      onTrialComplete({
        correct: result.correct,
        reactionTime,
        errorType: result.errorAnalysis.errorType,
        grammarFocus: result.trial.grammarFocus,
        trialSource: result.trial.id.startsWith('graded-') ? 'graded_sentence_bank' : 'standard_sentence_bank',
      });
    }
  };

  const handleNext = () => {
    nextTrial(difficultyLevel);
  };

  const getAvailableWords = (): Array<{ word: string; index: number }> => {
    if (!trial) return [];
    return trial.options
      .map((word, index) => ({ word, index }))
      .filter(item => !currentAnswer.includes(item.index));
  };

  const answerWords = getAnswerAsWords();

  if (!trial) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  if (completed) {
    const accuracy = Math.round((score / trials.length) * 100);
    const weakestArea = getWeakestGrammarArea();

    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-primary flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-1">Session Complete!</h2>
            <p className="text-lg text-muted-foreground">
              Score: {score} / {trials.length} ({accuracy}%)
            </p>
          </div>
          {weakestArea && (
            <div className="p-3 bg-warning/10 border border-warning rounded-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-left text-sm">
                  <p className="font-medium">Focus area: {weakestArea.replace(/_/g, " ")}</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => window.history.back()} className="min-h-[48px]">
              Back
            </Button>
            <Button onClick={() => nextTrial(difficultyLevel)} className="min-h-[48px]">
              Continue
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const progress = ((currentTrial + 1) / trials.length) * 100;
  const canSubmit = currentAnswer.length > 0;

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Compact progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs sm:text-sm">
          <span className="text-muted-foreground">
            {currentTrial + 1} of {trials.length}
          </span>
          <span className="font-medium">Score: {score}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Task info + audio — compact row */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">
          {trial.grammarFocus.replace(/_/g, " ")}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={showFeedback ? handlePlayAudio : handleHint}
          disabled={isLoading}
          className="gap-1.5 min-h-[40px]"
        >
          <Volume2 className="w-4 h-4" />
          {showFeedback ? "Hear it" : (hintUsed ? "Hear Again" : "Hear Sentence")}
        </Button>
      </div>

      {/* Main Task Card */}
      <Card className="p-3 sm:p-4">
        <div className="space-y-3">
          {/* Sentence Construction Area */}
          <div className="flex flex-wrap gap-1.5 min-h-[44px] p-2.5 bg-muted border-2 border-dashed border-primary rounded-lg">
            {answerWords.length === 0 ? (
              <span className="text-muted-foreground text-sm">Tap words to build sentence</span>
            ) : (
              answerWords.map((word, idx) => (
                <Badge key={idx} variant="secondary" className="text-sm px-2.5 py-1">
                  {word}
                </Badge>
              ))
            )}
          </div>

          {/* Word Options — large touch targets */}
          <div className="flex flex-wrap gap-2">
            {getAvailableWords().map((item) => (
              <Button
                key={item.index}
                variant="outline"
                onClick={() => selectWord(item.index)}
                disabled={showFeedback}
                className="text-base min-h-[48px] px-4"
              >
                {item.word}
              </Button>
            ))}
          </div>

          {/* Controls — compact row */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={removeLastWord}
              disabled={currentAnswer.length === 0 || showFeedback}
              className="min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAnswer}
              disabled={currentAnswer.length === 0 || showFeedback}
              className="min-h-[44px]"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
            <Button
              className="ml-auto min-h-[48px]"
              onClick={showFeedback ? handleNext : handleSubmit}
              disabled={!canSubmit && !showFeedback}
            >
              {showFeedback ? (
                <>
                  Next <ArrowRight className="w-4 h-4 ml-1" />
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
                "p-3 rounded-lg border-2 animate-in fade-in slide-in-from-bottom-2",
                feedbackCorrect
                  ? "bg-success/10 border-success"
                  : "bg-destructive/10 border-destructive"
              )}
            >
              <div className="flex items-center gap-2">
                {feedbackCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {feedbackCorrect ? "Correct!" : "Not quite right"}
                  </p>
                  {!feedbackCorrect && (
                    <p className="text-xs mt-0.5">
                      Answer: <span className="font-medium">{trial.targetSentence}</span>
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
