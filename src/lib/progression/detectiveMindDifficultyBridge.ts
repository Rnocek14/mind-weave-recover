/**
 * Detective Mind — Clinical Level → Engine Difficulty bridge.
 *
 * The Detective Mind in-game adapter uses the universal 1–10 difficulty
 * tier (collapsed to 3 content tiers via `levelToTier`). This bridge maps
 * the persistent Clinical Level (1–8) to a FLOOR on the engine tier; live
 * session adaptation may still escalate above the floor.
 *
 * Mapping rationale (see docs/clinical-evidence/detective-mind.md):
 *   Clinical L1 → tier 1   (factual short, hint OK)
 *   Clinical L2 → tier 2   (factual extended, hint OK)
 *   Clinical L3 → tier 3   (factual, no hint)
 *   Clinical L4 → tier 4   (simple inferential)
 *   Clinical L5 → tier 6   (mixed inferential)
 *   Clinical L6 → tier 7   (multi-step inference — thin)
 *   Clinical L7 → tier 8   (multi-step inference — thin)
 *   Clinical L8 → tier 9   (novel/abstract aspirational; ceiling clamp blocks)
 *
 * Soft-regression scaffolding mirrors MeaningMatch / PhotoNaming / FixSentence.
 *
 * Pure module — no I/O, no React.
 */

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

export function resolveEffectiveDetectiveMindInitialDifficulty(args: {
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
