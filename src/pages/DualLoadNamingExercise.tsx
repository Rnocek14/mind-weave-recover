/**
 * Dual-Load Naming Exercise Page — wrapper with session lifecycle.
 * Now consumes shared adaptation contract.
 */
import React, { useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DualLoadNamingGame } from '@/components/DualLoadNamingGame';
import { DualLoadTrialResult } from '@/hooks/useDualLoadNamingGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { SessionProgressBubble } from '@/components/SessionProgressBubble';
import { SessionSidePanel } from '@/components/SessionSidePanel';

const EXERCISE_SLUG = 'dual-load-naming';

export default function DualLoadNamingExercise() {
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
  const trialLimit = Number(location.state?.trialLimit) || 2;

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations: location.state?.adaptations,
    lessonFocusPhonemes: location.state?.focusPhonemes,
    defaultErrorType: 'phonemic_paraphasia',
  });

  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: true,   // naming task benefits from phoneme targeting
    cueSensitive: false,
  });

  const { activeSessionId, isCreatingSession } = useStandaloneSession(user?.id, providedSessionId, EXERCISE_SLUG);

  const getSessionStats = useCallback(() => ({
    score: scoreRef.current, totalTrials: trialsRef.current, startTime: startTimeRef.current,
  }), []);

  const { completeSession } = useSessionLifecycle({
    sessionId: activeSessionId, userId: user?.id, profileId: activeProfile?.id,
    exerciseSlug: EXERCISE_SLUG, getSessionStats,
  });

  const { logTrial } = useExerciseTelemetry(activeSessionId, normalizeExerciseSlug(EXERCISE_SLUG));

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'executive_function', fromLesson });

  const handleTrialComplete = useCallback((result: DualLoadTrialResult) => {
    if (!activeSessionId) return;
    scoreRef.current += Math.round((result.namingAccuracy + result.recallAccuracy) * 50);
    trialsRef.current += 1;

    pivot.recordTrialResult({
      wasCorrect: result.recallAccuracy >= 0.33,
      reactionTimeMs: result.durationMs,
    });

    logTrial({
      correct: result.recallAccuracy >= 0.33,
      reactionTimeMs: result.durationMs,
      taskParameters: {
        set_id: result.setId,
        naming_accuracy: result.namingAccuracy,
        recall_accuracy: result.recallAccuracy,
        interference_index: result.interferenceIndex,
        trial_limit: trialLimit,
        ...adaptationTelemetry,
      },
      trialOutputs: {
        depth: result.depthTelemetry,
      },
    });
  }, [activeSessionId, logTrial, trialLimit, adaptationTelemetry]);

  const handleGameComplete = useCallback((results: DualLoadTrialResult[]) => {
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
    <div className={`${fromLesson ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-background flex flex-col`}>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          <h1 className="text-lg font-semibold">🧠 Dual-Load Naming</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}><Home className="h-4 w-4" /></Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>
      <main className={`container px-4 ${fromLesson ? 'py-2 flex-1 min-h-0 overflow-auto' : 'py-4 md:py-8'}`}>
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🧠</div>
            <h2 className="text-2xl font-bold">Dual-Load Complete!</h2>
            <p className="text-muted-foreground">{fromLesson ? 'Loading next exercise…' : 'Great work under cognitive load!'}</p>
            {!fromLesson && <Button onClick={handleContinue} size="lg">Continue</Button>}
          </div>
        ) : (
          <DualLoadNamingGame onTrialComplete={handleTrialComplete} onGameComplete={handleGameComplete} roundCount={trialLimit} tier={adaptation.difficultyTier} focusPhonemes={adaptation.focusPhonemes.length > 0 ? adaptation.focusPhonemes : undefined} />
        )}
      </main>
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
