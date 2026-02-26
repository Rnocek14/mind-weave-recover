/**
 * Narrative Retell Game Component
 * 
 * Shows story scenes → user retells via speech → scores discourse organization.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNarrativeRetellGame, NarrativeTrialResult } from '@/hooks/useNarrativeRetellGame';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, BookOpen, ChevronRight, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NarrativeRetellGameProps {
  onTrialComplete: (result: NarrativeTrialResult) => void;
  onGameComplete: (results: NarrativeTrialResult[]) => void;
  roundCount?: number;
  tier?: number;
}

type Phase = 'reading' | 'retelling' | 'scored';

export function NarrativeRetellGame({
  onTrialComplete,
  onGameComplete,
  roundCount = 3,
  tier = 1,
}: NarrativeRetellGameProps) {
  const { currentStory, currentIndex, totalStories, isComplete, results, submitRetell, nextStory } =
    useNarrativeRetellGame(roundCount, tier);

  const [phase, setPhase] = useState<Phase>('reading');
  const [sceneIndex, setSceneIndex] = useState(0);
  const [lastResult, setLastResult] = useState<NarrativeTrialResult | null>(null);
  const [collectedTranscript, setCollectedTranscript] = useState('');
  const startTimeRef = useRef(Date.now());
  const latestTranscriptRef = useRef('');
  const hasProcessedRef = useRef(false);

  // Reset on story change
  useEffect(() => {
    setPhase('reading');
    setSceneIndex(0);
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

  const handleNextScene = useCallback(() => {
    if (!currentStory) return;
    if (sceneIndex < currentStory.scenes.length - 1) {
      setSceneIndex(prev => prev + 1);
    }
  }, [sceneIndex, currentStory]);

  const handleStartRetelling = useCallback(() => {
    setPhase('retelling');
    startTimeRef.current = Date.now();
    startListening();
  }, [startListening]);

  const handleDoneRetelling = useCallback(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    stopListening();

    setTimeout(() => {
      const transcript = collectedTranscript || latestTranscriptRef.current || '';
      const durationMs = Date.now() - startTimeRef.current;
      const result = submitRetell(transcript, durationMs);
      if (result) {
        setLastResult(result);
        setPhase('scored');
        onTrialComplete(result);
      }
    }, 150);
  }, [stopListening, collectedTranscript, submitRetell, onTrialComplete]);

  const handleSkip = useCallback(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    stopListening();
    const durationMs = Date.now() - startTimeRef.current;
    const result = submitRetell('', durationMs);
    if (result) {
      setLastResult(result);
      setPhase('scored');
      onTrialComplete(result);
    }
  }, [stopListening, submitRetell, onTrialComplete]);

  const handleContinue = useCallback(() => {
    nextStory();
  }, [nextStory]);

  if (!currentStory || isComplete) {
    const avgCoverage = results.length > 0
      ? results.reduce((sum, r) => sum + r.eventCoverage, 0) / results.length
      : 0;
    return (
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <div className="text-6xl">📖</div>
        <h2 className="text-2xl font-bold">Stories Complete!</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{results.length}</div>
              <div className="text-xs text-muted-foreground">Stories Retold</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{Math.round(avgCoverage * 100)}%</div>
              <div className="text-xs text-muted-foreground">Avg Coverage</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const allScenesRead = sceneIndex >= currentStory.scenes.length - 1;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="font-medium">Narrative Retell</span>
        </div>
        <div className="text-muted-foreground">
          Story {currentIndex + 1} of {totalStories}
        </div>
      </div>

      <Progress value={((currentIndex) / totalStories) * 100} className="h-2" />

      <h2 className="text-lg font-bold flex items-center gap-2">
        📂 {currentStory.title}
      </h2>

      {/* Reading phase */}
      {phase === 'reading' && (
        <div className="space-y-3">
          {currentStory.scenes.slice(0, sceneIndex + 1).map((scene, i) => (
            <Card key={i} className={cn("border transition-all", i === sceneIndex ? "border-primary/50 bg-primary/5" : "border-border/50")}>
              <CardContent className="pt-4 flex items-start gap-3">
                <span className="text-2xl">{scene.emoji}</span>
                <p className="text-base leading-relaxed">{scene.text}</p>
              </CardContent>
            </Card>
          ))}

          {!allScenesRead ? (
            <Button onClick={handleNextScene} className="w-full" size="lg">
              Next scene <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                You've read all scenes. Now retell the story in your own words.
              </p>
              {isSupported ? (
                <Button onClick={handleStartRetelling} className="w-full" size="lg">
                  <Mic className="h-4 w-4 mr-2" />
                  Start retelling
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground text-center italic">
                  Speech not supported in this browser.
                  <Button variant="ghost" size="sm" onClick={handleSkip} className="ml-2">Skip</Button>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Retelling phase */}
      {phase === 'retelling' && (
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
              <span className="font-semibold text-sm">
                Tell the story in your own words...
              </span>
            </div>

            {(liveTranscript || collectedTranscript) && (
              <div className="bg-muted/50 rounded-lg p-3 min-h-[3rem]">
                <p className="text-sm text-foreground italic">
                  "{collectedTranscript || liveTranscript}"
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleDoneRetelling} className="flex-1" variant="secondary">
                <MicOff className="h-4 w-4 mr-2" /> I'm done
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scored phase */}
      {phase === 'scored' && lastResult && (
        <div className="space-y-3">
          <Card className={cn("border-2",
            lastResult.eventCoverage >= 0.6 ? "border-green-500 bg-green-50 dark:bg-green-950/20" :
            lastResult.eventCoverage >= 0.3 ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" :
            "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
          )}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {lastResult.eventCoverage >= 0.6 ? '🧠' : lastResult.eventCoverage >= 0.3 ? '👍' : '💡'}
                </span>
                <span className="font-bold text-sm">
                  {lastResult.eventCoverage >= 0.6 ? 'Great retell!' :
                   lastResult.eventCoverage >= 0.3 ? 'Good effort!' : 'Keep practicing!'}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {lastResult.eventsFound}/{lastResult.eventsTotal} key events
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

          <Button onClick={handleContinue} className="w-full" size="lg">
            {currentIndex + 1 < totalStories ? 'Next Story' : 'Finish'} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
