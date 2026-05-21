/**
 * Category Fluency — Clinical Level → Engine Difficulty bridge.
 *
 * Category Fluency's in-game engine uses a 1–3 internal tier (the universal
 * GameLevel 1–10 is derived via `tierToLevel`, not the inverse). This
 * bridge maps the persistent Clinical Level (1–8) to a FLOOR on the
 * internal 1–3 tier.
 *
 *   Clinical L1, L2 → tier 1 (broad concrete)
 *   Clinical L3, L4 → tier 2 (mid/narrow concrete)
 *   Clinical L5–L8  → tier 3 (abstract / pressure)
 *
 * Soft-regression scaffolding mirrors PhotoNaming/FixSentence: when
 * supportBaseline ≥ threshold, lower the floor by 1 (clamped to 1).
 *
 * Pure module — no I/O, no React.
 */

const CLINICAL_TO_TIER_FLOOR: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
  6: 3,
  7: 3,
  8: 3,
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

export function resolveEffectiveCategoryFluencyInitialDifficulty(args: {
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
  const base = Math.max(1, Math.min(3, Math.round(args.sessionAdaptationDifficulty || 1)));
  const effective = Math.max(base, clinicalFloor);
  return { effective, clinicalFloor, raised: effective > base, softRegressionScaffold };
}
