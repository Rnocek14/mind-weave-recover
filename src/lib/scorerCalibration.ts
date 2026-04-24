/**
 * Scorer Calibration — versioned, tunable configuration for the discourse
 * signal scorer. Centralizes every knob so we can iterate on clinical
 * accuracy WITHOUT rewriting scoring logic.
 *
 * Workflow:
 *   1. Adjust values here (or add a new version below).
 *   2. Run the calibration runner (`scripts/runScorerCalibration.ts`)
 *      against the labeled dataset in `src/calibration/aphasiaTurns.ts`.
 *   3. Compare report vs previous version. Promote if it improves
 *      precision/recall + adaptation agreement without regressing.
 *
 * Used by:
 *   - src/lib/discourseSignalScorer.ts (composite + adaptation)
 *   - scripts/runScorerCalibration.ts (offline calibration runs)
 */

import type { DiscourseErrorType, DiscourseAdaptationDirection } from "./discourseSignalScorer";

export interface ScorerCalibration {
  version: string;
  notes: string;

  /** Weights applied to the three sub-scores when composing successScore. Must sum to 1. */
  weights: {
    targetAchievement: number;
    onTopic: number;
    responseQuality: number;
  };

  /** Composite successScore cutoffs that drive recommendedAdaptation. */
  adaptation: {
    upAtOrAbove: number;   // successScore >= → "up"
    downAtOrBelow: number; // successScore <= → "down"
  };

  /** Minimum confidence required before we trust LLM-recommended adaptation. */
  confidenceFloor: number;

  /** Latency thresholds (ms) used by local fallback + override rules. */
  latency: {
    wordFindingMs: number;       // > this latency triggers word_finding suspicion
    targetPenaltyMs: number;     // > this latency penalizes targetAchievement (fallback)
  };

  /**
   * Error-type override rules — applied AFTER the LLM/fallback returns.
   * These encode clinically non-negotiable invariants so the composite
   * score and adaptation can never contradict the diagnosis.
   *
   * Each entry: if the errorType matches, clamp sub-scores and/or force
   * an adaptation direction.
   */
  errorTypeOverrides: Partial<Record<DiscourseErrorType, ErrorTypeOverride>>;
}

export interface ErrorTypeOverride {
  /** Cap targetAchievement at this value (e.g. circumlocution can never be a "win"). */
  capTargetAchievement?: number;
  /** Cap onTopic at this value. */
  capOnTopic?: number;
  /** Cap responseQuality at this value. */
  capResponseQuality?: number;
  /** Force adaptation direction regardless of composite score. */
  forceAdaptation?: DiscourseAdaptationDirection;
}

// ---------------------------------------------------------------------------
// v1 — current production calibration (matches pre-calibration behavior)
// ---------------------------------------------------------------------------
export const CALIBRATION_V1: ScorerCalibration = {
  version: "v1",
  notes: "Initial deployed weights. Heuristic, not yet clinically tuned.",
  weights: {
    targetAchievement: 0.55,
    onTopic: 0.25,
    responseQuality: 0.20,
  },
  adaptation: {
    upAtOrAbove: 0.78,
    downAtOrBelow: 0.40,
  },
  confidenceFloor: 0.5,
  latency: {
    wordFindingMs: 8000,
    targetPenaltyMs: 6000,
  },
  errorTypeOverrides: {
    surrender:    { forceAdaptation: "down", capTargetAchievement: 0 },
    no_response:  { forceAdaptation: "down", capTargetAchievement: 0 },
  },
};

