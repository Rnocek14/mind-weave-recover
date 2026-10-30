/**
 * Abstract Comparison Exercise Page — wrapper with session lifecycle.
 */
import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import React, { useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AbstractCompareGame } from '@/components/AbstractCompareGame';
import { AbstractCompareTrialResult } from '@/hooks/useAbstractCompareGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import { useVerifiedExerciseCompletion } from '@/hooks/useVerifiedExerciseCompletion';
import { ExerciseSaveFeedback } from '@/components/exercise/ExerciseSaveFeedback';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { useDynamicTier } from '@/hooks/useDynamicTier';
import { tierToLevel } from '@/lib/gameLevels';

const EXERCISE_SLUG = 'abstract_compare';

export default function AbstractCompareExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const exerciseCompleteSentRef = useRef(false);
  const dispatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trialIndexRef = useRef(0);
  useEffect(() => () => {
    if (dispatchTimeoutRef.current !== null) clearTimeout(dispatchTimeoutRef.current);
  }, []);
  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  const trialLimit = Number(location.state?.trialLimit) || 4;

  const { activeSessionId, isCreatingSession, sessionError, retrySession } = useStandaloneSession(user?.id, providedSessionId, EXERCISE_SLUG);

  // Shared adaptation contract (session-static seed)
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations,
    defaultErrorType: 'no_response',
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation);

  // Per-trial adaptive tier — drives content pool dynamically.
  const dynamicTier = useDynamicTier({
    exerciseSlug: EXERCISE_SLUG,
    sessionId: activeSessionId,
    userId: user?.id,
    profileId: activeProfile?.id,
    initialTier: adaptation.difficultyTier,
    minTier: 1,
    maxTier: 3,
    targetSuccessRate: 0.75,
  });

  const getSessionStats = useCallback(() => ({
    score: scoreRef.current, totalTrials: trialsRef.current, startTime: startTimeRef.current,
  }), []);

  const { completeSession } = useSessionLifecycle({
    sessionId: activeSessionId, userId: user?.id, profileId: activeProfile?.id,
    exerciseSlug: EXERCISE_SLUG, getSessionStats,
  });

  const { submitTrial, commitSession, retryFailedSubmissions } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    progression: null,
  });

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'semantic_depth', fromLesson });

  const handleTrialComplete = useCallback((result: AbstractCompareTrialResult) => {
    if (!activeSessionId) return;
    scoreRef.current += Math.round(result.coverageRatio * 100);
    trialsRef.current += 1;

    const wasCorrect = result.coverageRatio >= 0.3;

    pivot.recordTrialResult({
      wasCorrect,
      reactionTimeMs: result.durationMs,
    });

    // Drive adaptive tier based on per-trial outcome
    dynamicTier.recordTrial({
      correct: wasCorrect,
      reactionTimeMs: result.durationMs,
      errorType: wasCorrect ? undefined : 'low_coverage',
    });

    trialIndexRef.current++;
    void submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: tierToLevel(dynamicTier.currentTier, { min: 1, max: 3 }),
      stimulusId: result.itemId,
      trialIndex: trialIndexRef.current,
      expectedResponse: `${result.wordA} / ${result.wordB}`,
      userResponse: result.transcript ?? null,
      isCorrect: wasCorrect,
      accuracyScore: result.coverageRatio,
      latencyMs: result.durationMs,
      cueLevel: 0,
      supportUsed: 'independent',
      trialMode: 'production',
      errorType: wasCorrect ? undefined : 'low_coverage',
      taskParameters: {
        unified_route_adaptation_log: true,
        item_id: result.itemId,
        word_a: result.wordA,
        word_b: result.wordB,
        abstraction_level: result.abstractionLevel,
        trial_limit: trialLimit,
        tier: dynamicTier.currentTier,
        game_level: tierToLevel(dynamicTier.currentTier, { min: 1, max: 3 }),
        skipped: result.skipped,
        explanation: {
          coverageRatio: result.coverageRatio,
          onTopicScore: result.onTopicScore,
          conceptsFound: result.conceptCount,
          conceptsTotal: result.conceptsTotal,
        },
        depth: result.depthTelemetry,
        ...adaptationTelemetry,
      },
    });
  }, [activeSessionId, activeProfile?.id, submitTrial, trialLimit, adaptationTelemetry, dynamicTier, pivot]);

  const onConfirmed = useCallback((results: AbstractCompareTrialResult[]) => {
    if (!fromLesson || exerciseCompleteSentRef.current) return;
    exerciseCompleteSentRef.current = true;
    dispatchTimeoutRef.current = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('exercise-complete', {
        detail: { exerciseSlug: EXERCISE_SLUG, results },
      }));
      navigate(returnTo, { state: { resuming: true }, replace: true });
    }, 400);
  }, [fromLesson, navigate, returnTo]);

  const { saveState, finish, retry } = useVerifiedExerciseCompletion<AbstractCompareTrialResult[]>({
    scope: user?.id && activeProfile?.id && activeSessionId
      ? JSON.stringify([user.id, activeProfile.id, activeSessionId, EXERCISE_SLUG])
      : null,
    commitSession,
    completeSession,
    retryFailedSubmissions,
    onConfirmed,
  });

  const handleGameComplete = useCallback((results: AbstractCompareTrialResult[]) => {
    void finish(results);
  }, [finish]);

  const handleBack = useCallback(() => {
    if (fromLesson) {
      // Signal lesson flow to skip this exercise and move on
      window.dispatchEvent(new CustomEvent('exercise-complete', { 
        detail: { exerciseSlug: EXERCISE_SLUG, skipped: true } 
      }));
    } else {
      navigate('/today');
    }
  }, [fromLesson, navigate]);
  const handleContinue = useCallback(() => navigate('/today'), [navigate]);

  if (isCreatingSession || !activeSessionId) {
    return <ExerciseLoading error={sessionError} onRetry={sessionError ? retrySession : undefined} />;
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}><ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Back</span></Button>
          <h1 className="text-lg font-semibold">🔗 Abstract Comparison</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}><Home className="h-4 w-4" /></Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>
      <main className="container px-4 py-2 flex-1 flex flex-col overflow-y-auto pb-16">
        {saveState === 'saving' || saveState === 'error' ? (
          <ExerciseSaveFeedback
            state={saveState}
            onRetry={() => void retry()}
            onExit={() => navigate('/today')}
          />
        ) : saveState === 'complete' ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🔗</div>
            <h2 className="text-2xl font-bold">Comparisons Complete!</h2>
            <p className="text-muted-foreground">
              {fromLesson ? 'Loading next exercise…' : 'Great abstract thinking!'}
            </p>
            {!fromLesson && <Button onClick={handleContinue} size="lg">Continue</Button>}
          </div>
        ) : (
          <AbstractCompareGame
            key={JSON.stringify([user?.id, activeProfile?.id, activeSessionId])}
            onTrialComplete={handleTrialComplete} onGameComplete={handleGameComplete} roundCount={trialLimit} tier={dynamicTier.currentTier} userId={user?.id} sessionId={activeSessionId} autoStart={fromLesson} />
        )}
      </main>
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
