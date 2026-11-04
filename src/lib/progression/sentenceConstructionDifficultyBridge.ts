/**
 * Sentence Construction — Clinical Level → Engine Difficulty bridge.
 *
 * The sentence-construction engine uses the universal 1–10 difficulty tier.
 * This bridge maps the persistent Clinical Level (1–8) to a FLOOR on the
 * tier the in-session engine starts from. Live session adaptation may still
 * escalate above the floor.
 *
 * Clinical level selects the authoritative grammar cohort. This bridge
 * supplies an engine display/start floor, NOT an unconstrained content selector.
 * L1→1 SVO, L2→2 expanded SVO, L3→3 agreement, L4→4 tense/word order,
 * L5→6 coordinating, L6→7 subordinating, L7→8 relatives,
 * L8→9 multi-clause/passive. Upper content at L8 may use bank 9–10.
 *
 * Soft-regression scaffolding mirrors PhotoNaming/FixSentence/SemanticFeatures.
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

export function resolveEffectiveSentenceConstructionInitialDifficulty(args: {
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
