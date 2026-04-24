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

const LLM_CLIENT_TIMEOUT_MS = 7000;

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
