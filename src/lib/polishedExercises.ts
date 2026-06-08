/**
 * Polished Exercise Allowlist
 *
 * Single source of truth for which games are clinically QA'd and approved
 * for auto-inclusion in daily sessions.
 *
 * Unpolished games remain accessible via the manual picker / dev routes,
 * but the daily lesson engine (and presets) MUST NOT auto-select them.
 *
 * Step 8 baseline (2026-05): the "polished 7".
 * Promotions are added one at a time after dedicated QA.
 */

export const POLISHED_EXERCISES = [
  'photo-naming',
  'two-clues',
  'describe-guess',
  'detective-mind',
  'narrative-retell',
  'category-fluency',
  'thought-continuation',
  // Step 9 — promoted (phonology coverage). Discrimination + optional 'Say it' echo.
  'minimal-pairs',
  // Step 10 — promoted (anchor grammar game). Registered, playable, progression-
  // wired, 90-item bank across 3 content tiers mapping engine L1–L10. L5–L8 special
  // cohorts are still thin (tier-collapse covers them), so it is eligible for daily
  // selection but should only surface when progression signals say it needs work.
  'fix-sentence',
] as const;

export type PolishedExerciseId = typeof POLISHED_EXERCISES[number];

const POLISHED_SET = new Set<string>(POLISHED_EXERCISES);

export function isPolishedExercise(id: string): boolean {
  return POLISHED_SET.has(id);
}

/** Filter an exercise-id list down to the polished allowlist. */
export function filterToPolished(ids: string[]): string[] {
  return ids.filter(isPolishedExercise);
}
