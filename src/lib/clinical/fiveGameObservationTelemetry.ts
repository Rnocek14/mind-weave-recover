/**
 * Five distinct task-observation contracts. These enrich the ACTUAL raw trial
 * submission in each game, without changing its accuracy algorithm, clinical
 * thresholds, content bank or saved level.
 *
 * "Full telemetry" means recording the available source, support, timing and
 * construct-specific observations honestly. Null is intentional when the
 * CURRENT UI cannot measure a research-proposed clinical construct. A JSON key
 * does not establish validity or recovery.
 */
import type { CategoryFluencyResult } from '@/components/CategoryFluencyGame';
import { analyzeFluency } from '@/lib/categoryFluencyAnalysis';
import type { PlanningTrialResult } from '@/hooks/useMultiStepPlanningGame';
import type { DualLoadTrialResult } from '@/hooks/useDualLoadNamingGame';

export const FIVE_GAME_TELEMETRY_VERSION = 'app-observation-2026-11-03-v1' as const;

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Category Fluency: dictionary/app-accepted tokens are NOT clinician-verified
 * speech, and an automated cluster heuristic is not a clinical cluster score. */
export function describeCategoryFluencyObservation(result: CategoryFluencyResult) {
  const words = Array.isArray(result.words) ? result.words : [];
  const normalized = words
    .filter((word): word is string => typeof word === 'string')
    .map((word) => word.trim().toLowerCase()).filter(Boolean);
  const validUnique = [...new Set(normalized)];
  const coherentCount = normalized.length === words.length &&
    validUnique.length === result.uniqueWordCount &&
    normalized.length === validUnique.length;
  const clusters = coherentCount ? analyzeFluency(validUnique, result.category) : null;

  return {
    five_game_telemetry_version: FIVE_GAME_TELEMETRY_VERSION,
    category_id: result.category || null,
    // "verified" here means the game's own category filter accepted these
    // items; it is NOT a human-adjudicated verification of aphasic speech.
    // Proposed clinically verified item count remains unknown until a
    // clinician checks the recognized/typed tokens, including paraphasias.
    verified_unique_items: null,
    app_valid_unique_items: coherentCount ? validUnique.length : null,
    app_validation_only: true,
    human_word_verification: false,
    valid_item_count_consistent: coherentCount,
    cluster_switches: clusters?.switchCount ?? null,
    cluster_count: clusters?.clusterCount ?? null,
    cluster_analysis_source: clusters ? 'automatic_subcategory_heuristic_on_app_valid_words' : 'unavailable',
    raw_asr_verification: 'not_performed',
    input_mode: result.inputMode,
    cue_level_used: result.cueLevelUsed,
    observed_duration_sec: finite(result.durationSec),
    instructed_time_limit_sec: finite(result.timeLimitSec),
    observed_valid_words: coherentCount ? validUnique : normalized,
  };
}

export interface SemanticFeatureSelectionObservation {
  word?: string | null;
  featuresCorrect?: number | null;
  featuresMissed?: number | null;
  featuresIncorrect?: number | null;
  retrievalCorrect?: boolean | null;
  retrievalSelectedWord?: string | null;
  featureBreakdown?: Record<string, { hit: number; miss: number }> | null;
}

/** Current SFA patient selects visually displayed features and a retrieval
 * answer button. It does not capture independently GENERATED semantic features. */
export function describeSemanticFeatureObservation(data: SemanticFeatureSelectionObservation) {
  const correct = finite(data.featuresCorrect);
  const incorrect = finite(data.featuresIncorrect);
  const missed = finite(data.featuresMissed);
  return {
    five_game_telemetry_version: FIVE_GAME_TELEMETRY_VERSION,
    target_word: data.word ?? null,
    independent_features: null,
    nonredundant_feature_count: null,
    observed_selected_feature_count: correct !== null && incorrect !== null
      ? correct + incorrect : null,
    app_matching_feature_count: correct,
    app_nonmatching_feature_count: incorrect,
    app_unselected_correct_feature_count: missed,
    feature_breakdown: data.featureBreakdown ?? null,
    feature_response_mode: 'visual_option_selection',
    retrieval_response_mode: 'choice',
    retrieval_selected_word: data.retrievalSelectedWord ?? null,
    retrieval_choice_correct: data.retrievalCorrect ?? null,
    input_mode: 'choice',
    independent_feature_generation_observed: false,
    functional_transfer_verified: false,
  };
}

