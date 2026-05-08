/**
 * Shared Clinical Demand Dimensions (v1 — spec)
 *
 * The single vocabulary every game uses to describe what gets harder
 * (or softer) as a patient progresses. Per-game rungs reference these
 * IDs so a clinician can interpret progress across the whole system,
 * not just inside one mini-game.
 *
 * IMPORTANT: Spec-only. No runtime engine code should branch on these
 * IDs yet. They drive the patient-facing "How this game supports
 * recovery" page and per-game rung definitions in `clinicalRungs.ts`.
 */

export type ClinicalDimensionId =
  | 'cue_dependency'
  | 'retrieval_burden'
  | 'linguistic_complexity'
  | 'processing_speed'
  | 'working_memory_load'
  | 'abstraction'
  | 'independence'
  | 'distractor_load'
  | 'discourse_organization'
  | 'speech_motor_precision';

export interface ClinicalDimension {
  id: ClinicalDimensionId;
  /** Patient-friendly short label. */
  patientLabel: string;
  /** Clinician term. */
  clinicalLabel: string;
  /** One-line plain-language description for the About page. */
  description: string;
  /** Optional example phrasing for "what gets harder". */
  whatHarder?: string;
  /** Optional example phrasing for "what softens with support". */
  whatSofter?: string;
}

export const CLINICAL_DIMENSIONS: Record<ClinicalDimensionId, ClinicalDimension> = {
  cue_dependency: {
    id: 'cue_dependency',
    patientLabel: 'Help needed',
    clinicalLabel: 'Cue dependency',
    description: 'How much prompting or hinting you need to retrieve or organize a response.',
    whatHarder: 'Fewer cues offered, longer wait before a hint, no first-sound or category prompt.',
    whatSofter: 'Sooner cues, more cue layers, full word reveal available.',
  },
  retrieval_burden: {
    id: 'retrieval_burden',
    patientLabel: 'Word-finding effort',
    clinicalLabel: 'Retrieval burden',
    description: 'How effortful it is to pull a target word, name, or fact from memory.',
    whatHarder: 'Lower-frequency words, less typical category members, atypical exemplars.',
    whatSofter: 'High-frequency, prototypical, age-of-acquisition-early items.',
  },
  linguistic_complexity: {
    id: 'linguistic_complexity',
    patientLabel: 'Sentence difficulty',
    clinicalLabel: 'Linguistic complexity',
    description: 'How elaborate the language is — sentence length, embedded clauses, rare structures.',
    whatHarder: 'Compound sentences, embedded clauses, low-frequency syntax.',
    whatSofter: 'Short SVO sentences, common frames.',
  },
  processing_speed: {
    id: 'processing_speed',
    patientLabel: 'Speed',
    clinicalLabel: 'Processing speed demand',
    description: 'How fast you have to listen, think, or respond.',
    whatHarder: 'Tighter response windows, faster audio, time pressure.',
    whatSofter: 'Long response windows, slow audio, replay available.',
  },
  working_memory_load: {
    id: 'working_memory_load',
    patientLabel: 'Holding it in mind',
    clinicalLabel: 'Working memory load',
    description: 'How much information you must hold and manipulate at once.',
    whatHarder: 'More items, longer narratives, more steps before responding.',
    whatSofter: 'Chunked playback, written outline, fewer items per trial.',
  },
  abstraction: {
    id: 'abstraction',
    patientLabel: 'Abstractness',
    clinicalLabel: 'Abstraction',
    description: 'How concrete vs. abstract the concepts are.',
    whatHarder: 'Abstract nouns, metaphor, inference, emotion.',
    whatSofter: 'Concrete, imageable, everyday items.',
  },
  independence: {
    id: 'independence',
    patientLabel: 'On your own',
    clinicalLabel: 'Independence',
    description: 'How much of the trial you complete without scaffolding from the coach.',
    whatHarder: 'Coach steps back, no model provided, no structure given.',
    whatSofter: 'Coach models, structures, or starts the response for you.',
  },
  distractor_load: {
    id: 'distractor_load',
    patientLabel: 'Things to filter out',
    clinicalLabel: 'Distractor / interference load',
    description: 'How many similar or competing options you must reject.',
    whatHarder: 'More distractors, semantically similar foils, secondary tasks.',
    whatSofter: 'Fewer choices, distant foils, single-focus screen.',
  },
  discourse_organization: {
    id: 'discourse_organization',
    patientLabel: 'Storytelling structure',
    clinicalLabel: 'Discourse organization',
    description: 'How well you sequence, connect, and summarize ideas across sentences.',
    whatHarder: 'Multiple events, causal links, inference, summary.',
    whatSofter: 'Single event, written outline, prompted sequence.',
  },
  speech_motor_precision: {
    id: 'speech_motor_precision',
    patientLabel: 'Sound clarity',
    clinicalLabel: 'Speech motor precision',
    description: 'How clearly you produce target sounds and words.',
    whatHarder: 'Complex consonant clusters, multisyllabic words, faster pacing.',
    whatSofter: 'Single syllables, slow modeling, repeated trials.',
  },
};

export const CLINICAL_DIMENSIONS_VERSION = '1.0.0-spec';

export function getDimension(id: ClinicalDimensionId): ClinicalDimension {
  return CLINICAL_DIMENSIONS[id];
}
