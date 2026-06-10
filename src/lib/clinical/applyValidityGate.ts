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

import type { ValidityResult, ValidityLabel, ConfirmedBy } from './classifyUtteranceValidity';

export interface GateDecision {
  /** Counts toward ASR/clinically-verified accuracy (summary.accuracy). */
  shouldScore: boolean;
  shouldFeedAdaptation: boolean;
  shouldShowToClinician: boolean;
  // ── Phase 1B scoring axes ──
  /** Counts toward session participation/engagement. */
  shouldCountParticipation: boolean;
  /** Counts toward coarse practice accuracy (may include manual_confirmed). */
  shouldCountPracticeAccuracy: boolean;
  /** Counts toward ASR-verified accuracy (FALSE for manual_confirmed). */
  shouldCountAsrAccuracy: boolean;
  confirmedBy: ConfirmedBy | null;
  /** Human-readable bucket for UI / logs */
  bucket:
    | 'valid'
    | 'filler'
    | 'silence'
    | 'noise'
    | 'review'
    | 'manual'
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
  manual_confirmed: 'manual',
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
      shouldCountParticipation: true,
      shouldCountPracticeAccuracy: true,
      shouldCountAsrAccuracy: true,
      confirmedBy: null,
      bucket: 'unknown',
      label: null,
      reason: null,
    };
  }
  const isValid = validity.validity === 'valid_attempt';
  return {
    shouldScore: validity.countsTowardScore,
    shouldFeedAdaptation: isValid, // only ASR-verified attempts feed adaptation
    shouldShowToClinician: true, // always visible in Session Review (in correct bucket)
    shouldCountParticipation: validity.countsTowardParticipation ?? isValid,
    shouldCountPracticeAccuracy: validity.countsTowardPracticeAccuracy ?? isValid,
    shouldCountAsrAccuracy: validity.countsTowardScore,
    confirmedBy: validity.confirmedBy ?? null,
    bucket: BUCKETS[validity.validity] ?? 'unknown',
    label: validity.validity,
    reason: validity.reason,
  };
}
