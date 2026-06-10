/**
 * MinimalPairsGame Component
 * 
 * Displays two images side-by-side for phoneme discrimination practice.
 * User hears a word and must select the matching image.
 */

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useMayaExerciseFrame } from '@/hooks/useMayaExerciseFrame';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useMinimalPairsGame } from '@/hooks/useMinimalPairsGame';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Check, X, Volume2, ArrowRight, RotateCcw, Trophy, Mic } from 'lucide-react';
import { StructuredFeedbackSummary } from '@/components/StructuredFeedbackSummary';
import { cn } from '@/lib/utils';
import { ExercisePurposeBanner } from '@/components/ExercisePurposeBanner';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { getCapabilityDifficultyBounds } from '@/lib/difficultyBounds';
import { AdaptationBadge, useAdaptationShift } from '@/components/AdaptationBadge';
import { AdaptationNarrationCard } from '@/components/AdaptationNarrationCard';
import { mapEngineLevelToMinimalPairsTier } from '@/data/minimalPairsBank';
import { LevelBadge } from '@/components/exercise/LevelBadge';

interface MinimalPairsGameProps {
  difficulty?: number;
  totalTrials?: number;
  focusPhonemes?: string[];
  sessionId?: string | null;
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
    /** Number of times the patient pressed the replay button BEFORE answering.
     *  0 = first-listen (independent target). >=1 = scaffolded. */
    audioReplayCount: number;
    echoAttempted?: boolean;
    echoTranscript?: string;
    /** Real measured response latency (ms) from trial display to answer. */
    reactionTimeMs: number;
  }) => void;
}

