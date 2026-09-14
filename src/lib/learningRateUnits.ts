/**
 * learning_rates.accuracy_slope is a linear-regression slope of DAILY ACCURACY
 * AS A FRACTION (correct / total, 0–1) against day index — a fraction per day.
 * The Patient Hub's status card reads it as percentage points per week
 * (thresholds −5 / −10, label "% accuracy / wk"), so a genuine decline of
 * 0.02/day (−14 points a week) rounded to "−0%" and never escalated triage.
 * Convert once, here, and say which unit a value is in.
 */
export function slopePerDayToPctPerWeek(fractionPerDay: number | null | undefined): number | null {
  if (fractionPerDay == null || !Number.isFinite(fractionPerDay)) return null;
  return fractionPerDay * 100 * 7;
}

/** The learning_rates row the clinician hub reads: speech accuracy over 14 days. */
export const LEARNING_RATE_DOMAIN = 'speech';
export const LEARNING_RATE_WINDOW_DAYS = 14;

/**
 * Minimum evidence before a slope may drive a trend arrow or a triage tier.
 *
 * A regression over three sessions of ten trials at a constant true 75% comes
 * out at ±5 points per active day almost half the time — enough to paint a
 * flat patient "Needs attention". Below these floors the hub shows no trend at
 * all rather than a confident wrong one. calculate-learning-rates already
 * refuses to write a row under 10 trials / 3 days; this is the stricter bar
 * for showing it to a person.
 */
export const MIN_TRIALS_FOR_SLOPE = 30;
export const MIN_ACTIVE_DAYS_FOR_SLOPE = 5;

export interface LearningRateEvidence {
  accuracy_slope: number | null;
  trial_count: number | null;
  /** Distinct practice days in the regression. Null on rows written before the column existed. */
  active_days: number | null;
  confidence_score?: number | null;
}

/**
 * The stored slope (fraction of accuracy per calendar day) when the row rests
 * on enough evidence, otherwise null. A row without `active_days` predates the
 * calendar-day regression and is not shown.
 */
export function learningRateSlopeIfTrustworthy(
  row: LearningRateEvidence | null | undefined,
): number | null {
  if (!row) return null;
  if (typeof row.accuracy_slope !== 'number' || !Number.isFinite(row.accuracy_slope)) return null;
  if ((row.trial_count ?? 0) < MIN_TRIALS_FOR_SLOPE) return null;
  if ((row.active_days ?? 0) < MIN_ACTIVE_DAYS_FOR_SLOPE) return null;
  return row.accuracy_slope;
}
