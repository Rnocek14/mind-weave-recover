/**
 * useStrengthsAndFocusAreas — derives strengths and focus areas
 * from clinical profile, runtime config, adaptation events, and exercise domain map.
 * 
 * Outputs two arrays: strengths (areas doing well) and focusAreas (areas needing work).
 */

import { useMemo } from "react";
import { EXERCISE_DOMAIN_MAP, getExerciseDomain } from "@/lib/exerciseDomainMap";
import { FOCUS_AREA_DEFINITIONS, getFocusAreaDefinition } from "@/lib/focusAreaDefinitions";
import type { AdaptationEvent } from "@/hooks/useAdaptationTimeline";
import type { ClinicianOverride } from "@/hooks/useClinicianOverrides";

export interface StrengthAreaCard {
  id: string;
  title: string;
  patientTitle: string;
  reason: string;
  patientReason: string;
  supportingSignals: string[];
  exercises: string[];
  systemPlan: string;
  functionalMeaning: string;
  linkedOutcomes: string[];
}

export interface FocusAreaCard {
  id: string;
  title: string;
  patientTitle: string;
  whyNeeded: string;
  patientWhyNeeded: string;
  supportingSignals: string[];
  exercises: string[];
  activeAdaptation: string;
  expectedGain: string;
  linkedOutcomes: string[];
  provenance: "system" | "clinician" | "mixed" | "default";
}

export interface PlanSummaryStatement {
  emphasis: string;
  reasoning: string;
  patientVersion: string;
}

interface UseStrengthsAndFocusAreasParams {
  clinicalProfile: Record<string, any> | null;
  runtimeConfig: Record<string, any> | null;
  activeExerciseSlugs: string[];
  adaptationEvents?: AdaptationEvent[];
  activeOverrides?: ClinicianOverride[];
}

