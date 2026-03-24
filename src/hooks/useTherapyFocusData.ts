/**
 * useTherapyFocusData — assembles per-exercise explainability data
 * for the Therapy Focus Map.
 * 
 * Combines: domain map, clinical profile, runtime config, adaptation events,
 * and clinician overrides into a unified per-exercise card model.
 */

import { useMemo } from "react";
import {
  getExerciseDomain,
  getPatientSpecificRationale,
  type ExerciseDomainEntry,
} from "@/lib/exerciseDomainMap";
import { COGNITIVE_DOMAINS } from "@/lib/cognitiveStateEngine";
import type { AdaptationEvent } from "@/hooks/useAdaptationTimeline";
import type { ClinicianOverride } from "@/hooks/useClinicianOverrides";

export interface TherapyFocusCard {
  slug: string;
  displayName: string;
  entry: ExerciseDomainEntry;
  /** Human-readable cognitive targets */
  clinicalTargets: string[];
  /** Patient-specific "why selected" rationale */
  whySelected: string;
  /** Current difficulty level for this exercise */
  currentDifficulty: number | null;
  /** Current cue level (null = auto) */
  currentCueLevel: number | null;
  /** Active adaptation description */
  activeAdaptation: string;
  /** Recent signal from adaptation events */
  recentSignal: string | null;
  /** Expected functional gain */
  expectedGain: string;
  /** Provenance: who last changed this exercise's config */
  provenance: "clinician" | "system" | "default";
  /** Date of last change */
  lastChangedAt: string | null;
  /** Has speech output */
  hasSpeechOutput: boolean;
  /** Outcome metrics this exercise contributes to */
  outcomeMetrics: string[];
}

export interface SessionRationale {
  emphasis: string[];
  reasons: string[];
  systemActions: string[];
}

interface UseTherapyFocusDataParams {
  activeExerciseSlugs: string[];
  clinicalProfile: Record<string, any> | null;
  runtimeConfig: Record<string, any> | null;
  adaptationEvents?: AdaptationEvent[];
  activeOverrides?: ClinicianOverride[];
}

