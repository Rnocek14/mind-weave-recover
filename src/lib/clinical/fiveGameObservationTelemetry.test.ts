import { describe, expect, it } from 'vitest';
import type { CategoryFluencyResult } from '@/components/CategoryFluencyGame';
import type { PlanningTrialResult } from '@/hooks/useMultiStepPlanningGame';
import type { DualLoadTrialResult } from '@/hooks/useDualLoadNamingGame';
import {
  auditGameMeasurementFields, getSpeechScoreExclusion,
} from './gameMeasurementContracts';
import {
  FIVE_GAME_TELEMETRY_VERSION,
  describeCategoryFluencyObservation,
  describeSemanticFeatureObservation,
  describeSentenceConstructionObservation,
  describeMultiStepPlanObservation,
  describeDualLoadNamingObservation,
} from './fiveGameObservationTelemetry';

const fluency = (overrides: Partial<CategoryFluencyResult> = {}): CategoryFluencyResult => ({
  category: 'animals', words: ['cat', 'dog'], uniqueWordCount: 2,
  wordsPerSecond: 2 / 60, durationSec: 60, timeLimitSec: 60,
  difficulty: 1, cueLevelUsed: 0, inputMode: 'spoken',
  ...overrides,
});

const plan = (overrides: Partial<PlanningTrialResult> = {}): PlanningTrialResult => ({
  itemId: 'plan-01', goal: 'Make tea', tier: 1,
  transcript: 'pour water then boil water',
  stepCount: 2, stepsFound: 2, stepsTotal: 3, goalCoverage: 2 / 3,
  sequenceScore: 0, durationMs: 6000, skipped: false,
  inputMode: 'spoken', completionReason: 'completed', responseValid: true,
  sequenceEvidenceAvailable: true, sequenceMatchedSteps: 2,
  observedStepOrder: [1, 0], sequenceMethod: 'distinctive_tokens_v1',
  browserTranscript: 'pour water then boil water',
  depthTelemetry: {
    taskType: 'multi_step_plan', stepCount: 2,
    sequenceScore: 0, goalCoverage: 2 / 3,
  },
  ...overrides,
});

const dual = (overrides: Partial<DualLoadTrialResult> = {}): DualLoadTrialResult => ({
  setId: 'dual-01', namingAccuracy: 0.5, recallAccuracy: 0.5,
  namingAttempts: [
    { targetWord: 'apple', userResponse: 'apple', correct: true, reactionTimeMs: 1200 },
    { targetWord: 'car', userResponse: '', correct: false, reactionTimeMs: 2200 },
  ],
  recalledWords: ['lamp'], interferenceIndex: 0.4, durationMs: 11000,
  depthTelemetry: {
    taskType: 'dual_load_naming', namingAccuracy: 0.5,
    recallAccuracy: 0.5, interferenceIndex: 0.4,
    baselineSource: 'heuristic', baselineAcc: 0.9,
  },
  ...overrides,
});

