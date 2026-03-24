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
  /** High-level focus areas this exercise contributes to */
  focusAreas: string[];
  /** What this exercise supports in daily life */
  functionalMeaning: string;
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
    focusAreas: ["semantic_understanding", "executive_function"],
    functionalMeaning: "Supports understanding relationships between ideas",
  },
  {
    slug: "conversation-coach",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Structured conversational practice with real-time coaching.",
    outcomeMetrics: ["cue_independence", "error_quality"],
    expectedGain: "More independent and organized conversational speech",
    focusAreas: ["story_recall_discourse", "sentence_formation"],
    functionalMeaning: "Helps build confidence in everyday conversation",
  },
  {
    slug: "conversation-partner",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Open-ended conversation practice for functional communication.",
    outcomeMetrics: ["cue_independence"],
    expectedGain: "Greater confidence and independence in everyday conversation",
    focusAreas: ["story_recall_discourse"],
    functionalMeaning: "Supports natural back-and-forth communication",
  },
  {
    slug: "describe-guess",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval", "discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Exercises circumlocution and descriptive naming strategies.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "Better circumlocution strategies and descriptive naming",
    focusAreas: ["naming", "word_retrieval"],
    functionalMeaning: "Helps find alternative ways to express what you mean",
  },
  {
    slug: "detective-mind",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Develops deductive reasoning and evidence-based decision making.",
    outcomeMetrics: ["error_quality"],
    expectedGain: "Stronger deductive reasoning and logical problem solving",
    focusAreas: ["executive_function", "planning_sequencing"],
    functionalMeaning: "Supports problem-solving and decision-making in daily life",
  },
  {
    slug: "dual-load-naming",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval", "executive_function"],
    hasSpeechOutput: true,
    clinicalRationale: "Trains word retrieval under cognitive load for real-world transfer.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "More reliable word retrieval under cognitive demands",
    focusAreas: ["naming", "word_retrieval", "attention"],
    functionalMeaning: "Supports finding words while multitasking or under pressure",
  },
  {
    slug: "fix-sentence",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax"],
    hasSpeechOutput: false,
    clinicalRationale: "Targets grammatical awareness and sentence-level error detection.",
    outcomeMetrics: ["error_quality"],
    expectedGain: "Improved grammatical awareness and self-monitoring",
    focusAreas: ["sentence_formation"],
    functionalMeaning: "Helps catch and correct grammar in speech and writing",
  },
  {
    slug: "left-side-hunt",
    recoveryDomain: "physical_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Visual scanning for left neglect rehabilitation with cognitive demands.",
    outcomeMetrics: ["error_quality"],
    expectedGain: "Better leftward scanning and reduced neglect misses",
    focusAreas: ["left_side_scanning"],
    functionalMeaning: "Helps notice things on the left side in everyday environments",
  },
  {
    slug: "meaning-match",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["semantic_depth"],
    hasSpeechOutput: false,
    clinicalRationale: "Strengthens semantic associations and word meaning comprehension.",
    outcomeMetrics: ["word_mastery", "error_quality"],
    expectedGain: "Stronger semantic networks and word comprehension",
    focusAreas: ["semantic_understanding", "comprehension"],
    functionalMeaning: "Supports understanding word meanings and relationships",
  },
  {
    slug: "minimal-pairs",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["phonology"],
    hasSpeechOutput: true,
    clinicalRationale: "Targets phonological discrimination and production accuracy.",
    outcomeMetrics: ["error_quality", "cue_independence"],
    expectedGain: "More accurate phonological discrimination and production",
    focusAreas: ["phonological_production"],
    functionalMeaning: "Helps distinguish and produce similar-sounding words clearly",
  },
  {
    slug: "multi-step-plan",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Exercises sequencing, planning, and multi-step problem solving.",
    outcomeMetrics: ["error_quality"],
    expectedGain: "Better multi-step planning and sequencing ability",
    focusAreas: ["planning_sequencing", "executive_function"],
    functionalMeaning: "Supports organizing steps for daily tasks like cooking or errands",
  },
  {
    slug: "narrative-retell",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization", "syntax"],
    hasSpeechOutput: true,
    clinicalRationale: "Practices connected speech, narrative structure, and story cohesion.",
    outcomeMetrics: ["cue_independence", "error_quality"],
    expectedGain: "More coherent and organized narrative speech",
    focusAreas: ["story_recall_discourse", "sentence_formation"],
    functionalMeaning: "Helps retell events and stories clearly to others",
  },
  {
    slug: "pattern-match",
    recoveryDomain: "physical_therapy",
    cognitiveDomains: ["executive_function"],
    hasSpeechOutput: false,
    clinicalRationale: "Visual pattern recognition and sustained attention training.",
    outcomeMetrics: ["error_quality"],
    expectedGain: "Improved sustained attention and pattern recognition",
    focusAreas: ["attention"],
    functionalMeaning: "Supports focus and concentration during daily activities",
  },
  {
    slug: "phonological-awareness",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["phonology"],
    hasSpeechOutput: true,
    clinicalRationale: "Builds phonological processing: rhyming, segmenting, blending.",
    outcomeMetrics: ["error_quality", "cue_independence"],
    expectedGain: "Stronger phonological assembly and sound processing",
    focusAreas: ["phonological_production"],
    functionalMeaning: "Supports breaking down and building up sounds in words",
  },
  {
    slug: "photo-naming",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval"],
    hasSpeechOutput: true,
    clinicalRationale: "Core confrontation naming for word retrieval practice.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "More independent and accurate word retrieval",
    focusAreas: ["naming", "word_retrieval"],
    functionalMeaning: "Supports finding the right word for everyday objects and people",
  },
  {
    slug: "phrase-practice",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax", "phonology"],
    hasSpeechOutput: true,
    clinicalRationale: "Functional phrase repetition and production fluency.",
    outcomeMetrics: ["cue_independence"],
    expectedGain: "Smoother phrase production and reduced hesitation",
    focusAreas: ["sentence_formation", "phonological_production"],
    functionalMeaning: "Helps produce common phrases more smoothly",
  },
  {
    slug: "reach-tap",
    recoveryDomain: "physical_therapy",
    cognitiveDomains: [],
    hasSpeechOutput: false,
    clinicalRationale: "Upper extremity motor coordination and reach targeting.",
    outcomeMetrics: [],
    expectedGain: "Improved affected-limb reach accuracy and coordination",
    focusAreas: ["upper_limb_coordination"],
    functionalMeaning: "Supports reaching and tapping movements for daily tasks",
  },
  {
    slug: "semantic-features",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["semantic_depth", "lexical_retrieval"],
    hasSpeechOutput: false,
    clinicalRationale: "Semantic Feature Analysis (SFA) to strengthen word retrieval networks.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "Stronger semantic retrieval networks and less cue dependence",
    focusAreas: ["semantic_understanding", "word_retrieval"],
    functionalMeaning: "Helps build richer word knowledge to support retrieval",
  },
  {
    slug: "sentence-construction",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax"],
    hasSpeechOutput: true,
    clinicalRationale: "Sentence formulation targeting grammar and word order.",
    outcomeMetrics: ["error_quality", "cue_independence"],
    expectedGain: "Better sentence formulation and grammatical accuracy",
    focusAreas: ["sentence_formation"],
    functionalMeaning: "Supports building complete, clear sentences",
  },
  {
    slug: "sentence-game",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["syntax"],
    hasSpeechOutput: true,
    clinicalRationale: "Sentence formulation targeting grammar and word order.",
    outcomeMetrics: ["error_quality", "cue_independence"],
    expectedGain: "Better sentence formulation and grammatical accuracy",
    focusAreas: ["sentence_formation"],
    functionalMeaning: "Supports building complete, clear sentences",
  },
  {
    slug: "thought-continuation",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization"],
    hasSpeechOutput: true,
    clinicalRationale: "Practices idea elaboration and thought completion.",
    outcomeMetrics: ["cue_independence"],
    expectedGain: "More complete and elaborated thought expression",
    focusAreas: ["story_recall_discourse"],
    functionalMeaning: "Helps finish thoughts and express complete ideas",
  },
  {
    slug: "thought-organization",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["discourse_organization", "executive_function"],
    hasSpeechOutput: true,
    clinicalRationale: "Structured thought organization and verbal planning.",
    outcomeMetrics: ["cue_independence", "error_quality"],
    expectedGain: "More organized verbal output and planning",
    focusAreas: ["story_recall_discourse", "planning_sequencing"],
    functionalMeaning: "Supports organizing what you want to say before speaking",
  },
  {
    slug: "two-clues",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["executive_function", "lexical_retrieval"],
    hasSpeechOutput: true,
    clinicalRationale: "Integrates two semantic/phonological cues to retrieve target words.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "Better integration of cues for independent word retrieval",
    focusAreas: ["word_retrieval", "naming"],
    functionalMeaning: "Helps use hints and context to find the right word",
  },
  {
    slug: "word-finding",
    recoveryDomain: "speech_therapy",
    cognitiveDomains: ["lexical_retrieval"],
    hasSpeechOutput: true,
    clinicalRationale: "General word retrieval practice across categories.",
    outcomeMetrics: ["word_mastery", "cue_independence"],
    expectedGain: "Broader and more reliable word retrieval across categories",
    focusAreas: ["word_retrieval", "naming"],
    functionalMeaning: "Supports finding words across different topics and situations",
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

/**
 * Get suggested exercises for a focus area, ranked by number of matching focus areas.
 */
export function getSuggestedExercisesForFocusArea(focusAreaId: string): ExerciseDomainEntry[] {
  return EXERCISE_DOMAIN_MAP
    .filter(e => e.focusAreas.includes(focusAreaId))
    .sort((a, b) => {
      // Prefer exercises where this is the primary focus area (listed first)
      const aIdx = a.focusAreas.indexOf(focusAreaId);
      const bIdx = b.focusAreas.indexOf(focusAreaId);
      return aIdx - bIdx;
    });
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
