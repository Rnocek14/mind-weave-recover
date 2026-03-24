/**
 * Session Plan Reasoning V2 — Canonical treatment intelligence types & assembler.
 *
 * Builds the reasoning object from actual engine outputs:
 *   clinical_profile → runtime_config → adaptation_events → clinician_overrides
 *
 * The UI should consume this object directly — not reconstruct logic.
 */

import {
  getExerciseDomain,
  EXERCISE_DOMAIN_MAP,
  getSuggestedExercisesForFocusArea,
  type ExerciseDomainEntry,
} from "@/lib/exerciseDomainMap";
import {
  FOCUS_AREA_DEFINITIONS,
  getFocusAreaDefinition,
} from "@/lib/focusAreaDefinitions";
import type { AdaptationEvent } from "@/hooks/useAdaptationTimeline";
import type { ClinicianOverride } from "@/hooks/useClinicianOverrides";

// ─── V2 Types ───

export interface RecentSignal {
  type: string;
  domain?: string;
  exerciseSlug?: string;
  value?: string | number;
  interpretation: string;
}

export interface ExerciseSelectionEntry {
  slug: string;
  displayName: string;
  selected: boolean;
  priorityRank: number | null;
  focusAreaIds: string[];
  selectedBecause: string[];
  expectedGain: string;
  linkedOutcomes: string[];
  provenance: "system" | "clinician" | "mixed" | "default";
}

export interface ExcludedCandidate {
  slug: string;
  displayName: string;
  reason: string;
  category:
    | "not_needed"
    | "lower_priority"
    | "fatigue_risk"
    | "already_strong"
    | "coverage_limit"
    | "clinical_override"
    | "insufficient_readiness";
}

export interface AppliedAdjustment {
  slug?: string;
  type: "difficulty" | "cue_level" | "dose" | "phoneme_targeting";
  value: string;
  reason: string;
  provenance: "system" | "clinician";
}

export interface PlanDeltaEntry {
  slug?: string;
  type: string;
  before: string;
  after: string;
  reason: string;
  provenance: "system" | "clinician";
}

export interface FocusShift {
  area: string;
  areaLabel: string;
  direction: "up" | "down" | "maintain";
  reason: string;
}

export interface PlanDelta {
  addedExercises: Array<{ slug: string; displayName: string; reason: string }>;
  removedExercises: Array<{ slug: string; displayName: string; reason: string }>;
  changedAdjustments: PlanDeltaEntry[];
  focusShifts: FocusShift[];
  newCoverageGaps: string[];
  resolvedCoverageGaps: string[];
  hasChanges: boolean;
}

export interface SessionPlanReasoningV2 {
  generatedAt: string;

  stateSummary: {
    activeDeficits: string[];
    maintainedAreas: string[];
    strengths: string[];
    uncoveredAreas: string[];
    recentSignals: RecentSignal[];
  };

  planIntent: {
    primaryFocusAreas: string[];
    secondaryFocusAreas: string[];
    maintenanceAreas: string[];
    intendedOutcomes: string[];
    narrative: string;
  };

  exerciseSelection: ExerciseSelectionEntry[];
  excludedCandidates: ExcludedCandidate[];

  appliedAdjustments: {
    global: AppliedAdjustment[];
    exerciseSpecific: AppliedAdjustment[];
  };

  planDelta: PlanDelta;

  confidence: "high" | "moderate" | "low";
}

// ─── Assembler inputs ───

export interface ReasoningAssemblerInput {
  clinicalProfile: Record<string, any> | null;
  runtimeConfig: Record<string, any> | null;
  activeExerciseSlugs: string[];
  adaptationEvents: AdaptationEvent[];
  activeOverrides: ClinicianOverride[];
  /** Previous plan's active slugs for delta computation */
  previousExerciseSlugs?: string[];
  /** Previous runtime config for delta computation */
  previousRuntimeConfig?: Record<string, any> | null;
  /** Previous adaptation events for delta */
  previousAdaptationEvents?: AdaptationEvent[];
  /** Previous overrides for delta */
  previousOverrides?: ClinicianOverride[];
}

// ─── Helpers ───

