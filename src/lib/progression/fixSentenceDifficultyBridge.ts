/**
 * Fix the Sentence — Clinical Level → Engine Difficulty bridge.
 *
 * Persistent Clinical Level (1–8) supplies a *floor* for the in-session
 * engine difficulty (1–10). Session adaptation is still free to escalate
 * above this floor based on live performance; it just cannot start *below*
 * the patient's current rehab progression.
 *
 * The bank's tier collapse (`toFixSentenceTier`) is:
 *   engine 1–3  → Tier 1 (obvious category violations)
 *   engine 4–7  → Tier 2 (within-category semantic swaps)
 *   engine 8–10 → Tier 3 (function-mismatch / multi-valid)
 *
 * Clinical floor mapping (must cross those tier breakpoints):
 *   Clinical L1 → engine 1   (Tier 1)
 *   Clinical L2 → engine 2   (Tier 1)
 *   Clinical L3 → engine 3   (Tier 1 ceiling — last semantic-swap-light bin)
 *   Clinical L4 → engine 4   (Tier 2 — push past Tier 1)
 *   Clinical L5 → engine 6   (Tier 2)
 *   Clinical L6 → engine 7   (Tier 2 ceiling)
 *   Clinical L7 → engine 8   (Tier 3 — function errors unlock)
 *   Clinical L8 → engine 9   (Tier 3)
 *
 * Pure module — no I/O, no React.
 */

const CLINICAL_TO_ENGINE_FLOOR: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
};

/**
 * Soft-regression scaffolding threshold. When `supportBaseline` reaches this
 * value, the bridge lowers the clinical floor by one engine step so the
 * patient starts the next session in an easier tier without a formal level
 * demotion. Decays back to 0 on success sessions inside `applySessionToState`.
 */
export const FIX_SENTENCE_SOFT_REGRESSION_SCAFFOLD_THRESHOLD = 2;

export function clinicalLevelToFixSentenceEngineFloor(
  level: number | null | undefined,
  supportBaseline: number = 0,
): number {
  if (!level || !Number.isFinite(level)) return 1;
  const clamped = Math.max(1, Math.min(8, Math.round(level)));
  const raw = CLINICAL_TO_ENGINE_FLOOR[clamped] ?? 1;
  if (supportBaseline >= FIX_SENTENCE_SOFT_REGRESSION_SCAFFOLD_THRESHOLD) {
    return Math.max(1, raw - 1);
  }
  return raw;
}

export function resolveEffectiveFixSentenceInitialDifficulty(args: {
  sessionAdaptationDifficulty: number;
  clinicalLevel: number | null | undefined;
  /** Optional soft-regression signal from clinical_progression_state. */
  supportBaseline?: number;
}): {
  effective: number;
  clinicalFloor: number;
  raised: boolean;
  softRegressionScaffold: boolean;
} {
  const supportBaseline = args.supportBaseline ?? 0;
  const softRegressionScaffold =
    supportBaseline >= FIX_SENTENCE_SOFT_REGRESSION_SCAFFOLD_THRESHOLD;
  const clinicalFloor = clinicalLevelToFixSentenceEngineFloor(
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
