/**
 * Focus Area Definitions — user-meaningful recovery area groupings.
 * 
 * Maps high-level focus areas to cognitive domains, likely impairments,
 * functional meaning, and linked outcome metrics.
 */

export interface FocusAreaDefinition {
  id: string;
  label: string;
  /** Patient-friendly label */
  patientLabel: string;
  /** Which cognitive domains map to this area */
  cognitiveDomains: string[];
  /** Impairment keywords that indicate this is a deficit */
  relatedImpairments: string[];
  /** What this area supports in daily life */
  functionalMeaning: string;
  /** Patient-friendly description of what this area is */
  patientDescription: string;
  /** Outcome metrics this area feeds */
  linkedOutcomes: string[];
  /** Category for grouping */
  category: 'speech_language' | 'cognitive' | 'motor_visuospatial';
}

export const FOCUS_AREA_DEFINITIONS: FocusAreaDefinition[] = [
  // Speech/Language
  {
    id: "naming",
    label: "Naming",
    patientLabel: "Naming pictures and objects",
    cognitiveDomains: ["lexical_retrieval"],
    relatedImpairments: ["anomia", "anomic_aphasia", "word_finding"],
    functionalMeaning: "Finding the right word for everyday objects and people",
    patientDescription: "How well you can say the name of something when you see it",
    linkedOutcomes: ["word_mastery", "cue_independence"],
    category: "speech_language",
  },
  {
    id: "word_retrieval",
    label: "Word Retrieval",
    patientLabel: "Finding the right words",
    cognitiveDomains: ["lexical_retrieval", "semantic_depth"],
    relatedImpairments: ["anomia", "anomic_aphasia", "semantic_paraphasia"],
    functionalMeaning: "Retrieving words from memory during conversation",
    patientDescription: "How easily the right word comes to mind when you need it",
    linkedOutcomes: ["word_mastery", "cue_independence"],
    category: "speech_language",
  },
  {
    id: "semantic_understanding",
    label: "Semantic Understanding",
    patientLabel: "Understanding word meanings",
    cognitiveDomains: ["semantic_depth"],
    relatedImpairments: ["comprehension_deficit", "semantic_paraphasia"],
    functionalMeaning: "Understanding what words mean and how they relate",
    patientDescription: "How well you understand the meaning of words and how they connect",
    linkedOutcomes: ["word_mastery", "error_quality"],
    category: "speech_language",
  },
  {
    id: "phonological_production",
    label: "Phonological Production",
    patientLabel: "Producing sounds clearly",
    cognitiveDomains: ["phonology"],
    relatedImpairments: ["phonemic_paraphasia", "dysarthria", "apraxia"],
    functionalMeaning: "Producing speech sounds clearly and accurately",
    patientDescription: "How clearly you can produce sounds and words",
    linkedOutcomes: ["error_quality", "cue_independence"],
    category: "speech_language",
  },
  {
    id: "sentence_formation",
    label: "Sentence Formation",
    patientLabel: "Building sentences",
    cognitiveDomains: ["syntax"],
    relatedImpairments: ["agrammatism", "fluency_deficit"],
    functionalMeaning: "Forming grammatically correct and complete sentences",
    patientDescription: "How well you can put words together into sentences",
    linkedOutcomes: ["error_quality", "cue_independence"],
    category: "speech_language",
  },
  {
    id: "story_recall_discourse",
    label: "Story Recall & Discourse",
    patientLabel: "Telling stories and having conversations",
    cognitiveDomains: ["discourse_organization"],
    relatedImpairments: ["discourse_impairment", "fluency_deficit"],
    functionalMeaning: "Organizing and expressing connected ideas in speech",
    patientDescription: "How well you can tell a story, describe events, or have a conversation",
    linkedOutcomes: ["cue_independence", "error_quality"],
    category: "speech_language",
  },
  {
    id: "comprehension",
    label: "Comprehension",
    patientLabel: "Understanding what's said",
    cognitiveDomains: ["semantic_depth"],
    relatedImpairments: ["comprehension_deficit"],
    functionalMeaning: "Understanding spoken and written language",
    patientDescription: "How well you understand what people say to you",
    linkedOutcomes: ["error_quality"],
    category: "speech_language",
  },
  // Cognitive
  {
    id: "executive_function",
    label: "Executive Function",
    patientLabel: "Thinking and problem-solving",
    cognitiveDomains: ["executive_function"],
    relatedImpairments: ["executive_dysfunction"],
    functionalMeaning: "Planning, reasoning, and flexible thinking",
    patientDescription: "How well you can plan, organize, and solve problems",
    linkedOutcomes: ["error_quality"],
    category: "cognitive",
  },
  {
    id: "attention",
    label: "Attention",
    patientLabel: "Staying focused",
    cognitiveDomains: ["executive_function"],
    relatedImpairments: ["attention_deficit"],
    functionalMeaning: "Sustaining focus and concentration",
    patientDescription: "How well you can focus and stay on task",
    linkedOutcomes: ["error_quality"],
    category: "cognitive",
  },
  {
    id: "planning_sequencing",
    label: "Planning & Sequencing",
    patientLabel: "Ordering steps",
    cognitiveDomains: ["executive_function"],
    relatedImpairments: ["executive_dysfunction"],
    functionalMeaning: "Organizing steps in the right order",
    patientDescription: "How well you can plan and follow steps in order",
    linkedOutcomes: ["error_quality"],
    category: "cognitive",
  },
  // Motor/Visuospatial
  {
    id: "left_side_scanning",
    label: "Left-Side Scanning",
    patientLabel: "Looking to the left",
    cognitiveDomains: ["executive_function"],
    relatedImpairments: ["left_neglect"],
    functionalMeaning: "Noticing things on the left side",
    patientDescription: "How well you notice things on the left side of your vision",
    linkedOutcomes: ["error_quality"],
    category: "motor_visuospatial",
  },
  {
    id: "upper_limb_coordination",
    label: "Upper Limb Coordination",
    patientLabel: "Arm and hand movement",
    cognitiveDomains: [],
    relatedImpairments: ["motor_upper"],
    functionalMeaning: "Reaching and using the affected arm and hand",
    patientDescription: "How well you can reach and use your arm and hand",
    linkedOutcomes: [],
    category: "motor_visuospatial",
  },
];

const _byId = new Map<string, FocusAreaDefinition>();
FOCUS_AREA_DEFINITIONS.forEach(d => _byId.set(d.id, d));

export function getFocusAreaDefinition(id: string): FocusAreaDefinition | undefined {
  return _byId.get(id);
}

export function getFocusAreaLabel(id: string, forPatient = false): string {
  const def = _byId.get(id);
  if (!def) return id.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  return forPatient ? def.patientLabel : def.label;
}
