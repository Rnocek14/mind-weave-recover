/**
 * useStrengthsAndFocusAreas — derives strengths, maintained areas, and focus areas
 * from clinical profile, runtime config, adaptation events, and exercise domain map.
 * 
 * Three-tier classification:
 * - Strength: evidence-backed positive area (no deficits, no adaptation pressure, actively exercised)
 * - Maintained: not currently a problem, but not proven strong either (limited evidence)
 * - Focus Area: actively targeted need (documented deficit or adaptation pressure)
 * - Uncovered: deficit present but no exercises assigned
 */

import { useMemo } from "react";
import { getExerciseDomain } from "@/lib/exerciseDomainMap";
import { FOCUS_AREA_DEFINITIONS, getFocusAreaDefinition } from "@/lib/focusAreaDefinitions";
import type { AdaptationEvent } from "@/hooks/useAdaptationTimeline";
import type { ClinicianOverride } from "@/hooks/useClinicianOverrides";

export type AreaClassification = "strength" | "maintained" | "focus" | "uncovered";

export interface EvidenceTag {
  source: "clinical_profile" | "adaptation" | "clinician_override" | "exercise_coverage" | "inferred";
  label: string;
}

export interface StrengthAreaCard {
  id: string;
  title: string;
  patientTitle: string;
  classification: "strength" | "maintained";
  reason: string;
  patientReason: string;
  evidence: EvidenceTag[];
  exercises: string[];
  systemPlan: string;
  functionalMeaning: string;
  linkedOutcomes: string[];
}

