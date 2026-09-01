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
 * Pure helpers (types, shortCircuit, localFallbackScore, calibration plumbing)
 * live in `discourseSignalScorerCore.ts` so they can be reused by Node-side
 * scripts (calibration runner) without dragging in the supabase client.
 *
 * Used by:
 *   - ConversationPartnerGame (Free Talk)
 *   - ThoughtContinuationGame (Finish the Thought)
 */

import { supabase } from "@/integrations/supabase/client";
import { showCrisisSafetyNotice } from "@/lib/safety/crisisDetection";
import {
  ACTIVE_CALIBRATION,
  applyErrorTypeCaps,
  computeSuccessScoreCalibrated,
  resolveAdaptation,
} from "./scorerCalibration";
import {
  shortCircuit,
  localFallbackScore,
  ERROR_TYPES,
  clamp01,
  type ClinicalSignal,
  type DiscourseErrorType,
  type DiscourseAdaptationDirection,
  type ScoreInput,
} from "./discourseSignalScorerCore";

// Re-export the public surface so existing callers don't need to change imports.
export {
  shortCircuit,
  localFallbackScore,
  type ClinicalSignal,
  type DiscourseErrorType,
  type DiscourseAdaptationDirection,
  type ScoreInput,
};

// Must stay > server TIMEOUT_MS (12000) so the edge function gets a chance to
// either succeed or return a structured error before the client aborts.
const LLM_CLIENT_TIMEOUT_MS = 13000;

/**
 * Tokens that are safe to fast-path even at ≤2 words: pure fillers, isolated
 * yes/no/ok acknowledgements, and discourse markers with no semantic content.
 * Anything else (including a single content word like "fork", "spoon", "dog")
 * MUST be sent to the LLM so semantic_paraphasia / off_topic / incomplete
 * are graded by clinical judgment, not word count.
 */
const NON_CONTENT_SHORT_RE =
  /^(?:(?:um+|uh+|er+|ah+|hmm+|mm+|mhm+|hm+|eh+|oh+)|(?:yes|yeah|yep|yup|no|nope|nah|ok|okay|sure|right|alright|fine|maybe|whatever|so|well|like|anyway))(?:\s+(?:um+|uh+|er+|ah+|hmm+|mm+|mhm+|hm+|eh+|oh+|yes|yeah|yep|yup|no|nope|nah|ok|okay|sure|right|alright|fine|maybe|whatever|so|well|like|anyway))?[\s.!?,]*$/i;

function isNonContentShort(transcript: string): boolean {
  const cleaned = transcript.trim();
  if (!cleaned) return true;
  return NON_CONTENT_SHORT_RE.test(cleaned);
}

/**
 * Main entry point. Always returns a ClinicalSignal; never throws.
 */
export async function scoreDiscourseTurn(input: ScoreInput): Promise<ClinicalSignal> {
  // 1) Instant short-circuit when the answer is unambiguous.
  const sc = shortCircuit(input);
  if (sc) return sc;

  // 1b) Short-input fast-path — but ONLY for non-content tokens.
  //
  // Critical clinical rule: "fork" (1 word) in response to "What do you use to
  // eat soup?" is a textbook semantic_paraphasia and MUST go to the LLM.
  // The previous blanket ≤2-word fallback misclassified meaningful short
  // answers as `incomplete` and destroyed semantic-paraphasia detection.
  //
  // We only fast-path when the short input is clearly non-content
  // (single filler, isolated yes/no, isolated discourse marker). Real
  // content words — even one of them — go through the LLM.
  if (input.wordCount > 0 && input.wordCount <= 2 && isNonContentShort(input.transcript)) {
    const fast = localFallbackScore(input);
    return {
      ...fast,
      reasoning: `Short non-content fast-path. ${fast.reasoning}`,
    };
  }

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
    // Safety gate tripped server-side (covers typed input that never passes
    // through the speech-recognition hook). Surface the fixed guidance and
    // return the deterministic local score so adaptation gets a sane,
    // LLM-free signal for this turn.
    if (data && typeof data === "object" && (data as { crisis?: boolean }).crisis === true) {
      const kind = (data as { crisisKind?: string }).crisisKind === "medical_emergency"
        ? "medical_emergency" as const
        : "self_harm" as const;
      showCrisisSafetyNotice(kind);
      return localFallbackScore(input);
    }
    if (!data || typeof data !== "object" || data.error) {
      console.warn("[discourseScorer] invalid LLM payload, falling back:", data);
      return localFallbackScore(input);
    }

    const rawSub = {
      onTopicScore: clamp01(data.onTopicScore),
      targetAchievementScore: clamp01(data.targetAchievementScore),
      responseQualityScore: clamp01(data.responseQualityScore),
    };
    const errorType = (ERROR_TYPES.has(data.errorType) ? data.errorType : "unclear") as DiscourseErrorType;
    const confidence = clamp01(data.confidence ?? 0.7);

    // Apply calibration: error-type caps + calibrated success + calibrated adaptation.
    const sub = applyErrorTypeCaps(rawSub, errorType, ACTIVE_CALIBRATION);
    const successScore = computeSuccessScoreCalibrated(sub, ACTIVE_CALIBRATION);
    const recommendedAdaptation = resolveAdaptation(successScore, errorType, confidence, ACTIVE_CALIBRATION);

    return {
      ...sub,
      errorType,
      confidence,
      recommendedAdaptation,
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
