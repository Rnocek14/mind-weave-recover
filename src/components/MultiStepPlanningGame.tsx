/**
 * Multi-Step Planning Game Component
 * 
 * "Plan [goal] in steps" — speech-based executive sequencing task.
 * 
 * UPGRADED: Capture parity with PhotoNaming:
 * - useUtteranceLogger for persisted utterance analysis records
 * - useAudioRecorder for WAV capture/upload
 * - Discourse-focused: no pronunciation analysis (planning > phoneme precision)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useMultiStepPlanningGame, PlanningTrialResult } from '@/hooks/useMultiStepPlanningGame';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, ListChecks, ChevronRight, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateSpokenResponse } from '@/lib/evaluation/responseValidation';
import { trackValidation, logValidationDetail } from '@/lib/evaluation/validationTelemetry';
import { speakMayaCoaching, resetCoachingState } from '@/lib/evaluation/mayaCoachingResponses';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { AdaptationBadge, useAdaptationShift } from '@/components/AdaptationBadge';
import { AdaptationNarrationCard } from '@/components/AdaptationNarrationCard';
import { TypingFallbackBar, getPreferTyping, setPreferTyping } from '@/components/TypingFallbackBar';
import { Keyboard } from 'lucide-react';

/** Map adaptive level (1-10) → content tier (1-3) */
function levelToTierLocal(level: number): number {
  if (level <= 3) return 1;
  if (level <= 7) return 2;
  return 3;
}

interface MultiStepPlanningGameProps {
  userId?: string;
  sessionId?: string | null;
  onTrialComplete: (result: PlanningTrialResult) => void;
  onGameComplete: (results: PlanningTrialResult[]) => void;
  roundCount?: number;
  tier?: number;
  /** Auto-start mic on first trial (from lesson flow) */
  autoStart?: boolean;
}

type Phase = 'prompt' | 'speaking' | 'scored';

