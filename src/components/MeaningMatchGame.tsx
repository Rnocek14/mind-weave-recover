/**
 * Meaning Match Arena Game Component
 * 
 * Read a sentence → pick the correct meaning → explain WHY (generative layer).
 * Supports keyword highlight hints and tiered difficulty.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useMeaningMatchGame, MeaningMatchTrialResult } from '@/hooks/useMeaningMatchGame';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Lightbulb, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExplainWhyPrompt, ExplainWhyResult } from '@/components/ExplainWhyPrompt';
import { deriveKeyConcepts } from '@/lib/explanationScorer';

interface MeaningMatchGameProps {
  onTrialComplete: (result: MeaningMatchTrialResult) => void;
  onGameComplete: (results: MeaningMatchTrialResult[]) => void;
  roundCount?: number;
  difficultyLevel?: number;
}

type Phase = 'reading' | 'answering' | 'feedback' | 'explaining';

/** Highlight keywords in a sentence */
function highlightSentence(sentence: string, keywords?: string[]): React.ReactNode {
  if (!keywords || keywords.length === 0) return sentence;
  
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = sentence.split(regex);
  
  return parts.map((part, i) => {
    const isKeyword = keywords.some(k => k.toLowerCase() === part.toLowerCase());
    if (isKeyword) {
      return (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/50 px-0.5 rounded font-medium">
          {part}
        </mark>
      );
    }
    return part;
  });
}

