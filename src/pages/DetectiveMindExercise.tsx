/**
 * Detective Mind Exercise Page
 *
 * Wrapper with session lifecycle, telemetry, and navigation.
 *
 * Wave 2 (Phase 2, receptive-safe variant): migrated off raw
 * useExerciseTelemetry to the unified useTrialSubmission pipeline.
 * Every submitTrial call emits `trialMode: 'recognition'` because
 * Detective Mind is inferential reading comprehension (multiple
 * choice). The slug `detective_mind` is INTENTIONALLY NOT in
 * ADOPTED_TRIAL_MODE_SLUGS — receptive mastery routing is deferred
 * (same precedent as MeaningMatch / MinimalPairs). Progression is
 * still wired via useDetectiveMindProgression (L1–L8 ladder) with a
 * load gate so the engine starts at the correct clinical floor.
 */

import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import { ExerciseLoadGate } from '@/components/ExerciseLoadGate';
import React, { useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DetectiveMindGame } from '@/components/DetectiveMindGame';
import { DetectiveTrialResult } from '@/hooks/useDetectiveMindGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { saveExerciseDetails } from '@/lib/exerciseDetailsStore';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import {
  useDetectiveMindProgression,
  mapDetectiveMindSupport,
} from '@/hooks/useDetectiveMindProgression';
import { resolveEffectiveDetectiveMindInitialDifficulty } from '@/lib/progression/detectiveMindDifficultyBridge';

const EXERCISE_SLUG = 'detective_mind';

