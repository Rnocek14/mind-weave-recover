/**
 * useDiscourseSignalScorer
 *
 * Bridges the LLM-first ClinicalSignal scorer into:
 *  - useDiscourseAdaptation (drives the up/down/hold AdaptationBadge)
 *  - exercise_events (clinician-grade audit log)
 *
 * Usage in a discourse exercise:
 *   const scorer = useDiscourseSignalScorer({ sessionId, exerciseSlug });
 *   const signal = await scorer.scoreAndRecord({ ... }, adaptation.recordTurn);
 */

import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeExerciseSlug } from "@/lib/exerciseSlugNormalizer";
import {
  scoreDiscourseTurn,
  type ClinicalSignal,
  type ScoreInput,
} from "@/lib/discourseSignalScorer";
import type { DiscourseTurnSignals } from "@/lib/discourseAdaptation";
import type { DiscourseAdaptationDecision } from "@/lib/discourseAdaptation";

interface UseDiscourseSignalScorerOptions {
  sessionId: string | null;
  exerciseSlug: string;
  /** Disable DB logging (defaults to true). */
  logToDatabase?: boolean;
}

export interface ScoreAndRecordResult {
  signal: ClinicalSignal;
  decision: DiscourseAdaptationDecision | null;
}

export function useDiscourseSignalScorer(opts: UseDiscourseSignalScorerOptions) {
  const { sessionId, exerciseSlug, logToDatabase = true } = opts;
  const turnIndexRef = useRef(0);

  const log = useCallback(
    async (
      input: ScoreInput,
      signal: ClinicalSignal,
    ) => {
      if (!logToDatabase || !sessionId) return;
      try {
        const isCorrect = signal.successScore >= 0.5;
        const resolvedErrorType: string = isCorrect
          ? 'correct'
          : (signal.errorType?.trim() || 'incorrect_unspecified');

        await supabase.from("exercise_events").insert({
          session_id: sessionId,
          exercise_slug: normalizeExerciseSlug(exerciseSlug),
          round: input.turnNumber ?? turnIndexRef.current,
          score: Math.round(signal.successScore * 100),
          reaction_time_ms: input.latencyToFirstWordMs ?? null,
          error_type: resolvedErrorType,
          inputs: {
            prompt: input.promptText,
            transcript: input.transcript,
            word_count: input.wordCount,
            duration_ms: input.durationMs ?? null,
            scaffold_used: !!input.scaffoldUsed,
            topic_keywords: input.topicKeywords ?? [],
            task_goal: input.taskGoal ?? null,
            error_type: resolvedErrorType,
          },
          outputs: {
            clinical_signal: {
              onTopicScore: signal.onTopicScore,
              targetAchievementScore: signal.targetAchievementScore,
              responseQualityScore: signal.responseQualityScore,
              successScore: signal.successScore,
              errorType: signal.errorType,
              confidence: signal.confidence,
              recommendedAdaptation: signal.recommendedAdaptation,
              reasoning: signal.reasoning,
              source: signal.source,
              model: signal.model ?? null,
              llm_latency_ms: signal.latencyMs ?? null,
            },
          },
          engagement_flags: {
            spoke: input.wordCount > 0,
            on_topic: signal.onTopicScore >= 0.5,
            target_achieved: signal.targetAchievementScore >= 0.6,
            scorer_source: signal.source,
          },
        });
      } catch (err) {
        // Logging is best-effort and must never block the user.
        console.warn("[discourseScorer] failed to log event:", err);
      }
    },
    [exerciseSlug, sessionId, logToDatabase],
  );

  const scoreAndRecord = useCallback(
    async (
      input: ScoreInput,
      recordTurn: (signals: DiscourseTurnSignals) => DiscourseAdaptationDecision,
    ): Promise<ScoreAndRecordResult> => {
      turnIndexRef.current += 1;
      const turnNumber = input.turnNumber ?? turnIndexRef.current;
      const signal = await scoreDiscourseTurn({ ...input, turnNumber });

      // Map the rich signal into the bridge's per-turn shape so the existing
      // sliding-window adaptation engine remains the single source of truth.
      const bridgeSignals: DiscourseTurnSignals = {
        meaningful: input.wordCount >= 2 && signal.errorType !== "surrender" && signal.errorType !== "no_response",
        wordCount: input.wordCount,
        latencyToFirstWordMs: input.latencyToFirstWordMs,
        scaffoldUsed: !!input.scaffoldUsed,
        surrendered: signal.errorType === "surrender",
        stuckType: mapErrorTypeToStuckType(signal.errorType),
        // Override the bridge's heuristic momentum with the LLM-derived success.
        momentum: signal.successScore,
      };

      const decision = recordTurn(bridgeSignals);

      // Fire-and-forget DB log. Don't await — keep flow snappy.
      void log({ ...input, turnNumber }, signal);

      return { signal, decision };
    },
    [log],
  );

  const reset = useCallback(() => {
    turnIndexRef.current = 0;
  }, []);

  return { scoreAndRecord, reset };
}

function mapErrorTypeToStuckType(t: ClinicalSignal["errorType"]) {
  switch (t) {
    case "no_response":
      return "no_speech";
    case "surrender":
      return "surrender";
    case "incomplete":
      return "incomplete";
    case "off_topic":
      return "off_topic";
    case "word_finding":
      return "long_latency";
    case "circumlocution":
      return "circumlocution";
    case "fluent_correct":
      return "fluent_complete";
    default:
      return "incomplete";
  }
}
