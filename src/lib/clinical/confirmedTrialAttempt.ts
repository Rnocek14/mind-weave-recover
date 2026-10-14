/**
 * A duplicate attempt_id is only proof of successful persistence if the row
 * belongs to the SAME session and exercise. Never accept a uniqueness error
 * by itself as an acknowledged clinical write.
 */
export interface ClinicalAttemptIdentity {
  attempt_id: string;
  session_id: string;
  exercise_slug: string;
}

export function isConfirmedTrialAttempt(
  row: ClinicalAttemptIdentity | null | undefined,
  expected: ClinicalAttemptIdentity,
): boolean {
  return Boolean(
    row &&
    row.attempt_id === expected.attempt_id &&
    row.session_id === expected.session_id &&
    row.exercise_slug === expected.exercise_slug,
  );
}
