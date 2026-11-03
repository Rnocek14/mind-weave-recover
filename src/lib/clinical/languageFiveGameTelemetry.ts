/**
 * Second five-game NeuroSpark observation wave.
 *
 * Store source, assistance and actual app observations. Never represent a
 * browser ASR guess, model semantic similarity, selected chip, or heuristic
 * story match as clinician-adjudicated recovery.
 *
 * Null = the current game did not measure that proposed clinical construct.
 * These builders never decide game correctness or clinical level thresholds.
 */
import type { TwoCluesTrialResult } from '@/hooks/useTwoCluesGame';
import type { DescribeGuessTrialResult } from '@/hooks/useDescribeGuessGame';
import type { NarrativeTrialResult } from '@/hooks/useNarrativeRetellGame';
import type { MeaningMatchTrialResult } from '@/hooks/useMeaningMatchGame';

export const LANGUAGE_GAME_TELEMETRY_VERSION = 'app-observation-2026-11-03-v2' as const;

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export type PhotoNamingResponseSource =
  | 'production' | 'recognition' | 'caregiver' | 'manual' | 'timeout' | 'unknown';

export interface PhotoNamingObservation {
  inputMode?: PhotoNamingResponseSource;
  manualConfirmed?: boolean;
  confirmedBy?: 'user' | 'caregiver';
  confirmationMode?: 'asr' | 'manual' | 'caregiver';
  asrVerified?: boolean;
  cueLevel?: number;
  cueTypeGiven?: 'none' | 'semantic' | 'phonemic' | 'full_word';
  productionAttempted?: boolean;
  micTechnicalFailure?: boolean;
  selectedAnswer?: string;
  browserTranscript?: string;
  whisperTranscript?: string;
  errorType?: string;
}

export function classifyPhotoNamingObservation(result: PhotoNamingObservation) {
  const manual = result.manualConfirmed === true ||
    result.inputMode === 'manual' || result.inputMode === 'caregiver' ||
    result.confirmationMode === 'manual' || result.confirmationMode === 'caregiver';
  const source: PhotoNamingResponseSource = manual
    ? result.inputMode === 'caregiver' || result.confirmedBy === 'caregiver' ? 'caregiver' : 'manual'
    : result.inputMode ?? 'unknown';
  const spoken = source === 'production';
  const tap = source === 'recognition';
  const recognized = !!(result.browserTranscript?.trim() || result.whisperTranscript?.trim());
  // A timeout without a usable microphone is a technical absence, not an
  // incorrect patient response. A tapped answer is never a spoken response,
  // even when the patient first attempted to speak and then needed support.
  const trialMode: 'production' | 'recognition' | 'mixed' =
    spoken && recognized ? 'production'
      : tap ? 'recognition' : 'mixed';
  return {
    trialMode,
    // The Photo Naming game owns its progression state (this page passes
    // progression:null). The marker below only prevents inappropriate
    // downstream reclassification of ambiguous/manual/technical evidence.
    clinicalProgressionEligible: !manual && !result.micTechnicalFailure &&
      source !== 'unknown' &&
      // The game already treats a functioning-mic timeout as an attempted
      // trial on its own progression ladder. Preserve that exact distinction;
      // only technical absence or unverified production is ineligible.
      !(spoken && !recognized),
    taskParameters: {
      language_game_telemetry_version: LANGUAGE_GAME_TELEMETRY_VERSION,
      input_mode: spoken
        ? recognized ? 'browser_or_service_recognized' : 'spoken_unverified'
        : tap ? 'tap' : source,
      response_source: source,
      selected_choice_word: tap ? result.selectedAnswer ?? null : null,
      production_attempted_before_choice: result.productionAttempted ?? null,
      microphone_technical_failure: result.micTechnicalFailure ?? false,
      completion_reason: source === 'timeout' ? 'timeout'
        : manual ? 'manually_confirmed' : source === 'unknown' ? 'unknown' : 'answered',
      cue_type_given: result.cueTypeGiven ?? null,
      delivered_cue_level: finite(result.cueLevel),
      human_manual_confirmation: manual,
      confirmation_mode: result.confirmationMode ?? (manual ? source : 'asr'),
      confirmed_by: result.confirmedBy ?? null,
      browser_transcript_available: !!result.browserTranscript?.trim(),
      service_transcript_available: !!result.whisperTranscript?.trim(),
      independently_verified_naming: false,
      spoken_naming_outcome_human_verified: false,
      speech_score_eligible: trialMode === 'production' && !manual
        ? null : false,
    },
  };
}

