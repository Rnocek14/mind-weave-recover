/**
 * Dual-Load Naming Game Component
 * 
 * Remember 3 words → name 6 pictures → recall the 3 words.
 * Tests executive load tolerance and interference.
 * 
 * UPGRADED: Full clinical pipeline parity with PhotoNaming:
 * - useUtteranceLogger for persisted utterance analysis records
 * - useAudioRecorder for WAV capture/upload
 * - usePronunciationAnalysis for Azure phoneme-level scoring (naming phase)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDualLoadNamingGame, DualLoadTrialResult } from '@/hooks/useDualLoadNamingGame';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { usePronunciationAnalysis } from '@/hooks/usePronunciationAnalysis';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { AdaptationBadge, useAdaptationShift } from '@/components/AdaptationBadge';
import { LevelBadge } from '@/components/exercise/LevelBadge';
import { AdaptationNarrationCard } from '@/components/AdaptationNarrationCard';
import { Button } from '@/components/ui/button';
import { RoundDoneAutoAdvance } from '@/components/RoundDoneAutoAdvance';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, Brain, ChevronRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Map adaptive level (1-10) → content tier (1-3) */
function levelToTierLocal(level: number): number {
  if (level <= 3) return 1;
  if (level <= 7) return 2;
  return 3;
}

interface DualLoadNamingGameProps {
  userId?: string;
  sessionId?: string | null;
  onTrialComplete: (result: DualLoadTrialResult) => void;
  onGameComplete: (results: DualLoadTrialResult[]) => void;
  roundCount?: number;
  tier?: number;
  focusPhonemes?: string[];
}

