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
import { Badge } from '@/components/ui/badge';
import { useMinimalPairsGame } from '@/hooks/useMinimalPairsGame';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { Check, X, Volume2, ArrowRight, RotateCcw, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MinimalPairsGameProps {
  difficulty?: number;
  totalTrials?: number;
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
  onComplete,
  onTrialComplete,
}: MinimalPairsGameProps) {
  const { state, selectAnswer, nextTrial, reset } = useMinimalPairsGame({
    totalTrials,
    difficultyLevel: difficulty,
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
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No minimal pairs available for practice.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Add more photos to the photo bank to enable this exercise.
        </p>
      </Card>
    );
  }
  
  if (isComplete) {
    const accuracy = state.totalTrials > 0 
      ? Math.round((correctCount / state.totalTrials) * 100) 
      : 0;
    
    return (
      <Card className="p-8">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold">Exercise Complete!</h2>
            <p className="text-muted-foreground mt-1">Great work on your phoneme discrimination practice</p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{score}</div>
              <div className="text-xs text-muted-foreground">Score</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">{correctCount}</div>
              <div className="text-xs text-muted-foreground">Correct</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{accuracy}%</div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
          </div>
          
          <Button onClick={() => reset()} size="lg">
            <RotateCcw className="w-4 h-4 mr-2" />
            Practice Again
          </Button>
        </div>
      </Card>
    );
  }
  
  const progress = ((trialIndex) / state.totalTrials) * 100;
  
  return (
    <div className="space-y-6">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline">
            {trialIndex + 1} / {state.totalTrials}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Check className="w-3 h-3" /> {correctCount}
          </Badge>
        </div>
        <div className="text-lg font-semibold">Score: {score}</div>
      </div>
      
      <Progress value={progress} className="h-2" />
      
      {/* Instruction and audio button */}
      <Card className="p-6 text-center bg-primary/5 border-primary/20">
        <p className="text-lg font-medium mb-3">
          Which picture shows: <span className="text-primary font-bold text-xl">"{currentTrial.targetWord}"</span>?
        </p>
        <Button 
          variant="outline" 
          size="lg"
          onClick={() => speak(currentTrial.targetWord)}
          disabled={isSpeaking}
          className="gap-2"
        >
          <Volume2 className="w-5 h-5" />
          Hear Word Again
        </Button>
      </Card>
      
      {/* Side-by-side images */}
      <div className="grid grid-cols-2 gap-4">
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
                "relative rounded-xl overflow-hidden border-4 transition-all duration-200",
                "focus:outline-none focus:ring-4 focus:ring-primary/50",
                !showFeedback && "hover:scale-[1.02] hover:border-primary/50 cursor-pointer",
                !showFeedback && !isSelected && "border-border",
                showFeedback && isTarget && "border-green-500 ring-4 ring-green-500/30",
                showFeedback && isSelected && !isTarget && "border-red-500 ring-4 ring-red-500/30",
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
                    <div className="bg-green-500 text-white rounded-full p-3">
                      <Check className="w-8 h-8" />
                    </div>
                  )}
                  {isSelected && !isTarget && (
                    <div className="bg-red-500 text-white rounded-full p-3">
                      <X className="w-8 h-8" />
                    </div>
                  )}
                </div>
              )}
              
              {/* Word label (shown after selection) */}
              {showFeedback && (
                <div className={cn(
                  "absolute bottom-0 left-0 right-0 py-2 px-3 text-center font-bold text-lg",
                  isTarget ? "bg-green-500 text-white" : "bg-muted text-foreground"
                )}>
                  {word}
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Contrast info (shown after selection) */}
      {showFeedback && (
        <Card className="p-4 bg-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Phoneme Contrast</p>
              <p className="font-medium">
                <span className="text-primary">{currentTrial.pair.phoneme1}</span>
                {" vs "}
                <span className="text-primary">{currentTrial.pair.phoneme2}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {currentTrial.pair.contrastDescription}
              </p>
            </div>
            
            <Button onClick={nextTrial} size="lg" className="gap-2">
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