describe('five-game raw task observation telemetry, not clinical outcome validation', () => {
  it('Category Fluency records the app-accepted item count and lexical cluster heuristic without claiming human-verification', () => {
    const evidence = describeCategoryFluencyObservation(fluency());
    expect(evidence).toMatchObject({
      five_game_telemetry_version: FIVE_GAME_TELEMETRY_VERSION,
      category_id: 'animals', app_valid_unique_items: 2,
      verified_unique_items: null,
      app_validation_only: true, human_word_verification: false,
      cluster_analysis_source: 'automatic_subcategory_heuristic_on_app_valid_words',
      input_mode: 'spoken', cue_level_used: 0,
    });
    expect(typeof evidence.cluster_switches).toBe('number');
    expect(auditGameMeasurementFields('category_fluency', evidence)?.missingProposedFields)
      .toContain('verified_unique_items');
  });

  it('fluency incongruent word counts abstain from invented cluster scores', () => {
    const evidence = describeCategoryFluencyObservation(fluency({
      words: ['cat', 'cat', 'dog'], uniqueWordCount: 3,
    }));
    expect(evidence.app_valid_unique_items).toBeNull();
    expect(evidence.cluster_switches).toBeNull();
    expect(evidence.valid_item_count_consistent).toBe(false);
    expect(evidence.cluster_analysis_source).toBe('unavailable');
  });

  it('Semantic Features retains visual feature and retrieval choices without pretending the patient generated features', () => {
    const evidence = describeSemanticFeatureObservation({
      word: 'apple', featuresCorrect: 2, featuresMissed: 1,
      featuresIncorrect: 1, retrievalCorrect: true, retrievalSelectedWord: 'apple',
      selectedFeatureChoices: [
        { text: 'red', category: 'perceptual' },
        { text: 'you eat it', category: 'functional' },
        { text: 'it is metal', category: 'perceptual' },
      ],
      visibleFeatureOptionCount: 6,
      featureBreakdown: {
        perceptual: { hit: 1, miss: 1 }, functional: { hit: 1, miss: 0 },
      },
    });
    expect(evidence).toMatchObject({
      target_word: 'apple', independent_features: null,
      nonredundant_feature_count: null,
      observed_selected_feature_count: 3,
      app_matching_feature_count: 2,
      retrieval_selected_word: 'apple',
      retrieval_response_mode: 'choice',
      independent_feature_generation_observed: false,
      input_mode: 'choice',
    });
    expect(evidence.selected_feature_options).toHaveLength(3);
    expect(getSpeechScoreExclusion('semantic_features', 'recognition', evidence))
      .toBe('trial_mode_not_spoken_production');
    expect(auditGameMeasurementFields('semantic_features', evidence)?.fieldCoverage).toBe('partial');
  });

  it('sentence tile submissions cannot be mistaken for speech, while browser-recognized text remains provisional', () => {
    const tapped = describeSentenceConstructionObservation({
      grammarFocus: 'SVO', trialId: 's-1', inputMode: 'word_tiles',
      selectedAnswerWords: ['the', 'dog', 'runs'], browserTranscript: null,
      hintUsed: true,
    });
    expect(tapped).toMatchObject({
      sentence_structure: 'SVO',
      thematic_roles: null, thematic_roles_assessed: false,
      production_mode: 'word_tile_selection',
      input_mode: 'tap', displayed_word_options: true,
      audio_model_requested: true, browser_transcript_available: false,
    });
    expect(getSpeechScoreExclusion('sentence_construction', 'recognition', tapped))
      .toBe('trial_mode_not_spoken_production');
    const voiced = describeSentenceConstructionObservation({
      grammarFocus: 'SVO', trialId: 's-1', inputMode: 'browser_recognized',
      selectedAnswerWords: ['the', 'dog', 'runs'],
      browserTranscript: 'the dog runs', hintUsed: false,
    });
    expect(voiced.production_mode).toBe('browser_recognized_scaffolded');
    expect(voiced.browser_transcript_available).toBe(true);
    expect(voiced.human_sentence_judgement).toBe(false);
    expect(auditGameMeasurementFields('sentence_construction', voiced)?.missingProposedFields)
      .toContain('thematic_roles');
  });

  it('Multi Step Planning stores the actual observed step order and abstains for missing sequence anchors', () => {
    const evidence = describeMultiStepPlanObservation(plan());
    expect(evidence).toMatchObject({
      plan_id: 'plan-01', steps_in_order: [1, 0],
      step_order_evidence_source: 'distinctive_transcript_tokens_v1',
      app_heuristic_sequence_score: 0, constraint_violations: null,
      constraints_independently_assessed: false,
    });
    const unknown = describeMultiStepPlanObservation(plan({
      sequenceEvidenceAvailable: false, sequenceMatchedSteps: 1,
      observedStepOrder: null, sequenceScore: 0,
    }));
    expect(unknown.steps_in_order).toBeNull();
    expect(unknown.app_heuristic_sequence_score).toBeNull();
    expect(auditGameMeasurementFields('multi_step_plan', evidence)?.missingProposedFields)
      .toContain('constraint_violations');
  });

  it('Dual Load Naming keeps actual naming attempts, typed recall and unmeasured baseline separate', () => {
    const evidence = describeDualLoadNamingObservation(dual());
    expect(evidence).toMatchObject({
      baseline_naming_trial_id: null,
      dual_task_accuracy: 0.5, overlap_timing_ms: null,
      naming_attempt_count: 2, recall_input_mode: 'typed',
      recalled_word_count: 1, baseline_source: 'heuristic',
      heuristic_interference_index: 0.4,
      independent_interference_cost_verified: false,
      measured_matched_baseline: false,
    });
    expect(evidence.naming_attempt_observations.map(x => x.input_mode))
      .toEqual(['browser_recognized', 'skipped']);
    expect(evidence.naming_attempt_observations[0].app_exact_word_match).toBe(true);
    expect(auditGameMeasurementFields('dual_load_naming', evidence)?.missingProposedFields)
      .toEqual(['baseline_naming_trial_id', 'overlap_timing_ms']);
  });

  it('non-finite values never become saved task measurement values', () => {
    const evidence = describeDualLoadNamingObservation(dual({
      namingAccuracy: Number.NaN, recallAccuracy: Number.POSITIVE_INFINITY,
    }));
    expect(evidence.dual_task_accuracy).toBeNull();
    expect(evidence.recall_accuracy).toBeNull();
  });
});
