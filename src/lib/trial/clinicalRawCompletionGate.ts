import type { CommitSessionResult } from '@/lib/trial/types';

/**
 * Only a FAILED raw exercise-event write prevents a lesson from being marked
 * saved. A separate mastery/adaptation flush failure should be reported,
 * but does not erase raw practice the patient actually completed.
 */
export function hasMissingClinicalRawEvidence(
  result: Pick<CommitSessionResult, 'ok' | 'errors'>,
): boolean {
  return !result.ok && result.errors.some((error) =>
    error.startsWith('raw clinical event writes failed:'),
  );
}
