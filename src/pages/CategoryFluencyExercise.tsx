/**
 * Category Fluency Exercise Page
 * 
 * "Name as many [category] as you can" with adaptive difficulty
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CategoryFluencyGame, type CategoryFluencyResult } from '@/components/CategoryFluencyGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import { tierToLevel } from '@/lib/gameLevels';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { saveExerciseDetails } from '@/lib/exerciseDetailsStore';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import {
  useCategoryFluencyProgression,
  mapCategoryFluencySupport,
} from '@/hooks/useCategoryFluencyProgression';
import {
  resolveEffectiveCategoryFluencyInitialDifficulty,
} from '@/lib/progression/categoryFluencyDifficultyBridge';
import { getCategoryFluencyLevelSpec } from '@/lib/progression/categoryFluencyLevels';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';

const EXERCISE_SLUG = 'category_fluency';

export default function CategoryFluencyExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);
  const exerciseCompleteSentRef = useRef(false);
  const dispatchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (dispatchTimeoutRef.current) clearTimeout(dispatchTimeoutRef.current); };
  }, []);

  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;
  const roundCount = Number(location.state?.trialLimit) || 3;
  const blockIndex = location.state?.blockIndex ?? null;
  const lessonAdaptations = restored.adaptations;

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

  // Wave 1: migrated from useExerciseTelemetry.logTrial to the unified
  // useTrialSubmission pathway with per-game progression. Emits
  // trialMode='production' on every round (slug is in
  // ADOPTED_TRIAL_MODE_SLUGS). CategoryFluencyGame is autoLog:false.
  const progression = useCategoryFluencyProgression({
    userId: user?.id,
    profileId: activeProfile?.id,
  });
  const bridge = resolveEffectiveCategoryFluencyInitialDifficulty({
    sessionAdaptationDifficulty: difficultyLevel,
    clinicalLevel: progression.startingLevel,
    supportBaseline: progression.state?.supportBaseline ?? 0,
  });
  if (import.meta.env.DEV && bridge.softRegressionScaffold) {
    console.log(
      `[SoftRegression] CategoryFluency scaffolding active — supportBaseline=${progression.state?.supportBaseline} ` +
        `lowered floor by 1 (clinicalLevel=${progression.startingLevel}, floor=${bridge.clinicalFloor}, effective=${bridge.effective})`,
    );
  }
  const effectiveTier = bridge.effective;

  const { submitTrial, commitSession } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    progression,
  });

  const pivot = useExerciseMidSessionPivot({
    exerciseSlug: EXERCISE_SLUG,
    domainSlug: 'lexical_retrieval',
    fromLesson,
  });

  const handleDifficultyChange = useCallback((newLevel: number, direction: 'up' | 'down') => {
    console.log(`[CategoryFluency] Adaptive difficulty ${direction}: now level ${newLevel}`);
  }, []);

  const handleRoundComplete = useCallback((result: CategoryFluencyResult) => {
    if (!activeSessionId) return;
    trialsRef.current += 1;
    scoreRef.current += result.uniqueWordCount;

    // Rung-aware correctness: uniqueWordCount >= rung's minUniqueWords.
    const clinicalLevel = progression.startingLevel ?? 1;
    const rungSpec = getCategoryFluencyLevelSpec(clinicalLevel);
    const isCorrect = result.uniqueWordCount >= rungSpec.minUniqueWords;

    pivot.recordTrialResult({
      wasCorrect: isCorrect,
      reactionTimeMs: result.durationSec * 1000,
    });

    let errorType: string | undefined;
    if (!isCorrect) {
      if (result.uniqueWordCount === 0) errorType = 'no_response';
      else if (result.uniqueWordCount === 1) errorType = 'single_item';
      else errorType = 'low_fluency';
    }

    // CategoryFluency does not currently surface a sub-prompt scaffold per
    // round; treat all rounds as `independent` for support until a
    // sub-prompt feature ships. Keeps support mapping honest.
    const supportUsed = mapCategoryFluencySupport(false);

    void submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: effectiveTier ?? result.difficulty ?? 1,
      stimulusId: result.category ?? `cf_round_${trialsRef.current}`,
      expectedResponse: null,
      userResponse: Array.isArray(result.words) ? result.words.join(', ') : null,
      isCorrect,
      accuracyScore: isCorrect ? 1 : Math.min(1, result.uniqueWordCount / Math.max(1, rungSpec.minUniqueWords)),
      cueLevel: 0,
      supportUsed,
      latencyMs: result.durationSec * 1000,
      trialMode: 'production',
      errorType,
      taskParameters: {
        category: result.category,
        unique_words: result.uniqueWordCount,
        words_per_second: Math.round(result.wordsPerSecond * 100) / 100,
        time_limit: result.timeLimitSec,
        words: result.words,
        difficulty: result.difficulty,
        game_level: typeof result.difficulty === 'number'
          ? tierToLevel(result.difficulty, { min: 1, max: 3 })
          : null,
        difficulty_changed: result.difficultyChanged ?? null,
        pivot_pending: pivot.hasPending,
        clinical_level: clinicalLevel,
        clinical_floor: bridge.clinicalFloor,
        min_unique_words_rung: rungSpec.minUniqueWords,
        ...adaptationTelemetry,
      },
    });

    if (pivot.shouldStepDown) {
      console.log('[CategoryFluency] Pivot: step down', pivot.pivotReason);
      pivot.acknowledge();
    }
  }, [activeSessionId, activeProfile?.id, submitTrial, adaptationTelemetry, pivot, progression.startingLevel, bridge.clinicalFloor, effectiveTier]);

  const handleGameComplete = useCallback(async (results: CategoryFluencyResult[]) => {
    // Unified commit: flushes mastery shadow + per-game progression ladder.
    await commitSession();
    completeSession();

    // Save structured details for reflection engine
    if (blockIndex != null) {
      const totalWords = results.reduce((sum, r) => sum + r.uniqueWordCount, 0);
      const lastAnalysis = results[results.length - 1]?.analysis;
      saveExerciseDetails(blockIndex, 'category-fluency', {
        totalWords,
        clusters: lastAnalysis?.clusterCount ?? 0,
        switches: lastAnalysis?.switchCount ?? 0,
      });
    }

    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      
      const totalScore = results.reduce((sum, r) => sum + r.uniqueWordCount, 0);
      const maxPossible = results.length * 10; // rough max
      const score = maxPossible > 0 ? Math.min(totalScore / maxPossible, 1) : 0;
      const allWords = results.flatMap(r => r.words).slice(0, 10);
      
      // Store results for SmartCoach to read on restore (avoids event race condition)
      sessionStorage.setItem('smartCoachExerciseResult', JSON.stringify({
        exerciseSlug: EXERCISE_SLUG,
        score,
        accuracy: score,
        targetWords: allWords,
        difficultyReached: results[results.length - 1]?.difficulty ?? 1,
      }));
      
      dispatchTimeoutRef.current = window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', {
          detail: {
            exerciseSlug: EXERCISE_SLUG,
            results,
            score,
            targetWords: allWords,
            totalScore,
          }
        }));
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    } else {
      // Standalone mode: mark completed so the game summary stays visible with onFinish
      setCompleted(true);
    }
  }, [fromLesson, completeSession, commitSession, navigate, returnTo, blockIndex]);

  const handleFinish = useCallback(() => {
    navigate('/today');
  }, [navigate]);

  const handleBack = useCallback(() => {
    navigate(fromLesson ? returnTo : '/dashboard');
  }, [navigate, fromLesson]);

  // Load gate: progression must load so the bridge floor + rung-aware
  // correctness threshold are in place before the game mounts.
  const isReady = !isCreatingSession && !!activeSessionId && progression.loaded;

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading exercise...</div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">🐾 Category Fluency</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className="container px-4 py-2 flex-1 min-h-0 overflow-hidden flex flex-col">
          <CategoryFluencyGame
            difficulty={difficultyLevel}
            onRoundComplete={handleRoundComplete}
            onGameComplete={handleGameComplete}
            onDifficultyChange={handleDifficultyChange}
            onFinish={!fromLesson ? handleFinish : undefined}
            roundCount={roundCount}
            autoStartFirst={fromLesson}
            userId={user?.id}
            sessionId={activeSessionId}
          />
      </main>

      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