export interface SentenceConstructionObservation {
  grammarFocus: string;
  trialId?: string | null;
  inputMode: 'browser_recognized' | 'word_tiles';
  browserTranscript?: string | null;
  selectedAnswerWords: string[];
  hintUsed: boolean;
}

/** A spoken answer converted into tile matches is NOT interchangeable with
 * manually arranging displayed word tiles. The construct is target grammar
 * focus, not a parsed demonstration of independent thematic-role syntax. */
export function describeSentenceConstructionObservation(data: SentenceConstructionObservation) {
  return {
    five_game_telemetry_version: FIVE_GAME_TELEMETRY_VERSION,
    sentence_structure: data.grammarFocus,
    sentence_structure_source: 'authored_target_grammar_focus',
    thematic_roles: null,
    thematic_roles_assessed: false,
    production_mode: data.inputMode === 'browser_recognized'
      ? 'browser_recognized_scaffolded' : 'word_tile_selection',
    input_mode: data.inputMode === 'browser_recognized' ? 'browser_recognized' : 'tap',
    stimulus_sentence_id: data.trialId ?? null,
    selected_answer_words: Array.isArray(data.selectedAnswerWords)
      ? data.selectedAnswerWords : [],
    browser_transcript_available: data.inputMode === 'browser_recognized' &&
      !!data.browserTranscript?.trim(),
    displayed_word_options: true,
    audio_model_requested: data.hintUsed,
    human_sentence_judgement: false,
  };
}

/** Multi-Step Planning already knows the lexical positions of *detected*
 * steps. We preserve their observed order without recomputing its score.
 * Missing/ambiguous anchors are unknown, not zero executive function. */
export function describeMultiStepPlanObservation(result: PlanningTrialResult) {
  const observed = result.sequenceEvidenceAvailable &&
    Array.isArray(result.observedStepOrder) &&
    result.observedStepOrder.length >= 2 &&
    result.observedStepOrder.every((n) => Number.isInteger(n) && n >= 0)
    ? [...result.observedStepOrder] : null;
  return {
    five_game_telemetry_version: FIVE_GAME_TELEMETRY_VERSION,
    plan_id: result.itemId || null,
    steps_in_order: observed,
    constraint_violations: null,
    constraints_independently_assessed: false,
    step_order_evidence_source: observed ? 'distinctive_transcript_tokens_v1' : 'unavailable_or_ambiguous',
    sequence_evidence_available: result.sequenceEvidenceAvailable,
    sequence_matched_steps: finite(result.sequenceMatchedSteps),
    app_heuristic_sequence_score: result.sequenceEvidenceAvailable
      ? finite(result.sequenceScore) : null,
    input_mode: result.inputMode,
    response_valid: result.responseValid,
    completion_reason: result.completionReason,
  };
}

/** Dual Load Naming: actual names + typed memory recalls belong to separate
 * modalities. The historical 90% "baseline" is an app heuristic, so NEVER
 * display its interference subtraction as a measured within-person deficit. */
export function describeDualLoadNamingObservation(result: DualLoadTrialResult) {
  const attempted = Array.isArray(result.namingAttempts) ? result.namingAttempts : [];
  const baselineIsMeasured = result.depthTelemetry?.baselineSource === 'user_history';
  const naming = finite(result.namingAccuracy);
  return {
    five_game_telemetry_version: FIVE_GAME_TELEMETRY_VERSION,
    baseline_naming_trial_id: null,
    dual_task_accuracy: naming,
    overlap_timing_ms: null,
    naming_observed_under_memory_load: true,
    naming_attempt_observations: attempted.map((attempt) => ({
      target_word: attempt.targetWord,
      recognized_response: attempt.userResponse,
      app_exact_word_match: attempt.correct,
      response_latency_ms: finite(attempt.reactionTimeMs),
      input_mode: attempt.userResponse.trim() ? 'browser_recognized' : 'skipped',
    })),
    naming_attempt_count: attempted.length,
    recall_input_mode: 'typed',
    recall_accuracy: finite(result.recallAccuracy),
    recalled_word_count: Array.isArray(result.recalledWords) ? result.recalledWords.length : null,
    baseline_source: result.depthTelemetry?.baselineSource ?? null,
    measured_matched_baseline: baselineIsMeasured,
    heuristic_interference_index: !baselineIsMeasured ? finite(result.interferenceIndex) : null,
    independent_interference_cost_verified: false,
    real_concurrent_overlap_measured: false,
  };
}
