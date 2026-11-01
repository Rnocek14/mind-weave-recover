/**
 * Clinician-facing *observation* labels. These do not diagnose a decline,
 * declare recovery/stability, prescribe therapy, or establish patient safety.
 * Alerts retain their source severity but are not independently verified.
 */
export type ReviewPriority = 'alert' | 'follow_up' | 'measurement' | 'routine';
export interface ClinicianReviewInputs {
  criticalAlerts: number;
  otherAlerts: number;
  activeDays7d: number;
  lastActiveDate: string | null;
  scoredRecent: number;
  scoredPrior: number;
  practiceDeltaPp: number | null;
}

export interface ClinicianReviewSummary {
  priority: ReviewPriority;
  title: string;
  reason: string;
  nextStep: string;
}

export const MIN_COMPARE_ATTEMPTS = 10;

export function comparablePracticeDelta(
  recentAccuracy: number | null,
  priorAccuracy: number | null,
  recentCount: number,
  priorCount: number,
): number | null {
  if (recentCount < MIN_COMPARE_ATTEMPTS || priorCount < MIN_COMPARE_ATTEMPTS
    || recentAccuracy === null || priorAccuracy === null
    || !Number.isFinite(recentAccuracy) || !Number.isFinite(priorAccuracy)) return null;
  // Practice-only signal. Difficulty, cueing and task mix may still differ.
  return Math.round(recentAccuracy - priorAccuracy);
}

export function clinicianReviewSummary({
  criticalAlerts, otherAlerts, activeDays7d, lastActiveDate,
  scoredRecent, scoredPrior, practiceDeltaPp,
}: ClinicianReviewInputs): ClinicianReviewSummary {
  if (criticalAlerts > 0) return {
    priority: 'alert', title: 'Alerts to review',
    reason: `${criticalAlerts} high-priority app ${criticalAlerts === 1 ? 'alert' : 'alerts'} recorded`,
    nextStep: 'Review the source, recording and patient context before taking clinical action.',
  };
  if (otherAlerts > 0) return {
    priority: 'follow_up', title: 'Alerts to review',
    reason: `${otherAlerts} app ${otherAlerts === 1 ? 'alert' : 'alerts'} awaiting review`,
    nextStep: 'Inspect alert evidence and document a clinician assessment if needed.',
  };
  if (!lastActiveDate || activeDays7d === 0) return {
    priority: 'measurement', title: 'No recent practice recorded',
    reason: 'No recorded activity in the last 7 days',
    nextStep: 'Check whether this is an expected gap before considering outreach.',
  };
  if (activeDays7d < 2) return {
    priority: 'measurement', title: 'Limited recent activity',
    reason: `${activeDays7d} of 7 days with recorded activity`,
    nextStep: 'Review the planned practice schedule and any access or fatigue barriers.',
  };
  if (practiceDeltaPp !== null && scoredRecent >= MIN_COMPARE_ATTEMPTS
    && scoredPrior >= MIN_COMPARE_ATTEMPTS && practiceDeltaPp <= -5) return {
    priority: 'follow_up', title: 'Practice score change',
    reason: `${practiceDeltaPp} percentage points versus the previous 7 days`,
    nextStep: 'Compare task difficulty, cueing, recording quality and examples before interpreting this change.',
  };
  if (scoredRecent === 0) return {
    priority: 'measurement', title: 'Not enough scored data',
    reason: 'Activity recorded without eligible scored responses',
    nextStep: 'Review excluded or unscored attempts. Do not interpret missing scores as failures.',
  };
  return {
    priority: 'routine', title: 'Practice data available',
    reason: `${scoredRecent} scored responses in the last 7 days`,
    nextStep: 'Review skill-specific changes and functional communication goals at the next visit.',
  };
}
