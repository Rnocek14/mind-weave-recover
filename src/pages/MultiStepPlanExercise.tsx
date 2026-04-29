/**
 * Multi-Step Planning Exercise Page — wrapper with session lifecycle.
 */
import React, { useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MultiStepPlanningGame } from '@/components/MultiStepPlanningGame';
import { PlanningTrialResult } from '@/hooks/useMultiStepPlanningGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
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

const EXERCISE_SLUG = 'multi-step-plan';

export default function MultiStepPlanExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);
  const exerciseCompleteSentRef = useRef(false);
  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  const trialLimit = Number(location.state?.trialLimit) || 3;

  const { activeSessionId, isCreatingSession } = useStandaloneSession(user?.id, providedSessionId, EXERCISE_SLUG);

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations,
    defaultErrorType: 'no_response',
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation);

  // Per-trial dynamic tier controller (1..3)
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

  const { logTrial } = useExerciseTelemetry(activeSessionId, normalizeExerciseSlug(EXERCISE_SLUG));

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'executive_function', fromLesson });

  const handleTrialComplete = useCallback((result: PlanningTrialResult) => {
    if (!activeSessionId) return;
    scoreRef.current += Math.round(result.goalCoverage * 100);
    trialsRef.current += 1;

    pivot.recordTrialResult({
      wasCorrect: result.goalCoverage >= 0.3,
      reactionTimeMs: result.durationMs,
    });

    dynamicTier.recordTrial({
      correct: result.goalCoverage >= 0.3,
      reactionTimeMs: result.durationMs,
    });

    const isCorrect = result.goalCoverage >= 0.3;
    let errorType: string | undefined;
    if (!isCorrect) {
      if (result.stepsFound === 0) errorType = 'no_plan_steps';
      else if (result.sequenceScore != null && result.sequenceScore < 0.3) errorType = 'sequence_disorder';
      else errorType = 'incomplete_plan';
    }

    logTrial({
      correct: isCorrect,
      reactionTimeMs: result.durationMs,
      errorType,
      taskParameters: {
        item_id: result.itemId, goal: result.goal,
        steps_found: result.stepsFound, steps_total: result.stepsTotal,
        sequence_score: result.sequenceScore, trial_limit: trialLimit,
        tier: dynamicTier.currentTier,
        // Universal 1–10 GameLevel for analytics + UI consistency
        game_level: tierToLevel(dynamicTier.currentTier, { min: 1, max: 3 }),
        ...adaptationTelemetry,
      },
      adaptationsActive: dynamicTier.getAdaptationsActive(),
      trialOutputs: {
        explanation: {
          coverageRatio: result.goalCoverage,
          onTopicScore: null,
          conceptsFound: result.stepsFound,
          conceptsTotal: result.stepsTotal,
        },
        depth: result.depthTelemetry,
      },
    });
  }, [activeSessionId, logTrial, trialLimit, adaptationTelemetry, dynamicTier]);

  const handleGameComplete = useCallback((results: PlanningTrialResult[]) => {
    setCompleted(true);
    completeSession();
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', { detail: { exerciseSlug: EXERCISE_SLUG, results } }));
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    }
  }, [fromLesson, completeSession]);

  const handleBack = useCallback(() => navigate(fromLesson ? returnTo : '/dashboard'), [navigate, fromLesson]);
  const handleContinue = useCallback(() => {
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      window.dispatchEvent(new CustomEvent('exercise-complete', { detail: { exerciseSlug: EXERCISE_SLUG } }));
    } else if (!fromLesson) navigate('/today');
  }, [fromLesson, navigate]);

  if (isCreatingSession || !activeSessionId) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Loading exercise...</div></div>;
  }

  return (
    <div className={`${fromLesson ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-background flex flex-col`}>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}><ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Back</span></Button>
          <h1 className="text-lg font-semibold">📋 Step-by-Step Planning</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}><Home className="h-4 w-4" /></Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>
      <main className={`container px-4 ${fromLesson ? 'py-2 flex-1 min-h-0 overflow-auto' : 'py-4 md:py-8'}`}>
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">📋</div>
            <h2 className="text-2xl font-bold">Planning Complete!</h2>
            <p className="text-muted-foreground">{fromLesson ? 'Loading next exercise…' : 'Great executive planning!'}</p>
            {!fromLesson && <Button onClick={handleContinue} size="lg">Continue</Button>}
          </div>
        ) : (
          <MultiStepPlanningGame userId={user?.id} sessionId={activeSessionId} onTrialComplete={handleTrialComplete} onGameComplete={handleGameComplete} roundCount={trialLimit} tier={dynamicTier.currentTier} autoStart={fromLesson} />
        )}
      </main>
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
