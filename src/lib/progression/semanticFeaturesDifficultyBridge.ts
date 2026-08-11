/**
 * Semantic Features — Clinical Level → Engine Difficulty bridge.
 *
 * The SFA bank uses a 1–5 difficulty scale (bank-internal), distinct from
 * the generic engine's 1–10 scale. This bridge maps the persistent Clinical
 * Level (1–8) to a *floor* on the bank-difficulty value that the in-session
 * engine starts from. Live session adaptation may still escalate above the
 * floor; it just cannot start below the patient's current rehab progression.
 *
 * Mapping rationale (see docs/clinical-evidence/semantic-features.md):
 *   Clinical L1 → bank diff 1   (perceptual, chip-supported)
 *   Clinical L2 → bank diff 1   (consolidation at perceptual tier)
 *   Clinical L3 → bank diff 2   (functional features, independent)
 *   Clinical L4 → bank diff 2   (functional + categorical)
 *   Clinical L5 → bank diff 3   (categorical mixed)
 *   Clinical L6 → bank diff 3   (associative — thin bank, hold engine at 3)
 *   Clinical L7 → bank diff 4   (mixed abstract — thin)
 *   Clinical L8 → bank diff 5   (live — d5 pool expanded to 20 trials)
 *
 * Pure module — no I/O, no React.
 */

const CLINICAL_TO_BANK_FLOOR: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
  6: 3,
  7: 4,
  8: 5,
};

/** Mirror PhotoNaming's soft-regression scaffolding threshold. */
export const SOFT_REGRESSION_SCAFFOLD_THRESHOLD = 2;

export function clinicalLevelToBankFloor(
  level: number | null | undefined,
  supportBaseline: number = 0,
): number {
  if (!level || !Number.isFinite(level)) return 1;
  const clamped = Math.max(1, Math.min(8, Math.round(level)));
  const raw = CLINICAL_TO_BANK_FLOOR[clamped] ?? 1;
  if (supportBaseline >= SOFT_REGRESSION_SCAFFOLD_THRESHOLD) {
    return Math.max(1, raw - 1);
  }
  return raw;
}

export function resolveEffectiveSemanticFeaturesInitialDifficulty(args: {
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
  const clinicalFloor = clinicalLevelToBankFloor(args.clinicalLevel, supportBaseline);
  const base = Math.max(1, Math.min(5, Math.round(args.sessionAdaptationDifficulty || 1)));
  const effective = Math.max(base, clinicalFloor);
  return { effective, clinicalFloor, raised: effective > base, softRegressionScaffold };
}
