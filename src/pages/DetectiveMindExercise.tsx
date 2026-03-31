/**
 * Detective Mind Exercise Page
 * 
 * Wrapper with session lifecycle, telemetry, and navigation.
 * Now uses adaptive difficulty instead of hardcoded DIFFICULTY_LEVEL = 1.
 */

import React, { useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DetectiveMindGame } from '@/components/DetectiveMindGame';
import { DetectiveTrialResult } from '@/hooks/useDetectiveMindGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { SessionProgressBubble } from '@/components/SessionProgressBubble';
import { SessionSidePanel } from '@/components/SessionSidePanel';

const EXERCISE_SLUG = 'detective_mind';

export default function DetectiveMindExercise() {
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
  const trialLimit = Number(location.state?.trialLimit) || 10;
  const lessonSource = location.state?.lessonSource ?? null;
  const presetId = location.state?.presetId ?? null;
  const blockIndex = location.state?.blockIndex ?? null;
  const lessonAdaptations = restored.adaptations;

  // Adaptive difficulty from shared contract (replaces hardcoded DIFFICULTY_LEVEL = 1)
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations,
  });
  const difficultyLevel = adaptation.difficultyTier;
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation);

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

  const { logTrial } = useExerciseTelemetry(
    activeSessionId,
    normalizeExerciseSlug(EXERCISE_SLUG)
  );

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'executive_function', fromLesson });

  const handleTrialComplete = useCallback((result: DetectiveTrialResult) => {
    if (!activeSessionId) return;
    scoreRef.current += result.points;
    trialsRef.current += 1;
    pivot.recordTrialResult({ wasCorrect: result.correct, reactionTimeMs: result.reactionTimeMs, cueLevel: result.usedHint ? 1 : 0 });
    logTrial({
      correct: result.correct,
      reactionTimeMs: result.reactionTimeMs,
      errorType: result.correct ? undefined : 'wrong_option',
      taskParameters: {
        case_id: result.caseId, question_type: result.questionType, tier: result.tier,
        used_hint: result.usedHint, hint_type: result.usedHint ? 'highlight_sentence' : null,
        points: result.points, trial_limit: trialLimit, block_index: blockIndex,
        lesson_source: lessonSource, preset_id: presetId, pivot_pending: pivot.hasPending,
        ...adaptationTelemetry,
      },
      cueTypeGiven: result.usedHint ? 'semantic' : 'none',
      cueWasEffective: result.usedHint ? result.correct : null,
    });
    if (pivot.shouldStepDown) { console.log('[DetectiveMind] Pivot: step down', pivot.pivotReason); pivot.acknowledge(); }
  }, [activeSessionId, logTrial, adaptationTelemetry, pivot]);

  const handleGameComplete = useCallback((results: DetectiveTrialResult[]) => {
    setCompleted(true);
    completeSession();

    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', {
          detail: {
            exerciseSlug: EXERCISE_SLUG,
            results,
            totalScore: results.reduce((sum, r) => sum + r.points, 0),
          }
        }));
      }, 2000);
    }
  }, [fromLesson, completeSession]);

  const handleBack = useCallback(() => {
    navigate(fromLesson ? '/lesson' : '/dashboard');
  }, [navigate, fromLesson]);

  const handleContinue = useCallback(() => {
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      window.dispatchEvent(new CustomEvent('exercise-complete', {
        detail: { exerciseSlug: EXERCISE_SLUG }
      }));
    } else if (!fromLesson) {
      navigate('/dashboard');
    }
  }, [fromLesson, navigate]);

  const isReady = !isCreatingSession && !!activeSessionId;

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">
          Loading exercise...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">🕵️ Detective Mind</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {fromLesson && <SessionProgressBubble />}

      <main className="container px-4 py-8">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🕵️</div>
            <h2 className="text-2xl font-bold">Investigation Complete!</h2>
            <p className="text-muted-foreground">
              Great detective work on those cases!
            </p>
            <Button onClick={handleContinue} size="lg">
              Continue
            </Button>
          </div>
        ) : (
          <DetectiveMindGame
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
            roundCount={trialLimit}
            difficultyLevel={difficultyLevel}
            recommendedCueType={adaptation.recommendedCueType !== 'none' ? adaptation.recommendedCueType as any : undefined}
          />
        )}
      </main>

      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
