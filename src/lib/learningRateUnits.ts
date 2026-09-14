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
