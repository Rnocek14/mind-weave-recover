/**
 * applyValidityGate — single shared helper for scoring callsites.
 *
 * Wrap any (analysis → score) decision so that invalid attempts:
 *   • do not advance accuracy / cue / adaptation
 *   • are still recorded for audit
 *
 * Usage:
 *   const gated = applyValidityGate(validity);
 *   if (!gated.shouldScore) {
 *     // log audit-only, do not call setScore / onCorrect / onIncorrect
 *     return;
 *   }
 *   // proceed with normal scoring
 */

import type { ValidityResult, ValidityLabel } from './classifyUtteranceValidity';

export interface GateDecision {
  shouldScore: boolean;
  shouldFeedAdaptation: boolean;
  shouldShowToClinician: boolean;
  /** Human-readable bucket for UI / logs */
  bucket:
    | 'valid'
    | 'filler'
    | 'silence'
    | 'noise'
    | 'review'
    | 'unknown';
  label: ValidityLabel | null;
  reason: string | null;
}

const BUCKETS: Record<ValidityLabel, GateDecision['bucket']> = {
  valid_attempt: 'valid',
  filler_only: 'filler',
  no_response: 'silence',
  background_noise: 'noise',
  low_confidence: 'review',
  other_speaker_suspected: 'review',
};

export function applyValidityGate(
  validity: ValidityResult | null | undefined
): GateDecision {
  if (!validity) {
    // No classification available — treat as valid (preserves legacy behavior).
    return {
      shouldScore: true,
      shouldFeedAdaptation: true,
      shouldShowToClinician: true,
      bucket: 'unknown',
      label: null,
      reason: null,
    };
  }
  const isValid = validity.validity === 'valid_attempt';
  return {
    shouldScore: isValid,
    shouldFeedAdaptation: isValid,
    shouldShowToClinician: true, // always visible in Session Review (in correct bucket)
    bucket: BUCKETS[validity.validity] ?? 'unknown',
    label: validity.validity,
    reason: validity.reason,
  };
}
