/**
 * Discourse Signal Scorer
 *
 * LLM-first clinical scoring for discourse turns with a local hybrid fallback.
 * Returns a unified ClinicalSignal that drives the discourse adaptation engine
 * AND can be persisted to exercise_events for the clinician dashboard.
 *
 * Architecture:
 *   1. Pre-LLM short-circuits (no_response / surrender / filler-only) — instant.
 *   2. LLM scorer via score-discourse-turn edge function — primary path.
 *   3. Local heuristic fallback if LLM fails, times out, or short-circuits.
 *
 * Used by:
 *   - ConversationPartnerGame (Free Talk)
 *   - ThoughtContinuationGame (Finish the Thought)
 */

import { supabase } from "@/integrations/supabase/client";

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
  onTopicScore: number;            // 0..1
  targetAchievementScore: number;  // 0..1
  responseQualityScore: number;    // 0..1
  errorType: DiscourseErrorType;
  confidence: number;              // 0..1
  recommendedAdaptation: DiscourseAdaptationDirection;
  reasoning: string;
  source: "llm" | "fallback" | "shortcircuit";
  model?: string;
  latencyMs?: number;
  /** Composite 0..1 success score consumed by the adaptation engine. */
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

const SURRENDER_RE =
  /^(i don'?t know|idk|no idea|i can'?t|nothing|i forget|i forgot|don'?t remember|not sure|i'?m not sure|pass|skip)\.{0,3}$/i;
const FILLER_ONLY_RE = /^(um+|uh+|er+|ah+|hmm+)(\s+(um+|uh+|er+|ah+|hmm+))*\.{0,3}$/i;

const LLM_CLIENT_TIMEOUT_MS = 5000; // slightly above edge-function 4s server cap

/**
 * Compute the composite success score from the four sub-scores.
 * Weights tuned for stroke rehab where target achievement matters most.
 */
function computeSuccessScore(s: {
  onTopicScore: number;
  targetAchievementScore: number;
  responseQualityScore: number;
}): number {
  const composite =
    s.targetAchievementScore * 0.55 +
    s.onTopicScore * 0.25 +
    s.responseQualityScore * 0.2;
  return Math.max(0, Math.min(1, composite));
}

/**
 * Pre-LLM short-circuits. These cases are unambiguous and don't need the model.
 * Returns null if the input does not match a short-circuit case.
 */
function shortCircuit(input: ScoreInput): ClinicalSignal | null {
  const cleaned = input.transcript.trim();

  if (!cleaned || input.wordCount === 0) {
    const sub = { onTopicScore: 0, targetAchievementScore: 0, responseQualityScore: 0 };
    return {
      ...sub,
      errorType: "no_response",
      confidence: 0.95,
      recommendedAdaptation: "down",
      reasoning: "User did not speak this turn.",
      source: "shortcircuit",
      successScore: computeSuccessScore(sub),
    };
  }

  if (SURRENDER_RE.test(cleaned)) {
    const sub = { onTopicScore: 0, targetAchievementScore: 0, responseQualityScore: 0.1 };
    return {
      ...sub,
      errorType: "surrender",
      confidence: 0.95,
      recommendedAdaptation: "down",
      reasoning: "User explicitly surrendered (e.g. 'I don't know').",
      source: "shortcircuit",
      successScore: computeSuccessScore(sub),
    };
  }

  if (FILLER_ONLY_RE.test(cleaned)) {
    const sub = { onTopicScore: 0, targetAchievementScore: 0, responseQualityScore: 0.1 };
    return {
      ...sub,
      errorType: "incomplete",
      confidence: 0.9,
      recommendedAdaptation: "down",
      reasoning: "Only filler/hesitation tokens — no meaningful content.",
      source: "shortcircuit",
      successScore: computeSuccessScore(sub),
    };
  }

  return null;
}

/**
 * Local heuristic fallback. Used when the LLM fails, times out, is rate-limited,
 * or returns malformed output. Mirrors the legacy scoring shape but produces
 * the new ClinicalSignal so downstream code is unified.
 */