export function MultiStepPlanningGame({
  userId,
  sessionId,
  onTrialComplete, onGameComplete, roundCount = 3, tier = 1,
  autoStart = false,
}: MultiStepPlanningGameProps) {
  const { currentItem, currentIndex, totalItems, isComplete, results, activeTier, setActiveTier, submitPlan, nextItem } =
    useMultiStepPlanningGame(roundCount, tier);

  // Visible adaptation
  const { direction: shiftDirection, reason: shiftReason, signal: signalShift } = useAdaptationShift();
  const engagement = useEngagementMonitor(sessionId ?? null);

  // In-game adaptation: success = goalCoverage ≥ 0.6 + sequenceScore ≥ 0.5
  const adaptation = useInGameAdaptation({
    exerciseSlug: 'multi-step-planning',
    sessionId: sessionId ?? null,
    initialDifficulty: Math.max(1, Math.min(10, tier * 3)),
    bounds: { floor: 1, ceiling: 10, suggestedStart: tier * 3 },
    enableDifficultyToasts: false,
    enableAutoHints: false,
    getCueDependencyScore: () => {
      const sig = engagement.getState().signals;
      return Math.max(
        Math.min(1, sig.hesitationCount / 4),
        Math.min(1, sig.timeoutRate),
      );
    },
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.info('[MultiStep] escalation blocked', {
        reason, cueDependencyScore, trialsAtLevel,
      });
    },
    onDifficultyChange: (newLevel, reason, dir) => {
      const newTier = levelToTierLocal(newLevel);
      if (newTier !== activeTier) {
        setActiveTier(newTier);
      }
      const narration = narrateAdaptation({
        direction: dir,
        reasonKind: classifyReason(reason),
      });
      signalShift(dir, narration || reason);
    },
  });

  const [phase, setPhase] = useState<Phase>('prompt');
  const [lastResult, setLastResult] = useState<PlanningTrialResult | null>(null);
  const [validationCoaching, setValidationCoaching] = useState<string | null>(null);
  const { speak: speakMaya } = useTextToSpeech();
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
    setCollectedTranscript(transcript);
    latestTranscriptRef.current = transcript;
  }, []);

  // Typing fallback (clinical safety)
  const [useTyping, setUseTyping] = useState<boolean>(() => getPreferTyping());
  const handleDoneRef = useRef<(() => void) | null>(null);
  const handleTypedSubmit = useCallback((text: string) => {
    if (hasProcessedRef.current) return;
    setCollectedTranscript(text);
    latestTranscriptRef.current = text;
    setTimeout(() => { if (!hasProcessedRef.current) handleDoneRef.current?.(); }, 0);
  }, []);

  const { isListening, transcript: liveTranscript, fullTranscript, startListening, stopListening, isSupported } =
    useSpeechRecognition({ onResult: handleSpeechResult, patientMode: true, continuousListening: true, discourseMode: true });

  useEffect(() => {
    if (fullTranscript) latestTranscriptRef.current = fullTranscript;
  }, [fullTranscript]);

  // Auto-submit after 3s silence once user has spoken 2+ words
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (phase !== 'speaking') return;
    const transcript = collectedTranscript || latestTranscriptRef.current || '';
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (wordCount >= 2) {
      silenceTimerRef.current = setTimeout(() => {
        if (!hasProcessedRef.current) handleDone();
      }, 3000);
    }
    return () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
  }, [phase, collectedTranscript, fullTranscript]);

  const handleStart = useCallback(() => {
    setPhase('speaking');
    startTimeRef.current = Date.now();

    // Start clinical pipeline
    if (currentItem && userId) {
      startAttempt({
        sessionId: sessionId || 'standalone',
        userId,
        exerciseSlug: 'multi_step_planning',
        trialIndex: currentIndex,
        attemptNumber: 1,
        targetWord: currentItem.goal,
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

    const recordingResult = await stopRecording();

    setTimeout(async () => {
      const transcript = collectedTranscript || latestTranscriptRef.current || '';
      const validation = validateSpokenResponse({ transcript, expectedMode: 'description' });
      trackValidation('multi_step_planning', validation);
      logValidationDetail('multi_step_planning', transcript, validation);
      const durationMs = Date.now() - startTimeRef.current;
      if (!validation.valid && validation.rejectionReason) {
        speakMayaCoaching(validation.rejectionReason, speakMaya, { exerciseKey: 'multi_step_planning' }).then(line => setValidationCoaching(line));
      } else {
        setValidationCoaching(null);
        resetCoachingState('multi_step_planning', speakMaya);
      }
      const result = submitPlan(validation.valid ? transcript : '', durationMs);

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

      if (result) {
        setLastResult(result);
        setPhase('scored');
        onTrialComplete(result);
        // Feed adaptive engine: success = covering steps AND in correct order
        const success = result.goalCoverage >= 0.6 && result.sequenceScore >= 0.5;
        adaptation.recordTrial({
          correct: success,
          reactionTimeMs: durationMs,
        });
        engagement.recordTrial({
          correct: success,
          reactionTimeMs: durationMs,
          cueLevel: 0,
          timeout: !collectedTranscript.trim(),
          timestamp: Date.now(),
        });
      }
    }, 150);
  }, [stopListening, stopRecording, collectedTranscript, submitPlan, onTrialComplete, uploadRecording, userId, sessionId, currentIndex, currentAttemptId, logFinalAnalysis, resetAttempt, adaptation, engagement, speakMaya]);

  // Bridge handleDone for typing-fallback path
  useEffect(() => { handleDoneRef.current = handleDone; }, [handleDone]);

  const handleSkip = useCallback(async () => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    stopListening();
    await stopRecording();

    const durationMs = Date.now() - startTimeRef.current;
    const result = submitPlan('', durationMs);

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
  }, [stopListening, stopRecording, submitPlan, onTrialComplete, currentAttemptId, logFinalAnalysis, resetAttempt]);

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
    <div className="max-w-lg mx-auto space-y-2 sm:space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <span className="font-medium">Step-by-Step Planning</span>
        </div>
        <span className="text-muted-foreground">{currentIndex + 1} of {totalItems}</span>
      </div>
      <Progress value={(currentIndex / totalItems) * 100} className="h-1.5" />

      {shiftDirection && (
        <div className="space-y-2">
          <div className="flex justify-center">
            <AdaptationBadge direction={shiftDirection} reason={shiftReason} />
          </div>
          <AdaptationNarrationCard direction={shiftDirection} message={shiftReason} />
        </div>
      )}

      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="pt-6 text-center space-y-3">
          <span className="text-4xl">{currentItem.emoji}</span>
          <p className="text-sm text-muted-foreground">Plan the steps to:</p>
          <h3 className="text-xl font-bold text-primary">{currentItem.goal}</h3>
          <p className="text-sm text-muted-foreground">Describe the steps in order.</p>
        </CardContent>
      </Card>

      {phase === 'prompt' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {isSupported && !useTyping ? (
              <Button onClick={handleStart} className="flex-1" size="lg">
                <Mic className="h-4 w-4 mr-2" /> Start planning
              </Button>
            ) : (
              <Button onClick={() => setPhase('speaking')} className="flex-1" size="lg" variant="secondary">
                <Keyboard className="h-4 w-4 mr-2" /> Type your plan
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSkip}><SkipForward className="h-4 w-4" /></Button>
          </div>
          {isSupported && (
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0"
              onClick={() => { const next = !useTyping; setUseTyping(next); setPreferTyping(next); }}
            >
              {useTyping ? 'Switch to speech' : 'Type instead'}
            </Button>
          )}
        </div>
      )}

      {phase === 'speaking' && (
        <Card className="border-2 border-primary/50">
          <CardContent className="pt-4 space-y-3">
            {!useTyping && (
              <>
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
                  <span className="text-xs text-muted-foreground ml-auto">Auto-submits when you pause</span>
                </div>
                {(fullTranscript || collectedTranscript) && (
                  <div className="bg-muted/50 rounded-lg p-3 max-h-[8rem] overflow-y-auto"><p className="text-sm italic">"{collectedTranscript || fullTranscript}"</p></div>
                )}
              </>
            )}
            <TypingFallbackBar
              visible={useTyping}
              onSubmit={handleTypedSubmit}
              placeholder="Type the steps in your plan…"
              buttonLabel="Submit"
            />
            <div className="flex gap-2">
              {!useTyping && (
                <Button onClick={handleDone} className="flex-1" variant="secondary"><MicOff className="h-4 w-4 mr-2" /> I'm done</Button>
              )}
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
              {validationCoaching && !lastResult.transcript && (
                <p className="text-sm text-muted-foreground italic">💡 {validationCoaching}</p>
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