export function MinimalPairsGame({
  difficulty = 1,
  totalTrials = 10,
  focusPhonemes,
  sessionId = null,
  onComplete,
  onTrialComplete,
}: MinimalPairsGameProps) {
  const { state, selectAnswer, nextTrial, reset, setActiveDifficulty } = useMinimalPairsGame({
    totalTrials,
    difficultyLevel: difficulty,
    focusPhonemes,
  });

  const { speak, isLoading: isSpeaking } = useTextToSpeech();
  const { buildReflection } = useMayaExerciseFrame({ exerciseSlug: 'minimal-pairs' });
  const vg = useVoiceGuidance('minimal-pairs');

  // ============ Adaptive Difficulty Layer ============
  // Phase 1.5: single source of truth — canonical engine→tier mapper.
  const levelToBankTier = mapEngineLevelToMinimalPairsTier;
  const bounds = useMemo(() => getCapabilityDifficultyBounds('minimal-pairs', null), []);
  const { direction: shiftDirection, reason: shiftReason, signal: signalShift } = useAdaptationShift();
  const lastTierRef = useRef(levelToBankTier(difficulty));

  const engagement = useEngagementMonitor(sessionId);

  const adaptation = useInGameAdaptation({
    exerciseSlug: 'minimal-pairs',
    sessionId,
    initialDifficulty: difficulty,
    bounds,
    enableDifficultyToasts: false,
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.info('[MinimalPairs] escalation blocked', {
        reason, cueDependencyScore, trialsAtLevel,
      });
    },
    onDifficultyChange: (newLevel, reason, dir) => {
      const newTier = levelToBankTier(newLevel);
      if (newTier !== lastTierRef.current) {
        lastTierRef.current = newTier;
        setActiveDifficulty(newTier);
      }
      const narration = narrateAdaptation({
        direction: dir,
        reasonKind: classifyReason(reason),
      });
      signalShift(dir, narration || reason);
    },
  });

  // Speak intro on first mount in Full Coaching mode
  const hasSpokenIntroRef = useRef(false);
  useEffect(() => {
    if (!hasSpokenIntroRef.current && vg.shouldAutoSpeak) {
      hasSpokenIntroRef.current = true;
      vg.speakIntro();
    }
  }, [vg.shouldAutoSpeak]);

  // Stall timer for voice reminder
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { currentTrial, trialIndex, score, correctCount, incorrectCount, showFeedback, isComplete } = state;

  // ============ Optional 'Say it' echo phase ============
  // Exposure, NOT evaluation. Never marks user wrong, never blocks progression.
  type EchoStatus = 'idle' | 'listening' | 'heard' | 'skipped';
  const [echoStatus, setEchoStatus] = useState<EchoStatus>('idle');
  const [echoTranscript, setEchoTranscript] = useState('');
  const echoActiveRef = useRef(false);
  const echoTimerRef = useRef<NodeJS.Timeout | null>(null);

  const speech = useSpeechRecognition({
    onResult: (t) => {
      if (!echoActiveRef.current) return;
      setEchoTranscript(t);
      setEchoStatus('heard');
    },
    continuousListening: false,
    enabled: true,
  });

  const stopEcho = useCallback(() => {
    echoActiveRef.current = false;
    if (echoTimerRef.current) { clearTimeout(echoTimerRef.current); echoTimerRef.current = null; }
    try { speech.stopListening(); } catch {}
  }, [speech]);

  const startEcho = useCallback(async () => {
    if (!speech.isSupported) {
      setEchoStatus('skipped');
      return;
    }
    echoActiveRef.current = true;
    setEchoStatus('listening');
    setEchoTranscript('');
    // Sync-Wait: target was just spoken in feedback effect; small gap before mic.
    await new Promise((r) => setTimeout(r, 600));
    if (!echoActiveRef.current) return;
    try { speech.startListening(); } catch {}
    // Auto-stop after 4s — exposure window, not evaluation.
    echoTimerRef.current = setTimeout(() => {
      if (echoActiveRef.current && echoStatus === 'listening') {
        stopEcho();
        setEchoStatus((s) => (s === 'listening' ? 'skipped' : s));
      }
    }, 4000);
  }, [speech, stopEcho, echoStatus]);

  const handleEchoSaidIt = useCallback(() => {
    stopEcho();
    setEchoStatus('heard');
  }, [stopEcho]);

  const handleEchoSkip = useCallback(() => {
    stopEcho();
    setEchoStatus('skipped');
  }, [stopEcho]);

  // Reset echo on each new trial
  useEffect(() => {
    stopEcho();
    setEchoStatus('idle');
    setEchoTranscript('');
  }, [trialIndex, stopEcho]);

  useEffect(() => () => stopEcho(), [stopEcho]);


  // Track trial completions for adaptation
  const trialStartRef = useRef(Date.now());
  useEffect(() => {
    if (currentTrial && !showFeedback) {
      trialStartRef.current = Date.now();
    }
  }, [currentTrial, showFeedback]);

  const lastReportedTrialRef = useRef<number>(-1);
  useEffect(() => {
    if (showFeedback && state.isCorrect !== null && lastReportedTrialRef.current !== trialIndex) {
      lastReportedTrialRef.current = trialIndex;
      adaptation.recordTrial({
        correct: state.isCorrect === true,
        reactionTimeMs: Date.now() - trialStartRef.current,
      });
      // MinimalPairs: target word is auto-spoken — treat as cueLevel 1 (audio support).
      engagement.recordTrial({
        correct: state.isCorrect === true,
        reactionTimeMs: Date.now() - trialStartRef.current,
        cueLevel: 1,
        timeout: false,
        timestamp: Date.now(),
      });
    }
  }, [showFeedback, state.isCorrect, trialIndex, adaptation, engagement]);

  
  // Per-trial replay counter — counts ONLY user-initiated replays (button
  // taps), excluding the auto-play that fires when a trial loads. Reset on
  // trial change. Used to derive Minimal Pairs SupportLevel
  // (first_listen vs after_replay).
  const audioReplayCountRef = useRef(0);

  // Auto-play target word when trial changes + stall timer
  useEffect(() => {
    if (currentTrial && !showFeedback) {
      audioReplayCountRef.current = 0;
      const timer = setTimeout(() => {
        speak(currentTrial.targetWord);
      }, 500);

      // Start stall timer
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => {
        if (!showFeedback) {
          // Actually replay the target word so "listen one more time" is truthful,
          // then give the spoken reminder to tap an answer.
          speak(currentTrial.targetWord);
          vg.speakReminder();
        }
      }, 10000);

      return () => {
        clearTimeout(timer);
        if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      };
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
  
  // Report trial data — fire once per trial. For incorrect, immediate; for
  // correct, wait until echo resolves so we can include echoAttempted as a cue signal.
  // Guard: keyed on `${trialIndex}-${pair.id}` so a stuck `showFeedback=true`
  // state cannot re-fire the logger even if the parent passes a new
  // onTrialComplete identity. Also requires selectedIndex !== null so we
  // never log a trial the user hasn't actually answered.
  const trialReportedRef = useRef<string>('');
  useEffect(() => {
    if (!showFeedback || !currentTrial || !onTrialComplete) return;
    if (state.selectedIndex === null) return;
    const reportKey = `${trialIndex}-${currentTrial.pair.id}`;
    if (trialReportedRef.current === reportKey) return;
    const correct = state.isCorrect === true;
    if (correct && echoStatus !== 'heard' && echoStatus !== 'skipped') return;
    trialReportedRef.current = reportKey;
    const selectedWord = state.selectedIndex === 0
      ? currentTrial.pair.word1
      : currentTrial.pair.word2;
    onTrialComplete({
      targetWord: currentTrial.targetWord,
      selectedWord,
      isCorrect: state.isCorrect ?? false,
      pair: { word1: currentTrial.pair.word1, word2: currentTrial.pair.word2 },
      audioReplayCount: audioReplayCountRef.current,
      echoAttempted: echoStatus === 'heard',
      echoTranscript: echoStatus === 'heard' ? echoTranscript : undefined,
      reactionTimeMs: Math.max(0, Date.now() - trialStartRef.current),
    });
  }, [showFeedback, currentTrial, trialIndex, state.selectedIndex, state.isCorrect, echoStatus, echoTranscript, onTrialComplete]);

  // Auto-advance after selection.
  // Incorrect: 2.4s (time to read contrast info), no say-it step.
  // Correct: wait for the optional "Say it" echo to resolve (heard/skipped)
  // so the production step is never cut off; once resolved, brief 1.2s beat.
  useEffect(() => {
    if (!showFeedback || isComplete) return;
    if (state.isCorrect) {
      if (echoStatus === 'heard' || echoStatus === 'skipped') {
        const t = setTimeout(() => { nextTrial(); }, 1200);
        return () => clearTimeout(t);
      }
      // Safety net: if the say-it step never resolves (e.g. no mic), don't hang.
      const fallback = setTimeout(() => { nextTrial(); }, 9000);
      return () => clearTimeout(fallback);
    }
    const t = setTimeout(() => { nextTrial(); }, 2400);
    return () => clearTimeout(t);
  }, [showFeedback, isComplete, state.isCorrect, echoStatus, trialIndex, nextTrial]);

  // Auto-prompt 'Say it' after correct answer (Sync-Wait: starts mic with delay)
  useEffect(() => {
    if (!showFeedback || isComplete) return;
    if (!state.isCorrect) return;
    if (echoStatus !== 'idle') return;
    // Speak target once for production model, then open mic.
    let cancelled = false;
    (async () => {
      try { await speak(currentTrial!.targetWord); } catch {}
      if (cancelled) return;
      startEcho();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFeedback, isComplete, state.isCorrect, trialIndex]);

  
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
    const accNorm = accuracy / 100;
    const maya = buildReflection(accNorm);
    
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (accuracy >= 80) strengths.push('Strong sound discrimination accuracy');
    if (correctCount >= totalTrials * 0.6) strengths.push(`Got ${correctCount} of ${state.totalTrials} correct`);
    if (accuracy < 60) weaknesses.push('Some similar sounds were hard to tell apart');
    if (accuracy >= 60 && accuracy < 80) weaknesses.push('A few tricky sound pairs need more practice');
    
    return (
      <div className="max-w-md mx-auto space-y-4">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Trophy className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Exercise Complete!</h2>
              <p className="text-muted-foreground mt-1 text-sm">Sound discrimination practice</p>
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xl font-bold text-primary">{score}</div>
                <div className="text-xs text-muted-foreground">Score</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xl font-bold text-primary">{correctCount}</div>
                <div className="text-xs text-muted-foreground">Correct</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xl font-bold">{accuracy}%</div>
                <div className="text-xs text-muted-foreground">Accuracy</div>
              </div>
            </div>
          </div>
        </Card>

        <StructuredFeedbackSummary
          strengths={strengths}
          weaknesses={weaknesses}
          nextStep={maya.nextStep}
          mayaReflection={maya.reflection}
          realLifeLine={maya.realLifeLine}
        />

        <div className="text-center">
          <Button onClick={() => reset()} size="lg" className="min-h-[48px]">
            <RotateCcw className="w-4 h-4 mr-2" />
            Practice Again
          </Button>
        </div>
      </div>
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
          <LevelBadge descriptor={adaptation.levelDescriptor} compact />
          <AdaptationBadge direction={shiftDirection} reason={shiftReason} />
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Check className="w-3 h-3" /> {correctCount}
          </span>
          <span className="font-medium">Score: {score}</span>
        </div>
      </div>
      {shiftDirection && (
        <AdaptationNarrationCard direction={shiftDirection} message={shiftReason} className="my-2" />
      )}
      
      <Progress value={progress} className="h-1.5" />
      
      {/* Listen prompt — target word is hidden so the user must discriminate by sound */}
      <div className="flex items-center justify-center gap-3 py-2">
        <p className="text-base sm:text-lg font-medium text-muted-foreground">
          Listen, then tap the matching picture
        </p>
        <button
          onClick={() => {
            if (!showFeedback) audioReplayCountRef.current += 1;
            speak(currentTrial.targetWord);
          }}
          disabled={isSpeaking}
          aria-label="Replay word"
          className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0"
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
      
      {/* Optional 'Say it' echo — exposure only, never penalized */}
      {showFeedback && state.isCorrect && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">
              {echoStatus === 'idle' && <>Now say: <span className="font-bold text-primary">"{currentTrial.targetWord}"</span></>}
              {echoStatus === 'listening' && <>Listening… say <span className="font-bold text-primary">"{currentTrial.targetWord}"</span></>}
              {echoStatus === 'heard' && (
                <>Nice — that sounded close.{echoTranscript ? <span className="text-muted-foreground"> ({echoTranscript})</span> : null}</>
              )}
              {echoStatus === 'skipped' && <span className="text-muted-foreground">No problem — moving on.</span>}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {echoStatus === 'listening' ? (
                <Button onClick={handleEchoSaidIt} size="sm" variant="secondary" className="gap-1">
                  <Mic className="w-3.5 h-3.5" /> I said it
                </Button>
              ) : echoStatus === 'idle' ? (
                <Button onClick={startEcho} size="sm" variant="secondary" className="gap-1" disabled={!speech.isSupported}>
                  <Mic className="w-3.5 h-3.5" /> Say it
                </Button>
              ) : null}
              {(echoStatus === 'idle' || echoStatus === 'listening') && (
                <Button onClick={handleEchoSkip} variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  Skip <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
          {!speech.isSupported && echoStatus === 'idle' && (
            <p className="text-xs text-muted-foreground mt-1">Mic not available — tap Skip to continue.</p>
          )}
        </div>
      )}

      {/* Contrast info + Next — compact. Auto-advances; tap Next to skip ahead. */}
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
          <Button onClick={nextTrial} variant="ghost" size="sm" className="gap-1 shrink-0 ml-3 text-muted-foreground">
            Skip
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