export interface FocusAreaCard {
  id: string;
  title: string;
  patientTitle: string;
  classification: "focus" | "uncovered";
  whyNeeded: string;
  patientWhyNeeded: string;
  clinicianSignal: string;
  evidence: EvidenceTag[];
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

/** Extract a specific clinician-facing signal from adaptation events for exercises in an area */
function deriveClinicianSignal(
  exercises: string[],
  adaptationEvents: AdaptationEvent[],
  activeOverrides: ClinicianOverride[],
  defLabel: string,
): string {
  // Check clinician overrides first
  const relevantOverrides = activeOverrides.filter(o => exercises.includes(o.targetSlug || ""));
  if (relevantOverrides.length > 0) {
    const o = relevantOverrides[0];
    if (o.overrideType === "difficulty") {
      const level = o.valueAfter?.difficulty_level;
      return `Clinician ${Number(level) > (o.valueBefore?.difficulty_level ?? 0) ? "increased" : "decreased"} difficulty for ${defLabel.toLowerCase()} tasks`;
    }
    if (o.overrideType === "cue_level") {
      return `Clinician set cue level to ${o.valueAfter?.cue_level ?? "reviewed"} for ${defLabel.toLowerCase()} tasks`;
    }
    if (o.reason) return o.reason;
  }

  // Check adaptation events
  const relevantAdaptations = adaptationEvents.filter(e => exercises.includes(e.exercise_slug || ""));
  if (relevantAdaptations.length > 0) {
    const latest = relevantAdaptations[0]; // already sorted desc
    const ev = latest.evidence as Record<string, any>;
    if (ev?.accuracy !== undefined) {
      const acc = Math.round(Number(ev.accuracy) * 100);
      if (acc < 50) return `Recent accuracy is low (${acc}%) — tasks still require support`;
      if (acc < 70) return `Accuracy is improving but still variable (${acc}%)`;
      return `Accuracy is strong (${acc}%) — challenge may increase`;
    }
    if (ev?.trigger_description) return String(ev.trigger_description);
    if (latest.trigger_condition) return latest.trigger_condition;
    return `System adjusted ${defLabel.toLowerCase()} based on recent performance`;
  }

  return `${defLabel} is being actively trained`;
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

      // Determine provenance
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
        // Build evidence tags
        const evidence: EvidenceTag[] = [];
        if (isDeficit) evidence.push({ source: "clinical_profile", label: "Clinical profile" });
        if (areaOverrides.length > 0) evidence.push({ source: "clinician_override", label: "Clinician override" });
        if (areaAdaptations.length > 0) evidence.push({ source: "adaptation", label: "System adjustment" });
        if (evidence.length === 0) evidence.push({ source: "exercise_coverage", label: "Exercise coverage" });

        // Build specific clinician signal
        const clinicianSignal = deriveClinicianSignal(exercises, adaptationEvents, activeOverrides, def.label);

        // Why needed — more specific
        const whyParts: string[] = [];
        if (isDeficit) whyParts.push(`${def.label.toLowerCase()} is a documented need`);
        if (hasPressure && !isDeficit) whyParts.push(`${def.label.toLowerCase()} has active adjustments`);
        const whyNeeded = whyParts.length > 0
          ? whyParts.join(" and ") + ` — ${clinicianSignal.toLowerCase()}`
          : clinicianSignal;
        
        // Patient-facing: daily-life language
        const patientWhyNeeded = isDeficit
          ? `${def.patientDescription.charAt(0).toLowerCase() + def.patientDescription.slice(1)} — we're working on making this easier`
          : `The app is adjusting these exercises to give you the right level of support`;

        focusAreas.push({
          id: faId,
          title: def.label,
          patientTitle: def.patientLabel,
          classification: "focus",
          whyNeeded,
          patientWhyNeeded,
          clinicianSignal,
          evidence,
          exercises: exerciseNames,
          activeAdaptation,
          expectedGain: gains[0] || def.functionalMeaning,
          linkedOutcomes: def.linkedOutcomes,
          provenance,
        });
      } else {
        // Classify as strength or maintained
        // Strength: has exercises, no deficit, no pressure, AND has enough exercise coverage (2+)
        const isStrength = exercises.length >= 2 && !isDeficit;
        const classification: "strength" | "maintained" = isStrength ? "strength" : "maintained";

        const evidence: EvidenceTag[] = [];
        if (isStrength) {
          evidence.push({ source: "exercise_coverage", label: "Multiple exercises active" });
          evidence.push({ source: "inferred", label: "No adaptation pressure" });
        } else {
          evidence.push({ source: "inferred", label: "No active issues detected" });
        }

        const reason = isStrength
          ? `${def.label} is covered by ${exercises.length} exercises with no active adaptation pressure`
          : `${def.label} is being practiced — not enough evidence to confirm as a strength`;
        
        const patientReason = isStrength
          ? `You're doing well with ${def.functionalMeaning.toLowerCase()}`
          : `You're practicing ${def.functionalMeaning.toLowerCase()} — keep it up`;

        strengths.push({
          id: faId,
          title: def.label,
          patientTitle: def.patientLabel,
          classification,
          reason,
          patientReason,
          evidence,
          exercises: exerciseNames,
          systemPlan: isStrength
            ? "Maintain and gradually increase challenge"
            : "Continue current practice level",
          functionalMeaning: def.functionalMeaning,
          linkedOutcomes: def.linkedOutcomes,
        });
      }
    }

    // Uncovered: deficit present but no exercises assigned
    for (const def of FOCUS_AREA_DEFINITIONS) {
      if (focusAreasWithDeficit.has(def.id) && !exercisesByFocusArea.has(def.id)) {
        focusAreas.push({
          id: def.id,
          title: def.label,
          patientTitle: def.patientLabel,
          classification: "uncovered",
          whyNeeded: `${def.label} is documented as a need but no active exercises target it directly`,
          patientWhyNeeded: `${def.patientDescription.charAt(0).toLowerCase() + def.patientDescription.slice(1)} — this isn't being directly practiced right now`,
          clinicianSignal: "No exercise coverage for documented deficit",
          evidence: [{ source: "clinical_profile", label: "Clinical profile (uncovered)" }],
          exercises: [],
          activeAdaptation: "No exercises currently assigned",
          expectedGain: def.functionalMeaning,
          linkedOutcomes: def.linkedOutcomes,
          provenance: "default",
        });
      }
    }

    // Sort: strengths first, then maintained
    strengths.sort((a, b) => {
      if (a.classification === "strength" && b.classification === "maintained") return -1;
      if (a.classification === "maintained" && b.classification === "strength") return 1;
      return 0;
    });

    // Build plan summary
    const focusNames = focusAreas.filter(f => f.classification === "focus").slice(0, 3).map(f => f.title.toLowerCase());
    const strengthNames = strengths.filter(s => s.classification === "strength").slice(0, 2).map(s => s.title.toLowerCase());
    const maintainedNames = strengths.filter(s => s.classification === "maintained").slice(0, 2).map(s => s.title.toLowerCase());
    
    const emphasis = focusNames.length > 0
      ? focusNames.join(", ")
      : "general communication skills";
    
    const reasonParts: string[] = [];
    if (focusAreas.some(f => f.evidence.some(e => e.source === "clinical_profile"))) {
      reasonParts.push("based on the clinical profile");
    }
    if (focusAreas.some(f => f.evidence.some(e => e.source === "adaptation" || e.source === "clinician_override"))) {
      reasonParts.push("informed by recent performance and adjustments");
    }

    const maintainedSuffix = maintainedNames.length > 0
      ? `, monitoring ${maintainedNames.join(" and ")}`
      : "";

    const planSummary: PlanSummaryStatement = {
      emphasis: `Currently emphasizing ${emphasis}${strengthNames.length > 0 ? ` while maintaining ${strengthNames.join(" and ")}` : ""}${maintainedSuffix}`,
      reasoning: reasonParts.length > 0 ? reasonParts.join(" and ") : "based on the recovery plan",
      patientVersion: focusNames.length > 0
        ? `Your exercises are focused on helping with ${focusNames.join(" and ")}. ${strengthNames.length > 0 ? `You're doing well with ${strengthNames.join(" and ")}!` : ""}`
        : "Your exercises are helping with overall communication recovery.",
    };

    return { strengths, focusAreas, planSummary };
  }, [clinicalProfile, runtimeConfig, activeExerciseSlugs, adaptationEvents, activeOverrides]);
}
