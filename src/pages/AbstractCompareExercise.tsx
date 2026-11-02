import { confirmRawEventWrites } from '@/lib/trial/confirmRawEventWrites';
import { UnverifiedPracticeBanner } from '@/components/exercise/UnverifiedPracticeBanner';
/**
 * Abstract Comparison Exercise Page — wrapper with session lifecycle.
 */
import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import React, { useCallback, useState, useRef, useEffect } from 'react';
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
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { useDynamicTier } from '@/hooks/useDynamicTier';
import { tierToLevel } from '@/lib/gameLevels';
import { useAbstractPracticeStage } from '@/hooks/useAbstractPracticeStage';
import {
  getAbstractPracticeStage, type AbstractPracticeStageLevel,
} from '@/lib/abstractCompare/trainingStages';

const EXERCISE_SLUG = 'abstract_compare';

export default function AbstractCompareExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completedScope, setCompletedScope] = useState<string | null>(null);
  const [saveErrorScope, setSaveErrorScope] = useState<string | null>(null);
  const pendingEventWritesRef = useRef<Promise<boolean>[]>([]);
  const completionStartedRef = useRef(false);
  const exerciseCompleteSentRef = useRef(false);
  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  const trialLimit = Number(location.state?.trialLimit) || 4;

  const { activeSessionId, isCreatingSession } = useStandaloneSession(user?.id, providedSessionId, EXERCISE_SLUG);

  const scope = JSON.stringify([user?.id ?? null, activeProfile?.id ?? null, activeSessionId ?? null]);
  const liveScopeRef = useRef(scope);
  liveScopeRef.current = scope;
  const practiceLoad = useAbstractPracticeStage({
    userId: user?.id, profileId: activeProfile?.id,
    offline: typeof window !== 'undefined' && localStorage.getItem('offlineMode') === 'true',
  });
  const [chosen, setChosen] = useState<{ scope: string; level: AbstractPracticeStageLevel } | null>(null);
  const [attemptedScope, setAttemptedScope] = useState<string | null>(null);
  const manuallyChosen = chosen?.scope === scope;
  const practiceStage = manuallyChosen
    ? getAbstractPracticeStage(chosen.level) : practiceLoad.stage;
  const practiceSource = manuallyChosen ? 'care_partner_selection' :
    practiceStage ? 'saved_level' : 'general_practice';

  useEffect(() => {
    // In-flight results must not contaminate the next patient's session.
    pendingEventWritesRef.current = [];
    completionStartedRef.current = false;
    exerciseCompleteSentRef.current = false;
    scoreRef.current = 0;
    trialsRef.current = 0;
    startTimeRef.current = Date.now();
  }, [scope]);

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

  const { logTrial } = useExerciseTelemetry(activeSessionId, normalizeExerciseSlug(EXERCISE_SLUG));

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'semantic_depth', fromLesson });

  const handleTrialComplete = useCallback((result: AbstractCompareTrialResult) => {
    if (!activeSessionId || liveScopeRef.current !== scope) return;
    setAttemptedScope(scope);
    const practiceScore = Math.round(result.coverageRatio * 100);

    const wasCorrect = result.coverageRatio >= 0.3;

    pivot.recordTrialResult({
      wasCorrect,
      reactionTimeMs: result.durationMs,
    });

    // Drive adaptive tier based on per-trial outcome
    if (!practiceStage) {
      dynamicTier.recordTrial({
        correct: wasCorrect,
        reactionTimeMs: result.durationMs,
        errorType: wasCorrect ? undefined : 'low_coverage',
      });
    }

    const pending = logTrial({
      correct: wasCorrect,
      reactionTimeMs: result.durationMs,
      taskParameters: {
        item_id: result.itemId, word_a: result.wordA, word_b: result.wordB,
        abstraction_level: result.abstractionLevel, trial_limit: trialLimit,
        tier: practiceStage?.contentTier ?? dynamicTier.currentTier,
        abstract_practice_stage: practiceStage?.level ?? null,
        practice_stage_source: practiceSource,
        practice_prompt: practiceStage?.prompt ?? null,
        practice_support_presented: practiceStage?.displayedSupport ?? null,
        evaluated_dimensions: ['shared_property_keyword_coverage'],
        // Difference and relational appropriateness are not validated by
        // the existing keyword scorer; never label these mastery.
        difference_accuracy: null,
        clinical_stage_promotion_eligible: false,
        independent_spoken_score_eligible: false,
        input_mode: result.inputMode ?? 'unknown',
        trial_mode: result.inputMode === 'spoken' ? 'production'
          : result.inputMode === 'typed' ? 'typed'
          : result.inputMode === 'skip' ? 'skipped' : 'unknown',
        clinical_progression_eligible: false,
        // A coverage-ratio exercise is descriptive practice, not clinical
        // speech-recognition accuracy or independent mastery.
        // Universal 1–10 GameLevel for analytics + UI consistency
        game_level: tierToLevel(practiceStage?.contentTier ?? dynamicTier.currentTier, { min: 1, max: 3 }),
        ...adaptationTelemetry,
      },
      adaptationsActive: dynamicTier.getAdaptationsActive(),
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
    pendingEventWritesRef.current.push(pending.then(saved => {
      if (saved === true && liveScopeRef.current === scope) {
        scoreRef.current += practiceScore;
        trialsRef.current += 1;
      }
      return saved;
    }));
  }, [activeSessionId, logTrial, trialLimit, adaptationTelemetry, dynamicTier, pivot, scope, practiceStage, practiceSource]);

  const handleGameComplete = useCallback(async (results: AbstractCompareTrialResult[]) => {
    if (completionStartedRef.current) return;
    completionStartedRef.current = true;
    const saved = await confirmRawEventWrites(
      pendingEventWritesRef.current.splice(0),
      results.length,
    );
    if (liveScopeRef.current !== scope) return;
    if (!saved.ok) {
      console.warn('[AbstractCompare] Session has incomplete raw clinical events', saved);
      setSaveErrorScope(scope);
      return;
    }
    await completeSession();
    if (liveScopeRef.current !== scope) return;
    setCompletedScope(scope);
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', { detail: { exerciseSlug: EXERCISE_SLUG, results } }));
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    }
  }, [fromLesson, completeSession, scope, navigate, returnTo]);

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
  const handleContinue = useCallback(() => {
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      window.dispatchEvent(new CustomEvent('exercise-complete', { detail: { exerciseSlug: EXERCISE_SLUG } }));
    } else if (!fromLesson) navigate('/today');
  }, [fromLesson, navigate]);

  if (isCreatingSession || !activeSessionId || !practiceLoad.loaded) {
    return <ExerciseLoading />;
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
        {saveErrorScope === scope ? (
          <UnverifiedPracticeBanner />
        ) : completedScope === scope ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🔗</div>
            <h2 className="text-2xl font-bold">Comparisons Complete!</h2>
            <p className="text-muted-foreground">
              {fromLesson ? 'Loading next exercise…' : 'Great abstract thinking!'}
            </p>
            {!fromLesson && <Button onClick={handleContinue} size="lg">Continue</Button>}
          </div>
        ) : (
          <>
            {!fromLesson && attemptedScope !== scope && (
              <details className="mx-auto max-w-lg rounded-lg border p-3 mb-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Care partner: choose comparison practice
                </summary>
                {practiceStage ? (
                  <p className="mt-2 text-muted-foreground">
                    Practice Stage {practiceStage.level}: {practiceStage.label}.
                    This is supported practice, not a clinical promotion.
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground" role="status">
                    {practiceLoad.unavailable
                      ? 'Your saved level could not be checked. General practice remains available.'
                      : 'The saved level is unavailable as a staged practice format. General practice remains available.'}
                  </p>
                )}
                <div className="flex flex-col gap-2 mt-3">
                  {([1, 2, 3, 4, 5, 6, 7, 8] as const).map(level => {
                    const stage = getAbstractPracticeStage(level);
                    return (
                      <Button
                        key={level}
                        size="sm"
                        type="button"
                        aria-pressed={practiceStage?.level === level}
                        variant={practiceStage?.level === level ? 'default' : 'outline'}
                        onClick={() => setChosen({ scope, level })}
                      >
                        Stage {level}: {stage?.label}
                      </Button>
                    );
                  })}
                </div>
              </details>
            )}
            <AbstractCompareGame
              key={scope + ':' + (practiceStage?.level ?? 'general')}
              onTrialComplete={handleTrialComplete}
              onGameComplete={handleGameComplete}
              roundCount={trialLimit}
              tier={practiceStage?.contentTier ?? dynamicTier.currentTier}
              trainingStage={practiceStage}
              onAttemptStart={() => setAttemptedScope(scope)}
              userId={user?.id}
              sessionId={activeSessionId}
              autoStart={fromLesson}
            />
          </>
        )}
      </main>
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