export function DualLoadNamingGame({
  userId,
  sessionId,
  onTrialComplete, onGameComplete, roundCount = 2, tier = 1,
  focusPhonemes = [],
}: DualLoadNamingGameProps) {
  const {
    currentSet, currentSetIndex, totalSets, isComplete,
    phase, currentNamingTarget, namingIndex, namingAttempts, results,
    startNaming, submitNaming, submitRecall, nextSet,
    activeTier, setActiveTier,
  } = useDualLoadNamingGame(roundCount, tier, focusPhonemes);

  // Visible adaptation cue
  const { direction: shiftDirection, reason: shiftReason, signal: signalShift } = useAdaptationShift();

  // Engagement monitor — feeds the cue-dependency safety gate.
  const engagement = useEngagementMonitor(sessionId ?? null);

  // In-game adaptation: drives mid-session content tier shifts based on combined
  // naming + recall performance.
  const adaptation = useInGameAdaptation({
    exerciseSlug: 'dual-load-naming',
    sessionId: sessionId ?? null,
    initialDifficulty: Math.max(1, Math.min(10, tier * 3)),
    bounds: { floor: 1, ceiling: 10, suggestedStart: tier * 3 },
    enableDifficultyToasts: false,
    enableAutoHints: false,
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.info('[DualLoad] escalation blocked', {
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

  const [recallInputs, setRecallInputs] = useState<string[]>(['', '', '']);
  const [lastResult, setLastResult] = useState<DualLoadTrialResult | null>(null);
  const namingStartRef = useRef(Date.now());
  const namingTrialIndexRef = useRef(0);

  // Clinical pipeline hooks
  const {
    startAttempt,
    logFinalAnalysis,
    resetAttempt,
    currentAttemptId,
  } = useUtteranceLogger();

  const {
    isRecording,
    startRecording,
    stopRecording,
    uploadRecording,
  } = useAudioRecorder();

  const { analyzePronunciation } = usePronunciationAnalysis();

  // Capture the target word at speech start to avoid stale closure issues
  const activeTargetWordRef = useRef<string>('');

  // Speech recognition for naming
  const handleNamingResult = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    const reactionTimeMs = Date.now() - namingStartRef.current;
    
    // Capture the target word NOW (before any state changes)
    const targetWord = activeTargetWordRef.current;
    
    // Stop recording and capture audio
    const recordingResult = await stopRecording();
    
    // Submit naming result (this advances internal state to next target)
    submitNaming(transcript.trim(), reactionTimeMs);
    
    // Upload audio + run pronunciation analysis for clinical data
    let audioStoragePath: string | null = null;
    if (recordingResult?.audioBlob && userId && sessionId) {
      // Upload audio
      audioStoragePath = await uploadRecording(
        recordingResult.audioBlob,
        userId,
        sessionId,
        namingTrialIndexRef.current,
        recordingResult.mimeType
      );
      
      // Run pronunciation analysis (naming tasks = high value for phoneme analysis)
      if (targetWord) {
        const pronResult = await analyzePronunciation(recordingResult.audioBlob, targetWord);
        
        if (currentAttemptId) {
          if (pronResult.ok) {
            await logFinalAnalysis({
              transcript: transcript.trim(),
              transcriptSource: 'browser',
              isCorrect: transcript.trim().toLowerCase() === targetWord.toLowerCase(),
              recordingDurationMs: recordingResult.duration,
              audioStoragePath: audioStoragePath || undefined,
              pronunciationScore: pronResult.data.pronunciationScore,
              accuracyScore: pronResult.data.accuracyScore,
              fluencyScore: pronResult.data.fluencyScore,
              completenessScore: pronResult.data.completenessScore,
              prosodyScore: pronResult.data.prosodyScore,
              gopData: pronResult.data.words,
              alignmentData: pronResult.data.alignmentData,
              fluencyAvailable: true,
              pronunciationDiagnostics: {
                pronRequestId: pronResult.pronRequestId,
                pronunciationStatus: 'complete',
                pronunciationTimingsMs: pronResult.timingsMs,
                audioMeta: pronResult.audioMeta,
              },
            });
          } else {
            const errorResult = pronResult as import('@/hooks/usePronunciationAnalysis').PronunciationErrorResult;
            const errorStage = errorResult.error?.stage;
            await logFinalAnalysis({
              transcript: transcript.trim(),
              transcriptSource: 'browser',
              isCorrect: transcript.trim().toLowerCase() === targetWord.toLowerCase(),
              recordingDurationMs: recordingResult.duration,
              audioStoragePath: audioStoragePath || undefined,
              fluencyAvailable: false,
              fluencyUnavailableReason: 'analysis_error',
              pronunciationDiagnostics: {
                pronRequestId: pronResult.pronRequestId,
                pronunciationStatus: 'failed',
                pronunciationErrorStage: errorStage,
                pronunciationTimingsMs: pronResult.timingsMs,
                audioMeta: pronResult.audioMeta,
              },
            });
          }
          resetAttempt();
        }
      }
    } else if (currentAttemptId) {
      // No recording available - still log the utterance
      await logFinalAnalysis({
        transcript: transcript.trim(),
        transcriptSource: 'browser',
        isCorrect: targetWord ? transcript.trim().toLowerCase() === targetWord.toLowerCase() : undefined,
        recordingDurationMs: reactionTimeMs,
        fluencyAvailable: false,
        fluencyUnavailableReason: 'no_recording',
      });
      resetAttempt();
    }
    
    namingTrialIndexRef.current += 1;
    namingStartRef.current = Date.now();
  }, [submitNaming, stopRecording, uploadRecording, userId, sessionId, analyzePronunciation, currentAttemptId, logFinalAnalysis, resetAttempt]);

  // Start new attempt + recording when naming target changes
  useEffect(() => {
    if (phase === 'naming' && currentNamingTarget && userId) {
      activeTargetWordRef.current = currentNamingTarget.word;
      startAttempt({
        sessionId: sessionId || 'standalone',
        userId,
        exerciseSlug: 'dual_load_naming',
        trialIndex: namingTrialIndexRef.current,
        attemptNumber: 1,
        targetWord: currentNamingTarget.word,
        category: 'naming',
      });
      startRecording();
    }
  }, [phase, currentNamingTarget, userId, sessionId, startAttempt, startRecording]);

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
    namingTrialIndexRef.current = 0;
    // Attempt + recording start is handled by the useEffect watching phase/currentNamingTarget
    if (isSupported) startListening();
  }, [startNaming, startListening, isSupported]);

  // For naming: if speech doesn't capture, allow manual skip
  const handleSkipNaming = useCallback(async () => {
    const reactionTimeMs = Date.now() - namingStartRef.current;
    
    // Stop recording on skip
    await stopRecording();
    
    // Log skip as no-response
    if (currentAttemptId) {
      await logFinalAnalysis({
        transcript: '',
        transcriptSource: 'browser',
        isCorrect: false,
        didSpeak: false,
        fluencyAvailable: false,
        fluencyUnavailableReason: 'no_recording',
      });
      resetAttempt();
    }
    
    submitNaming('', reactionTimeMs);
    namingTrialIndexRef.current += 1;
    namingStartRef.current = Date.now();
    // Next attempt + recording handled by useEffect watching currentNamingTarget
  }, [submitNaming, stopRecording, currentAttemptId, logFinalAnalysis, resetAttempt]);

  // Stop listening when entering recall phase
  useEffect(() => {
    if (phase === 'recall') {
      stopListening();
      stopRecording();
    }
  }, [phase, stopListening, stopRecording]);

  const handleSubmitRecall = useCallback(() => {
    const result = submitRecall(recallInputs.filter(w => w.trim()));
    if (result) {
      setLastResult(result);
      // Combined success: at least 2/3 words recalled AND naming above 60% — true
      // dual-load proficiency. Feeds the adaptation engine so tier shifts reflect
      // genuine mastery under cognitive load, not just one or the other.
      const combinedSuccess =
        result.recallAccuracy >= 0.67 && result.namingAccuracy >= 0.6;
      adaptation.recordTrial({
        correct: combinedSuccess,
        reactionTimeMs: result.durationMs,
      });
      // DualLoad has no explicit cue ladder; cueLevel: 0
      engagement.recordTrial({
        correct: combinedSuccess,
        reactionTimeMs: result.durationMs,
        cueLevel: 0,
        timeout: false,
        timestamp: Date.now(),
      });
      onTrialComplete(result);
    }
  }, [recallInputs, submitRecall, onTrialComplete, adaptation, engagement]);

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
    <div className="max-w-lg mx-auto w-full my-auto space-y-2 sm:space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="font-medium">Dual-Load Naming</span>
          <AdaptationBadge direction={shiftDirection} reason={shiftReason} />
        </div>
        <div className="flex items-center gap-2">
          <LevelBadge descriptor={adaptation.levelDescriptor} compact />
          <span className="text-muted-foreground">Set {currentSetIndex + 1} of {totalSets}</span>
        </div>
      </div>
      <Progress value={(currentSetIndex / totalSets) * 100} className="h-1.5" />
      {shiftDirection && (
        <AdaptationNarrationCard direction={shiftDirection} message={shiftReason} />
      )}

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
        <RoundDoneAutoAdvance
          onAdvance={handleContinue}
          buttonLabel={currentSetIndex + 1 < totalSets ? 'Next Set' : 'Finish'}
          delayMs={3000}
        >
          <Card className={cn("border-2 w-full",
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
        </RoundDoneAutoAdvance>
      )}
    </div>
  );
}
