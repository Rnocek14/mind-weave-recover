/**
 * Canonical Exercise → Recovery Domain mapping.
 * 
 * Single source of truth used for:
 * - Dose/intensity calculations on the clinician review page
 * - Domain-level analytics and reporting
 * - "Why this plan" traceability
 * - Therapy Focus Map explainability
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
  /** Which recovery outcome metrics this exercise contributes to */
  outcomeMetrics: string[];
  /** Expected functional gain when this exercise is working */
  expectedGain: string;
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
    outcomeMetrics: ["error_quality"],
    expectedGain: "Improved abstract categorization and reasoning flexibility",
  },
  {
    slug: "conversation-coach",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Structured conversational practice with real-time coaching.",
    outcomeMetrics: ["cue_independence", "error_quality"],
    expectedGain: "More independent and organized conversational speech",
  },
  {
    slug: "conversation-partner",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Open-ended conversation practice for functional communication.",
    outcomeMetrics: ["cue_independence"],
    expectedGain: "Greater confidence and independence in everyday conversation",
  },
  {
    slug: "describe-guess",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval", "discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Exercises circumlocution and descriptive naming strategies.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "Better circumlocution strategies and descriptive naming",
  },
  {
    slug: "detective-mind",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Develops deductive reasoning and evidence-based decision making.",
    outcomeMetrics: ["error_quality"],
    expectedGain: "Stronger deductive reasoning and logical problem solving",
  },
  {
    slug: "dual-load-naming",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval", "executive_function"],
    hasSpeechOutput: true,
    clinicalRationale: "Trains word retrieval under cognitive load for real-world transfer.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "More reliable word retrieval under cognitive demands",
  },
  {
    slug: "fix-sentence",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax"],
    hasSpeechOutput: false,
    clinicalRationale: "Targets grammatical awareness and sentence-level error detection.",
    outcomeMetrics: ["error_quality"],
    expectedGain: "Improved grammatical awareness and self-monitoring",
  },
  {
    slug: "left-side-hunt",
    recoveryDomain: "physical_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Visual scanning for left neglect rehabilitation with cognitive demands.",
    outcomeMetrics: ["error_quality"],
    expectedGain: "Better leftward scanning and reduced neglect misses",
  },
  {
    slug: "meaning-match",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["semantic_depth"],
    hasSpeechOutput: false,
    clinicalRationale: "Strengthens semantic associations and word meaning comprehension.",
    outcomeMetrics: ["word_mastery", "error_quality"],
    expectedGain: "Stronger semantic networks and word comprehension",
  },
  {
    slug: "minimal-pairs",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["phonology"],
    hasSpeechOutput: true,
    clinicalRationale: "Targets phonological discrimination and production accuracy.",
    outcomeMetrics: ["error_quality", "cue_independence"],
    expectedGain: "More accurate phonological discrimination and production",
  },
  {
    slug: "multi-step-plan",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Exercises sequencing, planning, and multi-step problem solving.",
    outcomeMetrics: ["error_quality"],
    expectedGain: "Better multi-step planning and sequencing ability",
  },
  {
    slug: "narrative-retell",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization", "syntax"],
    hasSpeechOutput: true,
    clinicalRationale: "Practices connected speech, narrative structure, and story cohesion.",
    outcomeMetrics: ["cue_independence", "error_quality"],
    expectedGain: "More coherent and organized narrative speech",
  },
  {
    slug: "pattern-match",
    recoveryDomain: "physical_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Visual pattern recognition and sustained attention training.",
    outcomeMetrics: ["error_quality"],
    expectedGain: "Improved sustained attention and pattern recognition",
  },
  {
    slug: "phonological-awareness",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["phonology"],
    hasSpeechOutput: true,
    clinicalRationale: "Builds phonological processing: rhyming, segmenting, blending.",
    outcomeMetrics: ["error_quality", "cue_independence"],
    expectedGain: "Stronger phonological assembly and sound processing",
  },
  {
    slug: "photo-naming",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval"],
    hasSpeechOutput: true,
    clinicalRationale: "Core confrontation naming for word retrieval practice.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "More independent and accurate word retrieval",
  },
  {
    slug: "phrase-practice",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax", "phonology"],
    hasSpeechOutput: true,
    clinicalRationale: "Functional phrase repetition and production fluency.",
    outcomeMetrics: ["cue_independence"],
    expectedGain: "Smoother phrase production and reduced hesitation",
  },
  {
    slug: "reach-tap",
    recoveryDomain: "physical_therapy",
    cognitiveDomains: [],
    hasSpeechOutput: false,
    clinicalRationale: "Upper extremity motor coordination and reach targeting.",
    outcomeMetrics: [],
    expectedGain: "Improved affected-limb reach accuracy and coordination",
  },
  {
    slug: "semantic-features",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["semantic_depth", "lexical_retrieval"],
    hasSpeechOutput: false,
    clinicalRationale: "Semantic Feature Analysis (SFA) to strengthen word retrieval networks.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "Stronger semantic retrieval networks and less cue dependence",
  },
  {
    slug: "sentence-construction",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax"],
    hasSpeechOutput: true,
    clinicalRationale: "Sentence formulation targeting grammar and word order.",
    outcomeMetrics: ["error_quality", "cue_independence"],
    expectedGain: "Better sentence formulation and grammatical accuracy",
  },
  {
    slug: "sentence-game",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax"],
    hasSpeechOutput: true,
    clinicalRationale: "Sentence formulation targeting grammar and word order.",
    outcomeMetrics: ["error_quality", "cue_independence"],
    expectedGain: "Better sentence formulation and grammatical accuracy",
  },
  {
    slug: "thought-continuation",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Practices idea elaboration and thought completion.",
    outcomeMetrics: ["cue_independence"],
    expectedGain: "More complete and elaborated thought expression",
  },
  {
    slug: "thought-organization",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization", "executive_function"],
    hasSpeechOutput: true,
    clinicalRationale: "Structured thought organization and verbal planning.",
    outcomeMetrics: ["cue_independence", "error_quality"],
    expectedGain: "More organized verbal output and planning",
  },
  {
    slug: "two-clues",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["executive_function", "lexical_retrieval"],
    hasSpeechOutput: true,
    clinicalRationale: "Integrates two semantic/phonological cues to retrieve target words.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "Better integration of cues for independent word retrieval",
  },
  {
    slug: "word-finding",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval"],
    hasSpeechOutput: true,
    clinicalRationale: "General word retrieval practice across categories.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "Broader and more reliable word retrieval across categories",
  },
];

