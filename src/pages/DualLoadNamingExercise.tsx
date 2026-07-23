/**
 * Dual-Load Naming Exercise Page
 *
 * Wave 3 (Phase 2): migrated off raw useExerciseTelemetry to the unified
 * useTrialSubmission pipeline. Every submitTrial call emits
 * `trialMode: 'production'` (expressive confrontation naming under WM
 * load) and the slug `dual_load_naming` is in ADOPTED_TRIAL_MODE_SLUGS,
 * so longitudinal mastery now flows. Progression is wired via
 * useDualLoadNamingProgression (L1–L8 ladder) with a load gate so the
 * engine starts at the correct clinical floor.
 */
import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import { ExerciseLoadGate } from '@/components/ExerciseLoadGate';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DualLoadNamingGame } from '@/components/DualLoadNamingGame';
import { DualLoadTrialResult } from '@/hooks/useDualLoadNamingGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { useDynamicTier } from '@/hooks/useDynamicTier';
import { tierToLevel } from '@/lib/gameLevels';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import {
  useDualLoadNamingProgression,
  mapDualLoadNamingSupport,
} from '@/hooks/useDualLoadNamingProgression';
import { resolveEffectiveDualLoadNamingInitialDifficulty } from '@/lib/progression/dualLoadNamingDifficultyBridge';

const EXERCISE_SLUG = 'dual_load_naming';

