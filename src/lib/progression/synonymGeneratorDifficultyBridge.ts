/**
 * Synonym Generator — Clinical Level → Engine Difficulty bridge.
 *
 * The synonym-generator engine uses the universal 1–10 difficulty tier
 * (which `mapEngineLevelToSynonymTier` collapses to bank tiers 1–3).
 * This bridge maps the persistent Clinical Level (1–8) to a FLOOR on the
 * tier the in-session engine starts from. Live session adaptation may still
 * escalate above the floor.
 *
 * Mapping rationale (see docs/clinical-evidence/synonym-generator.md):
 *   Clinical L1 → tier 1   (concrete common, light bar)
 *   Clinical L2 → tier 2   (concrete common, full coverage)
 *   Clinical L3 → tier 3   (concrete extended — bank tier 1 boundary)
 *   Clinical L4 → tier 4   (mixed-frequency — bank tier 2)
 *   Clinical L5 → tier 6   (mixed-frequency, sustained productivity)
 *   Clinical L6 → tier 7   (abstract mid-frequency — thin bank)
 *   Clinical L7 → tier 8   (abstract low-frequency — bank tier 3, thin)
 *   Clinical L8 → tier 10  (constrained-output aspirational; ceiling clamp)
 *
 * Soft-regression scaffolding mirrors PhotoNaming/FixSentence/SemanticFeatures/
 * SentenceConstruction/MultiStepPlanning.
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
  8: 10,
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

export function resolveEffectiveSynonymGeneratorInitialDifficulty(args: {
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
