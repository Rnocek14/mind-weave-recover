/**
 * useDynamicTier — Page-level adaptive tier controller for exercises that
 * pass a static `tier`/`difficultyLevel` prop into their game component.
 *
 * Wraps `useInGameAdaptation` and exposes a clamped integer tier (1..maxTier)
 * suitable for content-pool selection (e.g. AbstractCompare, MeaningMatch,
 * SentenceConstruction, MinimalPairs, etc.).
 *
 * Why a separate hook?
 *  - Many existing games take a static `tier` prop and re-derive their pool
 *    via useMemo on that tier. Driving the tier dynamically from this hook
 *    keeps the game components untouched while restoring real adaptiveness.
 *  - Centralises the "successRate -> tier change" mapping so all unwired
 *    exercises adapt with consistent thresholds.
 *
 * Telemetry contract: caller should pass `currentTier` into `task_parameters`
 * AND into `adaptations_active.difficulty` so audits can verify motion.
 */
import { useCallback, useMemo } from 'react';
import { useInGameAdaptation, type FrustrationLevel } from '@/hooks/useInGameAdaptation';
import { getCapabilityDifficultyBounds } from '@/lib/difficultyBounds';
import { useExerciseGating } from '@/hooks/useExerciseGating';

export interface UseDynamicTierOptions {
  exerciseSlug: string;
  sessionId: string | null;
  userId?: string;
  profileId?: string;
  /** Initial tier from session adaptation layer (1..maxTier). */
  initialTier?: number;
  /** Hard ceiling for the tier (e.g. AbstractCompare has 3 tiers). */
  maxTier?: number;
  /** Hard floor (default 1). */
  minTier?: number;
  /** Rolling window for success rate. */
  windowSize?: number;
  /** Target success rate (0-1). Default 0.75. */
  targetSuccessRate?: number;
  /** ± window around target before adjusting. Default 0.10. */
  adjustmentThreshold?: number;
}

export interface UseDynamicTierReturn {
  /** Current adaptive tier, clamped to [minTier, maxTier]. */
  currentTier: number;
  /** Underlying continuous difficulty (1..10) for telemetry. */
  rawDifficulty: number;
  /** Recent rolling success rate (0..1). */
  recentSuccessRate: number;
  /** Detected frustration level. */
  frustrationLevel: FrustrationLevel;
  /** Number of consecutive errors. */
  consecutiveErrors: number;
  /** Total trials recorded. */
  trialCount: number;
  /** Record a trial outcome — drives tier adjustment. */
  recordTrial: (result: { correct: boolean; reactionTimeMs?: number; errorType?: string }) => void;
  /** Telemetry payload to merge into `adaptations_active`. */
  getAdaptationsActive: () => Record<string, unknown>;
}

/**
 * Convert continuous difficulty (1..10) into a tier in [minTier, maxTier].
 * Linear mapping with rounding — keeps tier stable across small swings.
 */
function difficultyToTier(diff: number, minTier: number, maxTier: number): number {
  if (maxTier <= minTier) return minTier;
  // 1..10 -> minTier..maxTier
  const normalized = (Math.max(1, Math.min(10, diff)) - 1) / 9;
  const t = Math.round(minTier + normalized * (maxTier - minTier));
  return Math.max(minTier, Math.min(maxTier, t));
}

export function useDynamicTier(opts: UseDynamicTierOptions): UseDynamicTierReturn {
  const {
    exerciseSlug,
    sessionId,
    userId,
    profileId,
    initialTier = 1,
    maxTier = 3,
    minTier = 1,
    windowSize = 5,
    targetSuccessRate = 0.75,
    adjustmentThreshold = 0.10,
  } = opts;

  const { capabilityScores } = useExerciseGating(userId, profileId);

  // Capability bounds clamp the *underlying* difficulty (1..10).
  // We translate into the game-specific tier afterwards.
  const bounds = useMemo(
    () => getCapabilityDifficultyBounds(exerciseSlug, capabilityScores),
    [exerciseSlug, capabilityScores]
  );

  // Convert initial tier (1..maxTier) back to underlying difficulty (1..10)
  const initialDifficulty = useMemo(() => {
    if (maxTier <= minTier) return bounds.suggestedStart;
    const normalized = (Math.max(minTier, Math.min(maxTier, initialTier)) - minTier) /
      (maxTier - minTier);
    const diff = Math.round(1 + normalized * 9);
    return Math.max(bounds.floor, Math.min(bounds.ceiling, diff));
  }, [initialTier, minTier, maxTier, bounds]);

  const adaptation = useInGameAdaptation({
    exerciseSlug,
    sessionId,
    initialDifficulty,
    bounds,
    windowSize,
    targetSuccessRate,
    adjustmentThreshold,
    enableDifficultyAutoStepDown: true,
    enableDifficultyToasts: false, // tier games already show feedback per trial
    enableAutoHints: false,
    enableInterventionUI: false,
  });

  const currentTier = useMemo(
    () => difficultyToTier(adaptation.currentDifficulty, minTier, maxTier),
    [adaptation.currentDifficulty, minTier, maxTier]
  );

  const recordTrial = useCallback(
    (r: { correct: boolean; reactionTimeMs?: number; errorType?: string }) => {
      adaptation.recordTrial({
        correct: r.correct,
        reactionTimeMs: r.reactionTimeMs,
        errorType: r.errorType,
      });
    },
    [adaptation]
  );

  const getAdaptationsActive = useCallback(
    () => ({
      difficulty: adaptation.currentDifficulty,
      tier: currentTier,
      success_rate: adaptation.recentSuccessRate,
      frustration: adaptation.frustrationLevel,
      consecutive_errors: adaptation.consecutiveErrors,
      trial_count: adaptation.trialCount,
      window_size: windowSize,
      target_success_rate: targetSuccessRate,
      bounds,
      controller: 'useDynamicTier',
    }),
    [
      adaptation.currentDifficulty,
      adaptation.recentSuccessRate,
      adaptation.frustrationLevel,
      adaptation.consecutiveErrors,
      adaptation.trialCount,
      currentTier,
      windowSize,
      targetSuccessRate,
      bounds,
    ]
  );

  return {
    currentTier,
    rawDifficulty: adaptation.currentDifficulty,
    recentSuccessRate: adaptation.recentSuccessRate,
    frustrationLevel: adaptation.frustrationLevel,
    consecutiveErrors: adaptation.consecutiveErrors,
    trialCount: adaptation.trialCount,
    recordTrial,
    getAdaptationsActive,
  };
}