// ─── Lookup helpers ───

const _bySlug = new Map<string, ExerciseDomainEntry>();
EXERCISE_DOMAIN_MAP.forEach((e) => _bySlug.set(e.slug, e));

/** Get the canonical domain entry for an exercise slug. Returns undefined if unknown. */
export function getExerciseDomain(slug: string): ExerciseDomainEntry | undefined {
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

// ─── Deficit → Exercise rationale mapping ───

/** Impairment keywords → domain-specific rationale fragments */
const DEFICIT_RATIONALE_MAP: Record<string, { domains: string[]; reason: string }> = {
  anomic_aphasia: { domains: ["lexical_retrieval"], reason: "naming retrieval is a primary deficit" },
  anomia: { domains: ["lexical_retrieval"], reason: "word-finding difficulty is documented" },
  semantic_paraphasia: { domains: ["semantic_depth", "lexical_retrieval"], reason: "semantic retrieval errors are elevated" },
  phonemic_paraphasia: { domains: ["phonology"], reason: "phonological production errors are present" },
  agrammatism: { domains: ["syntax"], reason: "grammatical formulation is impaired" },
  dysarthria: { domains: ["phonology"], reason: "motor speech production needs targeted practice" },
  apraxia: { domains: ["phonology"], reason: "speech motor planning is impaired" },
  executive_dysfunction: { domains: ["executive_function"], reason: "executive planning and sequencing are impaired" },
  attention_deficit: { domains: ["executive_function"], reason: "sustained attention is reduced" },
  left_neglect: { domains: ["executive_function"], reason: "leftward scanning is inconsistent" },
  discourse_impairment: { domains: ["discourse_organization"], reason: "connected speech organization is impaired" },
  comprehension_deficit: { domains: ["semantic_depth"], reason: "language comprehension is reduced" },
  fluency_deficit: { domains: ["discourse_organization", "phonology"], reason: "verbal fluency is reduced" },
  motor_upper: { domains: [], reason: "upper extremity motor function needs rehabilitation" },
};

/**
 * Get patient-specific rationale for why an exercise was selected,
 * based on the patient's documented impairments and therapy focus.
 * Falls back to generic clinicalRationale if no specific match.
 */
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

  // Find the best deficit match for this exercise's domains
  for (const imp of allImpairments) {
    const normalized = imp.toLowerCase().replace(/[\s-]/g, "_");
    const match = DEFICIT_RATIONALE_MAP[normalized];
    if (match && match.domains.some((d) => entry.cognitiveDomains.includes(d))) {
      return `Selected because ${match.reason}`;
    }
  }

  // Check recovery domain match via therapy focus
  for (const focus of therapyFocus) {
    const normalized = focus.toLowerCase().replace(/[\s-]/g, "_");
    if (normalized.includes("naming") && entry.cognitiveDomains.includes("lexical_retrieval")) {
      return "Selected because naming is a therapy priority";
    }
    if (normalized.includes("syntax") && entry.cognitiveDomains.includes("syntax")) {
      return "Selected because sentence-level skills are a therapy priority";
    }
    if (normalized.includes("phonolog") && entry.cognitiveDomains.includes("phonology")) {
      return "Selected because phonological skills are a therapy priority";
    }
  }

  return entry.clinicalRationale;
}
