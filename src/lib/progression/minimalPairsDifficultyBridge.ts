/**
 * Minimal Pairs — Clinical Level → Engine Difficulty bridge.
 *
 * Persistent Clinical Level (1–8) supplies a *floor* for the in-session
 * engine difficulty (1–10). Session adaptation is still free to escalate
 * above this floor. Mirrors the PhotoNaming / FixSentence bridge contract.
 *
 * Bank tier collapse (`mapEngineLevelToMinimalPairsTier`):
 *   engine 1–3  → Tier 1 (distinct contrasts)
 *   engine 4–7  → Tier 2 (single-feature contrasts)
 *   engine 8–10 → Tier 3 (fast / similar — aspirational)
 *
 * Clinical floor mapping (must cross those tier breakpoints):
 *   Clinical L1 → engine 1
 *   Clinical L2 → engine 2
 *   Clinical L3 → engine 3   (Tier 1 ceiling)
 *   Clinical L4 → engine 4   (Tier 2 floor)
 *   Clinical L5 → engine 5
 *   Clinical L6 → engine 6
 *   Clinical L7 → engine 7   (Tier 2 ceiling)
 *   Clinical L8 → engine 8   (Tier 3 — aspirational)
 *
 * Soft regression: when `supportBaseline >= 2` the floor drops by 1 engine
 * step (clamped to 1) so a struggling patient lands in an easier tier on
 * their next session without a formal level demotion. Same threshold as
 * PhotoNaming/FixSentence — see `mem://features/soft-regression-scaffolding`.
 *
 * Pure module — no I/O, no React.
 */

const CLINICAL_TO_ENGINE_FLOOR: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
};

export const MINIMAL_PAIRS_SOFT_REGRESSION_SCAFFOLD_THRESHOLD = 2;

export function clinicalLevelToMinimalPairsEngineFloor(
  level: number | null | undefined,
  supportBaseline: number = 0,
): number {
  if (!level || !Number.isFinite(level)) return 1;
  const clamped = Math.max(1, Math.min(8, Math.round(level)));
  const raw = CLINICAL_TO_ENGINE_FLOOR[clamped] ?? 1;
  if (supportBaseline >= MINIMAL_PAIRS_SOFT_REGRESSION_SCAFFOLD_THRESHOLD) {
    return Math.max(1, raw - 1);
  }
  return raw;
}

export function resolveEffectiveMinimalPairsInitialDifficulty(args: {
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
    supportBaseline >= MINIMAL_PAIRS_SOFT_REGRESSION_SCAFFOLD_THRESHOLD;
  const clinicalFloor = clinicalLevelToMinimalPairsEngineFloor(
    args.clinicalLevel,
    supportBaseline,
  );
  const base = Math.max(
    1,
    Math.min(10, Math.round(args.sessionAdaptationDifficulty || 1)),
  );
  const effective = Math.max(base, clinicalFloor);
  return { effective, clinicalFloor, raised: effective > base, softRegressionScaffold };
}
