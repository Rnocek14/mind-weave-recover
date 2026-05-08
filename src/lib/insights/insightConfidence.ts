/**
 * insightConfidence — PR-B3
 *
 * Single authority for "should this insight be spoken?" Every signal type
 * (Phase B session digest + future weekly/longitudinal digests) calls this
 * one helper. Per-insight thresholds are forbidden; loosen/tighten in one
 * place only.
 *
 * Confidence is not just a tier — it carries provenance (the factor values
 * that produced the verdict). Provenance is INTERNAL ONLY: used for
 * debugging, clinician auditability, threshold tuning, and research
 * validation. Never expose to patients/caregivers.
 */

import type { ConfidenceTier } from './insightLanguage';

export interface ConfidenceFactors {
  /** Trials observed at the relevant dimension within the scope (session or week). */
  trialsAtDimension: number;
  /** Normalized magnitude of the change/effect, 0..1. */
  effectSize: number;
  /** Fraction of trials whose direction matches the claim, 0..1. */
  consistencyAcrossTrials: number;
  /** Optional: number of distinct sessions this signal was observed in. */
  sessionsObserved?: number;
}

export interface ConfidenceVerdict {
  tier: ConfidenceTier;
  /** 0..1 numeric score derived from factors. Internal use only. */
  score: number;
  /** Echo of the inputs — provenance for debugging / audit. */
  factors: ConfidenceFactors;
  /** Short machine-readable reason ('high', 'below_trials_floor', etc.). */
  reason: string;
}

// ---------------------------------------------------------------------------
// Tunable defaults — Phase B is intentionally STRICT. Loosen here only.
// ---------------------------------------------------------------------------

export const INSIGHT_CONFIDENCE_DEFAULTS = Object.freeze({
  trialsFloor: 10,            // below this → 'insufficient'
  highConsistency: 0.85,
  highEffect: 0.4,
  mediumConsistency: 0.7,
  mediumEffect: 0.25,
  /** When sessionsObserved >= this, we relax the trials floor by half. */
  longitudinalRelaxAt: 3,
});

export type ConfidenceDefaults = typeof INSIGHT_CONFIDENCE_DEFAULTS;

// ---------------------------------------------------------------------------

function computeScore(f: ConfidenceFactors, d: ConfidenceDefaults): number {
  // Weighted blend; bounded 0..1. Used internally only.
  const trialsTerm = Math.min(1, f.trialsAtDimension / (d.trialsFloor * 2));
  const effectTerm = Math.min(1, Math.max(0, f.effectSize));
  const consistencyTerm = Math.min(1, Math.max(0, f.consistencyAcrossTrials));
  return Number(
    (0.25 * trialsTerm + 0.35 * effectTerm + 0.4 * consistencyTerm).toFixed(3),
  );
}

/**
 * Single confidence verdict for any insight type.
 *
 * Rules (Phase B):
 *  - `insufficient` if trials < floor (relaxed for longitudinal scope).
 *  - `high` requires consistency ≥ 0.85 AND effectSize ≥ 0.4.
 *  - `medium` requires consistency ≥ 0.7 AND effectSize ≥ 0.25.
 *  - Anything else → `low` (composer will suppress in Phase B).
 */
export function insightConfidence(
  factors: ConfidenceFactors,
  defaults: ConfidenceDefaults = INSIGHT_CONFIDENCE_DEFAULTS,
): ConfidenceVerdict {
  const sessions = factors.sessionsObserved ?? 1;
  const effectiveFloor =
    sessions >= defaults.longitudinalRelaxAt
      ? Math.ceil(defaults.trialsFloor / 2)
      : defaults.trialsFloor;

  const score = computeScore(factors, defaults);

  if (factors.trialsAtDimension < effectiveFloor) {
    return {
      tier: 'insufficient',
      score,
      factors,
      reason: `below_trials_floor:${factors.trialsAtDimension}/${effectiveFloor}`,
    };
  }

  if (
    factors.consistencyAcrossTrials >= defaults.highConsistency &&
    factors.effectSize >= defaults.highEffect
  ) {
    return { tier: 'high', score, factors, reason: 'meets_high_bar' };
  }

  if (
    factors.consistencyAcrossTrials >= defaults.mediumConsistency &&
    factors.effectSize >= defaults.mediumEffect
  ) {
    return { tier: 'medium', score, factors, reason: 'meets_medium_bar' };
  }

  return { tier: 'low', score, factors, reason: 'below_medium_bar' };
}