export function describeTwoCluesObservation(result: TwoCluesTrialResult) {
  const skipped = result.completionReason === 'skipped' ||
    !result.spokenWord?.trim();
  const sourceVerified = !!result.browserTranscript?.trim();
  const supported = (result.cueLevelUsed ?? 0) > 0 ||
    (result.cueTypeUsed ?? 'none') !== 'none';
  return {
    trialMode: skipped || !sourceVerified ? 'mixed' as const
      : supported ? 'scaffolded' as const : 'production' as const,
    clinicalProgressionEligible: !skipped && sourceVerified,
    taskParameters: {
      language_game_telemetry_version: LANGUAGE_GAME_TELEMETRY_VERSION,
      target_word: result.anchors?.[0] ?? null,
      acceptable_word_candidates: result.anchors ?? [],
      clue_diagnosticity: null,
      clue_diagnosticity_human_assessed: false,
      cue_support_used: result.cueTypeUsed ?? 'none',
      delivered_cue_level: finite(result.cueLevelUsed),
      response_input_mode: skipped ? 'skipped' : sourceVerified
        ? 'browser_recognized_provisional' : 'unverified_response_source',
      completion_reason: skipped ? 'skipped' : 'answered',
      browser_recognizer_transcript_available: sourceVerified,
      browser_recognizer_raw_transcript: sourceVerified ? result.browserTranscript : null,
      speech_score_eligible: skipped || !sourceVerified ? false : null,
      attempt_number: Number.isFinite(result.attemptNumber) ? result.attemptNumber : null,
      first_attempt_without_delivered_help: !skipped &&
        result.attemptNumber === 1 && !supported,
      app_match_tier: result.tier,
      app_match_similarity: finite(result.semanticSimilarity),
      clinician_verified_target_retrieval: false,
      valid_alternative_human_verified: false,
    },
  };
}

export function describeDescribeGuessObservation(result: DescribeGuessTrialResult) {
  return {
    language_game_telemetry_version: LANGUAGE_GAME_TELEMETRY_VERSION,
    target_id: result.trialId,
    discriminative_features: null,
    discriminative_features_human_verified: false,
    partner_confirmed_guess: null,
    independent_partner_interaction_observed: false,
    app_inferred_feature_types: result.featureTypesUsed ?? [],
    app_inferred_meaning_win: result.meaningWin,
    app_inferred_word_win: result.wordWin,
    app_inferred_guess_confidence: finite(result.guessConfidence),
    model_or_rule_guess_not_human_confirmation: true,
    cue_prompts_shown: result.promptsShown ?? [],
    response_input_mode: result.inputMode ?? 'unknown',
    time_to_word_retrieval_ms: finite(result.timeToWordRetrievalMs),
    self_correction_observed_by_app: result.selfCorrected,
  };
}

export function describeNarrativeRetellObservation(result: NarrativeTrialResult) {
  const matched = Array.isArray(result.matchedEvents) ? result.matchedEvents : [];
  return {
    language_game_telemetry_version: LANGUAGE_GAME_TELEMETRY_VERSION,
    story_id: result.storyId,
    main_concepts_recalled: null, // requires clinician-adjudicated CIUs
    referent_coherence: null, // story grammar/referent coherence not assessed
    human_narrative_judgement: false,
    app_matched_story_events: matched,
    app_matched_story_event_count: finite(result.eventsFound),
    app_total_story_events: finite(result.eventsTotal),
    app_event_coverage_ratio: finite(result.eventCoverage),
    app_beginning_middle_end_breakdown: result.structureBreakdown ?? null,
    app_clause_count_coherence_proxy: finite(result.coherenceScore),
    app_topic_overlap_proxy: finite(result.onTopicScore),
    input_mode: result.inputMode ?? 'unknown',
    response_valid: result.responseValid === true,
    completion_reason: result.completionReason ?? (result.skipped ? 'skipped' : 'unknown'),
    event_match_method: 'automated_lexical_heuristic',
    coherence_clinically_verified: false,
    visual_support_present: result.visualSupport != null,
    word_count: finite(result.wordCount),
    duration_ms: finite(result.durationMs),
  };
}

export function describeMeaningMatchObservation(result: MeaningMatchTrialResult) {
  const optionTexts = Array.isArray(result.presentedOptions) ? result.presentedOptions : [];
  const validIndex = (index: number) =>
    Number.isInteger(index) && index >= 0 && index < optionTexts.length;
  const selected = validIndex(result.selectedIndex)
    ? optionTexts[result.selectedIndex] : null;
  const correct = validIndex(result.correctIndex)
    ? optionTexts[result.correctIndex] : null;
  return {
    language_game_telemetry_version: LANGUAGE_GAME_TELEMETRY_VERSION,
    item_id: result.itemId,
    semantic_competitor_selection_index: result.selectedIndex,
    correct_option_index: result.correctIndex,
    presented_options: optionTexts,
    selected_option_text: selected,
    correct_option_text: correct,
    response_input_mode: 'tap',
    explanation_attempted: !!result.explanation &&
      result.explanation.skipped !== true,
    explanation_skipped: result.explanation?.skipped ?? null,
    explanation_score_app_heuristic: finite(result.explanation?.score),
    semantic_competitor_discrimination_app_correct: result.correct,
    human_comprehension_adjudication: false,
    clinical_spoken_production_evidence: false,
    used_hint: result.usedHint,
  };
}
