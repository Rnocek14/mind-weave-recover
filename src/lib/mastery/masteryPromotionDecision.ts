/**
 * masteryPromotionDecision — Phase A.2 (Mastery Influence), tightened.
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
 * enforcement — it only classifies a recommendation and exposes telemetry.
 *
 * TWO QUESTIONS, TWO SIGNALS
 * --------------------------
 * The original wrapper was too shallow: it keyed only on CONFIDENCE, which
 * answers "do we have ENOUGH DATA?" — it never asked whether the performance
 * was actually INDEPENDENT enough to recommend moving up. A cue-dependent
 * learner with high raw accuracy would therefore (wrongly) be recommended for
 * promotion once enough trials accrued.
 *
 * The tightened rule separates the two questions:
 *
 *   1. Evidence confidence  → "do we have enough data?"   (confidence/verdict)
 *   2. Mastery quality      → "is the performance actually
 *                              independent enough?"        (mastery_score,
 *                                                           cue_independence,
 *                                                           plateau/fatigue/
 *                                                           regression flags)
 *
 * Promote ONLY when BOTH hold:
 *   - confidence is medium or high (or gate verdict 'pass'), AND
 *   - mastery_score      >= MIN_MASTERY_SCORE,              AND
 *   - cue_independence   >= MIN_CUE_INDEPENDENCE,           AND
 *   - no active plateau / fatigue / regression flag.
 *
 * Otherwise, when there IS enough data but quality falls short:
 *   - delay_reinforce  (one more confirming session + reinforcement tag +
 *                       planner boost). NEVER a permanent block.
 *
 * When there is not enough data:
 *   - no_opinion       (promotion proceeds on accuracy/evidence alone —
 *                       skip = open, new users are never blocked).
 *
 * This module is PURE.
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

/**
 * Quality thresholds the recommendation requires before it will say
 * "promote". Midpoints of the clinically-suggested ranges:
 *   mastery_score    70–75%  → 0.72
 *   cue_independence 60–70%  → 0.65
 */
export const MASTERY_QUALITY_THRESHOLDS = {
  MIN_MASTERY_SCORE: 0.72,
  MIN_CUE_INDEPENDENCE: 0.65,
} as const;

export type MasteryQualityFailCode =
  | 'low_mastery_score'
  | 'high_cue_dependency'
  | 'plateau'
  | 'fatigue'
  | 'regression';

export interface MasteryPromotionRecommendation {
  decision: MasteryPromotionDecision;
  /** Surface a reinforcement tag for the next session. */
  reinforcementRecommended: boolean;
  /** Ask the planner to prioritise this skill next session. */
  plannerBoost: boolean;
  /** Where the decision came from (verdict preferred over raw confidence). */
  basis: 'verdict' | 'confidence' | 'none';
  /** When delayed by a quality shortfall, which signal limited it. */
  qualityLimiter: MasteryQualityFailCode | null;
  /** Short, human-readable rationale. */
  reason: string;
}

export interface ClassifyMasteryPromotionInput {
  /** Verdict from the multi-skill gate rule (preferred evidence input). */
  verdict?: MasteryGateVerdict;
  /** Raw confidence level (fallback when no verdict supplied, e.g. sim). */
  confidence?: MasteryConfidenceLevel;

  // ---- Mastery QUALITY signals (the "is it independent?" question) ----
  /** 0..1 longitudinal mastery score. */
  masteryScore?: number | null;
  /** 0..1 cue independence (1 = fully independent). */
  cueIndependence?: number | null;
  /** Progress has stalled at a moderate level. */
  plateauFlag?: boolean;
  /** Performance is suppressed by fatigue. */
  fatigueFlag?: boolean;
  /** Independence is actively worsening (support dependency trend down). */
  regressionFlag?: boolean;
}

const NO_OPINION: MasteryPromotionRecommendation = {
  decision: 'no_opinion',
  reinforcementRecommended: false,
  plannerBoost: false,
  basis: 'none',
  qualityLimiter: null,
  reason: 'No longitudinal mastery signal yet — promotion follows accuracy and evidence.',
};

