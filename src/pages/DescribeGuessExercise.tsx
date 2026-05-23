/**
 * Describe & Guess Exercise Page
 *
 * Flagship circumlocution training — wrapper with session lifecycle.
 *
 * Phase 2 (Universal Clinical Migration):
 *   - Replaces `useExerciseTelemetry` + manual `logTrial` with the unified
 *     `useTrialSubmission` pathway (lexical axis). One call site → both
 *     `exercise_events` and the mastery shadow.
 *   - `adaptation_trial_logs` continues to be written from
 *     `DescribeGuessGame`'s own `useInGameAdaptation(autoLog:true)`.
 *   - SupportLevel mapping (lexical axis, ordinal to `cueLevel`):
 *       0 prompts → `independent`
 *       1 prompt  → `semantic_cue`
 *       2 prompts → `phonemic_cue`
 *       3 prompts → `carrier_or_full_model`
 *     `cueLevel` itself is already derived by `deriveCueTelemetry()`.
 *   - No per-game progression hook yet — `progression: null`.
 */

import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { useNavigate, useLocation } from 'react-router-dom';
import { DescribeGuessGame } from '@/components/DescribeGuessGame';
import { DescribeGuessTrialResult } from '@/hooks/useDescribeGuessGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { deriveCueTelemetry } from '@/lib/describeGuess/cueMapping';
import type { SupportLevel } from '@/lib/progression/clinicalProgression';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { SessionSidePanel } from '@/components/SessionSidePanel';

/** Ordinal cueLevel (0..3) → lexical-axis SupportLevel. */
function cueLevelToLexicalSupport(cueLevel: number): SupportLevel {
  if (cueLevel <= 0) return 'independent';
  if (cueLevel === 1) return 'semantic_cue';
  if (cueLevel === 2) return 'phonemic_cue';
  return 'carrier_or_full_model';
}


const EXERCISE_SLUG = 'describe_guess';

