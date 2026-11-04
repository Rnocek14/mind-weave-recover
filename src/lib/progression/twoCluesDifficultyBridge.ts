/**
 * Two Clues — Clinical Level → Engine Difficulty bridge.
 *
 * Two Clues uses the universal 1–10 difficulty tier. The bridge maps the
 * persistent Clinical Level (1–8) to a FLOOR on that tier; live session
 * adaptation may still escalate above the floor.
 *
 * Soft-regression scaffolding mirrors PhotoNaming/FixSentence.
 *
 * Pure module — no I/O, no React.
 */

import { getTwoCluesLevelSpec } from './twoCluesLevels';

const CLINICAL_TO_TIER_FLOOR: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
};

export const SOFT_REGRESSION_SCAFFOLD_THRESHOLD = 2;

export function clinicalLevelToTierFloor(
  level: number | null | undefined,
  supportBaseline: number = 0,
): number {
  if (!level || !Number.isFinite(level)) return 1;
  const clamped = Math.max(1, Math.min(8, Math.round(level)));
  const raw = CLINICAL_TO_TIER_FLOOR[clamped] ?? 1;
  if (supportBaseline >= SOFT_REGRESSION_SCAFFOLD_THRESHOLD) {
    return Math.max(1, raw - 1);
  }
  return raw;
}

export function resolveEffectiveTwoCluesInitialDifficulty(args: {
  sessionAdaptationDifficulty: number;
  clinicalLevel: number | null | undefined;
  supportBaseline?: number;
}): {
  effective: number;
  clinicalFloor: number;
  raised: boolean;
  softRegressionScaffold: boolean;
} {
  const supportBaseline = args.supportBaseline ?? 0;
  const softRegressionScaffold =
    supportBaseline >= SOFT_REGRESSION_SCAFFOLD_THRESHOLD;
  const clinicalFloor = clinicalLevelToTierFloor(args.clinicalLevel, supportBaseline);
  const base = Math.max(1, Math.min(10, Math.round(args.sessionAdaptationDifficulty || 1)));
  const effective = Math.max(base, clinicalFloor);
  return { effective, clinicalFloor, raised: effective > base, softRegressionScaffold };
}

/**
 * Select the ACTUAL 1–3 puzzle bank from the saved 1–8 clinical level.
 * This is separate from the 1–10 adaptation engine. Previously TwoCluesGame
 * never passed any bank difficulty, so L1 could randomly see L7 abstract
 * prompts such as "keeps / secret". Follow the existing clinical content
 * selector rather than adding time pressure or changing the mastery ladder.
 */
export function twoCluesBankDifficultyForClinicalLevel(
  level: number | null | undefined,
): 1 | 2 | 3 {
  const normalizedLevel = typeof level === 'number' && Number.isFinite(level)
    ? Math.max(1, Math.min(8, Math.round(level)))
    : 1;
  switch (getTwoCluesLevelSpec(normalizedLevel).contentSelector?.tierKey) {
    case 'high_freq_concrete':
      return 1;
    case 'concrete_general':
    case 'mixed_semantic':
      return 2;
    case 'abstract_introduced':
    case 'low_freq_concrete':
    case 'abstract_pressure':
    case 'figurative':
      return 3;
    default:
      // Unknown future spec should never force abstract material on a patient.
      return 1;
  }
}
