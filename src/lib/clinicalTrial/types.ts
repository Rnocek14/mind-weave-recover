/**
 * Shared types for the Clinical Trial Readiness Layer.
 * Mirrors the Supabase tables created in Phase A.
 */

export type StudyStatus = 'draft' | 'active' | 'closed';

export type EnrollmentStatus =
  | 'screening'
  | 'eligible'
  | 'ineligible'
  | 'consented'
  | 'active'
  | 'withdrawn'
  | 'completed';

export type CriterionKind = 'inclusion' | 'exclusion';

export interface EligibilityCriterion {
  key: string;
  label: string;
  kind: CriterionKind;
  /**
   * Optional helper text shown below the label during screening.
   */
  hint?: string;
}

/**
 * Default inclusion/exclusion criteria for a feasibility pilot.
 * Studies can override this list per-protocol.
 */
export const DEFAULT_INCLUSION_CRITERIA: EligibilityCriterion[] = [
  { key: 'adult', label: 'Adult, age 18 or older', kind: 'inclusion' },
  { key: 'aphasia_dx', label: 'Confirmed aphasia diagnosis', kind: 'inclusion' },
  { key: 'post_stroke_30d', label: 'At least 1 month post-stroke', kind: 'inclusion' },
  {
    key: 'sensory_ok',
    label: 'Sufficient hearing and vision to use the app',
    kind: 'inclusion',
    hint: 'Glasses and hearing aids OK.',
  },
  { key: 'support_available', label: 'Caregiver or clinician available', kind: 'inclusion' },
  { key: 'english_fluent', label: 'English fluent before stroke', kind: 'inclusion' },
];

export const DEFAULT_EXCLUSION_CRITERIA: EligibilityCriterion[] = [
  {
    key: 'global_aphasia_severe',
    label: 'Severe global aphasia with no functional comprehension',
    kind: 'exclusion',
  },
  {
    key: 'uncontrolled_medical',
    label: 'Active uncontrolled medical or psychiatric condition',
    kind: 'exclusion',
  },
  {
    key: 'concurrent_trial',
    label: 'Currently enrolled in another aphasia trial',
    kind: 'exclusion',
  },
  {
    key: 'cognitive_consent',
    label: 'Cognitive impairment that prevents informed consent',
    kind: 'exclusion',
    hint: 'A surrogate may consent on the patient\'s behalf if appropriate.',
  },
];

export interface TrialRuntimeConfig {
  study_id: string;
  engine_version: string;
  scorer_version: string;
  runtime_config: Record<string, unknown>;
  pinned_at: string;
}
