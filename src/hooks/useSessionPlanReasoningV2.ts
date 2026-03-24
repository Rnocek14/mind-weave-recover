/**
 * useSessionPlanReasoningV2 — Hook that assembles the canonical V2 reasoning
 * from real engine outputs (runtime_config, adaptation_events, overrides).
 *
 * Consumes the same data sources as V1 but produces a first-class reasoning
 * object with plan deltas, excluded candidates, and applied adjustments.
 */

import { useMemo } from "react";
import {
  useStrengthsAndFocusAreas,
  type StrengthAreaCard,
  type FocusAreaCard,
  type GlobalAdjustment,
  type PlanSummaryStatement,
} from "@/hooks/useStrengthsAndFocusAreas";
import {
  useTherapyFocusData,
  type TherapyFocusCard,
  type SessionRationale,
} from "@/hooks/useTherapyFocusData";
import {
  assembleSessionPlanReasoning,
  type SessionPlanReasoningV2,
  type ReasoningAssemblerInput,
} from "@/lib/sessionPlanReasoningV2";
import type { AdaptationEvent } from "@/hooks/useAdaptationTimeline";
import type { ClinicianOverride } from "@/hooks/useClinicianOverrides";
import type { UiRole } from "@/lib/roleVocabulary";
import type { WeeklyPlanNarrative, ExercisePlan } from "@/hooks/useSessionPlanReasoning";
import { getExerciseDomain } from "@/lib/exerciseDomainMap";
import { getFocusAreaDefinition } from "@/lib/focusAreaDefinitions";

// Re-export V1 types that UI still consumes
export type { WeeklyPlanNarrative, ExercisePlan };

interface UseSessionPlanReasoningV2Params {
  clinicalProfile: Record<string, any> | null;
  runtimeConfig: Record<string, any> | null;
  activeExerciseSlugs: string[];
  adaptationEvents?: AdaptationEvent[];
  activeOverrides?: ClinicianOverride[];
  /** Previous session's active slugs — for plan delta */
  previousExerciseSlugs?: string[];
  /** Previous runtime config — for plan delta */
  previousRuntimeConfig?: Record<string, any> | null;
  previousOverrides?: ClinicianOverride[];
  role?: UiRole;
}

export interface SessionPlanReasoningV2Result {
  // V2 canonical object
  v2: SessionPlanReasoningV2;

  // V1-compatible fields (for existing UI consumers)
  strengths: StrengthAreaCard[];
  focusAreas: FocusAreaCard[];
  planSummary: PlanSummaryStatement;
  globalAdjustments: GlobalAdjustment[];
  exercisePlans: ExercisePlan[];
  cardsByDomain: Record<string, TherapyFocusCard[]>;
  sessionRationale: SessionRationale;
  weeklyNarrative: WeeklyPlanNarrative;
  targetedOutcomes: string[];
  confidence: "high" | "moderate" | "low";
  activeExerciseCount: number;
}

