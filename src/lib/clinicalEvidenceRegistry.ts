/**
 * Clinically grounded progression DESIGN CONTRACT, not a validated instrument.
 * 29 activities are reviewed against distinct therapeutic targets, invalid
 * proxies and independent generalization checks. Every per-game eight-stage
 * ladder remains an app-specific hypothesis until SLP and clinical validation.
 *
 * Source basis: project synthesis "Clinical Progression Ladders for Seventeen
 * Aphasia and Cognitive Linguistic Therapy Games" (research framing, not
 * a clinical trial), supplemented by the linked ASHA / ESO / CSBPR guidance.
 *
 * Do not reuse evidenceFit as a patient score, automatic promotion gate,
 * or proof that a game's specific rules/8 stages have clinical efficacy.
 */

export type EvidenceFit = 'direct-method' | 'related' | 'exploratory';
export type EvidenceTrack = 'expressive' | 'receptive' | 'non-linguistic';
export type EvidenceSourceKey = 'ASHA_APHASIA' | 'ESO_2025' | 'CANADA_LANGUAGE' | 'CANADA_COGNITION' | 'CANADA_VISION' | 'CANADA_MOTOR' | 'BIG_CACTUS';

export const CLINICAL_EVIDENCE_SOURCES: Record<EvidenceSourceKey, {
  label: string;
  kind: 'guideline' | 'clinical-practice' | 'trial';
  url: string;
}> = {
  "ASHA_APHASIA": {
    "label": "ASHA Aphasia Practice Portal",
    "kind": "clinical-practice",
    "url": "https://www.asha.org/practice-portal/clinical-topics/aphasia/"
  },
  "ESO_2025": {
    "label": "European Stroke Organisation Aphasia Rehabilitation Guideline (2025)",
    "kind": "guideline",
    "url": "https://academic.oup.com/esj/article/10/4/1189/8377346"
  },
  "CANADA_LANGUAGE": {
    "label": "Canadian Stroke Best Practices, Language and Communication (2025)",
    "kind": "guideline",
    "url": "https://www.strokebestpractices.ca/recommendations/stroke-rehabilitation-delivery/7-language-and-communication"
  },
  "CANADA_COGNITION": {
    "label": "Canadian Stroke Best Practices, Cognitive Rehabilitation (2025)",
    "kind": "guideline",
    "url": "https://www.strokebestpractices.ca/recommendations/activity-participation-following-stroke/3-cognitive-rehabilitation-for-individuals-with-stroke"
  },
  "CANADA_VISION": {
    "label": "Canadian Stroke Best Practices, Visual and Visual-Perceptual Impairment (2025)",
    "kind": "guideline",
    "url": "https://www.strokebestpractices.ca/recommendations/stroke-rehabilitation-delivery/8-visual-and-visual-perceptual-impairment"
  },
  "CANADA_MOTOR": {
    "label": "Canadian Stroke Best Practices, Upper Extremity Function (2025)",
    "kind": "guideline",
    "url": "https://www.strokebestpractices.ca/recommendations/stroke-rehabilitation-delivery/1-initial-stroke-rehabilitation-screening-and-assessment"
  },
  "BIG_CACTUS": {
    "label": "Big CACTUS computerized aphasia therapy RCT",
    "kind": "trial",
    "url": "https://www.ncbi.nlm.nih.gov/books/NBK556719/"
  }
};

export interface ClinicalGameEvidence {
  /** Evidence for the therapy METHOD, never the exact digital 8-stage implementation. */
  evidenceFit: EvidenceFit;
  /** Disallow receptive/nonlinguistic wins from being routed to expressive mastery. */
  track: EvidenceTrack;
  primaryProgressionAxis: string;
  gameplayMeasure: string;
  measurementConfound: string;
  untrainedTransferCheck: string;
  sources: EvidenceSourceKey[];
}