export function localFallbackScore(input: ScoreInput): ClinicalSignal {
  const cleaned = input.transcript.trim().toLowerCase();
  const wc = input.wordCount;

  // Topic overlap via keyword presence
  const keywords = (input.topicKeywords || []).map(k => k.toLowerCase()).filter(Boolean);
  let topicHits = 0;
  for (const kw of keywords) {
    if (cleaned.includes(kw)) topicHits += 1;
  }
  const onTopicScore = keywords.length === 0
    ? 0.5
    : Math.min(1, topicHits / Math.max(1, Math.min(keywords.length, 3)));

  // Target achievement heuristic: needs both content volume AND topic relevance
  let targetAchievementScore = 0;
  if (wc >= 3) targetAchievementScore += 0.3;
  if (wc >= 8) targetAchievementScore += 0.2;
  targetAchievementScore += onTopicScore * 0.5;
  if (input.scaffoldUsed) targetAchievementScore -= 0.15;
  if (input.latencyToFirstWordMs != null && input.latencyToFirstWordMs > 6000) {
    targetAchievementScore -= 0.1;
  }
  targetAchievementScore = Math.max(0, Math.min(1, targetAchievementScore));

  // Quality: word count + completeness signals
  let responseQualityScore = 0.3;
  if (wc >= 5) responseQualityScore += 0.2;
  if (wc >= 10) responseQualityScore += 0.2;
  if (wc >= 15) responseQualityScore += 0.1;
  responseQualityScore = Math.max(0, Math.min(1, responseQualityScore));

  // Error-type heuristic
  let errorType: DiscourseErrorType = "fluent_correct";
  if (wc < 3) errorType = "incomplete";
  else if (onTopicScore < 0.2 && wc >= 4) errorType = "off_topic";
  else if (input.latencyToFirstWordMs != null && input.latencyToFirstWordMs > 8000) {
    errorType = "word_finding";
  } else if (/\b(the thing|you know|whatchamacallit|that thing)\b/i.test(cleaned)) {
    errorType = "circumlocution";
  }

  const sub = { onTopicScore, targetAchievementScore, responseQualityScore };
  const successScore = computeSuccessScore(sub);

  // Adaptation recommendation
  let recommendedAdaptation: DiscourseAdaptationDirection = "hold";
  if (successScore >= 0.78) recommendedAdaptation = "up";
  else if (successScore <= 0.4) recommendedAdaptation = "down";

  return {
    ...sub,
    errorType,
    confidence: 0.45, // Lower than LLM by design
    recommendedAdaptation,
    reasoning: `Local heuristic: words=${wc}, topicHits=${topicHits}/${keywords.length}, latency=${input.latencyToFirstWordMs ?? "?"}ms.`,
    source: "fallback",
    successScore,
  };
}

/**
 * Main entry point. Always returns a ClinicalSignal; never throws.
 */
export async function scoreDiscourseTurn(input: ScoreInput): Promise<ClinicalSignal> {
  // 1) Instant short-circuit when the answer is unambiguous.
  const sc = shortCircuit(input);
  if (sc) return sc;

  // 2) LLM primary path with client-side timeout safety net.
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), LLM_CLIENT_TIMEOUT_MS);

  try {
    const { data, error } = await supabase.functions.invoke("score-discourse-turn", {
      body: input,
    });
    clearTimeout(timeoutHandle);

    if (error) {
      console.warn("[discourseScorer] edge function error, falling back:", error.message);
      return localFallbackScore(input);
    }
    if (!data || typeof data !== "object" || data.error) {
      console.warn("[discourseScorer] invalid LLM payload, falling back:", data);
      return localFallbackScore(input);
    }

    const sub = {
      onTopicScore: clamp01(data.onTopicScore),
      targetAchievementScore: clamp01(data.targetAchievementScore),
      responseQualityScore: clamp01(data.responseQualityScore),
    };
    const successScore = computeSuccessScore(sub);

    return {
      ...sub,
      errorType: (ERROR_TYPES.has(data.errorType) ? data.errorType : "unclear") as DiscourseErrorType,
      confidence: clamp01(data.confidence ?? 0.7),
      recommendedAdaptation:
        data.recommendedAdaptation === "up" || data.recommendedAdaptation === "down"
          ? data.recommendedAdaptation
          : "hold",
      reasoning: typeof data.reasoning === "string" ? data.reasoning.slice(0, 240) : "",
      source: "llm",
      model: typeof data.model === "string" ? data.model : undefined,
      latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : undefined,
      successScore,
    };
  } catch (err) {
    clearTimeout(timeoutHandle);
    console.warn("[discourseScorer] exception, falling back:", err);
    return localFallbackScore(input);
  }
}

const ERROR_TYPES = new Set<DiscourseErrorType>([
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

function clamp01(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