function promote(
  basis: 'verdict' | 'confidence',
  reason: string,
): MasteryPromotionRecommendation {
  return {
    decision: 'promote',
    reinforcementRecommended: false,
    plannerBoost: false,
    basis,
    qualityLimiter: null,
    reason,
  };
}

function delay(
  basis: 'verdict' | 'confidence',
  reason: string,
  qualityLimiter: MasteryQualityFailCode | null = null,
): MasteryPromotionRecommendation {
  return {
    decision: 'delay_reinforce',
    reinforcementRecommended: true,
    plannerBoost: true,
    basis,
    qualityLimiter,
    reason,
  };
}

interface QualityResult {
  passes: boolean;
  limiter: MasteryQualityFailCode | null;
  reason: string;
}

/**
 * Evaluate whether the PERFORMANCE QUALITY is independent enough to
 * recommend promotion. Flags are checked first (clearest clinical story),
 * then the numeric floors. Missing numeric signals are treated as
 * "can't disqualify on this axis" so legacy callers that only pass
 * confidence still behave (data-volume gate then governs).
 */
function evaluateMasteryQuality(input: ClassifyMasteryPromotionInput): QualityResult {
  const { MIN_MASTERY_SCORE, MIN_CUE_INDEPENDENCE } = MASTERY_QUALITY_THRESHOLDS;

  if (input.regressionFlag) {
    return {
      passes: false,
      limiter: 'regression',
      reason:
        'Enough data, but promotion delayed because independence is slipping rather than improving.',
    };
  }
  if (input.fatigueFlag) {
    return {
      passes: false,
      limiter: 'fatigue',
      reason:
        'Enough data, but promotion delayed because performance is suppressed by fatigue right now.',
    };
  }
  if (input.plateauFlag) {
    return {
      passes: false,
      limiter: 'plateau',
      reason:
        'Enough data, but promotion delayed because progress has plateaued at this level.',
    };
  }
  if (input.cueIndependence != null && input.cueIndependence < MIN_CUE_INDEPENDENCE) {
    return {
      passes: false,
      limiter: 'high_cue_dependency',
      reason:
        'Enough data, but promotion delayed because correct answers still depend heavily on cues.',
    };
  }
  if (input.masteryScore != null && input.masteryScore < MIN_MASTERY_SCORE) {
    return {
      passes: false,
      limiter: 'low_mastery_score',
      reason:
        'Enough data, but promotion delayed because performance is not yet independent enough to recommend moving up.',
    };
  }

  return {
    passes: true,
    limiter: null,
    reason: 'Mastery quality is strong and independent — ready to move up.',
  };
}

/**
 * Classify the mastery-informed promotion recommendation.
 *
 * Verdict takes precedence over raw confidence for the EVIDENCE question
 * (it reflects the multi-skill gate rule). The MASTERY QUALITY gate then
 * applies on top of any "enough data" outcome.
 */
export function classifyMasteryPromotion(
  input: ClassifyMasteryPromotionInput,
): MasteryPromotionRecommendation {
  // --- Step 1: evidence question — "do we have enough data?" ---
  let basis: 'verdict' | 'confidence' | 'none';
  let enoughData: boolean;

  if (input.verdict !== undefined) {
    basis = 'verdict';
    if (input.verdict === 'skip') return NO_OPINION;
    if (input.verdict === 'block') {
      return delay('verdict', 'Mastery is not yet confident — one more confirming session recommended.');
    }
    enoughData = true; // 'pass'
  } else {
    basis = 'confidence';
    switch (input.confidence) {
      case 'high':
      case 'medium':
        enoughData = true;
        break;
      case 'low':
        return delay('confidence', 'Low evidence confidence — one more confirming session recommended.');
      case 'none':
      case undefined:
      default:
        return NO_OPINION;
    }
  }

  // --- Step 2: quality question — "is performance independent enough?" ---
  const quality = evaluateMasteryQuality(input);
  if (!quality.passes) {
    return delay(basis as 'verdict' | 'confidence', quality.reason, quality.limiter);
  }

  return promote(
    basis as 'verdict' | 'confidence',
    basis === 'verdict'
      ? 'Mastery confidence and quality both support moving up.'
      : `${input.confidence === 'high' ? 'High' : 'Medium'} confidence with strong independent performance — ready to move up.`,
  );
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