export default function DescribeGuessExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);

  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const completionTimeoutRef = useRef<number | null>(null);
  const hasAdvancedLessonRef = useRef(false);

  const restoredLessonContext = useMemo(() => {
    try {
      const savedState = sessionStorage.getItem('lessonFlowState');
      if (!savedState) return null;

      const parsed = JSON.parse(savedState);
      const savedIndex = typeof parsed?.currentBlockIndex === 'number' ? parsed.currentBlockIndex : -1;
      const savedBlock = parsed?.lesson?.blocks?.[savedIndex];
      const savedExerciseId = savedBlock?.exerciseId;
      const normalizedSavedExerciseId = typeof savedExerciseId === 'string'
        ? savedExerciseId.replace(/_/g, '-')
        : null;

      if (!savedBlock || normalizedSavedExerciseId !== 'describe-guess') {
        return null;
      }

      return {
        fromLesson: Boolean(parsed?.sessionId),
        sessionId: parsed?.sessionId ?? null,
        adaptations: savedBlock?.adaptations,
      };
    } catch (error) {
      console.warn('[DescribeGuess] Failed to restore lesson context:', error);
      return null;
    }
  }, [location.key]);

  const hasRouteLessonContext = Boolean(location.state?.fromLesson || location.state?.sessionId);
  const fromLesson = hasRouteLessonContext
    ? Boolean(location.state?.fromLesson || location.state?.sessionId)
    : (restoredLessonContext?.fromLesson ?? false);
  const providedSessionId = location.state?.sessionId ?? restoredLessonContext?.sessionId ?? null;
  const returnTo = location.state?.returnTo || '/lesson';

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations: location.state?.adaptations ?? restoredLessonContext?.adaptations,
    lessonFocusPhonemes: location.state?.focusPhonemes,
    defaultErrorType: 'semantic_paraphasia',
  });

  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: false,  // circumlocution is semantic, not phonemic
    cueSensitive: true,
  });

  const { activeSessionId, isCreatingSession } = useStandaloneSession(
    user?.id,
    providedSessionId,
    EXERCISE_SLUG
  );

  const getSessionStats = useCallback(() => ({
    score: scoreRef.current,
    totalTrials: trialsRef.current,
    startTime: startTimeRef.current,
  }), []);

  const { completeSession } = useSessionLifecycle({
    sessionId: activeSessionId,
    userId: user?.id,
    profileId: activeProfile?.id,
    exerciseSlug: EXERCISE_SLUG,
    getSessionStats,
  });

  // Unified trial submission (lexical axis). No per-game progression hook
  // yet — progression:null keeps the progression buffer + commit flush as
  // no-ops; exercise_events + mastery shadow still write.
  const { submitTrial, commitSession } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    progression: null,
  });

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'lexical_retrieval', fromLesson });

  const resumeLessonFlow = useCallback((results?: DescribeGuessTrialResult[]) => {
    if (!fromLesson || hasAdvancedLessonRef.current) return;

    hasAdvancedLessonRef.current = true;

    if (completionTimeoutRef.current !== null) {
      window.clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }

    window.dispatchEvent(new CustomEvent('exercise-complete', {
      detail: {
        exerciseSlug: EXERCISE_SLUG,
        ...(results ? { results } : {}),
      },
    }));

    navigate(returnTo, { state: { resuming: true }, replace: true });
  }, [fromLesson, navigate]);

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  const handleTrialComplete = useCallback((result: DescribeGuessTrialResult) => {
    if (!activeSessionId) return;
    const points = (result.meaningWin ? 40 : 0) + (result.wordWin ? 40 : 0) + (result.strategyWin ? 20 : 0);
    scoreRef.current += points;
    trialsRef.current += 1;
    const isCorrect = result.meaningWin || result.wordWin;
    pivot.recordTrialResult({ wasCorrect: isCorrect, reactionTimeMs: result.reactionTimeMs });

    // Cue telemetry — chips tapped (and feature-type prompts surfaced) are
    // semantic scaffolds. Map count → 0..3 cue level so adaptation, mastery
    // shadow, and cue-independence analytics see real support usage instead
    // of "always unaided".
    const promptCount = result.promptsShown?.length ?? 0;
    const { cueLevel, cueTypeGiven } = deriveCueTelemetry(promptCount, isCorrect);
    const supportUsed = cueLevelToLexicalSupport(cueLevel);

    void submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: result.difficulty ?? adaptation.difficultyTier ?? 1,
      stimulusId: result.trialId,
      expectedResponse: result.target ?? null,
      userResponse: null,
      isCorrect,
      // Word win is the harder of the two; weight accordingly so mastery
      // shadow / adaptation can distinguish full retrieval from
      // partial-meaning success.
      accuracyScore: result.wordWin ? 1 : (result.meaningWin ? 0.5 : 0),
      cueLevel,
      supportUsed,
      latencyMs: result.reactionTimeMs ?? null,
      trialMode: 'production',
      errorType: isCorrect ? undefined : 'no_guess',
      taskParameters: {
        trial_id: result.trialId, target: result.target,
        meaning_win: result.meaningWin, word_win: result.wordWin,
        strategy_win: result.strategyWin, communication_win: result.communicationWin,
        feature_types_used: result.featureTypesUsed, guess_confidence: result.guessConfidence,
        prompts_shown: result.promptsShown, prompts_shown_count: promptCount,
        cue_type_given: cueTypeGiven,
        time_to_word_retrieval_ms: result.timeToWordRetrievalMs,
        self_corrected: result.selfCorrected, difficulty: result.difficulty,
        pivot_pending: pivot.hasPending, ...adaptationTelemetry,
      },
    });
    if (pivot.shouldStepDown) { console.log('[DescribeGuess] Pivot: step down', pivot.pivotReason); pivot.acknowledge(); }
  }, [activeSessionId, activeProfile?.id, submitTrial, adaptation.difficultyTier, adaptationTelemetry, pivot]);

  const handleGameComplete = useCallback(async (results: DescribeGuessTrialResult[]) => {
    // Unified commit: drains adaptation log buffer + flushes mastery shadow.
    await commitSession();
    setCompleted(true);
    completeSession();

    if (fromLesson) {
      completionTimeoutRef.current = window.setTimeout(() => {
        resumeLessonFlow(results);
      }, 400);
    }
  }, [fromLesson, completeSession, commitSession, resumeLessonFlow]);


  const handleBack = useCallback(() => {
    navigate(fromLesson ? returnTo : '/dashboard');
  }, [navigate, fromLesson]);

  const handleContinue = useCallback(() => {
    if (fromLesson) {
      resumeLessonFlow();
    } else {
      navigate('/today');
    }
  }, [fromLesson, navigate, resumeLessonFlow]);

  const isReady = !isCreatingSession && !!activeSessionId;

  if (!isReady) {
    return <ExerciseLoading />;
  }

  return (
    <div className="h-dvh overflow-hidden bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">Describe & Guess</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className="container px-4 py-2 flex-1 min-h-0 overflow-hidden flex flex-col">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold">Exercise Complete!</h2>
            <p className="text-muted-foreground">
              {fromLesson ? 'Loading next exercise…' : 'Amazing describing practice!'}
            </p>
            {!fromLesson && <Button onClick={handleContinue} size="lg">Continue</Button>}
          </div>
        ) : (
          <DescribeGuessGame
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
            trialCount={8}
            sessionId={activeSessionId}
            userId={user?.id}
            profileId={activeProfile?.id}
          />
        )}
      </main>

      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