function slugToDisplay(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function getAllImpairments(cp: Record<string, any>): string[] {
  return [
    ...(cp?.impairments?.speech || []),
    ...(cp?.impairments?.cognitive || []),
    ...(cp?.impairments?.motor || []),
    ...(cp?.impairments?.visual || []),
  ].map((i: string) => i.toLowerCase().replace(/[\s-]/g, "_"));
}

function getTherapyFocus(cp: Record<string, any>): string[] {
  return (cp?.therapy_focus || []).map(
    (f: string) => f.toLowerCase().replace(/[\s-]/g, "_")
  );
}

// ─── Core assembler ───

export function assembleSessionPlanReasoning(
  input: ReasoningAssemblerInput
): SessionPlanReasoningV2 {
  const {
    clinicalProfile,
    runtimeConfig,
    activeExerciseSlugs,
    adaptationEvents,
    activeOverrides,
    previousExerciseSlugs = [],
    previousRuntimeConfig,
    previousOverrides = [],
  } = input;

  const cp = clinicalProfile || {};
  const rc = runtimeConfig || {};
  const allImpairments = getAllImpairments(cp);
  const therapyFocus = getTherapyFocus(cp);
  const diffOverrides = rc.difficulty_overrides || {};
  const globalDiff = diffOverrides._global ?? 0;
  const cueOverride = rc.cue_level_override ?? null;

  // ── 1. State Summary ──

  // Map active exercises to focus areas
  const exercisesByFocusArea = new Map<string, string[]>();
  for (const slug of activeExerciseSlugs) {
    const entry = getExerciseDomain(slug);
    if (!entry) continue;
    for (const fa of entry.focusAreas) {
      if (!exercisesByFocusArea.has(fa)) exercisesByFocusArea.set(fa, []);
      exercisesByFocusArea.get(fa)!.push(slug);
    }
  }

  // Determine deficits
  const deficitFocusAreas = new Set<string>();
  for (const def of FOCUS_AREA_DEFINITIONS) {
    if (def.relatedImpairments.some((imp) => allImpairments.includes(imp))) {
      deficitFocusAreas.add(def.id);
    }
    if (therapyFocus.some((f) => def.id.includes(f) || f.includes(def.id))) {
      deficitFocusAreas.add(def.id);
    }
  }

  // Exercise-specific pressure
  const exerciseSpecificAdaptations = adaptationEvents.filter((e) => e.exercise_slug);
  const exerciseSpecificOverrides = activeOverrides.filter(
    (o) => o.targetSlug && o.targetSlug !== "_global"
  );
  const adaptedSlugs = new Set(exerciseSpecificAdaptations.map((e) => e.exercise_slug).filter(Boolean));
  const overrideSlugs = new Set(exerciseSpecificOverrides.map((o) => o.targetSlug).filter(Boolean));

  const pressureFocusAreas = new Set<string>();
  for (const [faId, slugs] of exercisesByFocusArea) {
    if (slugs.some((s) => adaptedSlugs.has(s) || overrideSlugs.has(s))) {
      pressureFocusAreas.add(faId);
    }
  }

  // Classify focus areas
  const activeDeficits: string[] = [];
  const maintainedAreas: string[] = [];
  const strengthAreas: string[] = [];
  const uncoveredAreas: string[] = [];

  for (const def of FOCUS_AREA_DEFINITIONS) {
    const isDeficit = deficitFocusAreas.has(def.id);
    const hasCoverage = exercisesByFocusArea.has(def.id);
    const hasPressure = pressureFocusAreas.has(def.id);
    const exerciseCount = exercisesByFocusArea.get(def.id)?.length ?? 0;

    if (isDeficit && !hasCoverage) {
      uncoveredAreas.push(def.id);
    } else if (isDeficit || hasPressure) {
      activeDeficits.push(def.id);
    } else if (hasCoverage && exerciseCount >= 2) {
      strengthAreas.push(def.id);
    } else if (hasCoverage) {
      maintainedAreas.push(def.id);
    }
  }

  // Recent signals from adaptation events
  const recentSignals: RecentSignal[] = adaptationEvents.slice(0, 5).map((e) => {
    const ev = e.evidence as Record<string, any>;
    let interpretation = e.trigger_condition || `${e.adaptation_type} adjustment`;
    if (ev?.accuracy !== undefined) {
      const acc = Math.round(Number(ev.accuracy) * 100);
      interpretation = `Accuracy at ${acc}% triggered ${e.adaptation_type}`;
    }
    return {
      type: e.adaptation_type,
      domain: e.layer,
      exerciseSlug: e.exercise_slug || undefined,
      value: ev?.accuracy ?? undefined,
      interpretation,
    };
  });

  // ── 2. Plan Intent ──

  const primaryFocusAreas = activeDeficits.slice(0, 4);
  const secondaryFocusAreas = activeDeficits.slice(4);
  const maintenanceAreas = [...strengthAreas, ...maintainedAreas];

  const intendedOutcomeSet = new Set<string>();
  for (const faId of [...primaryFocusAreas, ...secondaryFocusAreas]) {
    const def = getFocusAreaDefinition(faId);
    def?.linkedOutcomes.forEach((o) => intendedOutcomeSet.add(o));
  }
  const intendedOutcomes = Array.from(intendedOutcomeSet);

  // Build narrative from actual state
  const focusLabels = primaryFocusAreas
    .map((id) => getFocusAreaDefinition(id)?.label.toLowerCase())
    .filter(Boolean);
  const maintainLabels = strengthAreas
    .slice(0, 2)
    .map((id) => getFocusAreaDefinition(id)?.label.toLowerCase())
    .filter(Boolean);

  let narrative = "";
  if (focusLabels.length > 0) {
    narrative = `Emphasizing ${focusLabels.join(", ")}`;
    if (maintainLabels.length > 0) {
      narrative += ` while maintaining ${maintainLabels.join(" and ")}`;
    }
    // Ground in actual evidence
    const hasProfileEvidence = allImpairments.length > 0;
    const hasAdaptationEvidence = adaptationEvents.length > 0;
    const hasClinicianEvidence = activeOverrides.length > 0;
    const sources: string[] = [];
    if (hasProfileEvidence) sources.push("clinical profile");
    if (hasAdaptationEvidence) sources.push("recent performance signals");
    if (hasClinicianEvidence) sources.push("clinician adjustments");
    if (sources.length > 0) {
      narrative += ` — based on ${sources.join(", ")}`;
    }
  } else {
    narrative = "Exercises are supporting general communication recovery";
  }

  // ── 3. Exercise Selection ──

  const exerciseSelection: ExerciseSelectionEntry[] = activeExerciseSlugs.map(
    (slug, idx) => {
      const entry = getExerciseDomain(slug);
      const focusAreaIds = entry?.focusAreas || [];

      // Build "selected because" from actual signals
      const reasons: string[] = [];
      const matchingDeficits = focusAreaIds.filter((fa) => deficitFocusAreas.has(fa));
      if (matchingDeficits.length > 0) {
        const labels = matchingDeficits
          .map((id) => getFocusAreaDefinition(id)?.label)
          .filter(Boolean);
        reasons.push(`Targets documented deficit: ${labels.join(", ")}`);
      }
      const matchingTherapy = therapyFocus.filter((f) =>
        focusAreaIds.some((fa) => fa.includes(f) || f.includes(fa))
      );
      if (matchingTherapy.length > 0) {
        reasons.push(`Aligns with therapy focus`);
      }
      // Check if clinician assigned
      const exOverride = activeOverrides.find(
        (o) => o.targetSlug === slug && o.status === "active"
      );
      if (exOverride) {
        reasons.push(`Clinician-directed: ${exOverride.reason || "manual assignment"}`);
      }
      // Check for system adaptations
      const exAdaptations = adaptationEvents.filter((e) => e.exercise_slug === slug);
      if (exAdaptations.length > 0 && reasons.length === 0) {
        reasons.push(`System adapted based on recent performance`);
      }
      if (reasons.length === 0) {
        reasons.push(entry?.clinicalRationale || "Part of balanced recovery plan");
      }

      // Provenance
      let provenance: "system" | "clinician" | "mixed" | "default" = "default";
      if (exOverride && exAdaptations.length > 0) provenance = "mixed";
      else if (exOverride) provenance = "clinician";
      else if (exAdaptations.length > 0) provenance = "system";

      return {
        slug,
        displayName: slugToDisplay(slug),
        selected: true,
        priorityRank: idx + 1,
        focusAreaIds,
        selectedBecause: reasons,
        expectedGain: entry?.expectedGain || "General recovery support",
        linkedOutcomes: entry?.outcomeMetrics || [],
        provenance,
      };
    }
  );

  // ── 4. Excluded Candidates ──

  const activeSlugSet = new Set(activeExerciseSlugs);
  const excludedCandidates: ExcludedCandidate[] = [];

  for (const entry of EXERCISE_DOMAIN_MAP) {
    if (activeSlugSet.has(entry.slug)) continue;

    // Determine why excluded
    const matchesDeficit = entry.focusAreas.some((fa) => deficitFocusAreas.has(fa));
    const matchesStrength = entry.focusAreas.some((fa) => strengthAreas.includes(fa));
    const hasClinicianExclusion = activeOverrides.some(
      (o) => o.targetSlug === entry.slug && o.status === "reversed"
    );

    let reason: string;
    let category: ExcludedCandidate["category"];

    if (hasClinicianExclusion) {
      reason = "Clinician reversed or excluded this exercise";
      category = "clinical_override";
    } else if (matchesStrength && !matchesDeficit) {
      reason = `${entry.focusAreas.map((fa) => getFocusAreaDefinition(fa)?.label).filter(Boolean).join(", ")} is currently strong — lower priority`;
      category = "already_strong";
    } else if (!matchesDeficit) {
      reason = "Not aligned with current focus areas";
      category = "not_needed";
    } else {
      // Matches a deficit but wasn't selected — lower priority or coverage limit
      const coveredByOther = entry.focusAreas.some((fa) =>
        (exercisesByFocusArea.get(fa)?.length ?? 0) >= 2
      );
      if (coveredByOther) {
        reason = `Focus area already covered by ${exercisesByFocusArea.get(entry.focusAreas[0])?.map(slugToDisplay).join(", ")}`;
        category = "coverage_limit";
      } else {
        reason = "Lower priority than selected exercises this week";
        category = "lower_priority";
      }
    }

    excludedCandidates.push({
      slug: entry.slug,
      displayName: slugToDisplay(entry.slug),
      reason,
      category,
    });
  }

  // Sort: show relevant exclusions first
  const categoryOrder: Record<string, number> = {
    clinical_override: 0,
    lower_priority: 1,
    coverage_limit: 2,
    already_strong: 3,
    fatigue_risk: 4,
    not_needed: 5,
    insufficient_readiness: 6,
  };
  excludedCandidates.sort(
    (a, b) => (categoryOrder[a.category] ?? 9) - (categoryOrder[b.category] ?? 9)
  );

  // ── 5. Applied Adjustments ──

  const globalAdjustments: AppliedAdjustment[] = [];
  if (globalDiff !== 0) {
    const globalOverride = activeOverrides.find(
      (o) => o.overrideType === "difficulty" && (!o.targetSlug || o.targetSlug === "_global")
    );
    globalAdjustments.push({
      type: "difficulty",
      value: globalDiff > 0 ? `+${globalDiff}` : String(globalDiff),
      reason: globalOverride
        ? `Clinician ${globalDiff > 0 ? "increased" : "decreased"} difficulty globally`
        : `System adjusted difficulty globally`,
      provenance: globalOverride ? "clinician" : "system",
    });
  }
  if (cueOverride !== null && cueOverride !== undefined) {
    const cueOvr = activeOverrides.find((o) => o.overrideType === "cue_level");
    globalAdjustments.push({
      type: "cue_level",
      value: `Level ${cueOverride}`,
      reason: cueOvr
        ? "Clinician set cue level"
        : "System adjusted cue level",
      provenance: cueOvr ? "clinician" : "system",
    });
  }

  const exerciseSpecificAdjustments: AppliedAdjustment[] = [];
  for (const slug of activeExerciseSlugs) {
    if (diffOverrides[slug] !== undefined) {
      const exOvr = exerciseSpecificOverrides.find(
        (o) => o.targetSlug === slug && o.overrideType === "difficulty"
      );
      exerciseSpecificAdjustments.push({
        slug,
        type: "difficulty",
        value: `${diffOverrides[slug] > 0 ? "+" : ""}${diffOverrides[slug]}`,
        reason: exOvr
          ? `Clinician adjusted difficulty for ${slugToDisplay(slug)}`
          : `System adjusted difficulty for ${slugToDisplay(slug)}`,
        provenance: exOvr ? "clinician" : "system",
      });
    }
  }

  // ── 6. Plan Delta ──

  const planDelta = computePlanDelta({
    currentSlugs: activeExerciseSlugs,
    previousSlugs: previousExerciseSlugs,
    currentConfig: rc,
    previousConfig: previousRuntimeConfig || {},
    currentOverrides: activeOverrides,
    previousOverrides,
    deficitFocusAreas,
    exercisesByFocusArea,
  });

  // ── 7. Confidence ──

  const hasProfile = allImpairments.length > 0 || therapyFocus.length > 0;
  const hasAdaptations = adaptationEvents.length > 0;
  const hasOverrides = activeOverrides.length > 0;
  const confidence: "high" | "moderate" | "low" =
    hasProfile && (hasAdaptations || hasOverrides) ? "high" :
    hasProfile || hasAdaptations || hasOverrides ? "moderate" :
    "low";

  return {
    generatedAt: new Date().toISOString(),
    stateSummary: {
      activeDeficits,
      maintainedAreas,
      strengths: strengthAreas,
      uncoveredAreas,
      recentSignals,
    },
    planIntent: {
      primaryFocusAreas,
      secondaryFocusAreas,
      maintenanceAreas,
      intendedOutcomes,
      narrative,
    },
    exerciseSelection,
    excludedCandidates,
    appliedAdjustments: {
      global: globalAdjustments,
      exerciseSpecific: exerciseSpecificAdjustments,
    },
    planDelta,
    confidence,
  };
}

// ─── Plan Delta ───

interface DeltaInput {
  currentSlugs: string[];
  previousSlugs: string[];
  currentConfig: Record<string, any>;
  previousConfig: Record<string, any>;
  currentOverrides: ClinicianOverride[];
  previousOverrides: ClinicianOverride[];
  deficitFocusAreas: Set<string>;
  exercisesByFocusArea: Map<string, string[]>;
}

function computePlanDelta(input: DeltaInput): PlanDelta {
  const {
    currentSlugs,
    previousSlugs,
    currentConfig,
    previousConfig,
    currentOverrides,
    previousOverrides,
    deficitFocusAreas,
    exercisesByFocusArea,
  } = input;

  const currentSet = new Set(currentSlugs);
  const previousSet = new Set(previousSlugs);

  // Added exercises
  const addedExercises = currentSlugs
    .filter((s) => !previousSet.has(s))
    .map((slug) => {
      const entry = getExerciseDomain(slug);
      const matchingDeficits = (entry?.focusAreas || []).filter((fa) =>
        deficitFocusAreas.has(fa)
      );
      const reason = matchingDeficits.length > 0
        ? `Added to target ${matchingDeficits.map((fa) => getFocusAreaDefinition(fa)?.label).filter(Boolean).join(", ")}`
        : "Added to broaden recovery coverage";
      return { slug, displayName: slugToDisplay(slug), reason };
    });

  // Removed exercises
  const removedExercises = previousSlugs
    .filter((s) => !currentSet.has(s))
    .map((slug) => {
      const entry = getExerciseDomain(slug);
      const focusAreas = entry?.focusAreas || [];
      const stillCovered = focusAreas.some(
        (fa) => (exercisesByFocusArea.get(fa)?.length ?? 0) > 0
      );
      const reason = stillCovered
        ? "Focus area still covered by other exercises"
        : "Removed from active plan";
      return { slug, displayName: slugToDisplay(slug), reason };
    });

  // Changed adjustments (difficulty, cue)
  const changedAdjustments: PlanDeltaEntry[] = [];
  const curDiff = currentConfig.difficulty_overrides || {};
  const prevDiff = previousConfig.difficulty_overrides || {};

  // Check global difficulty
  const curGlobal = curDiff._global ?? 0;
  const prevGlobal = prevDiff._global ?? 0;
  if (curGlobal !== prevGlobal) {
    const overrideMatch = currentOverrides.find(
      (o) => o.overrideType === "difficulty" && (!o.targetSlug || o.targetSlug === "_global")
    );
    changedAdjustments.push({
      type: "Global difficulty",
      before: prevGlobal > 0 ? `+${prevGlobal}` : String(prevGlobal),
      after: curGlobal > 0 ? `+${curGlobal}` : String(curGlobal),
      reason: overrideMatch?.reason || `Difficulty ${curGlobal > prevGlobal ? "increased" : "decreased"}`,
      provenance: overrideMatch ? "clinician" : "system",
    });
  }

  // Check cue level
  const curCue = currentConfig.cue_level_override ?? null;
  const prevCue = previousConfig.cue_level_override ?? null;
  if (curCue !== prevCue) {
    const cueOvr = currentOverrides.find((o) => o.overrideType === "cue_level");
    changedAdjustments.push({
      type: "Cue level",
      before: prevCue !== null ? `Level ${prevCue}` : "Auto",
      after: curCue !== null ? `Level ${curCue}` : "Auto",
      reason: cueOvr?.reason || `Cue level ${curCue !== null ? "set" : "released to auto"}`,
      provenance: cueOvr ? "clinician" : "system",
    });
  }

  // Check per-exercise difficulty changes
  const allDiffKeys = new Set([...Object.keys(curDiff), ...Object.keys(prevDiff)]);
  for (const key of allDiffKeys) {
    if (key === "_global") continue;
    const cur = curDiff[key];
    const prev = prevDiff[key];
    if (cur !== prev && cur !== undefined) {
      const exOvr = currentOverrides.find(
        (o) => o.targetSlug === key && o.overrideType === "difficulty"
      );
      changedAdjustments.push({
        slug: key,
        type: `Difficulty (${slugToDisplay(key)})`,
        before: prev !== undefined ? `${prev > 0 ? "+" : ""}${prev}` : "Default",
        after: `${cur > 0 ? "+" : ""}${cur}`,
        reason: exOvr?.reason || `Difficulty adjusted for ${slugToDisplay(key)}`,
        provenance: exOvr ? "clinician" : "system",
      });
    }
  }

  // Focus shifts — compare which areas got more/fewer exercises
  const focusShifts: FocusShift[] = [];
  const prevExByFA = new Map<string, string[]>();
  for (const slug of previousSlugs) {
    const entry = getExerciseDomain(slug);
    if (!entry) continue;
    for (const fa of entry.focusAreas) {
      if (!prevExByFA.has(fa)) prevExByFA.set(fa, []);
      prevExByFA.get(fa)!.push(slug);
    }
  }

  const allFocusAreas = new Set([
    ...exercisesByFocusArea.keys(),
    ...prevExByFA.keys(),
  ]);
  for (const faId of allFocusAreas) {
    const curCount = exercisesByFocusArea.get(faId)?.length ?? 0;
    const prevCount = prevExByFA.get(faId)?.length ?? 0;
    if (curCount === prevCount) continue;

    const def = getFocusAreaDefinition(faId);
    if (!def) continue;

    const direction: "up" | "down" | "maintain" =
      curCount > prevCount ? "up" : "down";
    const reason =
      direction === "up"
        ? `Increased from ${prevCount} to ${curCount} exercises`
        : `Decreased from ${prevCount} to ${curCount} exercises`;

    focusShifts.push({
      area: faId,
      areaLabel: def.label,
      direction,
      reason,
    });
  }

  // Coverage gaps
  const prevUncovered = new Set<string>();
  const curUncovered = new Set<string>();
  for (const def of FOCUS_AREA_DEFINITIONS) {
    const isDeficit = deficitFocusAreas.has(def.id);
    if (!isDeficit) continue;
    if (!exercisesByFocusArea.has(def.id)) curUncovered.add(def.id);
    if (!prevExByFA.has(def.id)) prevUncovered.add(def.id);
  }

  const newCoverageGaps = [...curUncovered].filter((id) => !prevUncovered.has(id));
  const resolvedCoverageGaps = [...prevUncovered].filter((id) => !curUncovered.has(id));

  const hasChanges =
    addedExercises.length > 0 ||
    removedExercises.length > 0 ||
    changedAdjustments.length > 0 ||
    focusShifts.length > 0 ||
    newCoverageGaps.length > 0 ||
    resolvedCoverageGaps.length > 0;

  return {
    addedExercises,
    removedExercises,
    changedAdjustments,
    focusShifts,
    newCoverageGaps: newCoverageGaps.map(
      (id) => getFocusAreaDefinition(id)?.label || id
    ),
    resolvedCoverageGaps: resolvedCoverageGaps.map(
      (id) => getFocusAreaDefinition(id)?.label || id
    ),
    hasChanges,
  };
}
