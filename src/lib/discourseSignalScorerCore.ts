/**
 * Pure (no supabase, no DOM) types + local fallback scorer for the
 * discourse signal pipeline. Safe to import from Node scripts (calibration
 * runner) and edge functions, in addition to the browser client.
 *
 * The full `scoreDiscourseTurn` pipeline (LLM call + fallback) lives in
 * `discourseSignalScorer.ts` which depends on the supabase client.
 */

import {
  ACTIVE_CALIBRATION,
  applyErrorTypeCaps,
  computeSuccessScoreCalibrated,
  resolveAdaptation,
  type ScorerCalibration,
} from "./scorerCalibration";

export type DiscourseErrorType =
  | "fluent_correct"
  | "off_topic"
  | "incomplete"
  | "word_finding"
  | "circumlocution"
  | "semantic_paraphasia"
  | "phonemic_issue"
  | "no_response"
  | "surrender"
  | "unclear";

export type DiscourseAdaptationDirection = "up" | "down" | "hold";

export interface ClinicalSignal {
  onTopicScore: number;
  targetAchievementScore: number;
  responseQualityScore: number;
  errorType: DiscourseErrorType;
  confidence: number;
  recommendedAdaptation: DiscourseAdaptationDirection;
  reasoning: string;
  source: "llm" | "fallback" | "shortcircuit";
  model?: string;
  latencyMs?: number;
  successScore: number;
}

export interface ScoreInput {
  exerciseSlug: string;
  promptText: string;
  transcript: string;
  taskGoal?: string;
  topicKeywords?: string[];
  wordCount: number;
  latencyToFirstWordMs: number | null;
  durationMs?: number | null;
  scaffoldUsed?: boolean;
  turnNumber?: number;
}

export const SURRENDER_RE =
  /^(i don'?t know|idk|no idea|i can'?t|nothing|i forget|i forgot|don'?t remember|not sure|i'?m not sure|pass|skip)\.{0,3}$/i;
export const FILLER_ONLY_RE = /^(um+|uh+|er+|ah+|hmm+)(\s+(um+|uh+|er+|ah+|hmm+))*\.{0,3}$/i;

export const ERROR_TYPES = new Set<DiscourseErrorType>([
  "fluent_correct",
  "off_topic",
  "incomplete",
  "word_finding",
  "circumlocution",
  "semantic_paraphasia",
  "phonemic_issue",
  "no_response",
  "surrender",
  "unclear",
]);

export function clamp01(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Pre-LLM short-circuits (no_response / surrender / filler-only). */
export function shortCircuit(input: ScoreInput, cal: ScorerCalibration = ACTIVE_CALIBRATION): ClinicalSignal | null {
  const cleaned = input.transcript.trim();

  if (!cleaned || input.wordCount === 0) {
    const sub = applyErrorTypeCaps(
      { onTopicScore: 0, targetAchievementScore: 0, responseQualityScore: 0 },
      "no_response", cal,
    );
    const successScore = computeSuccessScoreCalibrated(sub, cal);
    return {
      ...sub,
      errorType: "no_response",
      confidence: 0.95,
      recommendedAdaptation: resolveAdaptation(successScore, "no_response", 0.95, cal),
      reasoning: "User did not speak this turn.",
      source: "shortcircuit",
      successScore,
    };
  }

  if (SURRENDER_RE.test(cleaned)) {
    const sub = applyErrorTypeCaps(
      { onTopicScore: 0, targetAchievementScore: 0, responseQualityScore: 0.1 },
      "surrender", cal,
    );
    const successScore = computeSuccessScoreCalibrated(sub, cal);
    return {
      ...sub,
      errorType: "surrender",
      confidence: 0.95,
      recommendedAdaptation: resolveAdaptation(successScore, "surrender", 0.95, cal),
      reasoning: "User explicitly surrendered (e.g. 'I don't know').",
      source: "shortcircuit",
      successScore,
    };
  }

  if (FILLER_ONLY_RE.test(cleaned)) {
    const sub = applyErrorTypeCaps(
      { onTopicScore: 0, targetAchievementScore: 0, responseQualityScore: 0.1 },
      "incomplete", cal,
    );
    const successScore = computeSuccessScoreCalibrated(sub, cal);
    return {
      ...sub,
      errorType: "incomplete",
      confidence: 0.9,
      recommendedAdaptation: resolveAdaptation(successScore, "incomplete", 0.9, cal),
      reasoning: "Only filler/hesitation tokens — no meaningful content.",
      source: "shortcircuit",
      successScore,
    };
  }

  return null;
}

/** Local heuristic fallback (calibration-aware). */
export function localFallbackScore(
  input: ScoreInput,
  cal: ScorerCalibration = ACTIVE_CALIBRATION,
): ClinicalSignal {
  const cleaned = input.transcript.trim().toLowerCase();
  const wc = input.wordCount;

  const keywords = (input.topicKeywords || []).map((k) => k.toLowerCase()).filter(Boolean);
  let topicHits = 0;
  for (const kw of keywords) if (cleaned.includes(kw)) topicHits += 1;
  const onTopicScore = keywords.length === 0
    ? 0.5
    : Math.min(1, topicHits / Math.max(1, Math.min(keywords.length, 3)));

  let targetAchievementScore = 0;
  if (wc >= 3) targetAchievementScore += 0.3;
  if (wc >= 8) targetAchievementScore += 0.2;
  targetAchievementScore += onTopicScore * 0.5;
  if (input.scaffoldUsed) targetAchievementScore -= 0.15;
  if (input.latencyToFirstWordMs != null && input.latencyToFirstWordMs > cal.latency.targetPenaltyMs) {
    targetAchievementScore -= 0.1;
  }
  targetAchievementScore = clamp01(targetAchievementScore);

  let responseQualityScore = 0.3;
  if (wc >= 5) responseQualityScore += 0.2;
  if (wc >= 10) responseQualityScore += 0.2;
  if (wc >= 15) responseQualityScore += 0.1;
  responseQualityScore = clamp01(responseQualityScore);

  let errorType: DiscourseErrorType = "fluent_correct";
  if (wc < 3) errorType = "incomplete";
  else if (onTopicScore < 0.2 && wc >= 4) errorType = "off_topic";
  else if (input.latencyToFirstWordMs != null && input.latencyToFirstWordMs > cal.latency.wordFindingMs) {
    errorType = "word_finding";
  } else if (/\b(the thing|you know|whatchamacallit|that thing)\b/i.test(cleaned)) {
    errorType = "circumlocution";
  }

  const sub = applyErrorTypeCaps({ onTopicScore, targetAchievementScore, responseQualityScore }, errorType, cal);
  const successScore = computeSuccessScoreCalibrated(sub, cal);
  const confidence = 0.45;
  const recommendedAdaptation = resolveAdaptation(successScore, errorType, confidence, cal);

  return {
    ...sub,
    errorType,
    confidence,
    recommendedAdaptation,
    reasoning: `Local heuristic: words=${wc}, topicHits=${topicHits}/${keywords.length}, latency=${input.latencyToFirstWordMs ?? "?"}ms.`,
    source: "fallback",
    successScore,
  };
}
