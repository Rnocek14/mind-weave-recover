/**
 * Detective Mind Game Component
 * 
 * Interactive mystery game UI with story cards, question options,
 * detective-themed feedback, and generative "explain why" layer.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDetectiveMindGame, DetectiveTrialResult, DetectiveRank } from '@/hooks/useDetectiveMindGame';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Search, CheckCircle, XCircle, Lightbulb, Star, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExplainWhyPrompt, ExplainWhyResult } from '@/components/ExplainWhyPrompt';
import { deriveKeyConcepts } from '@/lib/explanationScorer';

interface DetectiveMindGameProps {
  onTrialComplete: (result: DetectiveTrialResult) => void;
  onGameComplete: (results: DetectiveTrialResult[]) => void;
  roundCount?: number;
  difficultyLevel?: number;
  /** Profile-recommended cue type — adapts hint behavior */
  recommendedCueType?: 'semantic' | 'phonemic' | 'full_word' | 'none';
}

const RANK_ICONS: Record<DetectiveRank, React.ReactNode> = {
  'Rookie': <Search className="h-5 w-5" />,
  'Junior Detective': <Search className="h-5 w-5" />,
  'Investigator': <Shield className="h-5 w-5" />,
  'Senior Detective': <Star className="h-5 w-5" />,
  'Chief Detective': <Star className="h-5 w-5 text-yellow-500" />,
};

type Phase = 'reading' | 'answering' | 'feedback' | 'explaining';

export function DetectiveMindGame({ 
  onTrialComplete, 
  onGameComplete, 
  roundCount = 10,
  difficultyLevel = 1,
  recommendedCueType,
}: DetectiveMindGameProps) {
  const {
    currentCase,
    currentIndex,
    totalCases,
    isComplete,
    results,
    totalPoints,
    rank,
    submitAnswer,
    nextCase,
  } = useDetectiveMindGame(roundCount, difficultyLevel);

  const [phase, setPhase] = useState<Phase>('reading');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<DetectiveTrialResult | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [reasoningPoints, setReasoningPoints] = useState(0);
  const trialStartRef = useRef(Date.now());

  // Reset state when case changes
  useEffect(() => {
    setPhase('reading');
    setSelectedOption(null);
    setLastResult(null);
    setUsedHint(false);
    setShowHint(false);
    trialStartRef.current = Date.now();
  }, [currentIndex]);

  // Check completion (fire once)
  const completedRef = useRef(false);
  useEffect(() => {
    if (isComplete && results.length > 0 && !completedRef.current) {
      completedRef.current = true;
      onGameComplete(results);
    }
  }, [isComplete, results, onGameComplete]);

  const handleReadyToAnswer = useCallback(() => {
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
    nextCase();
  }, [nextCase, lastResult, onTrialComplete]);


  if (!currentCase || isComplete) {
    // Summary screen
    const correctCount = results.filter(r => r.correct).length;
    return (
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <div className="text-6xl">🕵️</div>
        <h2 className="text-2xl font-bold">Investigation Complete!</h2>
        <div className="flex items-center justify-center gap-2 text-lg">
          {RANK_ICONS[rank]}
          <span className="font-semibold">{rank}</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{correctCount}/{results.length}</div>
              <div className="text-xs text-muted-foreground">Cases Solved</div>
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
              <div className="text-2xl font-bold">{Math.round((correctCount / results.length) * 100)}%</div>
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

  const progressPercent = (currentIndex / totalCases) * 100;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {RANK_ICONS[rank]}
          <span className="font-medium">{rank}</span>
        </div>
        <div className="text-muted-foreground">
          Case {currentIndex + 1} of {totalCases}
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

      {/* Case title */}
      <div className="flex items-center gap-2 py-2">
        <Search className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">📂 {currentCase.title}</h2>
      </div>

      {/* Story card */}
      <Card className="border-2 border-border/50">
        <CardContent className="pt-6 space-y-3">
          {currentCase.story.map((sentence, i) => (
            <p key={i} className={cn(
              "text-base leading-relaxed",
              showHint && i === 0 && "bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded font-medium"
            )}>
              {sentence}
            </p>
          ))}
        </CardContent>
      </Card>

      {/* Phase: Reading → ready to answer */}
      {phase === 'reading' && (
        <Button onClick={handleReadyToAnswer} className="w-full" size="lg">
          I've read the story — show me the question
        </Button>
      )}

      {/* Phase: Answering */}
      {phase === 'answering' && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">{currentCase.question}</h3>
          
          <div className="space-y-2">
            {currentCase.options.map((option, i) => (
              <Button
                key={i}
                variant="outline"
                className="w-full text-left justify-start h-auto py-3 px-4 whitespace-normal"
                onClick={() => handleSelectOption(i)}
              >
                <span className="mr-3 font-bold text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                {option}
              </Button>
            ))}
          </div>

          {!usedHint && (
            <Button variant="ghost" size="sm" onClick={handleHint} className="w-full text-muted-foreground">
              <Lightbulb className="h-4 w-4 mr-2" />
              Show a hint (−5 bonus points)
            </Button>
          )}
        </div>
      )}

      {/* Phase: Feedback — now transitions to explaining */}
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
                  : <XCircle className="h-5 w-5 text-red-600" />
                }
                <span className="font-bold">
                  {lastResult.correct ? '🎯 Case Solved!' : '❌ Not quite...'}
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
                  {currentCase.options[currentCase.correctIndex]}
                </p>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleProceedToExplain} className="w-full" size="lg">
            Now explain why →
          </Button>
        </div>
      )}

      {/* Phase: Explaining — generative "why" layer */}
      {phase === 'explaining' && currentCase && (
        <ExplainWhyPrompt
          wasCorrect={lastResult?.correct ?? false}
          correctAnswer={currentCase.options[currentCase.correctIndex]}
          keyConcepts={deriveKeyConcepts(currentCase.explanation, undefined, undefined, currentCase.options[currentCase.correctIndex])}
          modelExplanation={currentCase.explanation}
          onComplete={handleExplainComplete}
          promptOverride={
            lastResult?.correct 
              ? "What clues in the story told you that? Explain your reasoning."
              : `Why is "${currentCase.options[currentCase.correctIndex]}" the right answer? What clues support it?`
          }
        />
      )}
    </div>
  );
}
