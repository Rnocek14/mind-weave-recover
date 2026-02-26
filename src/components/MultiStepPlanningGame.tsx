/**
 * Multi-Step Planning Game Component
 * 
 * "Plan [goal] in steps" — speech-based executive sequencing task.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useMultiStepPlanningGame, PlanningTrialResult } from '@/hooks/useMultiStepPlanningGame';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, ListChecks, ChevronRight, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiStepPlanningGameProps {
  onTrialComplete: (result: PlanningTrialResult) => void;
  onGameComplete: (results: PlanningTrialResult[]) => void;
  roundCount?: number;
  tier?: number;
}

type Phase = 'prompt' | 'speaking' | 'scored';

export function MultiStepPlanningGame({
  onTrialComplete, onGameComplete, roundCount = 3, tier = 1,
}: MultiStepPlanningGameProps) {
  const { currentItem, currentIndex, totalItems, isComplete, results, submitPlan, nextItem } =
    useMultiStepPlanningGame(roundCount, tier);

  const [phase, setPhase] = useState<Phase>('prompt');
  const [lastResult, setLastResult] = useState<PlanningTrialResult | null>(null);
  const [collectedTranscript, setCollectedTranscript] = useState('');
  const startTimeRef = useRef(Date.now());
  const latestTranscriptRef = useRef('');
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    setPhase('prompt');
    setLastResult(null);
    setCollectedTranscript('');
    hasProcessedRef.current = false;
    latestTranscriptRef.current = '';
  }, [currentIndex]);

  const completedRef = useRef(false);
  useEffect(() => {
    if (isComplete && results.length > 0 && !completedRef.current) {
      completedRef.current = true;
      onGameComplete(results);
    }
  }, [isComplete, results, onGameComplete]);

  const handleSpeechResult = useCallback((transcript: string) => {
    if (hasProcessedRef.current || !transcript.trim()) return;
    setCollectedTranscript(transcript);
    latestTranscriptRef.current = transcript;
  }, []);

  const { isListening, transcript: liveTranscript, startListening, stopListening, isSupported } =
    useSpeechRecognition({ onResult: handleSpeechResult, patientMode: true, continuousListening: true });

  useEffect(() => {
    if (liveTranscript) latestTranscriptRef.current = liveTranscript;
  }, [liveTranscript]);

  const handleStart = useCallback(() => {
    setPhase('speaking');
    startTimeRef.current = Date.now();
    startListening();
  }, [startListening]);

  const handleDone = useCallback(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    stopListening();
    setTimeout(() => {
      const transcript = collectedTranscript || latestTranscriptRef.current || '';
      const durationMs = Date.now() - startTimeRef.current;
      const result = submitPlan(transcript, durationMs);
      if (result) { setLastResult(result); setPhase('scored'); onTrialComplete(result); }
    }, 150);
  }, [stopListening, collectedTranscript, submitPlan, onTrialComplete]);

  const handleSkip = useCallback(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    stopListening();
    const durationMs = Date.now() - startTimeRef.current;
    const result = submitPlan('', durationMs);
    if (result) { setLastResult(result); setPhase('scored'); onTrialComplete(result); }
  }, [stopListening, submitPlan, onTrialComplete]);

  if (!currentItem || isComplete) {
    const avgCov = results.length > 0 ? results.reduce((s, r) => s + r.goalCoverage, 0) / results.length : 0;
    const avgSeq = results.length > 0 ? results.reduce((s, r) => s + r.sequenceScore, 0) / results.length : 0;
    return (
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <div className="text-6xl">📋</div>
        <h2 className="text-2xl font-bold">Planning Complete!</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card><CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{Math.round(avgCov * 100)}%</div>
            <div className="text-xs text-muted-foreground">Step Coverage</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{Math.round(avgSeq * 100)}%</div>
            <div className="text-xs text-muted-foreground">Sequence Order</div>
          </CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <span className="font-medium">Step-by-Step Planning</span>
        </div>
        <span className="text-muted-foreground">{currentIndex + 1} of {totalItems}</span>
      </div>
      <Progress value={(currentIndex / totalItems) * 100} className="h-2" />

      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="pt-6 text-center space-y-3">
          <span className="text-4xl">{currentItem.emoji}</span>
          <p className="text-sm text-muted-foreground">Plan the steps to:</p>
          <h3 className="text-xl font-bold text-primary">{currentItem.goal}</h3>
          <p className="text-sm text-muted-foreground">Describe the steps in order.</p>
        </CardContent>
      </Card>

      {phase === 'prompt' && (
        <div className="flex gap-2">
          {isSupported ? (
            <Button onClick={handleStart} className="flex-1" size="lg">
              <Mic className="h-4 w-4 mr-2" /> Start planning
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Speech not supported.
              <Button variant="ghost" size="sm" onClick={handleSkip} className="ml-2">Skip</Button>
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={handleSkip}><SkipForward className="h-4 w-4" /></Button>
        </div>
      )}

      {phase === 'speaking' && (
        <Card className="border-2 border-primary/50">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Mic className="h-5 w-5 text-primary" />
                {isListening && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                  </span>
                )}
              </div>
              <span className="font-semibold text-sm">Tell me the steps...</span>
            </div>
            {(liveTranscript || collectedTranscript) && (
              <div className="bg-muted/50 rounded-lg p-3"><p className="text-sm italic">"{collectedTranscript || liveTranscript}"</p></div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleDone} className="flex-1" variant="secondary"><MicOff className="h-4 w-4 mr-2" /> I'm done</Button>
              <Button variant="ghost" size="sm" onClick={handleSkip}><SkipForward className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {phase === 'scored' && lastResult && (
        <div className="space-y-3">
          <Card className={cn("border-2",
            lastResult.goalCoverage >= 0.6 ? "border-green-500 bg-green-50 dark:bg-green-950/20" :
            lastResult.goalCoverage >= 0.3 ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" :
            "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
          )}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{lastResult.goalCoverage >= 0.6 ? '🧠' : lastResult.goalCoverage >= 0.3 ? '👍' : '💡'}</span>
                <span className="font-bold text-sm">
                  {lastResult.goalCoverage >= 0.6 ? 'Great plan!' : lastResult.goalCoverage >= 0.3 ? 'Good thinking!' : 'Keep practicing!'}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {lastResult.stepsFound}/{lastResult.stepsTotal} steps • {Math.round(lastResult.sequenceScore * 100)}% order
                </span>
              </div>
              {lastResult.transcript && (
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground mb-1">You said:</p>
                  <p className="text-sm italic">"{lastResult.transcript}"</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Button onClick={() => nextItem()} className="w-full" size="lg">
            {currentIndex + 1 < totalItems ? 'Next Goal' : 'Finish'} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