export function useStrengthsAndFocusAreas({
  clinicalProfile,
  runtimeConfig,
  activeExerciseSlugs,
  adaptationEvents = [],
  activeOverrides = [],
}: UseStrengthsAndFocusAreasParams) {
  return useMemo(() => {
    const cp = clinicalProfile || {};
    const rc = runtimeConfig || {};

    // Collect all impairments
    const allImpairments: string[] = [
      ...(cp.impairments?.speech || []),
      ...(cp.impairments?.cognitive || []),
      ...(cp.impairments?.motor || []),
      ...(cp.impairments?.visual || []),
    ].map((i: string) => i.toLowerCase().replace(/[\s-]/g, "_"));

    const therapyFocus: string[] = (cp.therapy_focus || []).map(
      (f: string) => f.toLowerCase().replace(/[\s-]/g, "_")
    );

    // Map active exercises to their focus areas
    const exercisesByFocusArea = new Map<string, string[]>();
    for (const slug of activeExerciseSlugs) {
      const entry = getExerciseDomain(slug);
      if (!entry) continue;
      for (const fa of entry.focusAreas) {
        if (!exercisesByFocusArea.has(fa)) exercisesByFocusArea.set(fa, []);
        exercisesByFocusArea.get(fa)!.push(slug);
      }
    }

    // Determine which focus areas have adaptation pressure
    const adaptedSlugs = new Set(adaptationEvents.map(e => e.exercise_slug).filter(Boolean));
    const overrideSlugs = new Set(activeOverrides.map(o => o.targetSlug).filter(Boolean));
    
    const focusAreasWithPressure = new Set<string>();
    for (const [faId, slugs] of exercisesByFocusArea) {
      if (slugs.some(s => adaptedSlugs.has(s) || overrideSlugs.has(s))) {
        focusAreasWithPressure.add(faId);
      }
    }

    // Determine which focus areas match documented impairments
    const focusAreasWithDeficit = new Set<string>();
    for (const def of FOCUS_AREA_DEFINITIONS) {
      if (def.relatedImpairments.some(imp => allImpairments.includes(imp))) {
        focusAreasWithDeficit.add(def.id);
      }
      // Also check therapy focus
      if (therapyFocus.some(f => 
        def.id.includes(f) || f.includes(def.id) ||
        def.relatedImpairments.some(imp => f.includes(imp))
      )) {
        focusAreasWithDeficit.add(def.id);
      }
    }

    // Classify each active focus area
    const strengths: StrengthAreaCard[] = [];
    const focusAreas: FocusAreaCard[] = [];

    for (const [faId, exercises] of exercisesByFocusArea) {
      const def = getFocusAreaDefinition(faId);
      if (!def) continue;

      const isDeficit = focusAreasWithDeficit.has(faId);
      const hasPressure = focusAreasWithPressure.has(faId);

      // Get exercise display names
      const exerciseNames = exercises.map(s =>
        s.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())
      );

      // Determine provenance for this area
      const areaOverrides = activeOverrides.filter(o => exercises.includes(o.targetSlug || ""));
      const areaAdaptations = adaptationEvents.filter(e => exercises.includes(e.exercise_slug || ""));
      let provenance: "system" | "clinician" | "mixed" | "default" = "default";
      if (areaOverrides.length > 0 && areaAdaptations.length > 0) provenance = "mixed";
      else if (areaOverrides.length > 0) provenance = "clinician";
      else if (areaAdaptations.length > 0) provenance = "system";

      // Build adaptation description
      const diffOverrides = rc.difficulty_overrides || {};
      const adaptParts: string[] = [];
      for (const slug of exercises) {
        if (diffOverrides[slug] !== undefined) {
          const d = diffOverrides[slug];
          adaptParts.push(`${slug.replace(/-/g, " ")}: difficulty ${d > 0 ? "+" : ""}${d}`);
        }
      }
      if (rc.cue_level_override !== null && rc.cue_level_override !== undefined) {
        adaptParts.push(`cue level ${rc.cue_level_override}`);
      }
      const activeAdaptation = adaptParts.length > 0 ? adaptParts.join(", ") : "Default settings";

      // Collect expected gains
      const gains = [...new Set(exercises.map(s => getExerciseDomain(s)?.expectedGain).filter(Boolean))];

      if (isDeficit || hasPressure) {
        // This is a focus area (needs work)
        const signals: string[] = [];
        if (isDeficit) signals.push("Documented in clinical profile");
        if (hasPressure) signals.push("Active adaptation or override");

        const whyNeeded = isDeficit
          ? `${def.label} is identified as a current need based on the clinical profile`
          : `${def.label} has active adaptations indicating ongoing support`;
        
        const patientWhyNeeded = isDeficit
          ? `This is an area we're focusing on because it needs more practice`
          : `The app is adjusting exercises here to give you the right level of support`;

        focusAreas.push({
          id: faId,
          title: def.label,
          patientTitle: def.patientLabel,
          whyNeeded,
          patientWhyNeeded,
          supportingSignals: signals,
          exercises: exerciseNames,
          activeAdaptation,
          expectedGain: gains[0] || def.functionalMeaning,
          linkedOutcomes: def.linkedOutcomes,
          provenance,
        });
      } else {
        // This is a strength (doing well)
        strengths.push({
          id: faId,
          title: def.label,
          patientTitle: def.patientLabel,
          reason: `${def.label} shows no active adaptation pressure`,
          patientReason: `You're doing well in this area`,
          supportingSignals: ["No active adaptation needed", "Steady performance"],
          exercises: exerciseNames,
          systemPlan: "Maintain and gradually increase challenge",
          functionalMeaning: def.functionalMeaning,
          linkedOutcomes: def.linkedOutcomes,
        });
      }
    }

    // Also add focus areas from impairments even if no exercise is active
    for (const def of FOCUS_AREA_DEFINITIONS) {
      if (focusAreasWithDeficit.has(def.id) && !exercisesByFocusArea.has(def.id)) {
        focusAreas.push({
          id: def.id,
          title: def.label,
          patientTitle: def.patientLabel,
          whyNeeded: `${def.label} is documented as a need but no active exercises target it directly`,
          patientWhyNeeded: `This area needs work but isn't being directly practiced right now`,
          supportingSignals: ["Documented deficit without active exercise coverage"],
          exercises: [],
          activeAdaptation: "No exercises currently assigned",
          expectedGain: def.functionalMeaning,
          linkedOutcomes: def.linkedOutcomes,
          provenance: "default",
        });
      }
    }

    // Build plan summary
    const focusNames = focusAreas.slice(0, 3).map(f => f.title.toLowerCase());
    const strengthNames = strengths.slice(0, 2).map(s => s.title.toLowerCase());
    
    const emphasis = focusNames.length > 0
      ? focusNames.join(", ")
      : "general communication skills";
    
    const reasonParts: string[] = [];
    if (focusAreas.some(f => f.supportingSignals.includes("Documented in clinical profile"))) {
      reasonParts.push("based on the clinical profile");
    }
    if (focusAreas.some(f => f.supportingSignals.includes("Active adaptation or override"))) {
      reasonParts.push("informed by recent performance");
    }

    const planSummary: PlanSummaryStatement = {
      emphasis: `Currently emphasizing ${emphasis}${strengthNames.length > 0 ? ` while maintaining ${strengthNames.join(" and ")}` : ""}`,
      reasoning: reasonParts.length > 0 ? reasonParts.join(" and ") : "based on the recovery plan",
      patientVersion: focusNames.length > 0
        ? `Your exercises are focused on helping with ${focusNames.join(" and ")}. ${strengthNames.length > 0 ? `You're doing well with ${strengthNames.join(" and ")}.` : ""}`
        : "Your exercises are helping with overall communication recovery.",
    };

    return { strengths, focusAreas, planSummary };
  }, [clinicalProfile, runtimeConfig, activeExerciseSlugs, adaptationEvents, activeOverrides]);
}
