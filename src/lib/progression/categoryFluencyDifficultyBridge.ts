/**
 * Category Fluency — Clinical Level → Engine Difficulty bridge.
 *
 * The game runs a 1–5 difficulty scale: it sets the round timer from it
 * (45/35/30/25/20 s), the success threshold (3/3/5/5/7 words) and the category
 * bank via `floor((difficulty - 1) / 2)`, so difficulties 1–2 draw broad
 * concrete categories, 3–4 mid/narrow concrete, and 5 the abstract bank.
 *
 * This bridge used to emit a 1–3 tier and clamp the session input to 3, which
 * silently capped the whole exercise: the abstract bank was unreachable from
 * any clinical level, and L5, L6, L7 and L8 all produced the identical session.
 * It now speaks the scale the game actually uses.
 *
 *   Clinical L1, L2  → 1 (broad concrete, 45 s)
 *   Clinical L3, L4  → 2 (broad concrete, 35 s)
 *   Clinical L5, L6  → 3 (mid/narrow concrete, 30 s)
 *   Clinical L7, L8  → 4 (mid/narrow concrete, 25 s)
 *
 * L1–L6 keep exactly the difficulty they resolve to today; only L7/L8 move up,
 * by one step, and they were previously indistinguishable from L5. The floor
 * deliberately stops at 4: the soft-regression step subtracts one, so a floor of
 * 5 would hand a STRUGGLING patient (scaffolded 5-1 = 4) a harder session than
 * the same patient received unscaffolded before this change. Difficulty 5 —
 * the abstract bank at 20 s — remains reachable by in-session escalation, which
 * is evidence-driven, rather than being assigned up front.
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
  7: 4,
  8: 4,
};

/** Highest difficulty the game's timer / threshold / category tables define. */
export const MAX_CATEGORY_FLUENCY_DIFFICULTY = 5;

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
  // The session-adaptation tier is on a different (roughly 1–10) scale and is
  // not earned clinical evidence, so it keeps its original ceiling of 3. A
  // generated lesson block can carry a start difficulty of 5 for a brand-new
  // patient; letting that through unconverted would open Category Fluency on
  // the abstract bank at 20 s and a 7-word bar at clinical Level 1.
  const base = Math.max(1, Math.min(3, Math.round(args.sessionAdaptationDifficulty || 1)));
  const effective = Math.max(base, clinicalFloor);
  return { effective, clinicalFloor, raised: effective > base, softRegressionScaffold };
}
