/**
 * A modality-mixed practice outcome cannot be pooled into a single
 * independent-language accuracy denominator even if its own multi-domain
 * clinical ladder has enough evidence to update.
 *
 * These rules apply only when no explicit clinical validity verdict was
 * supplied. Classified speech already has a separate validity gate.
 */
export function countsTowardUnclassifiedVerifiedScore(taskParameters: {
  clinical_progression_eligible?: unknown;
  trial_mode?: unknown;
}): boolean {
  return taskParameters.clinical_progression_eligible !== false &&
    taskParameters.trial_mode !== 'mixed';
}