export function useSessionPlanReasoningV2({
  clinicalProfile,
  runtimeConfig,
  activeExerciseSlugs,
  adaptationEvents = [],
  activeOverrides = [],
  previousExerciseSlugs,
  previousRuntimeConfig,
  previousOverrides,
  role = "patient",
}: UseSessionPlanReasoningV2Params): SessionPlanReasoningV2Result {
  // Existing V1 hooks for backward compatibility
  const { strengths, focusAreas, planSummary, globalAdjustments } = useStrengthsAndFocusAreas({
    clinicalProfile,
    runtimeConfig,
    activeExerciseSlugs,
    adaptationEvents,
    activeOverrides,
  });

  const { cards: therapyCards, cardsByDomain, sessionRationale } = useTherapyFocusData({
    activeExerciseSlugs,
    clinicalProfile,
    runtimeConfig,
    adaptationEvents,
    activeOverrides,
  });

  // V2 reasoning
  const v2 = useMemo(() => {
    const input: ReasoningAssemblerInput = {
      clinicalProfile,
      runtimeConfig,
      activeExerciseSlugs,
      adaptationEvents,
      activeOverrides,
      previousExerciseSlugs,
      previousRuntimeConfig,
      previousOverrides,
    };
    return assembleSessionPlanReasoning(input);
  }, [
    clinicalProfile,
    runtimeConfig,
    activeExerciseSlugs,
    adaptationEvents,
    activeOverrides,
    previousExerciseSlugs,
    previousRuntimeConfig,
    previousOverrides,
  ]);

  // Build V1-compatible exercise plans from V2 selection
  const exercisePlans = useMemo<ExercisePlan[]>(() => {
    return v2.exerciseSelection
      .filter((e) => e.selected)
      .map((sel) => {
        const entry = getExerciseDomain(sel.slug);
        const primaryFocusAreaId = sel.focusAreaIds[0] || "general";
        const faDef = getFocusAreaDefinition(primaryFocusAreaId);

        // Find matching adjustment
        const exAdj = v2.appliedAdjustments.exerciseSpecific.find(
          (a) => a.slug === sel.slug
        );

        return {
          slug: sel.slug,
          displayName: sel.displayName,
          focusAreaId: primaryFocusAreaId,
          focusAreaLabel: faDef?.label || primaryFocusAreaId,
          selectedBecause: sel.selectedBecause.join("; "),
          currentLevel: exAdj
            ? `Difficulty ${exAdj.value}`
            : v2.appliedAdjustments.global.find((g) => g.type === "difficulty")
            ? `Global ${v2.appliedAdjustments.global.find((g) => g.type === "difficulty")!.value}`
            : "Default",
          cueSupport: v2.appliedAdjustments.global.find((g) => g.type === "cue_level")
            ? v2.appliedAdjustments.global.find((g) => g.type === "cue_level")!.value
            : "Auto",
          adaptationReason: exAdj?.reason || "Default settings",
          provenance: sel.provenance,
          recentSignal: v2.stateSummary.recentSignals.find(
            (s) => s.exerciseSlug === sel.slug
          )?.interpretation || null,
          expectedGain: sel.expectedGain,
          linkedOutcomeMetrics: sel.linkedOutcomes,
          hasSpeechOutput: entry?.hasSpeechOutput ?? false,
        };
      });
  }, [v2]);

  // Build weekly narrative from V2
  const weeklyNarrative = useMemo<WeeklyPlanNarrative>(() => {
    const focusLabels = v2.planIntent.primaryFocusAreas
      .map((id) => getFocusAreaDefinition(id)?.label.toLowerCase())
      .filter(Boolean) as string[];
    const strengthLabels = v2.stateSummary.strengths
      .slice(0, 2)
      .map((id) => getFocusAreaDefinition(id)?.label.toLowerCase())
      .filter(Boolean) as string[];

    const emphasis = v2.planIntent.narrative;

    const whyParts: string[] = [];
    focusAreas
      .filter((f) => f.classification === "focus")
      .slice(0, 2)
      .forEach((fa) => {
        whyParts.push(`${fa.title.toLowerCase()} — ${fa.clinicianSignal.toLowerCase()}`);
      });
    const whyThisWeek = whyParts.length > 0
      ? whyParts.join("; ")
      : "Based on recovery profile and current performance";

    // Adaptation summary from V2
    const adaptParts: string[] = [];
    if (v2.appliedAdjustments.global.length > 0) {
      adaptParts.push(
        v2.appliedAdjustments.global
          .map((g) => `${g.type === "difficulty" ? "Difficulty" : "Cue"}: ${g.value}`)
          .join(", ")
      );
    }
    if (v2.appliedAdjustments.exerciseSpecific.length > 0) {
      adaptParts.push(
        `${v2.appliedAdjustments.exerciseSpecific.length} exercise-specific adjustment${v2.appliedAdjustments.exerciseSpecific.length > 1 ? "s" : ""}`
      );
    }
    const adaptationSummary = adaptParts.length > 0 ? adaptParts.join(", ") : "Default settings active";

    const outcomeLabels: Record<string, string> = {
      word_mastery: "word mastery",
      cue_independence: "cue independence",
      error_quality: "error quality",
    };
    const intendedOutcomes = v2.planIntent.intendedOutcomes.length > 0
      ? `Expected to improve: ${v2.planIntent.intendedOutcomes.map((o) => outcomeLabels[o] || o).join(", ")}`
      : "General communication improvement";

    // Patient version
    const patientFocusLabels = v2.planIntent.primaryFocusAreas
      .slice(0, 2)
      .map((id) => getFocusAreaDefinition(id)?.patientLabel.toLowerCase())
      .filter(Boolean);
    const patientVersion = patientFocusLabels.length > 0
      ? `Your exercises are helping with ${patientFocusLabels.join(" and ")}. ${strengthLabels.length > 0 ? `You're doing well with ${strengthLabels.join(" and ")}!` : "Keep practicing!"}`
      : "Your exercises are helping with overall communication recovery.";

    // Caregiver version
    const caregiverVersion = focusLabels.length > 0
      ? `Therapy is focusing on ${focusLabels.join(" and ")} because ${whyParts.length > 0 ? whyParts[0] : "these are current needs"}. The goal is ${v2.planIntent.intendedOutcomes.length > 0 ? `improving ${v2.planIntent.intendedOutcomes.map((o) => outcomeLabels[o] || o).join(" and ")}` : "ongoing recovery support"}.`
      : "Therapy is supporting general communication recovery.";

    return {
      emphasis,
      whyThisWeek,
      adaptationSummary,
      intendedOutcomes,
      patientVersion,
      caregiverVersion,
    };
  }, [v2, focusAreas]);

  return {
    v2,
    strengths,
    focusAreas,
    planSummary,
    globalAdjustments,
    exercisePlans,
    cardsByDomain,
    sessionRationale,
    weeklyNarrative,
    targetedOutcomes: v2.planIntent.intendedOutcomes,
    confidence: v2.confidence,
    activeExerciseCount: activeExerciseSlugs.length,
  };
}
