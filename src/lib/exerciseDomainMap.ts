/**
 * Canonical Exercise → Recovery Domain mapping.
 * 
 * NOW DERIVED from the canonical exercise registry.
 * This file re-exports domain-map helpers for backward compatibility.
 */

import { CANONICAL_EXERCISES, getCanonicalExercise } from '@/data/canonicalExerciseRegistry';

export interface ExerciseDomainEntry {
  slug: string;
  recoveryDomain: string;
  cognitiveDomains: string[];
  hasSpeechOutput: boolean;
  clinicalRationale: string;
  outcomeMetrics: string[];
  expectedGain: string;
  focusAreas: string[];
  functionalMeaning: string;
}

/**
 * Derived domain map from canonical registry.
 */
export const EXERCISE_DOMAIN_MAP: ExerciseDomainEntry[] = CANONICAL_EXERCISES.map(e => ({
  slug: e.slug,
  recoveryDomain: e.recoveryDomain,
  cognitiveDomains: e.cognitiveDomains,
  hasSpeechOutput: e.hasSpeechOutput,
  clinicalRationale: e.clinicalRationale,
  outcomeMetrics: e.outcomeMetrics,
  expectedGain: e.expectedGain,
  focusAreas: e.focusAreas,
  functionalMeaning: e.functionalMeaning,
}));

// ─── Lookup helpers ───

const _bySlug = new Map<string, ExerciseDomainEntry>();
EXERCISE_DOMAIN_MAP.forEach((e) => _bySlug.set(e.slug, e));

export function getExerciseDomain(slug: string): ExerciseDomainEntry | undefined {
  const normalized = slug.toLowerCase().replace(/_/g, "-");
  return _bySlug.get(normalized) || _bySlug.get(slug);
}

export function getRecoveryDomain(slug: string): string {
  return getExerciseDomain(slug)?.recoveryDomain ?? "speech_therapy";
}

export function getCognitiveDomains(slug: string): string[] {
  return getExerciseDomain(slug)?.cognitiveDomains ?? [];
}

export function getExerciseRationale(slug: string): string {
  return getExerciseDomain(slug)?.clinicalRationale ?? "General therapy exercise.";
}

export function getSuggestedExercisesForFocusArea(focusAreaId: string): ExerciseDomainEntry[] {
  return EXERCISE_DOMAIN_MAP
    .filter(e => e.focusAreas.includes(focusAreaId))
    .sort((a, b) => {
      const aIdx = a.focusAreas.indexOf(focusAreaId);
      const bIdx = b.focusAreas.indexOf(focusAreaId);
      return aIdx - bIdx;
    });
}

export function aggregateTrialsByDomain(
  exercises: { slug: string; trials: number }[]
): Record<string, number> {
  const map: Record<string, number> = {};
  exercises.forEach((e) => {
    const domain = getRecoveryDomain(e.slug);
    map[domain] = (map[domain] || 0) + e.trials;
  });
  return map;
}

// ─── Deficit → Exercise rationale mapping ───

const DEFICIT_RATIONALE_MAP: Record<string, { domains: string[]; reason: string }> = {
  anomic_aphasia: { domains: ["lexical_retrieval"], reason: "naming retrieval is a primary deficit" },
  anomia: { domains: ["lexical_retrieval"], reason: "word-finding difficulty is documented" },
  semantic_paraphasia: { domains: ["semantic_depth", "lexical_retrieval"], reason: "semantic retrieval errors are elevated" },
  phonemic_paraphasia: { domains: ["phonology"], reason: "phonological production errors are present" },
  agrammatism: { domains: ["syntax"], reason: "grammatical formulation is impaired" },
  // HONESTY NOTE: dysarthria and apraxia of speech are MOTOR-SPEECH deficits.
  // This app has no motor-speech content (no articulation drills, repetition
  // hierarchies, rate/prosody work), so the best available routing is the
  // phonology domain — which targets phonological *selection*, not motor
  // execution. The rationale strings are deliberately hedged: they must not
  // imply the routed exercises treat the motor deficit itself. Tracked gap:
  // add true motor-speech exercises before presenting these as targeted.
  dysarthria: { domains: ["phonology"], reason: "closest available practice (sound-discrimination work); this app does not yet include motor-speech drills for dysarthria" },
  apraxia: { domains: ["phonology"], reason: "closest available practice (phonological selection work); this app does not yet include motor-planning drills for apraxia of speech" },
  executive_dysfunction: { domains: ["executive_function"], reason: "executive planning and sequencing are impaired" },
  attention_deficit: { domains: ["executive_function"], reason: "sustained attention is reduced" },
  left_neglect: { domains: ["executive_function"], reason: "leftward scanning is inconsistent" },
  discourse_impairment: { domains: ["discourse_organization"], reason: "connected speech organization is impaired" },
  comprehension_deficit: { domains: ["semantic_depth"], reason: "language comprehension is reduced" },
  fluency_deficit: { domains: ["discourse_organization", "phonology"], reason: "verbal fluency is reduced" },
  motor_upper: { domains: [], reason: "upper extremity motor function needs rehabilitation" },
};

export function getPatientSpecificRationale(
  slug: string,
  impairments: { speech: string[]; cognitive: string[]; motor?: string[]; visual?: string[] },
  therapyFocus: string[]
): string {
  const entry = getExerciseDomain(slug);
  if (!entry) return "General therapy exercise.";

  const allImpairments = [
    ...(impairments.speech || []),
    ...(impairments.cognitive || []),
    ...(impairments.motor || []),
    ...(impairments.visual || []),
    ...therapyFocus,
  ];

  for (const imp of allImpairments) {
    const normalized = imp.toLowerCase().replace(/[\s-]/g, "_");
    const match = DEFICIT_RATIONALE_MAP[normalized];
    if (match && match.domains.some((d) => entry.cognitiveDomains.includes(d))) {
      return `Selected because ${match.reason}`;
    }
  }

  for (const focus of therapyFocus) {
    const normalized = focus.toLowerCase().replace(/[\s-]/g, "_");
    if (normalized.includes("naming") && entry.cognitiveDomains.includes("lexical_retrieval")) {
      return "Selected to support naming recovery goals";
    }
    if (normalized.includes("comprehension") && entry.cognitiveDomains.includes("semantic_depth")) {
      return "Selected to support comprehension recovery goals";
    }
  }

  return entry.clinicalRationale;
}
