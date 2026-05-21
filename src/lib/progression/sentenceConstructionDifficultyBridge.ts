/**
 * Sentence Construction — Clinical Level → Engine Difficulty bridge.
 *
 * The sentence-construction engine uses the universal 1–10 difficulty tier.
 * This bridge maps the persistent Clinical Level (1–8) to a FLOOR on the
 * tier the in-session engine starts from. Live session adaptation may still
 * escalate above the floor.
 *
 * Mapping rationale (see docs/clinical-evidence/sentence-construction.md):
 *   Clinical L1 → tier 1   (basic SVO + model)
 *   Clinical L2 → tier 2   (articles, model OK)
 *   Clinical L3 → tier 3   (tense + pronouns, tiles only)
 *   Clinical L4 → tier 4   (prepositions + simple conjunctions)
 *   Clinical L5 → tier 6   (compound sentences)
 *   Clinical L6 → tier 7   (relative clauses — thin bank)
 *   Clinical L7 → tier 8   (passive / complex embedding — thin bank)
 *   Clinical L8 → tier 10  (open complex — aspirational, ceiling clamp blocks)
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
