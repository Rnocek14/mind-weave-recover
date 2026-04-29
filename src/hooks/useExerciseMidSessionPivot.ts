/**
 * useExerciseMidSessionPivot — Standardized mid-session pivot integration for exercises.
 * 
 * Wraps useMidSessionPivot with exercise-specific wiring:
 * - Converts exercise trial results to RecentTrialData
 * - Provides a handlePivotResponse() callback for exercises to act on recommendations
 * - Returns simple flags exercises can check after each trial
 * 
 * Usage:
 *   const pivot = useExerciseMidSessionPivot({ exerciseSlug, domainSlug, fromLesson, domainScores });
 *   // After each trial:
 *   pivot.recordTrialResult({ wasCorrect, reactionTimeMs, wasTimeout, cueLevel });
 *   // Check:
 *   if (pivot.shouldStepDown) { reduceDifficulty(); pivot.acknowledge(); }
 *   if (pivot.shouldRest)     { showBreakPrompt(); pivot.acknowledge(); }
 */

import { useCallback, useMemo } from 'react';
import { useMidSessionPivot } from '@/hooks/useMidSessionPivot';
import type { RecentTrialData, PivotRecommendation } from '@/lib/midSessionPivot';
import type { DomainScore } from '@/lib/cognitiveStateEngine';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

interface UseExerciseMidSessionPivotOptions {
  exerciseSlug: string;
  domainSlug: string;
  /** Only active during lesson flow */
  fromLesson?: boolean;
  /** Enable even outside lesson flow (override) */
  forceEnabled?: boolean;
  domainScores?: DomainScore[];
}

interface TrialResult {
  wasCorrect: boolean;
  reactionTimeMs: number | null;
  wasTimeout?: boolean;
  cueLevel?: number;
}

interface UseExerciseMidSessionPivotResult {
  /** Record a trial — call after each trial completes */
  recordTrialResult: (trial: TrialResult) => void;
  /** Whether pivot recommends stepping down difficulty */
  shouldStepDown: boolean;
  /** Whether pivot recommends a rest/break */
  shouldRest: boolean;
  /** Whether pivot recommends switching domains */
  shouldSwitchDomain: boolean;
  /** Suggested difficulty delta (negative = easier) */
  suggestedDifficultyDelta: number;
  /** Suggested domain to switch to */
  suggestedDomain: string | undefined;
  /** Full recommendation object for advanced use */
  recommendation: PivotRecommendation | null;
  /** Acknowledge and clear the pivot recommendation */
  acknowledge: () => void;
  /** Whether a pivot action is pending */
  hasPending: boolean;
  /** Pivot reason string for telemetry */
  pivotReason: string | null;
}

export function useExerciseMidSessionPivot(
  options: UseExerciseMidSessionPivotOptions
): UseExerciseMidSessionPivotResult {
  const { exerciseSlug: rawExerciseSlug, domainSlug, fromLesson = false, forceEnabled = false, domainScores } = options;
  const exerciseSlug = normalizeExerciseSlug(rawExerciseSlug);

  const {
    pivotRecommendation,
    recordTrial,
    acknowledgePivot,
    hasPendingPivot,
  } = useMidSessionPivot({
    enabled: fromLesson || forceEnabled,
    currentDomainSlug: domainSlug,
    domainScores,
  });

  const recordTrialResult = useCallback((trial: TrialResult) => {
    const trialData: RecentTrialData = {
      wasCorrect: trial.wasCorrect,
      reactionTimeMs: trial.reactionTimeMs,
      wasTimeout: trial.wasTimeout ?? false,
      cueLevel: trial.cueLevel ?? 0,
      exerciseSlug,
      domainSlug,
    };
    recordTrial(trialData);
  }, [recordTrial, exerciseSlug, domainSlug]);

  const derived = useMemo(() => {
    const rec = pivotRecommendation;
    return {
      shouldStepDown: rec?.action === 'step_down',
      shouldRest: rec?.action === 'rest_prompt',
      shouldSwitchDomain: rec?.action === 'switch_to_strength',
      suggestedDifficultyDelta: rec?.suggestedDifficultyDelta ?? 0,
      suggestedDomain: rec?.suggestedDomain,
      pivotReason: rec?.reason ?? null,
    };
  }, [pivotRecommendation]);

  return {
    recordTrialResult,
    ...derived,
    recommendation: pivotRecommendation,
    acknowledge: acknowledgePivot,
    hasPending: hasPendingPivot,
  };
}