export const CLINICAL_GAME_EVIDENCE: Record<string, ClinicalGameEvidence> = {
  "abstract-compare": {
    "evidenceFit": "exploratory",
    "track": "expressive",
    "primaryProgressionAxis": "Concept abstractness and imageability, not sentence length",
    "gameplayMeasure": "Relevant, accurate similarities and differences across a comparable concept pair",
    "measurementConfound": "General knowledge, culture, and vocabulary can masquerade as reasoning",
    "untrainedTransferCheck": "Untrained concept pair with independent human-rated relation accuracy",
    "sources": [
      "CANADA_COGNITION",
      "ASHA_APHASIA"
    ]
  },
  "conversation-coach": {
    "evidenceFit": "related",
    "track": "expressive",
    "primaryProgressionAxis": "Interactional complexity: turns, topic shifts and repair opportunities",
    "gameplayMeasure": "Successful functional message and independently attempted conversational repair",
    "measurementConfound": "AI partner variability, prompted imitation and TTS echo can inflate success",
    "untrainedTransferCheck": "Unscripted conversation with an unfamiliar partner, scored separately",
    "sources": [
      "CANADA_LANGUAGE",
      "ASHA_APHASIA"
    ]
  },
  "conversation-partner": {
    "evidenceFit": "related",
    "track": "expressive",
    "primaryProgressionAxis": "Pragmatic contingency in unscripted exchanges",
    "gameplayMeasure": "Topic maintenance, response relevance, initiation and successful repair",
    "measurementConfound": "An overly accommodating AI partner can conceal communication difficulty",
    "untrainedTransferCheck": "Independent real-world partner-rated functional goal assessment",
    "sources": [
      "CANADA_LANGUAGE",
      "ASHA_APHASIA"
    ]
  },
  "describe-guess": {
    "evidenceFit": "related",
    "track": "expressive",
    "primaryProgressionAxis": "Target feature opacity and imageability with constant describe-until-guessed rule",
    "gameplayMeasure": "Distinctive semantic features and whether the intended message was conveyed",
    "measurementConfound": "AI guesser instability, forbidden gestures and target-word leakage distort scores",
    "untrainedTransferCheck": "Novel target conveyed to a person without seeing the answer",
    "sources": [
      "ASHA_APHASIA",
      "CANADA_LANGUAGE"
    ]
  },
  "detective-mind": {
    "evidenceFit": "exploratory",
    "track": "receptive",
    "primaryProgressionAxis": "Inferential load and implicit clue integration",
    "gameplayMeasure": "Correct justified inference from supported, matched-language clues",
    "measurementConfound": "Reading demand and memory span can dominate inference",
    "untrainedTransferCheck": "New cases with equivalent comprehension demands and clinician review",
    "sources": [
      "CANADA_COGNITION",
      "ASHA_APHASIA"
    ]
  },
  "dual-load-naming": {
    "evidenceFit": "related",
    "track": "expressive",
    "primaryProgressionAxis": "Concurrent-task interference while naming target difficulty remains stable",
    "gameplayMeasure": "Naming validity plus concurrent task accuracy, recorded separately",
    "measurementConfound": "Response speed alone or changing both loads prevents interpretation",
    "untrainedTransferCheck": "Untrained naming under an equivalent validated dual-task condition",
    "sources": [
      "CANADA_COGNITION",
      "ASHA_APHASIA"
    ]
  },
  "fix-sentence": {
    "evidenceFit": "related",
    "track": "expressive",
    "primaryProgressionAxis": "Syntactic relation and error complexity, not word-count alone",
    "gameplayMeasure": "Grammatical and meaningful repair with defensible alternative sentences",
    "measurementConfound": "Exact-string scoring rejects valid grammar; cues mask independence",
    "untrainedTransferCheck": "Untrained sentence structures reviewed for grammatical adequacy",
    "sources": [
      "ASHA_APHASIA",
      "CANADA_LANGUAGE"
    ]
  },
  "left-side-hunt": {
    "evidenceFit": "related",
    "track": "non-linguistic",
    "primaryProgressionAxis": "Systematic leftward visual exploration under controlled clutter",
    "gameplayMeasure": "Target detection, search pattern, side and assistance, not spoken output",
    "measurementConfound": "Vision loss, device layout or lighting can mimic spatial neglect",
    "untrainedTransferCheck": "Functional visual search and validated neglect assessment by a specialist",
    "sources": [
      "CANADA_VISION",
      "CANADA_COGNITION"
    ]
  },
  "meaning-match": {
    "evidenceFit": "related",
    "track": "receptive",
    "primaryProgressionAxis": "Semantic distance between plausible meaning alternatives",
    "gameplayMeasure": "Unaided identification of intended meaning among controlled competitors",
    "measurementConfound": "Uneven reading load, implausible foils and item memorization",
    "untrainedTransferCheck": "Held-out, difficulty-balanced semantic discrimination items",
    "sources": [
      "ASHA_APHASIA",
      "CANADA_LANGUAGE"
    ]
  },
  "minimal-pairs": {
    "evidenceFit": "related",
    "track": "receptive",
    "primaryProgressionAxis": "Auditory phoneme contrast and controlled acoustic similarity",
    "gameplayMeasure": "Accurate first-hearing discrimination with replay separately recorded",
    "measurementConfound": "Hearing loss, equipment and text labels may confound phonemic processing",
    "untrainedTransferCheck": "Novel minimal pairs with calibrated playback and hearing accommodations",
    "sources": [
      "ASHA_APHASIA",
      "CANADA_LANGUAGE"
    ]
  },
  "multi-step-plan": {
    "evidenceFit": "related",
    "track": "expressive",
    "primaryProgressionAxis": "Plan depth, ordered dependencies and subgoals",
    "gameplayMeasure": "Valid functional order, retained dependencies and independent self-correction",
    "measurementConfound": "Complicated wording may become a language-comprehension test",
    "untrainedTransferCheck": "New everyday task evaluated with functional planning criteria",
    "sources": [
      "CANADA_COGNITION"
    ]
  },
  "narrative-retell": {
    "evidenceFit": "related",
    "track": "expressive",
    "primaryProgressionAxis": "Story-grammar and discourse macrostructure complexity",
    "gameplayMeasure": "Correct information units, event sequence and global coherence",
    "measurementConfound": "Word count, repeated stories or ASR omissions create false improvement",
    "untrainedTransferCheck": "Untrained stories scored with a reproducible human-checked rubric",
    "sources": [
      "ASHA_APHASIA",
      "CANADA_LANGUAGE"
    ]
  },
  "pattern-match": {
    "evidenceFit": "exploratory",
    "track": "non-linguistic",
    "primaryProgressionAxis": "Rule induction and controlled sequence complexity",
    "gameplayMeasure": "Correct application of a novel nonverbal rule, with supports recorded",
    "measurementConfound": "Visual acuity, motor precision and memory load masquerade as rule learning",
    "untrainedTransferCheck": "Independent nonverbal rule-transfer task, not aphasia outcome",
    "sources": [
      "CANADA_COGNITION"
    ]
  },
  "phonological-awareness": {
    "evidenceFit": "related",
    "track": "receptive",
    "primaryProgressionAxis": "Phoneme segmentation and manipulation complexity",
    "gameplayMeasure": "Accurate target sound identification/manipulation, replay separated",
    "measurementConfound": "Orthography and microphone/acoustic artifacts confound phonology",
    "untrainedTransferCheck": "Novel phonological material assessed separately from reading",
    "sources": [
      "ASHA_APHASIA",
      "CANADA_LANGUAGE"
    ]
  },
  "photo-naming": {
    "evidenceFit": "direct-method",
    "track": "expressive",
    "primaryProgressionAxis": "Lexical retrieval complexity while cue support is independently tracked",
    "gameplayMeasure": "Valid target or meaning-equivalent response, error type and help delivered",
    "measurementConfound": "Speech-recognition error and rehearsed items can inflate naming outcomes",
    "untrainedTransferCheck": "Untrained naming probes distinct from therapy words",
    "sources": [
      "ASHA_APHASIA",
      "BIG_CACTUS",
      "CANADA_LANGUAGE"
    ]
  },
  "phrase-practice": {
    "evidenceFit": "direct-method",
    "track": "expressive",
    "primaryProgressionAxis": "Functional script autonomy and flexible use, not repeated phrase length alone",
    "gameplayMeasure": "Correct communicative intent with independent versus modeled production",
    "measurementConfound": "Echoed target, fixed scripts and ASR match are not real-world generalization",
    "untrainedTransferCheck": "Personally relevant unprompted exchange with another speaker",
    "sources": [
      "ASHA_APHASIA",
      "CANADA_LANGUAGE"
    ]
  },
  "reach-tap": {
    "evidenceFit": "related",
    "track": "non-linguistic",
    "primaryProgressionAxis": "Comfortable task-specific reach accuracy and control",
    "gameplayMeasure": "Targeting precision, device/hand used, assistance and fatigue",
    "measurementConfound": "Touchscreen tapping is not a validated measure of upper limb recovery",
    "untrainedTransferCheck": "Functional upper-limb activity evaluated with standardized motor measure",
    "sources": [
      "CANADA_MOTOR"
    ]
  },
  "semantic-features": {
    "evidenceFit": "direct-method",
    "track": "expressive",
    "primaryProgressionAxis": "Target semantic abstractness and feature discriminability",
    "gameplayMeasure": "Nonredundant, correct target features recorded by independence and cues",
    "measurementConfound": "More clues or more words may not reflect improved semantic retrieval",
    "untrainedTransferCheck": "Untrained naming and feature generation distinct from practiced items",
    "sources": [
      "ASHA_APHASIA",
      "CANADA_LANGUAGE"
    ]
  },
  "sentence-construction": {
    "evidenceFit": "direct-method",
    "track": "expressive",
    "primaryProgressionAxis": "Syntactic structure complexity and argument relations",
    "gameplayMeasure": "Grammatically valid produced sentence and thematic-role accuracy",
    "measurementConfound": "Longer sentences and tile arrangement alone do not prove sentence production",
    "untrainedTransferCheck": "Novel syntactic structures produced without automatic full models",
    "sources": [
      "ASHA_APHASIA",
      "CANADA_LANGUAGE"
    ]
  },
  "sentence-game": {
    "evidenceFit": "related",
    "track": "expressive",
    "primaryProgressionAxis": "Self-formulated clause and grammatical relation complexity",
    "gameplayMeasure": "Independent intelligible agent-action-object message or adequate alternative",
    "measurementConfound": "Choice/tile success is not equivalent to spontaneous sentence generation",
    "untrainedTransferCheck": "Untrained sentence prompt rated for grammar and intended meaning",
    "sources": [
      "ASHA_APHASIA",
      "CANADA_LANGUAGE"
    ]
  },
  "thought-continuation": {
    "evidenceFit": "exploratory",
    "track": "expressive",
    "primaryProgressionAxis": "Contextual under-specification and self-generated proposition demand",
    "gameplayMeasure": "Relevant coherent continuation with independent intent",
    "measurementConfound": "Grammar-only scoring and auto-complete cues hide discourse difficulty",
    "untrainedTransferCheck": "Novel contexts scored for cohesion and self-initiated content",
    "sources": [
      "CANADA_LANGUAGE",
      "ASHA_APHASIA"
    ]
  },
  "thought-organization": {
    "evidenceFit": "related",
    "track": "expressive",
    "primaryProgressionAxis": "Organization of propositions and goal-relevant sequence",
    "gameplayMeasure": "Relevant ordered ideas, causal links and topic retention",
    "measurementConfound": "More words, rigid scripts or dictated outlines can mask organization",
    "untrainedTransferCheck": "New functional explanation scored for coherence by a trained rater",
    "sources": [
      "CANADA_COGNITION",
      "CANADA_LANGUAGE"
    ]
  },
  "two-clues": {
    "evidenceFit": "exploratory",
    "track": "expressive",
    "primaryProgressionAxis": "Semantic cue diagnosticity and competitor resolution",
    "gameplayMeasure": "Valid convergent target or defensible alternative; actual hint use separately",
    "measurementConfound": "A strong anchor match must never be mistaken for a delivered cue",
    "untrainedTransferCheck": "Novel clue combinations with accepted-alternative review",
    "sources": [
      "ASHA_APHASIA",
      "CANADA_LANGUAGE"
    ]
  },
  "word-finding": {
    "evidenceFit": "direct-method",
    "track": "expressive",
    "primaryProgressionAxis": "Independent lexical retrieval across personally relevant semantic contexts",
    "gameplayMeasure": "Target named or effective circumlocution; those outcomes marked separately",
    "measurementConfound": "ASR exact match and memorized items can be mistaken for generalized naming",
    "untrainedTransferCheck": "Untrained personally meaningful words distinct from practice set",
    "sources": [
      "ASHA_APHASIA",
      "BIG_CACTUS"
    ]
  },
  "follow-directions": {
    "evidenceFit": "related",
    "track": "receptive",
    "primaryProgressionAxis": "Spoken instruction step/dependency complexity, with constant accessible audio",
    "gameplayMeasure": "Correct ordered action on first presentation versus after replay",
    "measurementConfound": "Literacy, motor limitations and hearing may bias auditory comprehension",
    "untrainedTransferCheck": "Novel commands assessed in supported real-world action contexts",
    "sources": [
      "CANADA_LANGUAGE",
      "ASHA_APHASIA"
    ]
  },
  "category-fluency": {
    "evidenceFit": "related",
    "track": "expressive",
    "primaryProgressionAxis": "Semantic search and switching demand with comparable timed windows",
    "gameplayMeasure": "Unique valid category items and switching quality, separated from cues",
    "measurementConfound": "Time changes, repeats and education/cultural exposure bias output",
    "untrainedTransferCheck": "Novel matched categories with consistent timing and cluster metrics",
    "sources": [
      "CANADA_COGNITION",
      "ASHA_APHASIA"
    ]
  },
  "synonym-generator": {
    "evidenceFit": "exploratory",
    "track": "expressive",
    "primaryProgressionAxis": "Semantic competition and intended word sense specificity",
    "gameplayMeasure": "Context-appropriate substitute or paraphrase, not one string only",
    "measurementConfound": "Multiple valid synonyms, polysemy and lexical frequency confound scoring",
    "untrainedTransferCheck": "Untrained contextual substitution assessed for equivalent meaning",
    "sources": [
      "ASHA_APHASIA"
    ]
  },
  "sequence-builder": {
    "evidenceFit": "related",
    "track": "receptive",
    "primaryProgressionAxis": "Temporal/causal dependencies in meaningful everyday sequences",
    "gameplayMeasure": "Correct independent ordering, partial order and cause-effect reasoning",
    "measurementConfound": "Drag precision, reading and rote familiar pictures distort cognitive score",
    "untrainedTransferCheck": "Novel everyday sequence demonstrated with functional performance",
    "sources": [
      "CANADA_COGNITION"
    ]
  },
  "functional-scenes": {
    "evidenceFit": "exploratory",
    "track": "expressive",
    "primaryProgressionAxis": "Context-appropriate functional commands and goal changes",
    "gameplayMeasure": "Successfully communicated intended scene action with acceptable phrasing",
    "measurementConfound": "Preloaded keywords and prompted echoes mask independent requests",
    "untrainedTransferCheck": "Unseen everyday scene intent tested with a human communication partner",
    "sources": [
      "CANADA_LANGUAGE",
      "ASHA_APHASIA"
    ]
  }
};

/** Neither trial accuracy nor design coverage demonstrates validation. */
export const EIGHT_STAGE_LADDER_VALIDATED = false as const;
export const CLINICIAN_REVIEW_DOCUMENTED = false as const;

export const EVIDENCE_FIT_TEXT: Record<EvidenceFit, string> = {
  'direct-method': 'A published treatment method closely relates to this activity; the app implementation is not validated.',
  related: 'Related clinical rehabilitation evidence; this game's eight-stage design is an extrapolation.',
  exploratory: 'Exploratory game mechanic; direct evidence for this exact progression is not established.',
};

export function getClinicalGameEvidence(slug: string): ClinicalGameEvidence | null {
  return CLINICAL_GAME_EVIDENCE[slug] ?? null;
}
