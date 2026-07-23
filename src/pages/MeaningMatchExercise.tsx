/**
 * Meaning Match Arena Exercise Page
 *
 * Wrapper with session lifecycle, telemetry, and navigation.
 *
 * Phase 2 (Universal Clinical Migration):
 *   - Telemetry/adaptation now flows through `useTrialSubmission`, the
 *     unified Tier-A pathway used by Photo Naming, Fix Sentence, and
 *     Minimal Pairs. This fans out to `exercise_events`,
 *     `clinical_progression_state` (no-op until a per-game progression
 *     hook lands), and the mastery shadow flush on commit.
 *   - `adaptation_trial_logs` is still auto-written from
 *     `MeaningMatchGame`'s own `useInGameAdaptation(autoLog:true)` —
 *     `sessionId` is now forwarded so those rows actually persist.
 *   - SupportLevel mapping uses the **comprehension axis** contract:
 *     baseline trials = `recognition_only` (multi-choice picker),
 *     hint-assisted trials = `semantic_cue` (keyword highlight).
 *     See `docs/unified-trial-contract.md` §"Per-axis supportUsed".
 */

import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MeaningMatchGame } from '@/components/MeaningMatchGame';
import { MeaningMatchTrialResult } from '@/hooks/useMeaningMatchGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import {
  useMeaningMatchProgression,
  mapMeaningMatchSupport,
} from '@/hooks/useMeaningMatchProgression';
import { resolveEffectiveMeaningMatchInitialDifficulty } from '@/lib/progression/meaningMatchDifficultyBridge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';

const EXERCISE_SLUG = 'meaning_match';

export default function MeaningMatchExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);
  const exerciseCompleteSentRef = useRef(false);
  const dispatchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (dispatchTimeoutRef.current) clearTimeout(dispatchTimeoutRef.current);
    };
  }, []);

  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;
  const trialLimit = Number(location.state?.trialLimit) || 10;
  const lessonSource = location.state?.lessonSource ?? null;
  const presetId = location.state?.presetId ?? null;
  const blockIndex = location.state?.blockIndex ?? null;
  const lessonAdaptations = restored.adaptations;

  // Shared session-static adaptation (seeds tier; in-game controller lives in MeaningMatchGame).
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations,
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: false,
    cueSensitive: true,
  });

  const { activeSessionId, isCreatingSession } = useStandaloneSession(
    user?.id,
    providedSessionId,
    EXERCISE_SLUG
  );

  const difficultyLevel = adaptation.difficultyTier;

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

  // Clinical Progression v1 — Wave 1 wiring for Meaning Match (receptive-safe).
  // The hook drives persistent Clinical Level + engine floor, but `submitTrial`
  // continues to emit `trialMode: 'recognition'` and the slug is INTENTIONALLY
  // NOT in ADOPTED_TRIAL_MODE_SLUGS. Routing this comprehension task into the
  // expressive mastery track would conflate axes. Receptive-mastery track is
  // deferred. Same precedent as MinimalPairs.
  const progression = useMeaningMatchProgression({
    userId: user?.id,
    profileId: activeProfile?.id,
  });
  const bridge = resolveEffectiveMeaningMatchInitialDifficulty({
    sessionAdaptationDifficulty: difficultyLevel,
    clinicalLevel: progression.startingLevel,
    supportBaseline: progression.state?.supportBaseline ?? 0,
  });
  if (import.meta.env.DEV && bridge.softRegressionScaffold) {
    console.log(
      `[SoftRegression] MeaningMatch scaffolding active — supportBaseline=${progression.state?.supportBaseline} ` +
        `lowered floor by 1 (clinicalLevel=${progression.startingLevel}, floor=${bridge.clinicalFloor}, effective=${bridge.effective})`,
    );
  }
  const effectiveDifficulty = bridge.effective;

  // Unified trial submission. Progression is wired through
  // useMeaningMatchProgression — every submitTrial buffers a clinical trial
  // and commitSession flushes the L1–L8 ladder. trialMode stays 'recognition'
  // (receptive-safe routing; see comment above).
  const { submitTrial, commitSession } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    progression,
  });

  // Mid-session pivot for frustration/crash detection
  const pivot = useExerciseMidSessionPivot({
    exerciseSlug: EXERCISE_SLUG,
    domainSlug: 'semantic_depth',
    fromLesson,
  });

  const handleTrialComplete = useCallback((result: MeaningMatchTrialResult) => {
    if (!activeSessionId) return;

    scoreRef.current += result.points;
    trialsRef.current += 1;

    pivot.recordTrialResult({
      wasCorrect: result.correct,
      reactionTimeMs: result.reactionTimeMs,
      wasTimeout: false,
      cueLevel: result.usedHint ? 1 : 0,
    });

    // Comprehension axis SupportLevel mapping:
    //   recognition_only  → multi-choice baseline (no hint)
    //   semantic_cue      → keyword-highlight hint used
    const supportUsed = mapMeaningMatchSupport(!!result.usedHint);

    void submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: effectiveDifficulty ?? result.tier ?? difficultyLevel ?? 1,
      stimulusId: result.itemId,
      expectedResponse: null,
      userResponse: null,
      isCorrect: result.correct,
      accuracyScore: result.correct ? 1 : 0,
      cueLevel: result.usedHint ? 1 : 0,
      supportUsed,
      latencyMs: result.reactionTimeMs ?? null,
      trialMode: 'recognition',
      errorType: result.correct ? undefined : 'semantic_confusion',
      taskParameters: {
        item_id: result.itemId,
        tier: result.tier,
        type: result.type,
        used_hint: result.usedHint,
        hint_type: result.usedHint ? 'highlight_keywords' : null,
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

    if (pivot.shouldStepDown) {
      console.log('[MeaningMatch] Mid-session pivot: step down', pivot.pivotReason);
      pivot.acknowledge();
    }
  }, [
    activeSessionId,
    activeProfile?.id,
    submitTrial,
    adaptationTelemetry,
    pivot,
    difficultyLevel,
    trialLimit,
    blockIndex,
    lessonSource,
    presetId,
  ]);

  const handleGameComplete = useCallback(async (results: MeaningMatchTrialResult[]) => {
    // Unified commit: drains adaptation log buffer + flushes mastery shadow.
    // No per-game progression snapshot yet (progression: null above).
    await commitSession();

    setCompleted(true);
    completeSession();

    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      dispatchTimeoutRef.current = window.setTimeout(() => {
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
  }, [fromLesson, completeSession, commitSession, navigate, returnTo]);

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

  // Load gate: progression must load so the bridge floor is in place
  // before the game mounts. Mirrors SemanticFeatures Wave 1 gate.
  const isReady = !isCreatingSession && !!activeSessionId && progression.loaded;

  if (!isReady) {
    return <ExerciseLoading />;
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">🏟️ Meaning Match</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className="container px-4 py-2 flex-1 flex flex-col overflow-y-auto pb-16">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🏆</div>
            <h2 className="text-2xl font-bold">Arena Complete!</h2>
            <p className="text-muted-foreground">
              {fromLesson ? 'Loading next exercise…' : 'Great work matching those meanings!'}
            </p>
            {!fromLesson && (
              <Button onClick={handleContinue} size="lg">
                Continue
              </Button>
            )}
          </div>
        ) : (
          <MeaningMatchGame
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
            roundCount={trialLimit}
            difficultyLevel={effectiveDifficulty}
            sessionId={activeSessionId}
            recommendedCueType={adaptation.recommendedCueType !== 'none' ? adaptation.recommendedCueType as any : undefined}
          />
        )}
      </main>

      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