export function MeaningMatchGame({
  onTrialComplete,
  onGameComplete,
  roundCount = 10,
  difficultyLevel = 1,
}: MeaningMatchGameProps) {
  const {
    currentItem,
    currentIndex,
    totalItems,
    isComplete,
    results,
    totalPoints,
    submitAnswer,
    nextItem,
  } = useMeaningMatchGame(roundCount, difficultyLevel);

  const [phase, setPhase] = useState<Phase>('reading');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<MeaningMatchTrialResult | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [reasoningPoints, setReasoningPoints] = useState(0);
  const trialStartRef = useRef(Date.now());

  // Reset state when item changes
  useEffect(() => {
    setPhase('reading');
    setSelectedOption(null);
    setLastResult(null);
    setUsedHint(false);
    setShowHint(false);
    trialStartRef.current = Date.now();
  }, [currentIndex]);

  // Fire completion once
  const completedRef = useRef(false);
  useEffect(() => {
    if (isComplete && results.length > 0 && !completedRef.current) {
      completedRef.current = true;
      onGameComplete(results);
    }
  }, [isComplete, results, onGameComplete]);

  const handleReady = useCallback(() => {
    setPhase('answering');
    trialStartRef.current = Date.now();
  }, []);

  const handleSelectOption = useCallback((index: number) => {
    if (phase !== 'answering' || selectedOption !== null) return;

    setSelectedOption(index);
    const reactionTimeMs = Date.now() - trialStartRef.current;
    const result = submitAnswer(index, reactionTimeMs, usedHint);

    if (result) {
      setLastResult(result);
      setPhase('feedback');
      // Do NOT emit onTrialComplete here — wait until after explanation phase
    }
  }, [phase, selectedOption, usedHint, submitAnswer]);

  const handleHint = useCallback(() => {
    setUsedHint(true);
    setShowHint(true);
  }, []);

  // Transition from feedback → explaining
  const handleProceedToExplain = useCallback(() => {
    setPhase('explaining');
  }, []);

  // Handle explanation completion — emit single combined trial result
  const handleExplainComplete = useCallback((explainResult: ExplainWhyResult) => {
    if (!explainResult.skipped) {
      setReasoningPoints(prev => prev + explainResult.score.score);
    }
    if (lastResult) {
      onTrialComplete({
        ...lastResult,
        points: lastResult.points + explainResult.score.score,
        explanation: explainResult.explanationData,
      });
    }
    nextItem();
  }, [nextItem, lastResult, onTrialComplete]);

  const handleNext = useCallback(() => {
    nextItem();
  }, [nextItem]);

  // Summary screen
  if (!currentItem || isComplete) {
    const correctCount = results.filter(r => r.correct).length;
    return (
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <div className="text-6xl">🏆</div>
        <h2 className="text-2xl font-bold">Arena Complete!</h2>
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{correctCount}/{results.length}</div>
              <div className="text-xs text-muted-foreground">Correct</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{totalPoints}</div>
              <div className="text-xs text-muted-foreground">Points</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">
                {results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </CardContent>
          </Card>
        </div>
        {reasoningPoints > 0 && (
          <div className="text-sm text-muted-foreground">
            🧠 Reasoning score: {reasoningPoints} pts
          </div>
        )}
      </div>
    );
  }

  const progressPercent = (currentIndex / totalItems) * 100;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-medium">Round {currentIndex + 1} of {totalItems}</span>
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">{totalPoints}</span>
          {reasoningPoints > 0 && (
            <span className="text-xs text-muted-foreground ml-1">+🧠{reasoningPoints}</span>
          )}
        </div>
      </div>

      <Progress value={progressPercent} className="h-2" />

      {/* Sentence card */}
      <Card className="border-2 border-border/50">
        <CardContent className="pt-6">
          <p className="text-lg leading-relaxed">
            {showHint
              ? highlightSentence(currentItem.sentence, currentItem.keywords)
              : currentItem.sentence}
          </p>
          {currentItem.type === 'figurative' && (
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
              Figurative
            </span>
          )}
        </CardContent>
      </Card>

      {/* Reading phase */}
      {phase === 'reading' && (
        <Button onClick={handleReady} className="w-full" size="lg">
          What does this mean? →
        </Button>
      )}

      {/* Answering phase */}
      {phase === 'answering' && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Pick the best meaning:</h3>

          <div className="space-y-2">
            {currentItem.options.map((option, i) => (
              <Button
                key={i}
                variant="outline"
                className="w-full text-left justify-start h-auto py-3 px-4 whitespace-normal"
                onClick={() => handleSelectOption(i)}
              >
                <span className="mr-3 font-bold text-muted-foreground">
                  {String.fromCharCode(65 + i)}.
                </span>
                {option}
              </Button>
            ))}
          </div>

          {!usedHint && (
            <Button variant="ghost" size="sm" onClick={handleHint} className="w-full text-muted-foreground">
              <Lightbulb className="h-4 w-4 mr-2" />
              Highlight keywords (−5 bonus points)
            </Button>
          )}
        </div>
      )}

      {/* Feedback phase — now transitions to explaining */}
      {phase === 'feedback' && lastResult && (
        <div className="space-y-4">
          <Card className={cn(
            "border-2",
            lastResult.correct
              ? "border-green-500 bg-green-50 dark:bg-green-950/20"
              : "border-red-500 bg-red-50 dark:bg-red-950/20"
          )}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2">
                {lastResult.correct
                  ? <CheckCircle className="h-5 w-5 text-green-600" />
                  : <XCircle className="h-5 w-5 text-red-600" />}
                <span className="font-bold">
                  {lastResult.correct ? '✅ Correct!' : '❌ Not quite...'}
                </span>
                {lastResult.correct && (
                  <span className="ml-auto text-sm text-green-700 dark:text-green-400 font-medium">
                    +{lastResult.points} pts
                  </span>
                )}
              </div>
              {!lastResult.correct && (
                <p className="text-sm">
                  <span className="font-medium">Correct answer:</span>{' '}
                  {currentItem.options[currentItem.correctIndex]}
                </p>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleProceedToExplain} className="w-full" size="lg">
            Now explain why →
          </Button>
        </div>
      )}

      {/* Explaining phase — generative "why" layer */}
      {phase === 'explaining' && currentItem && (
        <ExplainWhyPrompt
          wasCorrect={lastResult?.correct ?? false}
          correctAnswer={currentItem.options[currentItem.correctIndex]}
          keyConcepts={deriveKeyConcepts(currentItem.explanation, currentItem.keywords, undefined, currentItem.options[currentItem.correctIndex])}
          modelExplanation={currentItem.explanation}
          onComplete={handleExplainComplete}
        />
      )}
    </div>
  );
}
