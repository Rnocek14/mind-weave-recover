/**
 * Discourse Adaptation Bridge
 *
 * Converts messy conversational behavior (hesitation, word-finding, off-topic,
 * surrender, latency) into a unified up/down/hold difficulty signal that
 * mirrors the trial-based game adaptation engine.
 *
 * Used by:
 *  - ConversationPartnerGame (Free Talk)
 *  - ThoughtContinuationGame (Finish the Thought)
 *  - ConversationCoachGame (Smart Coach)
 *
 * Output:
 *  - direction: 'up' | 'down' | 'hold' — what just happened to difficulty
 *  - reason:    short human-readable string for the AdaptationBadge tooltip
 *  - level:     1..5 internal discourse-difficulty tier (consumers may use
 *               this to pick scaffolding intensity, narrowing prompts, etc.)
 */

export type DiscourseDirection = "up" | "down" | "hold";

export interface DiscourseTurnSignals {
  /** Whether the user produced any meaningful speech (>=2 words). */
  meaningful: boolean;
  /** Word count of user utterance. */
  wordCount: number;
  /** ms from prompt-end to first user word. null if unknown / no speech. */
  latencyToFirstWordMs: number | null;
  /** Engine-classified marker (optional). */
  stuckType?:
    | "no_speech"
    | "long_latency"
    | "incomplete"
    | "fluent_complete"
    | "off_topic"
    | "surrender"
    | "filler_only"
    | "circumlocution"
    | "fluent"
    | string
    | null;
  /** Whether the user explicitly gave up ("I don't know", "skip"). */
  surrendered?: boolean;
  /** Whether the system gave a hint / narrowing prompt this turn. */
  scaffoldUsed?: boolean;
  /** Optional momentum 0..1 for flow exercises. */
  momentum?: number | null;
}

export interface DiscourseTurnResult {
  /** Heuristic success score for this turn, 0..1. */
  successScore: number;
  /** True iff this turn counts as a "successful" discourse trial. */
  success: boolean;
}

export interface DiscourseAdaptationDecision {
  direction: DiscourseDirection;
  level: number; // 1..5
  reason: string;
  successRateInWindow: number;
  windowSize: number;
}

const MIN_LEVEL = 1;
const MAX_LEVEL = 5;
const WINDOW_SIZE = 3; // sliding window of last N turns
const UP_THRESHOLD = 0.85; // sustained success → harder
const DOWN_THRESHOLD = 0.4; // sustained struggle → easier
const LONG_LATENCY_MS = 6000;

/**
 * Score a single discourse turn into a 0..1 success heuristic.
 * Mirrors the trial-based "did they hit the target challenge band?" logic
 * but tolerates conversational variability.
 */
export function scoreDiscourseTurn(
  signals: DiscourseTurnSignals,
): DiscourseTurnResult {
  // Surrender / no speech → unambiguous failure
  if (signals.surrendered || signals.stuckType === "surrender") {
    return { successScore: 0, success: false };
  }
  if (!signals.meaningful || signals.wordCount === 0) {
    return { successScore: 0, success: false };
  }

  let score = 0.5; // baseline for "they spoke"

  // Word-count generosity: more sustained output → higher score
  if (signals.wordCount >= 12) score += 0.3;
  else if (signals.wordCount >= 6) score += 0.2;
  else if (signals.wordCount >= 3) score += 0.1;

  // Latency penalty (slow = struggling)
  if (signals.latencyToFirstWordMs != null) {
    if (signals.latencyToFirstWordMs > LONG_LATENCY_MS) score -= 0.2;
    else if (signals.latencyToFirstWordMs < 2500) score += 0.1;
  }

  // Stuck-type adjustments
  switch (signals.stuckType) {
    case "fluent":
    case "fluent_complete":
      score += 0.15;
      break;
    case "incomplete":
    case "filler_only":
    case "circumlocution":
      score -= 0.2;
      break;
    case "off_topic":
      score -= 0.1;
      break;
    case "long_latency":
      score -= 0.15;
      break;
  }

  // Scaffold tax: needing a hint means it was harder than ideal
  if (signals.scaffoldUsed) score -= 0.15;

  // Momentum signal (flow exercises)
  if (typeof signals.momentum === "number") {
    score = score * 0.6 + signals.momentum * 0.4;
  }

  score = Math.max(0, Math.min(1, score));
  return { successScore: score, success: score >= 0.6 };
}

/**
 * Decide whether to shift discourse difficulty based on recent history.
 * Operates on a sliding window so single bad turns don't whipsaw the level.
 */
export function decideDiscourseShift(
  recentScores: number[],
  currentLevel: number,
  latestSignals: DiscourseTurnSignals,
): DiscourseAdaptationDecision {
  const window = recentScores.slice(-WINDOW_SIZE);
  const avg =
    window.length > 0
      ? window.reduce((a, b) => a + b, 0) / window.length
      : 0.5;

  // Default: hold
  let direction: DiscourseDirection = "hold";
  let level = currentLevel;
  let reason = "Keeping difficulty steady";

  if (window.length >= 2) {
    if (avg >= UP_THRESHOLD && currentLevel < MAX_LEVEL) {
      direction = "up";
      level = currentLevel + 1;
      reason = "You're flowing — adding richer prompts";
    } else if (avg <= DOWN_THRESHOLD && currentLevel > MIN_LEVEL) {
      direction = "down";
      level = currentLevel - 1;
      reason = "Easing the prompts to support you";
    }
  }

  // Hard floor: a clear surrender immediately eases (one-shot down)
  if (
    (latestSignals.surrendered || latestSignals.stuckType === "surrender") &&
    currentLevel > MIN_LEVEL &&
    direction !== "down"
  ) {
    direction = "down";
    level = currentLevel - 1;
    reason = "Switching to a simpler prompt";
  }

  return {
    direction,
    level,
    reason,
    successRateInWindow: avg,
    windowSize: window.length,
  };
}
