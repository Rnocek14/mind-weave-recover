/**
 * Dual-Load Naming Game Component
 * 
 * Remember 3 words → name 6 pictures → recall the 3 words.
 * Tests executive load tolerance and interference.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDualLoadNamingGame, DualLoadTrialResult } from '@/hooks/useDualLoadNamingGame';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, Brain, ChevronRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DualLoadNamingGameProps {
  onTrialComplete: (result: DualLoadTrialResult) => void;
  onGameComplete: (results: DualLoadTrialResult[]) => void;
  roundCount?: number;
  tier?: number;
}

export function DualLoadNamingGame({
  onTrialComplete, onGameComplete, roundCount = 2, tier = 1,
}: DualLoadNamingGameProps) {
  const {
    currentSet, currentSetIndex, totalSets, isComplete,
    phase, currentNamingTarget, namingIndex, namingAttempts, results,
    startNaming, submitNaming, submitRecall, nextSet,
  } = useDualLoadNamingGame(roundCount, tier);

  const [recallInputs, setRecallInputs] = useState<string[]>(['', '', '']);
  const [lastResult, setLastResult] = useState<DualLoadTrialResult | null>(null);
  const namingStartRef = useRef(Date.now());

  // Speech recognition for naming
  const handleNamingResult = useCallback((transcript: string) => {
    if (!transcript.trim()) return;
    const reactionTimeMs = Date.now() - namingStartRef.current;
    submitNaming(transcript.trim(), reactionTimeMs);
    namingStartRef.current = Date.now();
  }, [submitNaming]);

  const { isListening, startListening, stopListening, isSupported } =
    useSpeechRecognition({ onResult: handleNamingResult, patientMode: true });

  // Reset on set change
  useEffect(() => {
    setRecallInputs(['', '', '']);
    setLastResult(null);
  }, [currentSetIndex]);

  const completedRef = useRef(false);
  useEffect(() => {
    if (isComplete && results.length > 0 && !completedRef.current) {
      completedRef.current = true;
      onGameComplete(results);
    }
  }, [isComplete, results, onGameComplete]);

  const handleStartNaming = useCallback(() => {
    startNaming();
    namingStartRef.current = Date.now();
    if (isSupported) startListening();
  }, [startNaming, startListening, isSupported]);

  // For naming: if speech doesn't capture, allow manual skip
  const handleSkipNaming = useCallback(() => {
    const reactionTimeMs = Date.now() - namingStartRef.current;
    submitNaming('', reactionTimeMs);
    namingStartRef.current = Date.now();
  }, [submitNaming]);

  // Stop listening when entering recall phase
  useEffect(() => {
    if (phase === 'recall') stopListening();
  }, [phase, stopListening]);

  const handleSubmitRecall = useCallback(() => {
    const result = submitRecall(recallInputs.filter(w => w.trim()));
    if (result) {
      setLastResult(result);
      onTrialComplete(result);
    }
  }, [recallInputs, submitRecall, onTrialComplete]);

  const handleContinue = useCallback(() => {
    nextSet();
  }, [nextSet]);

  if (!currentSet || isComplete) {
    const avgNaming = results.length > 0 ? results.reduce((s, r) => s + r.namingAccuracy, 0) / results.length : 0;
    const avgRecall = results.length > 0 ? results.reduce((s, r) => s + r.recallAccuracy, 0) / results.length : 0;
    return (
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <div className="text-6xl">🧠</div>
        <h2 className="text-2xl font-bold">Dual-Load Complete!</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card><CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{Math.round(avgNaming * 100)}%</div>
            <div className="text-xs text-muted-foreground">Naming Accuracy</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{Math.round(avgRecall * 100)}%</div>
            <div className="text-xs text-muted-foreground">Memory Recall</div>
          </CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="font-medium">Dual-Load Naming</span>
        </div>
        <span className="text-muted-foreground">Set {currentSetIndex + 1} of {totalSets}</span>
      </div>
      <Progress value={(currentSetIndex / totalSets) * 100} className="h-2" />

      {/* Memorize phase */}
      {phase === 'memorize' && (
        <div className="space-y-4">
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardContent className="pt-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground font-medium">Remember these 3 words:</p>
              <div className="flex items-center justify-center gap-6 py-4">
                {currentSet.memoryWords.map((word, i) => (
                  <span key={i} className="text-xl font-bold text-primary bg-primary/10 px-4 py-2 rounded-lg">
                    {word}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">You'll be asked to recall them after naming some pictures.</p>
            </CardContent>
          </Card>
          <Button onClick={handleStartNaming} className="w-full" size="lg">
            I've memorized them — start naming!
          </Button>
        </div>
      )}

      {/* Naming phase */}
      {phase === 'naming' && currentNamingTarget && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Name this picture ({namingIndex + 1} of {currentSet.namingTargets.length})
          </p>
          <Card className="border-2 border-border/50">
            <CardContent className="pt-6 text-center">
              <span className="text-7xl block mb-4">{currentNamingTarget.emoji}</span>
              {isListening && (
                <div className="flex items-center justify-center gap-2 text-sm text-primary">
                  <Mic className="h-4 w-4 animate-pulse" />
                  <span>Listening...</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Show recent attempts */}
          {namingAttempts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {namingAttempts.map((a, i) => (
                <span key={i} className={cn(
                  "text-xs px-2 py-1 rounded-full",
                  a.correct ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}>
                  {a.correct ? <Check className="h-3 w-3 inline mr-1" /> : <X className="h-3 w-3 inline mr-1" />}
                  {a.targetWord}
                </span>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={handleSkipNaming} className="w-full">
            Skip this picture
          </Button>
        </div>
      )}

      {/* Recall phase */}
      {phase === 'recall' && (
        <div className="space-y-4">
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground font-medium text-center">
                Now — what were the 3 words you memorized?
              </p>
              <div className="space-y-2">
                {recallInputs.map((val, i) => (
                  <input
                    key={i}
                    type="text"
                    value={val}
                    onChange={e => {
                      const updated = [...recallInputs];
                      updated[i] = e.target.value;
                      setRecallInputs(updated);
                    }}
                    placeholder={`Word ${i + 1}`}
                    className="w-full rounded-lg border border-border px-3 py-2 text-base bg-background"
                    autoFocus={i === 0}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
          <Button onClick={handleSubmitRecall} className="w-full" size="lg">
            Check my recall
          </Button>
        </div>
      )}

      {/* Results phase */}
      {phase === 'results' && lastResult && (
        <div className="space-y-3">
          <Card className={cn("border-2",
            lastResult.recallAccuracy >= 0.67 ? "border-green-500 bg-green-50 dark:bg-green-950/20" :
            lastResult.recallAccuracy >= 0.33 ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" :
            "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
          )}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{lastResult.recallAccuracy >= 0.67 ? '🧠' : '💡'}</span>
                <span className="font-bold text-sm">
                  {lastResult.recallAccuracy >= 0.67 ? 'Great memory!' : 'Good effort!'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Naming:</span>
                  <span className="font-semibold ml-2">{Math.round(lastResult.namingAccuracy * 100)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Recall:</span>
                  <span className="font-semibold ml-2">{lastResult.recalledWords.length}/3 words</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Words remembered: {lastResult.recalledWords.length > 0 ? lastResult.recalledWords.join(', ') : 'none'}
              </div>
            </CardContent>
          </Card>
          <Button onClick={handleContinue} className="w-full" size="lg">
            {currentSetIndex + 1 < totalSets ? 'Next Set' : 'Finish'} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
