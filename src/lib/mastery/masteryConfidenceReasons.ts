/**
 * masteryConfidenceReasons — Phase A.2 explainability layer.
 *
 * The single most important pre-requisite for letting mastery confidence
 * INFLUENCE promotion is that the system can explain *why* confidence is
 * what it is. A clinician will trust:
 *
 *   "Held because 78% of correct answers still required cues across 3 sessions."
 *
 * but not:
 *
 *   "Held because confidence = low."
 *
 * This module is PURE. It turns the raw mastery signal (the same numbers
 * `computeMastery` already produces) into a structured, human-readable
 * explanation. It does NOT gate, write, or change progression. It exists so
 * that A.2 (influence) and any clinician/dev surface can show the reasoning.
 *
 * Thresholds mirror `computeMastery` exactly:
 *   none   : trials_total < 5
 *   low    : trials_total >= 5  (but < 12 OR sessions < 3)
 *   medium : trials_total >= 12 AND sessions >= 3
 *   high   : trials_total >= 30 AND sessions >= 6 AND daySpan >= 3
 */

import type { MasteryConfidenceLevel } from '@/lib/progression/clinicalProgression';

export const MASTERY_THRESHOLDS = {
  LOW_MIN_TRIALS: 5,
  MEDIUM_MIN_TRIALS: 12,
  MEDIUM_MIN_SESSIONS: 3,
  HIGH_MIN_TRIALS: 30,
  HIGH_MIN_SESSIONS: 6,
  HIGH_MIN_DAYSPAN: 3,
  /** Below this, cue reliance is the limiting factor. */
  CUE_INDEPENDENCE_FLOOR: 0.5,
  /** Below this, recent accuracy is too inconsistent. */
  ACCURACY_FLOOR: 0.6,
} as const;

export type ConfidenceReasonCode =
  | 'insufficient_volume'
  | 'insufficient_sessions'
  | 'insufficient_timespan'
  | 'high_cue_dependency'
  | 'inconsistent_accuracy'
  | 'plateau'
  | 'strong_independent_evidence';

export interface ConfidenceReason {
  code: ConfidenceReasonCode;
  /** Short label for chips/badges. */
  label: string;
  /** Concrete, number-bearing explanation for clinicians. */
  detail: string;
  /** True when this reason is what's *holding confidence back*. */
  limiting: boolean;
}

export interface ExplainMasteryInput {
  confidence: MasteryConfidenceLevel;
  trialsTotal: number;
  /** Distinct sessions in the scoring window. Optional — production rows
   *  do not persist this; sim + dev surfaces supply it. */
  sessionCount?: number | null;
  /** Calendar days spanned by the scoring window. Optional (see above). */
  daySpanDays?: number | null;
  cueIndependence: number | null;
  accuracyRecent: number | null;
  plateauFlag: boolean;
}