export default function DetectiveMindExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isOfflineMode = typeof window !== 'undefined' && localStorage.getItem('offlineMode') === 'true';
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);
  const exerciseCompleteSentRef = useRef(false);

  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const trialIndexRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;
  const trialLimit = Number(location.state?.trialLimit) || 10;
  const lessonSource = location.state?.lessonSource ?? null;
  const presetId = location.state?.presetId ?? null;
  const blockIndex = location.state?.blockIndex ?? null;
  const lessonAdaptations = restored.adaptations;

  // Adaptive difficulty from shared contract (session-static seed)
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations,
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation);

  const { activeSessionId, isCreatingSession } = useStandaloneSession(
    user?.id,
    providedSessionId,
    EXERCISE_SLUG
  );

  // Wave 2: Clinical Progression v1 — detective-mind L1–L8 ladder.
  // Receptive-safe: submitTrial emits trialMode:'recognition' and the
  // slug is intentionally NOT in ADOPTED_TRIAL_MODE_SLUGS.
  const progression = useDetectiveMindProgression({
    userId: user?.id,
    profileId: activeProfile?.id,
  });
  const bridge = resolveEffectiveDetectiveMindInitialDifficulty({
    sessionAdaptationDifficulty: adaptation.difficultyTier,
    clinicalLevel: progression.startingLevel,
    supportBaseline: progression.state?.supportBaseline ?? 0,
  });
  if (import.meta.env.DEV && bridge.softRegressionScaffold) {
    console.log(
      `[SoftRegression] DetectiveMind scaffolding active — supportBaseline=${progression.state?.supportBaseline} ` +
        `lowered floor by 1 (clinicalLevel=${progression.startingLevel}, floor=${bridge.clinicalFloor}, effective=${bridge.effective})`,
    );
  }
  const difficultyLevel = bridge.effective;

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

  // Wave 2: unified trial submission (receptive-safe). DetectiveMindGame
  // is autoLog:false; this page owns the writer and emits
  // trialMode:'recognition'. Progression is buffered + flushed on commit.
  const { submitTrial, commitSession } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    progression,
  });

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'executive_function', fromLesson });

  const handleTrialComplete = useCallback(async (result: DetectiveTrialResult) => {
    if (!activeSessionId && !isOfflineMode) return;
    scoreRef.current += result.points;
    trialsRef.current += 1;
    trialIndexRef.current += 1;
    pivot.recordTrialResult({ wasCorrect: result.correct, reactionTimeMs: result.reactionTimeMs, cueLevel: result.usedHint ? 1 : 0 });

    await submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: result.tier ?? difficultyLevel,
      stimulusId: result.caseId ?? `dm_trial_${trialIndexRef.current}`,
      expectedResponse: null,
      userResponse: null,
      isCorrect: result.correct,
      accuracyScore: result.correct ? 1 : 0,
      cueLevel: result.usedHint ? 1 : 0,
      cueType: result.usedHint ? 'semantic' : null,
      supportUsed: mapDetectiveMindSupport(result.usedHint),
      latencyMs: result.reactionTimeMs,
      trialMode: 'recognition',
      errorType: result.correct ? undefined : 'wrong_option',
      cueTypeGiven: result.usedHint ? 'semantic' : 'none',
      cueWasEffective: result.usedHint ? result.correct : null,
      taskParameters: {
        case_id: result.caseId,
        question_type: result.questionType,
        tier: result.tier,
        used_hint: result.usedHint,
        hint_type: result.usedHint ? 'highlight_sentence' : null,
        points: result.points,
        trial_limit: trialLimit,
        block_index: blockIndex,
        lesson_source: lessonSource,
        preset_id: presetId,
        pivot_pending: pivot.hasPending,
        clinical_level: progression.startingLevel,
        clinical_floor: bridge.clinicalFloor,
        ...adaptationTelemetry,
      },
    });

    if (pivot.shouldStepDown) { console.log('[DetectiveMind] Pivot: step down', pivot.pivotReason); pivot.acknowledge(); }
  }, [activeSessionId, isOfflineMode, submitTrial, adaptationTelemetry, pivot, trialLimit, blockIndex, lessonSource, presetId, activeProfile?.id, difficultyLevel, progression.startingLevel, bridge.clinicalFloor]);

  const handleGameComplete = useCallback(async (results: DetectiveTrialResult[]) => {
    setCompleted(true);
    // Unified commit BEFORE session-end housekeeping — flushes the L1–L8
    // progression ladder + mastery shadow + drains adaptation rows.
    await commitSession();
    completeSession();

    // Save structured details for reflection engine
    if (blockIndex != null) {
      saveExerciseDetails(blockIndex, 'detective-mind', {
        results: results.map(r => ({ questionType: r.questionType, correct: r.correct })),
      });
    }

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
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    }
  }, [fromLesson, completeSession, commitSession, blockIndex, navigate, returnTo]);

  const handleBack = useCallback(() => {
    navigate(fromLesson ? returnTo : '/dashboard');
  }, [navigate, fromLesson, returnTo]);

  const handleContinue = useCallback(() => {
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      window.dispatchEvent(new CustomEvent('exercise-complete', {
        detail: { exerciseSlug: EXERCISE_SLUG }
      }));
    } else if (!fromLesson) {
      navigate('/today');
    }
  }, [fromLesson, navigate]);

  const isReady = isOfflineMode || (!isCreatingSession && !!activeSessionId);

  if (!isReady) {
    return <ExerciseLoading />;
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">🕵️ Detective Mind</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className="container px-4 py-2 flex-1 flex flex-col overflow-y-auto pb-16">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🕵️</div>
            <h2 className="text-2xl font-bold">Investigation Complete!</h2>
            <p className="text-muted-foreground">
              {fromLesson ? 'Loading next exercise…' : 'Great detective work on those cases!'}
            </p>
            {!fromLesson && (
              <Button onClick={handleContinue} size="lg">
                Continue
              </Button>
            )}
          </div>
        ) : progression.loaded ? (
          <DetectiveMindGame
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
            roundCount={trialLimit}
            difficultyLevel={difficultyLevel}
            sessionId={activeSessionId}
            recommendedCueType={adaptation.recommendedCueType !== 'none' ? adaptation.recommendedCueType as any : undefined}
          />
        ) : (
          <ExerciseLoadGate inline loadingLabel="Loading your progression…" />
        )}
      </main>

      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
