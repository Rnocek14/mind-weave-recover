/**
 * useSessionPlanReasoning — Canonical source of truth for the treatment reasoning chain.
 *
 * Composes: User Recovery State + Plan Strategy + Outcome Linkage
 * into one unified model that ALL explainability surfaces consume.
 *
 * Replaces scattered reconstruction in WhyThisPlan, PlanTab, RecoveryFocusSummary, etc.
 *
 * Three layers:
 *  Layer 1 — Recovery State: strengths, focus areas, maintained, uncovered, trends
 *  Layer 2 — Plan Strategy: weekly emphasis, exercises, adaptations, changes
 *  Layer 3 — Outcome Linkage: which metrics this plan should move
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
import { getExerciseDomain } from "@/lib/exerciseDomainMap";
import { getFocusAreaDefinition } from "@/lib/focusAreaDefinitions";
import type { AdaptationEvent } from "@/hooks/useAdaptationTimeline";
import type { ClinicianOverride } from "@/hooks/useClinicianOverrides";
import type { UiRole } from "@/lib/roleVocabulary";

// ─── Output types ───

export interface ExercisePlan {
  slug: string;
  displayName: string;
  focusAreaId: string;
  focusAreaLabel: string;
  /** Why this exercise is in the plan right now */
  selectedBecause: string;
  /** Current difficulty/cue settings */
  currentLevel: string;
  /** Cue support description */
  cueSupport: string;
  /** Why the system or clinician adapted it */
  adaptationReason: string;
  /** Who changed it */
  provenance: "system" | "clinician" | "mixed" | "default";
  /** Most recent signal */
  recentSignal: string | null;
  /** Expected functional gain */
  expectedGain: string;
  /** Which outcome metrics this should move */
  linkedOutcomeMetrics: string[];
  /** Has speech output */
  hasSpeechOutput: boolean;
}

export interface WeeklyPlanNarrative {
  /** 1-sentence emphasis statement */
  emphasis: string;
  /** Why this week's plan looks this way */
  whyThisWeek: string;
  /** What adaptations are active */
  adaptationSummary: string;
  /** What outcomes this should improve */
  intendedOutcomes: string;
  /** Patient-friendly version */
  patientVersion: string;
  /** Caregiver-friendly version */
  caregiverVersion: string;
}

export interface SessionPlanReasoning {
  // ── Layer 1: Recovery State ──
  strengths: StrengthAreaCard[];
  focusAreas: FocusAreaCard[];
  planSummary: PlanSummaryStatement;
  globalAdjustments: GlobalAdjustment[];

  // ── Layer 2: Plan Strategy ──
  exercisePlans: ExercisePlan[];
  /** Therapy focus cards grouped by domain */
  cardsByDomain: Record<string, TherapyFocusCard[]>;
  sessionRationale: SessionRationale;
  weeklyNarrative: WeeklyPlanNarrative;

  // ── Layer 3: Outcome Linkage ──
  /** Unique outcome metrics this plan targets */
  targetedOutcomes: string[];
  /** Recent plan changes (adaptations + overrides) */
  recentPlanChanges: PlanChange[];

  // ── Meta ──
  confidence: "high" | "moderate" | "low";
  activeExerciseCount: number;
}

export interface PlanChange {
  type: "adaptation" | "clinician_override";
  description: string;
  date: string;
  exerciseSlug?: string;
}

// ─── Input params ───

interface UseSessionPlanReasoningParams {
  clinicalProfile: Record<string, any> | null;
  runtimeConfig: Record<string, any> | null;
  activeExerciseSlugs: string[];
  adaptationEvents?: AdaptationEvent[];
  activeOverrides?: ClinicianOverride[];
  /** For narrative generation */
  role?: UiRole;
}