/** Cognitive domain slug → human label */
function domainLabel(slug: string): string {
  const meta = COGNITIVE_DOMAINS.find((d) => d.slug === slug);
  return meta?.label || slug.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/** Format a slug into a display name */
function slugToDisplayName(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function useTherapyFocusData({
  activeExerciseSlugs,
  clinicalProfile,
  runtimeConfig,
  adaptationEvents = [],
  activeOverrides = [],
}: UseTherapyFocusDataParams) {
  const cards = useMemo<TherapyFocusCard[]>(() => {
    const cp = clinicalProfile || {};
    const rc = runtimeConfig || {};
    const diffOverrides = rc.difficulty_overrides || {};
    const globalDiff = diffOverrides._global ?? 0;
    const cueOverride = rc.cue_level_override ?? null;

    const impairments = {
      speech: cp.impairments?.speech || [],
      cognitive: cp.impairments?.cognitive || [],
      motor: cp.impairments?.motor || [],
      visual: cp.impairments?.visual || [],
    };
    const therapyFocus: string[] = cp.therapy_focus || [];

    return activeExerciseSlugs
      .map((slug): TherapyFocusCard | null => {
        const entry = getExerciseDomain(slug);
        if (!entry) return null;

        // Clinical targets
        const clinicalTargets = entry.cognitiveDomains.map(domainLabel);

        // Patient-specific rationale
        const whySelected = getPatientSpecificRationale(slug, impairments, therapyFocus);

        // Current difficulty
        const exDiff = diffOverrides[slug];
        const currentDifficulty = exDiff !== undefined ? exDiff : globalDiff || null;

        // Adaptation events for this exercise (last 7 days)
        const exAdaptations = adaptationEvents.filter(
          (e) => e.exercise_slug === slug
        );
        const latestAdaptation = exAdaptations[0]; // already sorted desc

        // Active clinician override for this exercise
        const clinicianOverride = activeOverrides.find(
          (o) => o.targetSlug === slug && o.status === "active"
        );

        // Build adaptation description
        let activeAdaptation = "Default settings";
        const adaptParts: string[] = [];
        if (cueOverride !== null) adaptParts.push(`Cue level ${cueOverride}`);
        if (exDiff !== undefined) adaptParts.push(`Difficulty ${exDiff > 0 ? "+" : ""}${exDiff}`);
        else if (globalDiff !== 0) adaptParts.push(`Global difficulty ${globalDiff > 0 ? "+" : ""}${globalDiff}`);
        if (adaptParts.length > 0) activeAdaptation = adaptParts.join(", ");

        // Recent signal from adaptation event evidence
        let recentSignal: string | null = null;
        if (latestAdaptation) {
          const ev = latestAdaptation.evidence as Record<string, any>;
          if (ev?.accuracy !== undefined) {
            recentSignal = `Accuracy ${Math.round(Number(ev.accuracy) * 100)}%`;
          }
          if (ev?.trigger_description) {
            recentSignal = String(ev.trigger_description);
          }
          if (latestAdaptation.trigger_condition) {
            recentSignal = recentSignal
              ? `${recentSignal} — ${latestAdaptation.trigger_condition}`
              : latestAdaptation.trigger_condition;
          }
        }

        // Provenance
        let provenance: "clinician" | "system" | "default" = "default";
        let lastChangedAt: string | null = null;
        if (clinicianOverride) {
          provenance = "clinician";
          lastChangedAt = clinicianOverride.createdAt;
        } else if (latestAdaptation) {
          provenance = "system";
          lastChangedAt = latestAdaptation.created_at;
        }

        return {
          slug,
          displayName: slugToDisplayName(slug),
          entry,
          clinicalTargets,
          whySelected,
          currentDifficulty,
          currentCueLevel: cueOverride,
          activeAdaptation,
          recentSignal,
          expectedGain: entry.expectedGain,
          provenance,
          lastChangedAt,
          hasSpeechOutput: entry.hasSpeechOutput,
          outcomeMetrics: entry.outcomeMetrics,
        };
      })
      .filter(Boolean) as TherapyFocusCard[];
  }, [activeExerciseSlugs, clinicalProfile, runtimeConfig, adaptationEvents, activeOverrides]);

  // Group cards by recovery domain
  const cardsByDomain = useMemo(() => {
    const map: Record<string, TherapyFocusCard[]> = {};
    cards.forEach((c) => {
      const domain = c.entry.recoveryDomain;
      if (!map[domain]) map[domain] = [];
      map[domain].push(c);
    });
    return map;
  }, [cards]);

  // Session selection rationale
  const sessionRationale = useMemo<SessionRationale>(() => {
    const cp = clinicalProfile || {};
    const impairments = [
      ...(cp.impairments?.speech || []),
      ...(cp.impairments?.cognitive || []),
    ];
    const therapyFocus: string[] = cp.therapy_focus || [];

    // What domains are emphasized
    const domainSet = new Set<string>();
    cards.forEach((c) => c.clinicalTargets.forEach((t) => domainSet.add(t)));
    const emphasis = Array.from(domainSet).slice(0, 4);

    // Why
    const reasons: string[] = [];
    if (impairments.length > 0) {
      reasons.push(`Profile indicates: ${impairments.slice(0, 3).map((i: string) => i.replace(/_/g, " ")).join(", ")}`);
    }
    if (therapyFocus.length > 0) {
      reasons.push(`Therapy focus: ${therapyFocus.slice(0, 2).map((f: string) => f.replace(/_/g, " ")).join(", ")}`);
    }

    // What the system did
    const systemActions: string[] = [];
    const adaptedCount = cards.filter((c) => c.provenance !== "default").length;
    if (adaptedCount > 0) {
      systemActions.push(`${adaptedCount} exercise${adaptedCount > 1 ? "s" : ""} have active adaptations`);
    }
    const clinicianCount = cards.filter((c) => c.provenance === "clinician").length;
    if (clinicianCount > 0) {
      systemActions.push(`${clinicianCount} clinician-set override${clinicianCount > 1 ? "s" : ""}`);
    }

    return { emphasis, reasons, systemActions };
  }, [cards, clinicalProfile]);

  return { cards, cardsByDomain, sessionRationale };
}
