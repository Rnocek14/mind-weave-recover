/**
 * Read-side eligibility shared by weekly statistics and Session Review.
 * This does not classify speech, rescore trials, or change progression gates.
 * Preserve the existing explicit clinician override and legacy-null policies.
 */
export interface ScoredEvidence {
  counts_toward_score?: boolean | null;
  validity_label?: string | null;
  clinician_validity_override?: string | null;
  task_parameters?: unknown;
  taskParameters?: unknown;
  engagement_flags?: unknown;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function isScoredClinicalEvidence(evidence: ScoredEvidence): boolean {
  const override = evidence.clinician_validity_override;
  if (override === 'patient') return true;
  if (override === 'not_patient' || override === 'noise' || override === 'filler') return false;

  const task = record(evidence.task_parameters ?? evidence.taskParameters);
  const validity = record(task.speech_validity);
  const flags = record(evidence.engagement_flags);
  // Any explicit exclusion wins over missing or inconsistent legacy metadata.
  if (evidence.counts_toward_score === false || validity.should_score === false ||
      flags.counts_toward_score === false) return false;
  const label = evidence.validity_label ?? validity.label ?? flags.validity_label;
  if (typeof label === 'string' && label !== '' && label !== 'valid_attempt') return false;

  // Null metadata is not proof of ASR verification. It remains eligible only
  // for backward-compatible practice reporting, as in the existing review.
  return true;
}

export function hasDeliveredCue(cue: string | null | undefined): boolean {
  if (typeof cue !== 'string') return false;
  const value = cue.trim().toLowerCase();
  return value !== '' && value !== 'none';
}

export function scoredEventPercentages(
  events: readonly (ScoredEvidence & { score: number | null })[],
): number[] {
  return events.filter(isScoredClinicalEvidence).flatMap((event) => {
    if (typeof event.score !== 'number' || !Number.isFinite(event.score)) return [];
    // Keep the existing 0..1 / 0..100 compatibility rule. Explicit per-task
    // score units and binary-versus-graded reporting are a separate migration.
    const score = event.score <= 1 ? event.score * 100 : event.score;
    return [Math.max(0, Math.min(100, score))];
  });
}
