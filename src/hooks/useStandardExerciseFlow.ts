/**
 * useStandardExerciseFlow — Tier-A bundle in one hook (Phase 1, opt-in).
 *
 * Bundles the four primitives every Tier-A game wires by hand:
 *
 *   1. useExerciseConfig       → merged clinical/runtime/capability config
 *   2. useInGameAdaptation     → real-time difficulty controller
 *   3. useTrialSubmission      → submitTrial + commitSession fan-out
 *   4. (caller-supplied) ProgressionAdapter → per-game level/progress hook
 *
 * Existing Tier-A games (PhotoNaming / FixSentence / MinimalPairs) keep
 * their bespoke wiring — this hook is for NEW migrations so the work is
 * mechanical: one call site instead of four.
 *
 * No behaviour change. No new mastery / promotion logic. Pure facade.
 *
 * Usage:
 *
 *   const flow = useStandardExerciseFlow({
 *     exerciseSlug: 'meaning_match',
 *     userId, profileId, sessionId,
 *     initialDifficulty, bounds,
 *     progression: meaningMatchProgression, // or null
 *     adaptationOverrides: { levelScale: { min: 1, max: 10 } },
 *   });
 *
 *   const { config, adaptation, submitTrial, commitSession } = flow;
 *
 * See docs/unified-trial-contract.md for the migration checklist and the
 * per-axis SupportLevel mapping rule.
 */

import { useMemo } from 'react';
import { useExerciseConfig } from '@/hooks/useExerciseConfig';
import {
  useInGameAdaptation,
  type InGameAdaptationOptions,
} from '@/hooks/useInGameAdaptation';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import type { ProgressionAdapter } from '@/hooks/useTrialSubmission';
import type { DifficultyBounds } from '@/lib/difficultyBounds';

export interface UseStandardExerciseFlowOptions {
  /** Canonical exercise slug (e.g. 'meaning_match'). */
  exerciseSlug: string;
  userId: string | null | undefined;
  profileId: string | null | undefined;
  sessionId: string | null;

  /** Initial difficulty derived from the bridge / clinical floor. */
  initialDifficulty: number;
  /** Difficulty bounds resolved via getCapabilityDifficultyBounds(). */
  bounds: DifficultyBounds;

  /** Per-game progression adapter. Pass null when none yet (e.g. MinimalPairs-style). */
  progression?: ProgressionAdapter | null;

  /** Clinical profile snapshot (forwarded to useExerciseConfig). */
  clinicalProfile?: any | null;
  /** Lesson block (forwarded so a lesson can override startDifficulty). */
  lessonBlock?: { startDifficulty?: number } | null;

  /** Optional escape hatch — override any InGameAdaptationOptions field. */
  adaptationOverrides?: Partial<
    Omit<InGameAdaptationOptions, 'exerciseSlug' | 'sessionId' | 'initialDifficulty' | 'bounds'>
  >;

  /** Forward to useTrialSubmission's debug logging. */
  debug?: boolean;
}

export function useStandardExerciseFlow(opts: UseStandardExerciseFlowOptions) {
  const {
    exerciseSlug,
    userId,
    profileId,
    sessionId,
    initialDifficulty,
    bounds,
    progression = null,
    clinicalProfile = null,
    lessonBlock = null,
    adaptationOverrides,
    debug,
  } = opts;

  // 1) Merged config (clinical + runtime + capability).
  const cfg = useExerciseConfig(
    exerciseSlug,
    userId ?? undefined,
    profileId ?? undefined,
    clinicalProfile,
    lessonBlock ?? undefined,
  );

  // 2) Real-time adaptation controller. autoLog stays at its default (true)
  //    so adaptation_trial_logs is auto-written for the migrated game.
  const adaptationOptions: InGameAdaptationOptions = useMemo(
    () => ({
      exerciseSlug,
      sessionId,
      initialDifficulty,
      bounds,
      ...(adaptationOverrides ?? {}),
    }),
    [exerciseSlug, sessionId, initialDifficulty, bounds, adaptationOverrides],
  );
  const adaptation = useInGameAdaptation(adaptationOptions);

  // 3) Unified trial submission + commitSession.
  const trial = useTrialSubmission({
    userId,
    profileId,
    sessionId,
    exerciseSlug,
    progression,
    debug,
  });

  return {
    // useExerciseConfig
    config: cfg.config,
    capabilityScores: cfg.capabilityScores,
    hasCapabilityAdaptations: cfg.hasCapabilityAdaptations,
    bounds: cfg.bounds,

    // useInGameAdaptation
    adaptation,

    // useTrialSubmission
    startTrial: trial.startTrial,
    submitTrial: trial.submitTrial,
    commitSession: trial.commitSession,
    calculateReactionTime: trial.calculateReactionTime,
  };
}

export type StandardExerciseFlow = ReturnType<typeof useStandardExerciseFlow>;
