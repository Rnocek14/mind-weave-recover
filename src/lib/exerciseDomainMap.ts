/**
 * Canonical Exercise → Recovery Domain mapping.
 * 
 * Single source of truth used for:
 * - Dose/intensity calculations on the clinician review page
 * - Domain-level analytics and reporting
 * - "Why this plan" traceability
 * 
 * Recovery domains come from the `recovery_domains` table (speech_therapy,
 * physical_therapy, cognitive_therapy, etc.). Cognitive domains come from
 * the Cognitive State Engine (COGNITIVE_DOMAINS in cognitiveStateEngine.ts).
 */

export interface ExerciseDomainEntry {
  /** Exercise slug as used in exercise_events.exercise_slug */
  slug: string;
  /** Primary recovery domain (matches recovery_domains.slug) */
  recoveryDomain: string;
  /** Cognitive sub-domains this exercise feeds (matches COGNITIVE_DOMAINS slugs) */
  cognitiveDomains: string[];
  /** Whether this exercise involves speech production (has audio) */
  hasSpeechOutput: boolean;
  /** Brief clinical rationale for why this exercise is assigned */
  clinicalRationale: string;
}

/**
 * Canonical mapping — add new exercises here when they are created.
 * Keep alphabetical by slug for easy lookup.
 */
export const EXERCISE_DOMAIN_MAP: ExerciseDomainEntry[] = [
  {
    slug: "abstract-compare",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["semantic_depth", "executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Builds abstract reasoning and semantic categorization skills.",
  },
  {
    slug: "conversation-coach",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Structured conversational practice with real-time coaching.",
  },
  {
    slug: "conversation-partner",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Open-ended conversation practice for functional communication.",
  },
  {
    slug: "describe-guess",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval", "discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Exercises circumlocution and descriptive naming strategies.",
  },
  {
    slug: "detective-mind",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Develops deductive reasoning and evidence-based decision making.",
  },
  {
    slug: "dual-load-naming",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval", "executive_function"],
    hasSpeechOutput: true,
    clinicalRationale: "Trains word retrieval under cognitive load for real-world transfer.",
  },
  {
    slug: "fix-sentence",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax"],
    hasSpeechOutput: false,
    clinicalRationale: "Targets grammatical awareness and sentence-level error detection.",
  },
  {
    slug: "left-side-hunt",
    recoveryDomain: "physical_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Visual scanning for left neglect rehabilitation with cognitive demands.",
  },
  {
    slug: "meaning-match",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["semantic_depth"],
    hasSpeechOutput: false,
    clinicalRationale: "Strengthens semantic associations and word meaning comprehension.",
  },
  {
    slug: "minimal-pairs",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["phonology"],
    hasSpeechOutput: true,
    clinicalRationale: "Targets phonological discrimination and production accuracy.",
  },
  {
    slug: "multi-step-plan",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Exercises sequencing, planning, and multi-step problem solving.",
  },
  {
    slug: "narrative-retell",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization", "syntax"],
    hasSpeechOutput: true,
    clinicalRationale: "Practices connected speech, narrative structure, and story cohesion.",
  },
  {
    slug: "pattern-match",
    recoveryDomain: "physical_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Visual pattern recognition and sustained attention training.",
  },
  {
    slug: "phonological-awareness",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["phonology"],
    hasSpeechOutput: true,
    clinicalRationale: "Builds phonological processing: rhyming, segmenting, blending.",
  },
  {
    slug: "photo-naming",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval"],
    hasSpeechOutput: true,
    clinicalRationale: "Core confrontation naming for word retrieval practice.",
  },
  {
    slug: "phrase-practice",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax", "phonology"],
    hasSpeechOutput: true,
    clinicalRationale: "Functional phrase repetition and production fluency.",
  },
  {
    slug: "reach-tap",
    recoveryDomain: "physical_therapy",
    cognitiveDomains: [],
    hasSpeechOutput: false,
    clinicalRationale: "Upper extremity motor coordination and reach targeting.",
  },
  {
    slug: "semantic-features",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["semantic_depth", "lexical_retrieval"],
    hasSpeechOutput: false,
    clinicalRationale: "Semantic Feature Analysis (SFA) to strengthen word retrieval networks.",
  },
  {
    slug: "sentence-construction",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax"],
    hasSpeechOutput: true,
    clinicalRationale: "Sentence formulation targeting grammar and word order.",
  },
  // Handle alternate slug formats
  {
    slug: "sentence-game",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax"],
    hasSpeechOutput: true,
    clinicalRationale: "Sentence formulation targeting grammar and word order.",
  },
  {
    slug: "thought-continuation",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Practices idea elaboration and thought completion.",
  },
  {
    slug: "thought-organization",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization", "executive_function"],
    hasSpeechOutput: true,
    clinicalRationale: "Structured thought organization and verbal planning.",
  },
  {
    slug: "two-clues",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["executive_function", "lexical_retrieval"],
    hasSpeechOutput: true,
    clinicalRationale: "Integrates two semantic/phonological cues to retrieve target words.",
  },
  {
    slug: "word-finding",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval"],
    hasSpeechOutput: true,
    clinicalRationale: "General word retrieval practice across categories.",
  },
];

// ─── Lookup helpers ───

const _bySlug = new Map<string, ExerciseDomainEntry>();
EXERCISE_DOMAIN_MAP.forEach((e) => _bySlug.set(e.slug, e));

/** Get the canonical domain entry for an exercise slug. Returns undefined if unknown. */
export function getExerciseDomain(slug: string): ExerciseDomainEntry | undefined {
  // Normalize: some slugs use underscores or different casing
  const normalized = slug.toLowerCase().replace(/_/g, "-");
  return _bySlug.get(normalized) || _bySlug.get(slug);
}

/** Get recovery domain for a slug, with fallback. */
export function getRecoveryDomain(slug: string): string {
  return getExerciseDomain(slug)?.recoveryDomain ?? "speech_therapy";
}

/** Get cognitive domains for a slug. */
export function getCognitiveDomains(slug: string): string[] {
  return getExerciseDomain(slug)?.cognitiveDomains ?? [];
}

/** Get clinical rationale for why an exercise is in the plan. */
export function getExerciseRationale(slug: string): string {
  return getExerciseDomain(slug)?.clinicalRationale ?? "General therapy exercise.";
}

/** Aggregate trials by recovery domain using canonical mapping. */
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