export function useSessionPlanReasoning({
  clinicalProfile,
  runtimeConfig,
  activeExerciseSlugs,
  adaptationEvents = [],
  activeOverrides = [],
  role = "patient",
}: UseSessionPlanReasoningParams): SessionPlanReasoning {
  // Compose existing hooks — single computation path
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

  return useMemo(() => {
    // ── Build ExercisePlans from therapy cards + focus area linkage ──
    const exercisePlans: ExercisePlan[] = therapyCards.map((card) => {
      const entry = getExerciseDomain(card.slug);
      const primaryFocusAreaId = entry?.focusAreas?.[0] || "general";
      const faDef = getFocusAreaDefinition(primaryFocusAreaId);

      return {
        slug: card.slug,
        displayName: card.displayName,
        focusAreaId: primaryFocusAreaId,
        focusAreaLabel: faDef?.label || primaryFocusAreaId,
        selectedBecause: card.whySelected,
        currentLevel: card.currentDifficulty !== null ? `Difficulty ${card.currentDifficulty > 0 ? "+" : ""}${card.currentDifficulty}` : "Default",
        cueSupport: card.currentCueLevel !== null ? `Level ${card.currentCueLevel}` : "Auto",
        adaptationReason: card.activeAdaptation,
        provenance: card.provenance,
        recentSignal: card.recentSignal,
        expectedGain: card.expectedGain,
        linkedOutcomeMetrics: card.outcomeMetrics,
        hasSpeechOutput: card.hasSpeechOutput,
      };
    });

    // ── Targeted outcomes (unique across all exercises) ──
    const outcomeSet = new Set<string>();
    exercisePlans.forEach((ep) => ep.linkedOutcomeMetrics.forEach((m) => outcomeSet.add(m)));
    const targetedOutcomes = Array.from(outcomeSet);

    // ── Recent plan changes ──
    const recentPlanChanges: PlanChange[] = [];

    // From adaptation events (last 7 days worth)
    adaptationEvents.slice(0, 10).forEach((e) => {
      recentPlanChanges.push({
        type: "adaptation",
        description: e.trigger_condition || `${e.adaptation_type} adjustment`,
        date: e.created_at,
        exerciseSlug: e.exercise_slug || undefined,
      });
    });

    // From active overrides
    activeOverrides.forEach((o) => {
      recentPlanChanges.push({
        type: "clinician_override",
        description: o.reason || `${o.overrideType} override`,
        date: o.createdAt,
        exerciseSlug: o.targetSlug || undefined,
      });
    });

    // Sort by date desc
    recentPlanChanges.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // ── Confidence ──
    const hasProfile = !!(clinicalProfile && Object.keys(clinicalProfile).length > 0);
    const hasAdaptations = adaptationEvents.length > 0 || activeOverrides.length > 0;
    const confidence: "high" | "moderate" | "low" =
      hasProfile && hasAdaptations ? "high" :
      hasProfile || hasAdaptations ? "moderate" :
      "low";

    // ── Weekly Plan Narrative ──
    const focusNames = focusAreas.filter(f => f.classification === "focus").slice(0, 3).map(f => f.title.toLowerCase());
    const strengthNames = strengths.filter(s => s.classification === "strength").slice(0, 2).map(s => s.title.toLowerCase());
    const adaptedCount = exercisePlans.filter(e => e.provenance !== "default").length;
    const clinicianCount = exercisePlans.filter(e => e.provenance === "clinician").length;

    const emphasisText = focusNames.length > 0
      ? `This week emphasizes ${focusNames.join(", ")}${strengthNames.length > 0 ? ` while maintaining ${strengthNames.join(" and ")}` : ""}`
      : "Exercises are supporting overall communication recovery";

    // Why this week
    const whyParts: string[] = [];
    focusAreas.filter(f => f.classification === "focus").slice(0, 2).forEach(fa => {
      const signal = fa.clinicianSignal.toLowerCase();
      whyParts.push(`${fa.title.toLowerCase()} — ${signal}`);
    });
    const whyThisWeek = whyParts.length > 0
      ? whyParts.join("; ")
      : "Plan is based on recovery profile and current performance level";

    // Adaptation summary
    const adaptParts: string[] = [];
    if (globalAdjustments.length > 0) {
      adaptParts.push(globalAdjustments.map(g => `${g.label}: ${g.value}`).join(", "));
    }
    if (adaptedCount > 0) {
      adaptParts.push(`${adaptedCount} exercise${adaptedCount > 1 ? "s" : ""} adapted`);
    }
    if (clinicianCount > 0) {
      adaptParts.push(`${clinicianCount} clinician override${clinicianCount > 1 ? "s" : ""}`);
    }
    const adaptationSummary = adaptParts.length > 0 ? adaptParts.join(", ") : "Default settings active";

    // Intended outcomes
    const outcomeLabels: Record<string, string> = {
      word_mastery: "word mastery",
      cue_independence: "cue independence",
      error_quality: "error quality",
    };
    const intendedOutcomes = targetedOutcomes.length > 0
      ? `Expected to improve: ${targetedOutcomes.map(o => outcomeLabels[o] || o).join(", ")}`
      : "General communication improvement";

    // Patient version
    const patientFocusNames = focusAreas.filter(f => f.classification === "focus").slice(0, 2).map(f => f.patientTitle.toLowerCase());
    const patientVersion = patientFocusNames.length > 0
      ? `Your exercises are helping with ${patientFocusNames.join(" and ")}. ${strengthNames.length > 0 ? `You're doing well with ${strengthNames.join(" and ")}!` : "Keep practicing!"}`
      : "Your exercises are helping with overall communication recovery.";

    // Caregiver version
    const caregiverVersion = focusNames.length > 0
      ? `Therapy is focusing on ${focusNames.join(" and ")} because ${whyParts.length > 0 ? whyParts[0] : "these are current needs"}. The goal is ${targetedOutcomes.length > 0 ? `improving ${targetedOutcomes.map(o => outcomeLabels[o] || o).join(" and ")}` : "ongoing recovery support"}.`
      : "Therapy is supporting general communication recovery.";

    const weeklyNarrative: WeeklyPlanNarrative = {
      emphasis: emphasisText,
      whyThisWeek,
      adaptationSummary,
      intendedOutcomes,
      patientVersion,
      caregiverVersion,
    };

    return {
      strengths,
      focusAreas,
      planSummary,
      globalAdjustments,
      exercisePlans,
      cardsByDomain,
      sessionRationale,
      weeklyNarrative,
      targetedOutcomes,
      recentPlanChanges,
      confidence,
      activeExerciseCount: activeExerciseSlugs.length,
    };
  }, [
    strengths,
    focusAreas,
    planSummary,
    globalAdjustments,
    therapyCards,
    cardsByDomain,
    sessionRationale,
    adaptationEvents,
    activeOverrides,
    clinicalProfile,
    activeExerciseSlugs,
    role,
  ]);
}
