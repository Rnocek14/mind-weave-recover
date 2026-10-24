/**
 * Canonical eligibility gate for legacy per-exercise summary scores.
 * A skipped/unanswered exercise is *missing evidence*, not a measured zero.
 * This field is displayed alongside clinical results, so never synthesize
 * a failing score when a patient could not participate.
 */
export function mergeMeasuredExerciseScores(
  existing: Readonly<Record<string, number>>,
  exerciseSlug: string,
  score: number,
  measuredTrials: number,
): Record<string, number> {
  if (!Number.isFinite(measuredTrials) || measuredTrials <= 0 || !Number.isFinite(score)) {
    return { ...existing };
  }
  return { ...existing, [exerciseSlug]: score };
}