export default function DualLoadNamingExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);
  const exerciseCompleteSentRef = useRef(false);
  const dispatchTimeoutRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const trialIndexRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    return () => { if (dispatchTimeoutRef.current) clearTimeout(dispatchTimeoutRef.current); };
  }, []);

  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;
  const trialLimit = Number(location.state?.trialLimit) || 2;

  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations: location.state?.adaptations,
    lessonFocusPhonemes: location.state?.focusPhonemes,
    defaultErrorType: 'phonemic_paraphasia',
  });

  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: true,
    cueSensitive: false,
  });

  const { activeSessionId, isCreatingSession } = useStandaloneSession(user?.id, providedSessionId, EXERCISE_SLUG);

  // Wave 3: Clinical Progression v1 — dual-load-naming L1–L8 ladder.
  // Persistent Clinical Level supplies a FLOOR for the in-session engine
  // tier (1–10); session adaptation can still escalate above the floor.
  const progression = useDualLoadNamingProgression({
    userId: user?.id,
    profileId: activeProfile?.id,
  });
  const bridge = resolveEffectiveDualLoadNamingInitialDifficulty({
    sessionAdaptationDifficulty: adaptation.difficultyTier,
    clinicalLevel: progression.startingLevel,
    supportBaseline: progression.state?.supportBaseline ?? 0,
  });
  if (import.meta.env.DEV && bridge.softRegressionScaffold) {
    console.log(
      `[SoftRegression] DualLoadNaming scaffolding active — supportBaseline=${progression.state?.supportBaseline} ` +
        `lowered floor by 1 (clinicalLevel=${progression.startingLevel}, floor=${bridge.clinicalFloor}, effective=${bridge.effective})`,
    );
  }
  const difficultyLevel = bridge.effective;

  // Per-trial dynamic tier controller (1..3). Seeded from the clinical floor
  // mapped through engine level → content tier (1..3).
  const initialTierFromFloor = difficultyLevel <= 3 ? 1 : difficultyLevel <= 7 ? 2 : 3;
  const dynamicTier = useDynamicTier({
    exerciseSlug: EXERCISE_SLUG,
    sessionId: activeSessionId,
    userId: user?.id,
    profileId: activeProfile?.id,
    initialTier: initialTierFromFloor,
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

  // Wave 3: unified trial submission (expressive axis). DualLoadNamingGame
  // is autoLog:false; this page owns the writer and emits trialMode:'production'
  // so the adopted slug routes mastery correctly.
  const { submitTrial, commitSession } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    progression,
  });

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'executive_function', fromLesson });

  const handleTrialComplete = useCallback(async (result: DualLoadTrialResult) => {
    if (!activeSessionId) return;
    scoreRef.current += Math.round((result.namingAccuracy + result.recallAccuracy) * 50);
    trialsRef.current += 1;
    trialIndexRef.current += 1;

    pivot.recordTrialResult({
      wasCorrect: result.recallAccuracy >= 0.33,
      reactionTimeMs: result.durationMs,
    });

    dynamicTier.recordTrial({
      correct: result.recallAccuracy >= 0.33,
      reactionTimeMs: result.durationMs,
    });

    const isCorrect = result.recallAccuracy >= 0.33;
    let errorType: string | undefined;
    if (!isCorrect) {
      if (result.recallAccuracy === 0) errorType = 'recall_failure';
      else if (result.namingAccuracy < 0.5) errorType = 'naming_under_load';
      else errorType = 'partial_recall';
    }

    // Combined accuracy used as the clinical correctness signal for the
    // expressive mastery scalar. Recall ≥ 0.33 means the patient held the
    // memory list across the naming load — the minimum criterion for the
    // dual-task to count as "passed".
    const combinedAccuracy = (result.namingAccuracy + result.recallAccuracy) / 2;

    await submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: difficultyLevel,
      stimulusId: result.setId ?? `dln_trial_${trialIndexRef.current}`,
      expectedResponse: null,
      userResponse: result.recalledWords?.join(', ') ?? null,
      isCorrect,
      accuracyScore: combinedAccuracy,
      cueLevel: 0,
      supportUsed: mapDualLoadNamingSupport(),
      latencyMs: result.durationMs,
      trialMode: 'production',
      errorType,
      taskParameters: {
        set_id: result.setId,
        naming_accuracy: result.namingAccuracy,
        recall_accuracy: result.recallAccuracy,
        interference_index: result.interferenceIndex,
        trial_limit: trialLimit,
        tier: dynamicTier.currentTier,
        game_level: tierToLevel(dynamicTier.currentTier, { min: 1, max: 3 }),
        pivot_pending: pivot.hasPending,
        clinical_level: progression.startingLevel,
        clinical_floor: bridge.clinicalFloor,
        ...adaptationTelemetry,
      },
    });

    if (pivot.shouldStepDown) { console.log('[DualLoad] Pivot: step down', pivot.pivotReason); pivot.acknowledge(); }
  }, [activeSessionId, submitTrial, trialLimit, adaptationTelemetry, dynamicTier, pivot, activeProfile?.id, difficultyLevel, progression.startingLevel, bridge.clinicalFloor]);

  const handleGameComplete = useCallback(async (results: DualLoadTrialResult[]) => {
    setCompleted(true);
    // Unified commit BEFORE session-end housekeeping — flushes the L1–L8
    // progression ladder + mastery shadow + drains adaptation rows.
    await commitSession();
    completeSession();
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      dispatchTimeoutRef.current = window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', { detail: { exerciseSlug: EXERCISE_SLUG, results } }));
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    }
  }, [fromLesson, completeSession, commitSession, navigate, returnTo]);

  const handleBack = useCallback(() => navigate(fromLesson ? returnTo : '/dashboard'), [navigate, fromLesson, returnTo]);
  const handleContinue = useCallback(() => {
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      window.dispatchEvent(new CustomEvent('exercise-complete', { detail: { exerciseSlug: EXERCISE_SLUG } }));
    } else if (!fromLesson) navigate('/today');
  }, [fromLesson, navigate]);

  if (isCreatingSession || !activeSessionId) {
    return <ExerciseLoading />;
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}><ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Back</span></Button>
          <h1 className="text-lg font-semibold">🧠 Dual-Load Naming</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}><Home className="h-4 w-4" /></Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>
      <main className="container px-4 py-2 flex-1 flex flex-col overflow-y-auto pb-16">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🧠</div>
            <h2 className="text-2xl font-bold">Dual-Load Complete!</h2>
            <p className="text-muted-foreground">{fromLesson ? 'Loading next exercise…' : 'Great work under cognitive load!'}</p>
            {!fromLesson && <Button onClick={handleContinue} size="lg">Continue</Button>}
          </div>
        ) : progression.loaded ? (
          <DualLoadNamingGame
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
            roundCount={trialLimit}
            tier={dynamicTier.currentTier}
            focusPhonemes={adaptation.focusPhonemes.length > 0 ? adaptation.focusPhonemes : undefined}
            userId={user?.id}
            sessionId={activeSessionId}
          />
        ) : (
          <ExerciseLoadGate inline loadingLabel="Loading your progression…" />
        )}
      </main>
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
