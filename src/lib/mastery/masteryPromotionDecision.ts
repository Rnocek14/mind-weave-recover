/**
 * masteryPromotionDecision — Phase A.2 (Mastery Influence).
 *
 * A.2 changes the promotion model from:
 *
 *     Progress + Evidence            = Promotion
 *
 * to:
 *
 *     Progress + Evidence + Mastery  = Promotion RECOMMENDATION
 *
 * The key word is RECOMMENDATION, not requirement. This is NOT A.3
 * enforcement. The rules:
 *
 *   High mastery   → promote
 *   Medium mastery → promote
 *   Low mastery    → delay ONE confirming session + reinforcement tag +
 *                    planner boost  ("the system would like one more
 *                    confirming session"). NOT a permanent block.
 *   No signal      → no opinion (promotion proceeds on accuracy/evidence
 *                    alone — skip = open, new users are never blocked).
 *
 * This module is PURE. It only classifies the recommendation and exposes
 * telemetry-friendly outcomes so we can measure "how often would mastery
 * change the outcome?" BEFORE it is ever allowed to fully control it.
 */

import type { MasteryConfidenceLevel } from '@/lib/progression/clinicalProgression';
import type { MasteryGateVerdict } from '@/lib/mastery/readMasteryGate';

export type MasteryPromotionDecision =
  /** Mastery agrees the patient is ready to move up. */
  | 'promote'
  /** Mastery wants one more confirming session before moving up. */
  | 'delay_reinforce'
  /** Not enough signal yet — mastery defers to accuracy/evidence. */
  | 'no_opinion';

export interface MasteryPromotionRecommendation {
  decision: MasteryPromotionDecision;
  /** Surface a reinforcement tag for the next session. */
  reinforcementRecommended: boolean;
  /** Ask the planner to prioritise this skill next session. */
  plannerBoost: boolean;
  /** Where the decision came from (verdict preferred over raw confidence). */
  basis: 'verdict' | 'confidence' | 'none';
  /** Short, human-readable rationale. */
  reason: string;
}

export interface ClassifyMasteryPromotionInput {
  /** Verdict from the multi-skill gate rule (preferred input). */
  verdict?: MasteryGateVerdict;
  /** Raw confidence level (fallback when no verdict supplied, e.g. sim). */
  confidence?: MasteryConfidenceLevel;
}

const NO_OPINION: MasteryPromotionRecommendation = {
  decision: 'no_opinion',
  reinforcementRecommended: false,
  plannerBoost: false,
  basis: 'none',
  reason: 'No longitudinal mastery signal yet — promotion follows accuracy and evidence.',
};

const PROMOTE = (basis: 'verdict' | 'confidence', reason: string): MasteryPromotionRecommendation => ({
  decision: 'promote',
  reinforcementRecommended: false,
  plannerBoost: false,
  basis,
  reason,
});

const DELAY = (basis: 'verdict' | 'confidence', reason: string): MasteryPromotionRecommendation => ({
  decision: 'delay_reinforce',
  reinforcementRecommended: true,
  plannerBoost: true,
  basis,
  reason,
});

/**
 * Classify the mastery-informed promotion recommendation.
 *
 * Verdict takes precedence over raw confidence (it reflects the multi-skill
 * gate rule). Falls back to confidence for simulation / single-skill use.
 */
export function classifyMasteryPromotion(
  input: ClassifyMasteryPromotionInput,
): MasteryPromotionRecommendation {
  if (input.verdict !== undefined) {
    switch (input.verdict) {
      case 'pass':
        return PROMOTE('verdict', 'Mastery confidence supports moving up.');
      case 'block':
        return DELAY(
          'verdict',
          'Mastery is not yet confident — one more confirming session recommended.',
        );
      case 'skip':
      default:
        return NO_OPINION;
    }
  }

  switch (input.confidence) {
    case 'high':
      return PROMOTE('confidence', 'High mastery confidence — ready to move up.');
    case 'medium':
      return PROMOTE('confidence', 'Medium mastery confidence — ready to move up.');
    case 'low':
      return DELAY(
        'confidence',
        'Low mastery confidence — one more confirming session recommended.',
      );
    case 'none':
    case undefined:
    default:
      return NO_OPINION;
  }
}

/** Telemetry rollup: how often would mastery change the outcome? */
export interface MasteryDecisionTelemetry {
  /** Sessions where mastery would approve a pending promotion. */
  approved: number;
  /** Sessions where mastery would delay a pending promotion (reinforce). */
  delayed: number;
  /** Sessions where mastery had no opinion (defers to accuracy/evidence). */
  noOpinion: number;
  total: number;
  /** Of the sessions where mastery HAD an opinion, the share it would delay. */
  delayRateAmongOpinions: number;
}

export function emptyMasteryTelemetry(): MasteryDecisionTelemetry {
  return { approved: 0, delayed: 0, noOpinion: 0, total: 0, delayRateAmongOpinions: 0 };
}

export function tallyMasteryDecisions(
  decisions: MasteryPromotionDecision[],
): MasteryDecisionTelemetry {
  const t = emptyMasteryTelemetry();
  for (const d of decisions) {
    t.total += 1;
    if (d === 'promote') t.approved += 1;
    else if (d === 'delay_reinforce') t.delayed += 1;
    else t.noOpinion += 1;
  }
  const opinions = t.approved + t.delayed;
  t.delayRateAmongOpinions = opinions > 0 ? t.delayed / opinions : 0;
  return t;
}
