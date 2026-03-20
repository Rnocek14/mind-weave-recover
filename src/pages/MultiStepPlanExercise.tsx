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
import { SessionProgressBubble } from '@/components/SessionProgressBubble';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';

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

  const fromLesson = location.state?.fromLesson ?? false;
  const providedSessionId = location.state?.sessionId ?? null;
  const lessonAdaptations = location.state?.adaptations as Record<string, any> | undefined;
  const trialLimit = Number(location.state?.trialLimit) || 3;

  const { activeSessionId, isCreatingSession } = useStandaloneSession(user?.id, providedSessionId, EXERCISE_SLUG);

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    lessonAdaptations,
    defaultErrorType: 'no_response',
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation);

  const getSessionStats = useCallback(() => ({
    score: scoreRef.current, totalTrials: trialsRef.current, startTime: startTimeRef.current,
  }), []);

  const { completeSession } = useSessionLifecycle({
    sessionId: activeSessionId, userId: user?.id, profileId: activeProfile?.id,
    exerciseSlug: EXERCISE_SLUG, getSessionStats,
  });

  const { logTrial } = useExerciseTelemetry(activeSessionId, normalizeExerciseSlug(EXERCISE_SLUG));

  const handleTrialComplete = useCallback((result: PlanningTrialResult) => {
    if (!activeSessionId) return;
    scoreRef.current += Math.round(result.goalCoverage * 100);
    trialsRef.current += 1;

    logTrial({
      correct: result.goalCoverage >= 0.3,
      reactionTimeMs: result.durationMs,
      taskParameters: {
        item_id: result.itemId, goal: result.goal,
        steps_found: result.stepsFound, steps_total: result.stepsTotal,
        sequence_score: result.sequenceScore, trial_limit: trialLimit,
        ...adaptationTelemetry,
      },
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
  }, [activeSessionId, logTrial, trialLimit]);

  const handleGameComplete = useCallback((results: PlanningTrialResult[]) => {
    setCompleted(true);
    completeSession();
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', { detail: { exerciseSlug: EXERCISE_SLUG, results } }));
      }, 2000);
    }
  }, [fromLesson, completeSession]);

  const handleBack = useCallback(() => navigate(fromLesson ? '/lesson' : '/dashboard'), [navigate, fromLesson]);
  const handleContinue = useCallback(() => {
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      window.dispatchEvent(new CustomEvent('exercise-complete', { detail: { exerciseSlug: EXERCISE_SLUG } }));
    } else if (!fromLesson) navigate('/dashboard');
  }, [fromLesson, navigate]);

  if (isCreatingSession || !activeSessionId) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Loading exercise...</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          <h1 className="text-lg font-semibold">📋 Step-by-Step Planning</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}><Home className="h-4 w-4" /></Button>
        </div>
      </header>
      {fromLesson && <SessionProgressBubble />}
      <main className="container px-4 py-8">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">📋</div>
            <h2 className="text-2xl font-bold">Planning Complete!</h2>
            <p className="text-muted-foreground">Great executive planning!</p>
            <Button onClick={handleContinue} size="lg">Continue</Button>
          </div>
        ) : (
          <MultiStepPlanningGame onTrialComplete={handleTrialComplete} onGameComplete={handleGameComplete} roundCount={trialLimit} />
        )}
      </main>
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
