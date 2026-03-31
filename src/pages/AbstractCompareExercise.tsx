/**
 * Abstract Comparison Exercise Page — wrapper with session lifecycle.
 */
import React, { useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AbstractCompareGame } from '@/components/AbstractCompareGame';
import { AbstractCompareTrialResult } from '@/hooks/useAbstractCompareGame';
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
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';

const EXERCISE_SLUG = 'abstract-compare';

export default function AbstractCompareExercise() {
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
  const fromLesson = restored.fromLesson;
  const providedSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  const trialLimit = Number(location.state?.trialLimit) || 4;

  const { activeSessionId, isCreatingSession } = useStandaloneSession(user?.id, providedSessionId, EXERCISE_SLUG);

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
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

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'semantic_depth', fromLesson });

  const handleTrialComplete = useCallback((result: AbstractCompareTrialResult) => {
    if (!activeSessionId) return;
    scoreRef.current += Math.round(result.coverageRatio * 100);
    trialsRef.current += 1;

    pivot.recordTrialResult({
      wasCorrect: result.coverageRatio >= 0.3,
      reactionTimeMs: result.durationMs,
    });

    logTrial({
      correct: result.coverageRatio >= 0.3,
      reactionTimeMs: result.durationMs,
      taskParameters: {
        item_id: result.itemId, word_a: result.wordA, word_b: result.wordB,
        abstraction_level: result.abstractionLevel, trial_limit: trialLimit,
        ...adaptationTelemetry,
      },
      trialOutputs: {
        explanation: {
          coverageRatio: result.coverageRatio,
          onTopicScore: result.onTopicScore,
          conceptsFound: result.conceptCount,
          conceptsTotal: result.conceptsTotal,
        },
        depth: result.depthTelemetry,
      },
    });
  }, [activeSessionId, logTrial, trialLimit]);

  const handleGameComplete = useCallback((results: AbstractCompareTrialResult[]) => {
    setCompleted(true);
    completeSession();
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', { detail: { exerciseSlug: EXERCISE_SLUG, results } }));
        navigate('/lesson', { state: { resuming: true }, replace: true });
      }, 400);
    }
  }, [fromLesson, completeSession]);

  const handleBack = useCallback(() => {
    if (fromLesson) {
      // Signal lesson flow to skip this exercise and move on
      window.dispatchEvent(new CustomEvent('exercise-complete', { 
        detail: { exerciseSlug: EXERCISE_SLUG, skipped: true } 
      }));
    } else {
      navigate('/dashboard');
    }
  }, [fromLesson, navigate]);
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
          <h1 className="text-lg font-semibold">🔗 Abstract Comparison</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}><Home className="h-4 w-4" /></Button>
        </div>
      </header>
      {fromLesson && <SessionProgressBubble />}
      <main className="container px-4 py-8">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🔗</div>
            <h2 className="text-2xl font-bold">Comparisons Complete!</h2>
            <p className="text-muted-foreground">Great abstract thinking!</p>
            <Button onClick={handleContinue} size="lg">Continue</Button>
          </div>
        ) : (
          <AbstractCompareGame onTrialComplete={handleTrialComplete} onGameComplete={handleGameComplete} roundCount={trialLimit} tier={adaptation.difficultyTier} />
        )}
      </main>
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
