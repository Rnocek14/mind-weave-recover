/**
 * Research-to-runtime telemetry specifications for all 29 adult activities.
 *
 * These keys are TARGET FIELDS for future clinical review, not a claim that
 * the current game already emits them or that a valid clinical outcome exists.
 * The audit is observational, never a scoring/promotion gate. The clinical
 * ladder and its thresholds remain owned by each game-specific progression hook.
 *
 * Clinical construct/rationale/sources live in clinicalEvidenceRegistry;
 * do not duplicate the published evidence text in another registry.
 */
import { toLessonExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { getClinicalGameEvidence, type EvidenceTrack } from '@/lib/clinicalEvidenceRegistry';

export const GAME_MEASUREMENT_SPEC_VERSION = 'research-2026-11-02-v1' as const;

export type GameMeasurementUnit =
  | 'spoken_target' | 'spoken_phrase' | 'receptive_choice'
  | 'semantic_feature_set' | 'connected_disclosure'
  | 'sentence_repair' | 'sentence_structure'
  | 'semantic_search_window' | 'phonological_operation'
  | 'discourse_episode' | 'conversation_turn'
  | 'reasoning_case' | 'ordered_actions' | 'visual_pattern'
  | 'visual_search' | 'target_touch' | 'dual_task_pair';

export interface GameMeasurementSpec {
  /** Distinct primary app-observation label (not a standardized clinical scale). */
  primaryMeasureId: string;
  /** Unit of observation; never aggregate across mismatched units. */
  unit: GameMeasurementUnit;
  /** Per-game *proposed* task_parameters keys, NOT existing verified fields. */
  proposedTaskFields: readonly string[];
  /** Field whose interpretation needs clinician judgement even when present. */
  clinicianJudgement: string;
}

/** Proposed machine-readable targets from docs/clinical-evidence/29-game-specific-
 * progression-telemetry-research-2026.md. Source game catalog coverage is tested.
 * Actual implementation can be thin: absent telemetry is a code-coverage gap,
 * not an error made by the patient.
 */
export const GAME_MEASUREMENT_SPECS: Readonly<Record<string, GameMeasurementSpec>> = {
  'abstract-compare': {
    primaryMeasureId: 'concept_relation_quality',
    unit: 'connected_disclosure',
    proposedTaskFields: ['concept_pair_id','relation_dimensions','example_support_used'],
    clinicianJudgement: 'Relevant true similarity and a discriminative difference',
  },
  'conversation-coach': {
    primaryMeasureId: 'structured_interaction_goal_completion',
    unit: 'conversation_turn',
    proposedTaskFields: ['turn_goal','partner_response_type','repair_opportunity'],
    clinicianJudgement: 'Independent functional intent and communicative repair',
  },
  'conversation-partner': {
    primaryMeasureId: 'pragmatic_contingency_response',
    unit: 'conversation_turn',
    proposedTaskFields: ['partner_turn_id','initiated_without_prompt','repair_result'],
    clinicianJudgement: 'Topical response and successful clarification of breakdown',
  },
  'describe-guess': {
    primaryMeasureId: 'informative_circumlocution',
    unit: 'connected_disclosure',
    proposedTaskFields: ['target_id','discriminative_features','partner_confirmed_guess'],
    clinicianJudgement: 'Information conveyed to a person, not just bot keyword match',
  },
  'detective-mind': {
    primaryMeasureId: 'supported_inference_accuracy',
    unit: 'reasoning_case',
    proposedTaskFields: ['case_id','question_type','used_hint'],
    clinicianJudgement: 'Evidence-based inference with appropriate alternatives',
  },
  'dual-load-naming': {
    primaryMeasureId: 'naming_interference_cost',
    unit: 'dual_task_pair',
    proposedTaskFields: ['baseline_naming_trial_id','dual_task_accuracy','overlap_timing_ms'],
    clinicianJudgement: 'Naming under matched single and dual task targets',
  },
  'fix-sentence': {
    primaryMeasureId: 'contextual_sentence_repair',
    unit: 'sentence_repair',
    proposedTaskFields: ['input_mode','error_type','phase_1_repair'],
    clinicianJudgement: 'Targeted semantic or syntactic repair with alternative validity',
  },
  'left-side-hunt': {
    primaryMeasureId: 'left_visual_search_pattern',
    unit: 'visual_search',
    proposedTaskFields: ['target_x','target_y','search_order'],
    clinicianJudgement: 'Lateralized search performance accounting for vision and touch',
  },
  'meaning-match': {
    primaryMeasureId: 'semantic_competitor_discrimination',
    unit: 'receptive_choice',
    proposedTaskFields: ['item_id','type','used_hint'],
    clinicianJudgement: 'Accurate receptive interpretation among controlled competitors',
  },
  'minimal-pairs': {
    primaryMeasureId: 'auditory_phoneme_discrimination',
    unit: 'receptive_choice',
    proposedTaskFields: ['target_word','selected_word','audio_replay_count'],
    clinicianJudgement: 'Contrast discrimination on first hearing versus after replay',
  },
  'multi-step-plan': {
    primaryMeasureId: 'nested_plan_constraint_satisfaction',
    unit: 'ordered_actions',
    proposedTaskFields: ['plan_id','steps_in_order','constraint_violations'],
    clinicianJudgement: 'Correct ordering and subgoal completion, not tapping speed',
  },
  'narrative-retell': {
    primaryMeasureId: 'story_macrostructure_retell',
    unit: 'discourse_episode',
    proposedTaskFields: ['story_id','main_concepts_recalled','referent_coherence'],
    clinicianJudgement: 'Main concepts, story grammar, and coherent sequence',
  },
  'pattern-match': {
    primaryMeasureId: 'visual_pattern_working_memory',
    unit: 'visual_pattern',
    proposedTaskFields: ['pattern_size','match_rule','visual_support_presented'],
    clinicianJudgement: 'Choose working memory OR rule induction as the construct',
  },
  'phonological-awareness': {
    primaryMeasureId: 'segmental_operation_success',
    unit: 'phonological_operation',
    proposedTaskFields: ['relation_type','phoneme_differences','input_mode'],
    clinicianJudgement: 'Phonemic processing distinguished from spelling or replay',
  },
  'photo-naming': {
    primaryMeasureId: 'independent_picture_naming',
    unit: 'spoken_target',
    proposedTaskFields: ['target_word','input_mode','cue_type_given'],
    clinicianJudgement: 'Verifiable independent target retrieval and paraphasia type',
  },
  'phrase-practice': {
    primaryMeasureId: 'functional_script_use',
    unit: 'spoken_phrase',
    proposedTaskFields: ['phrase_id','script_support','input_mode'],
    clinicianJudgement: 'Message completeness and independent phrase intent',
  },
  'reach-tap': {
    primaryMeasureId: 'safe_reach_precision',
    unit: 'target_touch',
    proposedTaskFields: ['target_position','hand_used','target_size'],
    clinicianJudgement: 'Limb-specific movement and device limitation',
  },
  'semantic-features': {
    primaryMeasureId: 'discriminative_semantic_feature_set',
    unit: 'semantic_feature_set',
    proposedTaskFields: ['target_word','independent_features','nonredundant_feature_count'],
    clinicianJudgement: 'Correct patient-generated discriminative features',
  },
  'sentence-construction': {
    primaryMeasureId: 'thematic_role_syntax_accuracy',
    unit: 'sentence_structure',
    proposedTaskFields: ['sentence_structure','thematic_roles','production_mode'],
    clinicianJudgement: 'Correct noncanonical relations and agreement, not word count',
  },
  'sentence-game': {
    primaryMeasureId: 'functional_sentence_communication',
    unit: 'sentence_structure',
    proposedTaskFields: ['situation_id','essential_intent_slots','production_mode'],
    clinicianJudgement: 'Meaningful self-formulated functional statement',
  },
  'thought-continuation': {
    primaryMeasureId: 'independent_proposition_coherence',
    unit: 'connected_disclosure',
    proposedTaskFields: ['context_id','novel_propositions','coherence_rubric'],
    clinicianJudgement: 'Relevant self-generated propositions, not longer text',
  },
  'thought-organization': {
    primaryMeasureId: 'propositional_order_coherence',
    unit: 'connected_disclosure',
    proposedTaskFields: ['idea_units','causal_links','scaffold_used'],
    clinicianJudgement: 'Logical ordering and relevant connections',
  },
  'two-clues': {
    primaryMeasureId: 'convergent_cue_word_retrieval',
    unit: 'spoken_target',
    proposedTaskFields: ['target_word','clue_diagnosticity','cue_support_used'],
    clinicianJudgement: 'Convergent word retrieval with valid alternatives',
  },
  'word-finding': {
    primaryMeasureId: 'functional_context_word_access',
    unit: 'spoken_target',
    proposedTaskFields: ['intent_id','valid_alternative','independent_retrieval'],
    clinicianJudgement: 'Functional target communicated even if synonym/circumlocution',
  },
  'follow-directions': {
    primaryMeasureId: 'auditory_instruction_execution',
    unit: 'ordered_actions',
    proposedTaskFields: ['command_id','action_order','instruction_replays'],
    clinicianJudgement: 'Correct execution of temporally dependent spoken steps',
  },
  'category-fluency': {
    primaryMeasureId: 'category_semantic_search_switching',
    unit: 'semantic_search_window',
    proposedTaskFields: ['category_id','verified_unique_items','cluster_switches'],
    clinicianJudgement: 'Verified semantic search, not raw ASR word count',
  },
  'synonym-generator': {
    primaryMeasureId: 'contextual_near_synonym_selection',
    unit: 'spoken_target',
    proposedTaskFields: ['target_sense','accepted_paraphrase','competition_class'],
    clinicianJudgement: 'Appropriate near-equivalence in context',
  },
  'sequence-builder': {
    primaryMeasureId: 'temporal_causal_sequence_accuracy',
    unit: 'ordered_actions',
    proposedTaskFields: ['sequence_id','ordered_steps','first_step_revealed'],
    clinicianJudgement: 'Independent temporal order and causal relation',
  },
  'functional-scenes': {
    primaryMeasureId: 'functional_command_scene_success',
    unit: 'conversation_turn',
    proposedTaskFields: ['scene_id','command_components','assistance_used'],
    clinicianJudgement: 'Intended scene command communicated, not app clicks',
  },
};

export interface GameMeasurementAudit {
  gameSlug: string;
  primaryMeasureId: string;
  track: EvidenceTrack;
  observedProposedFields: string[];
  missingProposedFields: string[];
  /**
   * "fields_observed" means only that JSON keys were recorded, NOT that a
   * correct outcome, trustworthy transcript, or validated construct exists.
   */
  fieldCoverage: 'fields_observed' | 'partial' | 'missing';
}

function hasUsefulValue(value:unknown):boolean {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true; // false and 0 are useful, independently observed values.
}

export function getGameMeasurementSpec(rawSlug:string):GameMeasurementSpec|null {
  return GAME_MEASUREMENT_SPECS[toLessonExerciseSlug(rawSlug)] ?? null;
}

/** Read-only audit of missing task-specific telemetry. A missing field is a
 * developer-instrumentation gap, not incorrect patient performance. */
export function auditGameMeasurementFields(rawSlug:string,taskParameters:Record<string,unknown>):
  GameMeasurementAudit|null {
  const gameSlug=toLessonExerciseSlug(rawSlug);
  const spec=GAME_MEASUREMENT_SPECS[gameSlug];
  const evidence=getClinicalGameEvidence(gameSlug);
  if (!spec || !evidence) return null;
  const observedProposedFields=spec.proposedTaskFields.filter(key=>hasUsefulValue(taskParameters[key]));
  const missingProposedFields=spec.proposedTaskFields.filter(key=>!hasUsefulValue(taskParameters[key]));
  const fieldCoverage:GameMeasurementAudit['fieldCoverage']=
    missingProposedFields.length===0?'fields_observed':
      observedProposedFields.length===0?'missing':'partial';
  return {
    gameSlug,primaryMeasureId:spec.primaryMeasureId,track:evidence.track,
    observedProposedFields,missingProposedFields,fieldCoverage,
  };
}

/**
 * Add provenance labels to new unified raw events. It never changes scores,
 * eligibility, cue levels, or the patient's persisted clinical progression.
 */
export function describeGameMeasurementProvenance(
  rawSlug:string,taskParameters:Record<string,unknown>,
):Record<string,unknown> {
  const audit=auditGameMeasurementFields(rawSlug,taskParameters);
  if (!audit) return {};
  return {
    measurement_contract_version:GAME_MEASUREMENT_SPEC_VERSION,
    measurement_primary_metric_id:audit.primaryMeasureId,
    measurement_evidence_track:audit.track,
    measurement_field_coverage:audit.fieldCoverage,
    measurement_fields_observed:audit.observedProposedFields,
    measurement_fields_missing:audit.missingProposedFields,
    measurement_validation:'unreviewed_app_observation',
    // Explicitly do NOT provide an outcome, validated score, or probe status.
  };
}