// ---------------------------------------------------------------------------
// v2 — clinically-tuned candidate (more conservative, error-type aware)
// ---------------------------------------------------------------------------
export const CALIBRATION_V2: ScorerCalibration = {
  version: "v2",
  notes:
    "Lifts targetAchievement slightly. Tightens 'up' band so we don't escalate too eagerly. " +
    "Adds error-type caps so circumlocution / off_topic / word_finding can't masquerade as success.",
  weights: {
    targetAchievement: 0.60,
    onTopic: 0.25,
    responseQuality: 0.15,
  },
  adaptation: {
    upAtOrAbove: 0.80,
    downAtOrBelow: 0.45,
  },
  confidenceFloor: 0.55,
  latency: {
    wordFindingMs: 7000,
    targetPenaltyMs: 5500,
  },
  errorTypeOverrides: {
    surrender:           { forceAdaptation: "down", capTargetAchievement: 0 },
    no_response:         { forceAdaptation: "down", capTargetAchievement: 0 },
    off_topic:           { forceAdaptation: "down", capTargetAchievement: 0.25, capOnTopic: 0.2 },
    circumlocution:      { capTargetAchievement: 0.5, capResponseQuality: 0.55 },
    word_finding:        { capTargetAchievement: 0.55 },
    semantic_paraphasia: { capTargetAchievement: 0.45 },
    incomplete:          { capTargetAchievement: 0.5, capResponseQuality: 0.5 },
    unclear:             { capTargetAchievement: 0.4 },
  },
};

/** Active calibration used by the live scorer. Bump to promote a new version. */
export const ACTIVE_CALIBRATION: ScorerCalibration = CALIBRATION_V2;

/** All versions, for the calibration runner to compare against. */
export const ALL_CALIBRATIONS: ScorerCalibration[] = [CALIBRATION_V1, CALIBRATION_V2];

// ---------------------------------------------------------------------------
// Application helpers — pure, dependency-free, safe for both client + Node.
// ---------------------------------------------------------------------------

export interface SubScores {
  onTopicScore: number;
  targetAchievementScore: number;
  responseQualityScore: number;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Apply error-type override caps to sub-scores. Returns adjusted copy. */
export function applyErrorTypeCaps(
  sub: SubScores,
  errorType: DiscourseErrorType,
  cal: ScorerCalibration = ACTIVE_CALIBRATION,
): SubScores {
  const o = cal.errorTypeOverrides[errorType];
  if (!o) return sub;
  return {
    onTopicScore:
      o.capOnTopic != null ? Math.min(sub.onTopicScore, o.capOnTopic) : sub.onTopicScore,
    targetAchievementScore:
      o.capTargetAchievement != null
        ? Math.min(sub.targetAchievementScore, o.capTargetAchievement)
        : sub.targetAchievementScore,
    responseQualityScore:
      o.capResponseQuality != null
        ? Math.min(sub.responseQualityScore, o.capResponseQuality)
        : sub.responseQualityScore,
  };
}

/** Composite successScore using the active (or supplied) calibration weights. */
export function computeSuccessScoreCalibrated(
  sub: SubScores,
  cal: ScorerCalibration = ACTIVE_CALIBRATION,
): number {
  const { weights } = cal;
  const composite =
    sub.targetAchievementScore * weights.targetAchievement +
    sub.onTopicScore * weights.onTopic +
    sub.responseQualityScore * weights.responseQuality;
  return clamp01(composite);
}

/**
 * Resolve final adaptation direction from successScore + errorType + confidence.
 * Error-type forceAdaptation always wins. Otherwise composite thresholds decide.
 * If confidence is below floor, we soften "up" → "hold" (never escalate on guesses).
 */
export function resolveAdaptation(
  successScore: number,
  errorType: DiscourseErrorType,
  confidence: number,
  cal: ScorerCalibration = ACTIVE_CALIBRATION,
): DiscourseAdaptationDirection {
  const override = cal.errorTypeOverrides[errorType]?.forceAdaptation;
  if (override) return override;

  let dir: DiscourseAdaptationDirection = "hold";
  if (successScore >= cal.adaptation.upAtOrAbove) dir = "up";
  else if (successScore <= cal.adaptation.downAtOrBelow) dir = "down";

  if (dir === "up" && confidence < cal.confidenceFloor) return "hold";
  return dir;
}
