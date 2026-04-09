/**
 * MinimalPairsGame Component
 * 
 * Displays two images side-by-side for phoneme discrimination practice.
 * User hears a word and must select the matching image.
 */

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useMinimalPairsGame } from '@/hooks/useMinimalPairsGame';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { Check, X, Volume2, ArrowRight, RotateCcw, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MinimalPairsGameProps {
  difficulty?: number;
  totalTrials?: number;
  focusPhonemes?: string[];
  onComplete?: (results: {
    score: number;
    correctCount: number;
    incorrectCount: number;
    accuracy: number;
  }) => void;
  onTrialComplete?: (trialData: {
    targetWord: string;
    selectedWord: string;
    isCorrect: boolean;
    pair: { word1: string; word2: string };
  }) => void;
}

export function MinimalPairsGame({
  difficulty = 1,
  totalTrials = 10,
  focusPhonemes,
  onComplete,
  onTrialComplete,
}: MinimalPairsGameProps) {
  const { state, selectAnswer, nextTrial, reset } = useMinimalPairsGame({
    totalTrials,
    difficultyLevel: difficulty,
    focusPhonemes,
  });
  
  const { speak, isLoading: isSpeaking } = useTextToSpeech();
  
  const { currentTrial, trialIndex, score, correctCount, incorrectCount, showFeedback, isComplete } = state;
  
  // Auto-play target word when trial changes
  useEffect(() => {
    if (currentTrial && !showFeedback) {
      const timer = setTimeout(() => {
        speak(currentTrial.targetWord);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentTrial, showFeedback, speak]);
  
  // Handle completion
  useEffect(() => {
    if (isComplete && onComplete) {
      const accuracy = state.totalTrials > 0 
        ? Math.round((correctCount / state.totalTrials) * 100) 
        : 0;
      onComplete({ score, correctCount, incorrectCount, accuracy });
    }
  }, [isComplete, onComplete, score, correctCount, incorrectCount, state.totalTrials]);
  
  // Report trial data
  useEffect(() => {
    if (showFeedback && currentTrial && onTrialComplete) {
      const selectedWord = state.selectedIndex === 0 
        ? currentTrial.pair.word1 
        : currentTrial.pair.word2;
      onTrialComplete({
        targetWord: currentTrial.targetWord,
        selectedWord,
        isCorrect: state.isCorrect ?? false,
        pair: { word1: currentTrial.pair.word1, word2: currentTrial.pair.word2 },
      });
    }
  }, [showFeedback, currentTrial, state.selectedIndex, state.isCorrect, onTrialComplete]);
  
  if (!currentTrial && !isComplete) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">No minimal pairs available for practice.</p>
      </Card>
    );
  }
  
  if (isComplete) {
    const accuracy = state.totalTrials > 0 
      ? Math.round((correctCount / state.totalTrials) * 100) 
      : 0;
    
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Exercise Complete!</h2>
            <p className="text-muted-foreground mt-1 text-sm">Great work on phoneme discrimination</p>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xl font-bold text-primary">{score}</div>
              <div className="text-xs text-muted-foreground">Score</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xl font-bold text-green-600">{correctCount}</div>
              <div className="text-xs text-muted-foreground">Correct</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xl font-bold">{accuracy}%</div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
          </div>
          <Button onClick={() => reset()} size="lg" className="min-h-[48px]">
            <RotateCcw className="w-4 h-4 mr-2" />
            Practice Again
          </Button>
        </div>
      </Card>
    );
  }
  
  const progress = ((trialIndex) / state.totalTrials) * 100;
  
  return (
    <div className="space-y-2 sm:space-y-4">
      {/* Purpose banner — first trial only */}
      {trialIndex === 0 && !showFeedback && (
        <ExercisePurposeBanner exerciseSlug="minimal-pairs" />
      )}
      {/* Compact header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {trialIndex + 1} / {state.totalTrials}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Check className="w-3 h-3" /> {correctCount}
          </span>
          <span className="font-medium">Score: {score}</span>
        </div>
      </div>
      
      <Progress value={progress} className="h-1.5" />
      
      {/* Target word + audio — compact inline */}
      <div className="flex items-center justify-center gap-3 py-2">
        <p className="text-lg font-medium">
          Which is: <span className="text-primary font-bold text-xl">"{currentTrial.targetWord}"</span>?
        </p>
        <button
          onClick={() => speak(currentTrial.targetWord)}
          disabled={isSpeaking}
          className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0"
        >
          <Volume2 className="w-5 h-5 text-primary" />
        </button>
      </div>
      
      {/* Side-by-side images — full-width, large touch targets */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[0, 1].map((index) => {
          const trial = index === 0 ? currentTrial.trial1 : currentTrial.trial2;
          const word = index === 0 ? currentTrial.pair.word1 : currentTrial.pair.word2;
          const isSelected = state.selectedIndex === index;
          const isTarget = currentTrial.targetIndex === index;
          
          return (
            <button
              key={index}
              onClick={() => !showFeedback && selectAnswer(index as 0 | 1)}
              disabled={showFeedback}
              className={cn(
                "relative rounded-xl overflow-hidden border-3 transition-all duration-200",
                "focus:outline-none focus:ring-4 focus:ring-primary/50",
                "active:scale-[0.98]",
                !showFeedback && "hover:border-primary/50 cursor-pointer border-border",
                showFeedback && isTarget && "border-green-500 ring-2 ring-green-500/30",
                showFeedback && isSelected && !isTarget && "border-red-500 ring-2 ring-red-500/30",
                showFeedback && !isSelected && !isTarget && "border-border opacity-50",
              )}
            >
              <div className="aspect-square bg-muted">
                <img
                  src={trial.imageUrl}
                  alt={`Option ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Feedback overlay */}
              {showFeedback && (
                <div className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  isTarget ? "bg-green-500/20" : isSelected ? "bg-red-500/20" : "bg-black/30"
                )}>
                  {isTarget && (
                    <div className="bg-green-500 text-white rounded-full p-2.5">
                      <Check className="w-6 h-6" />
                    </div>
                  )}
                  {isSelected && !isTarget && (
                    <div className="bg-red-500 text-white rounded-full p-2.5">
                      <X className="w-6 h-6" />
                    </div>
                  )}
                </div>
              )}
              
              {/* Word label (shown after selection) */}
              {showFeedback && (
                <div className={cn(
                  "absolute bottom-0 left-0 right-0 py-1.5 px-2 text-center font-bold text-sm",
                  isTarget ? "bg-green-500 text-white" : "bg-muted text-foreground"
                )}>
                  {word}
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Contrast info + Next — compact */}
      {showFeedback && (
        <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              <span className="text-primary font-medium">{currentTrial.pair.phoneme1}</span>
              {" vs "}
              <span className="text-primary font-medium">{currentTrial.pair.phoneme2}</span>
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentTrial.pair.contrastDescription}
            </p>
          </div>
          <Button onClick={nextTrial} size="lg" className="gap-2 min-h-[48px] shrink-0 ml-3">
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