export interface MasteryConfidenceExplanation {
  confidence: MasteryConfidenceLevel;
  /** One clinician-facing sentence summarising the dominant driver. */
  summary: string;
  reasons: ConfidenceReason[];
  /** The single most important factor holding confidence back, or null
   *  when confidence is already 'high' / fully earned. */
  limitingCode: ConfidenceReasonCode | null;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/**
 * Produce a structured, number-bearing explanation of a confidence level.
 * Pure — never throws, gracefully degrades when optional metrics are absent.
 */
export function explainMasteryConfidence(
  input: ExplainMasteryInput,
): MasteryConfidenceExplanation {
  const {
    confidence,
    trialsTotal,
    sessionCount,
    daySpanDays,
    cueIndependence,
    accuracyRecent,
    plateauFlag,
  } = input;

  const reasons: ConfidenceReason[] = [];

  // ---- Volume ----
  if (trialsTotal < MASTERY_THRESHOLDS.LOW_MIN_TRIALS) {
    reasons.push({
      code: 'insufficient_volume',
      label: 'Too few responses',
      detail: `Only ${trialsTotal} response${trialsTotal === 1 ? '' : 's'} so far (need ${MASTERY_THRESHOLDS.LOW_MIN_TRIALS}+ to register a signal).`,
      limiting: true,
    });
  } else if (trialsTotal < MASTERY_THRESHOLDS.MEDIUM_MIN_TRIALS) {
    reasons.push({
      code: 'insufficient_volume',
      label: 'Building volume',
      detail: `${trialsTotal} responses (need ${MASTERY_THRESHOLDS.MEDIUM_MIN_TRIALS}+ for medium confidence).`,
      limiting: confidence === 'low',
    });
  }

  // ---- Sessions ----
  if (
    sessionCount != null &&
    trialsTotal >= MASTERY_THRESHOLDS.MEDIUM_MIN_TRIALS &&
    sessionCount < MASTERY_THRESHOLDS.MEDIUM_MIN_SESSIONS
  ) {
    reasons.push({
      code: 'insufficient_sessions',
      label: 'Needs more sessions',
      detail: `Evidence spans ${sessionCount} session${sessionCount === 1 ? '' : 's'} (need ${MASTERY_THRESHOLDS.MEDIUM_MIN_SESSIONS}+ to confirm it isn't a single good day).`,
      limiting: confidence === 'low',
    });
  } else if (
    sessionCount != null &&
    confidence === 'medium' &&
    sessionCount < MASTERY_THRESHOLDS.HIGH_MIN_SESSIONS
  ) {
    reasons.push({
      code: 'insufficient_sessions',
      label: 'Approaching high',
      detail: `${sessionCount} sessions of evidence (need ${MASTERY_THRESHOLDS.HIGH_MIN_SESSIONS}+ for high confidence).`,
      limiting: false,
    });
  }

  // ---- Timespan (only matters for the jump to high) ----
  if (
    daySpanDays != null &&
    confidence === 'medium' &&
    daySpanDays < MASTERY_THRESHOLDS.HIGH_MIN_DAYSPAN
  ) {
    reasons.push({
      code: 'insufficient_timespan',
      label: 'Needs more time',
      detail: `Evidence spans ${Math.round(daySpanDays)} day${Math.round(daySpanDays) === 1 ? '' : 's'} (need ${MASTERY_THRESHOLDS.HIGH_MIN_DAYSPAN}+ days for high confidence).`,
      limiting: false,
    });
  }

  // ---- Cue dependency ----
  if (
    cueIndependence != null &&
    cueIndependence < MASTERY_THRESHOLDS.CUE_INDEPENDENCE_FLOOR
  ) {
    const cueReliance = 1 - cueIndependence;
    reasons.push({
      code: 'high_cue_dependency',
      label: 'High cue reliance',
      detail: `About ${pct(cueReliance)} of correct answers still leaned on cues (independence ${pct(cueIndependence)}).`,
      limiting: true,
    });
  }

  // ---- Accuracy consistency ----
  if (
    accuracyRecent != null &&
    accuracyRecent < MASTERY_THRESHOLDS.ACCURACY_FLOOR
  ) {
    reasons.push({
      code: 'inconsistent_accuracy',
      label: 'Inconsistent accuracy',
      detail: `Recent accuracy ${pct(accuracyRecent)} — below the ${pct(MASTERY_THRESHOLDS.ACCURACY_FLOOR)} consistency floor.`,
      limiting: true,
    });
  }

  // ---- Plateau ----
  if (plateauFlag) {
    reasons.push({
      code: 'plateau',
      label: 'Plateau',
      detail: 'Mastery has been flat across recent sessions — progress has stalled at this level.',
      limiting: false,
    });
  }

  // ---- Positive signal ----
  if (
    confidence === 'high' ||
    (confidence === 'medium' &&
      (cueIndependence ?? 0) >= MASTERY_THRESHOLDS.CUE_INDEPENDENCE_FLOOR &&
      (accuracyRecent ?? 0) >= MASTERY_THRESHOLDS.ACCURACY_FLOOR)
  ) {
    reasons.push({
      code: 'strong_independent_evidence',
      label: 'Strong evidence',
      detail: `Consistent, largely independent performance (accuracy ${
        accuracyRecent != null ? pct(accuracyRecent) : '—'
      }, independence ${cueIndependence != null ? pct(cueIndependence) : '—'}).`,
      limiting: false,
    });
  }

  // Pick the dominant limiting reason (first limiting one wins; volume and
  // cue dependency are the most clinically meaningful, and appear first).
  const limiting = reasons.find((r) => r.limiting) ?? null;
  const limitingCode = limiting?.code ?? null;

  const summary = buildSummary(confidence, limiting, reasons);

  return { confidence, summary, reasons, limitingCode };
}

function buildSummary(
  confidence: MasteryConfidenceLevel,
  limiting: ConfidenceReason | null,
  reasons: ConfidenceReason[],
): string {
  if (confidence === 'high') {
    const positive = reasons.find((r) => r.code === 'strong_independent_evidence');
    return positive
      ? `High confidence — ${positive.detail.toLowerCase()}`
      : 'High confidence — consistent, independent performance over time.';
  }
  if (limiting) {
    return `${capitalize(confidence)} confidence — ${limiting.detail}`;
  }
  if (confidence === 'medium') {
    return 'Medium confidence — solid evidence, not yet enough sessions/time for high.';
  }
  return `${capitalize(confidence)} confidence.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
