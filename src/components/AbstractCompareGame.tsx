/**
 * Abstract Comparison Game Component
 * 
 * "How are X and Y similar?" — speech-based semantic depth task.
 * 
 * UPGRADED: Capture parity with PhotoNaming:
 * - useUtteranceLogger for persisted utterance analysis records
 * - useAudioRecorder for WAV capture/upload
 * - Discourse-focused: no pronunciation analysis (semantic depth > phoneme precision)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAbstractCompareGame, AbstractCompareTrialResult } from '@/hooks/useAbstractCompareGame';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { classifySpeechState } from '@/lib/speechStateClassifier';
import { SpeechNudge } from '@/components/SpeechNudge';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, Layers, ChevronRight, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AbstractCompareGameProps {
  userId?: string;
  sessionId?: string | null;
  onTrialComplete: (result: AbstractCompareTrialResult) => void;
  onGameComplete: (results: AbstractCompareTrialResult[]) => void;
  roundCount?: number;
  tier?: number;
  /** Auto-start mic on first trial (from lesson flow) */
  autoStart?: boolean;
}

type Phase = 'prompt' | 'speaking' | 'scored';

export function AbstractCompareGame({
  userId,
  sessionId,
  onTrialComplete, onGameComplete, roundCount = 4, tier = 1,
  autoStart = false,
}: AbstractCompareGameProps) {
  const { currentItem, currentIndex, totalItems, isComplete, results, submitAnswer, nextItem } =
    useAbstractCompareGame(roundCount, tier);

  const [phase, setPhase] = useState<Phase>('prompt');
  const [lastResult, setLastResult] = useState<AbstractCompareTrialResult | null>(null);
  const [collectedTranscript, setCollectedTranscript] = useState('');
  const startTimeRef = useRef(Date.now());
  const latestTranscriptRef = useRef('');
  const hasProcessedRef = useRef(false);

  // Clinical pipeline hooks
  const {
    startAttempt,
    logFinalAnalysis,
    resetAttempt,
    currentAttemptId,
  } = useUtteranceLogger();

  const {
    startRecording,
    stopRecording,
    uploadRecording,
  } = useAudioRecorder();

  const autoStartedRef = useRef(false);

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
    // In discourse mode, transcript is already accumulated
    setCollectedTranscript(transcript);
    latestTranscriptRef.current = transcript;
  }, []);

  const { isListening, transcript: liveTranscript, fullTranscript, startListening, stopListening, isSupported } =
    useSpeechRecognition({ onResult: handleSpeechResult, patientMode: true, continuousListening: true, discourseMode: true });

  useEffect(() => {
    if (fullTranscript) latestTranscriptRef.current = fullTranscript;
  }, [fullTranscript]);

  // Adaptive silence-based auto-submit using speech state classifier
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptTimeRef = useRef<number>(Date.now());
  const speakingStartRef = useRef<number>(Date.now());
  const [nudgeHint, setNudgeHint] = useState<string | null>(null);

  // Track when transcript changes (proxy for "user is speaking")
  useEffect(() => {
    const transcript = collectedTranscript || latestTranscriptRef.current || '';
    if (transcript.trim()) lastTranscriptTimeRef.current = Date.now();
  }, [collectedTranscript, fullTranscript]);

  // Reset speaking start when phase enters speaking
  useEffect(() => {
    if (phase === 'speaking') {
      speakingStartRef.current = Date.now();
      lastTranscriptTimeRef.current = Date.now();
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'speaking') return;

    const interval = setInterval(() => {
      if (hasProcessedRef.current) return;
      const transcript = collectedTranscript || latestTranscriptRef.current || '';
      const silenceMs = Date.now() - lastTranscriptTimeRef.current;
      const elapsedMs = Date.now() - speakingStartRef.current;
      const promptText = currentItem ? `${currentItem.wordA} and ${currentItem.wordB}` : undefined;

      const state = classifySpeechState({
        transcript,
        elapsedMs,
        silenceDurationMs: silenceMs,
        promptText,
      });

      setNudgeHint(state.nudgeHint);

      if (state.suppressAutoSubmit) return;

      // Adaptive threshold: base 1500ms for discourse, scaled by patience
      const threshold = Math.round(1500 * state.patienceMultiplier);
      const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

      if (wordCount >= 2 && silenceMs >= threshold) {
        if (!hasProcessedRef.current) handleDone();
      }
    }, 200);

    return () => clearInterval(interval);
  }, [phase, collectedTranscript, fullTranscript, currentItem]);

  const handleStart = useCallback(() => {
    setPhase('speaking');
    startTimeRef.current = Date.now();
    
    // Start clinical pipeline
    if (currentItem && userId) {
      startAttempt({
        sessionId: sessionId || 'standalone',
        userId,
        exerciseSlug: 'abstract_compare',
        trialIndex: currentIndex,
        attemptNumber: 1,
        targetWord: `${currentItem.wordA} & ${currentItem.wordB}`,
        category: 'discourse',
      });
    }
    
    startRecording();
    startListening();
  }, [startListening, startRecording, startAttempt, currentItem, currentIndex, userId, sessionId]);

  // Auto-start first trial when launched from lesson
  useEffect(() => {
    if (autoStart && !autoStartedRef.current && phase === 'prompt' && currentItem && isSupported) {
      autoStartedRef.current = true;
      setTimeout(() => handleStart(), 400);
    }
  }, [autoStart, phase, currentItem, isSupported, handleStart]);

  const handleDone = useCallback(async () => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    stopListening();
    
    // Stop recording and capture audio
    const recordingResult = await stopRecording();
    
    setTimeout(async () => {
      const transcript = collectedTranscript || latestTranscriptRef.current || '';
      const durationMs = Date.now() - startTimeRef.current;
      const result = submitAnswer(transcript, durationMs);
      
      // Upload audio + log utterance
      let audioStoragePath: string | null = null;
      if (recordingResult?.audioBlob && userId && sessionId) {
        audioStoragePath = await uploadRecording(
          recordingResult.audioBlob,
          userId,
          sessionId,
          currentIndex,
          recordingResult.mimeType
        );
      }
      
      if (currentAttemptId) {
        await logFinalAnalysis({
          transcript: transcript || undefined,
          transcriptSource: 'browser',
          evaluationModel: 'flow',
          isCorrect: null, // Discourse task - no binary correctness
          didSpeak: transcript.trim().length > 0,
          utteranceComplete: transcript.trim().length > 0,
          recordingDurationMs: durationMs,
          audioStoragePath: audioStoragePath || undefined,
          fluencyAvailable: false,
          fluencyUnavailableReason: 'discourse_task',
        });
        resetAttempt();
      }
      
      if (result) { setLastResult(result); setPhase('scored'); onTrialComplete(result); }
    }, 150);
  }, [stopListening, stopRecording, collectedTranscript, submitAnswer, onTrialComplete, uploadRecording, userId, sessionId, currentIndex, currentAttemptId, logFinalAnalysis, resetAttempt]);

  const handleSkip = useCallback(async () => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    stopListening();
    await stopRecording();
    
    const durationMs = Date.now() - startTimeRef.current;
    const result = submitAnswer('', durationMs);
    
    // Log skip
    if (currentAttemptId) {
      await logFinalAnalysis({
        transcript: '',
        transcriptSource: 'browser',
        evaluationModel: 'flow',
        isCorrect: null,
        didSpeak: false,
        fluencyAvailable: false,
        fluencyUnavailableReason: 'no_recording',
      });
      resetAttempt();
    }
    
    if (result) { setLastResult(result); setPhase('scored'); onTrialComplete(result); }
  }, [stopListening, stopRecording, submitAnswer, onTrialComplete, currentAttemptId, logFinalAnalysis, resetAttempt]);

  if (!currentItem || isComplete) {
    const avgCoverage = results.length > 0 ? results.reduce((s, r) => s + r.coverageRatio, 0) / results.length : 0;
    return (
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <div className="text-6xl">🔗</div>
        <h2 className="text-2xl font-bold">Comparisons Complete!</h2>
        <Card><CardContent className="pt-4 text-center">
          <div className="text-2xl font-bold">{Math.round(avgCoverage * 100)}%</div>
          <div className="text-xs text-muted-foreground">Avg Concept Coverage</div>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-2 sm:space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="font-medium">Abstract Comparison</span>
        </div>
        <span className="text-muted-foreground">{currentIndex + 1} of {totalItems}</span>
      </div>
      <Progress value={(currentIndex / totalItems) * 100} className="h-2" />

      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="pt-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">How are these two things similar?</p>
          <div className="flex items-center justify-center gap-4 py-4">
            <span className="text-2xl font-bold text-primary">{currentItem.wordA}</span>
            <span className="text-muted-foreground text-lg">&</span>
            <span className="text-2xl font-bold text-primary">{currentItem.wordB}</span>
          </div>
        </CardContent>
      </Card>

      {phase === 'prompt' && (
        <div className="flex gap-2">
          {isSupported ? (
            <Button onClick={handleStart} className="flex-1" size="lg">
              <Mic className="h-4 w-4 mr-2" /> Explain similarities
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
              <span className="font-semibold text-sm">Listening...</span>
              <span className="text-xs text-muted-foreground ml-auto">Auto-submits when you pause</span>
            </div>
            {(fullTranscript || collectedTranscript) && (
              <div className="bg-muted/50 rounded-lg p-3 max-h-[8rem] overflow-y-auto"><p className="text-sm italic">"{collectedTranscript || fullTranscript}"</p></div>
            )}
            <SpeechNudge nudgeHint={nudgeHint} isSpeaking={isListening && !!(liveTranscript || fullTranscript)} />
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
            lastResult.coverageRatio >= 0.6 ? "border-green-500 bg-green-50 dark:bg-green-950/20" :
            lastResult.coverageRatio >= 0.3 ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" :
            "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
          )}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{lastResult.coverageRatio >= 0.6 ? '🧠' : lastResult.coverageRatio >= 0.3 ? '👍' : '💡'}</span>
                <span className="font-bold text-sm">
                  {lastResult.coverageRatio >= 0.6 ? 'Excellent thinking!' : lastResult.coverageRatio >= 0.3 ? 'Good connections!' : 'Keep exploring!'}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{lastResult.conceptCount}/{lastResult.conceptsTotal} shared properties</span>
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
            {currentIndex + 1 < totalItems ? 'Next Pair' : 'Finish'} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
