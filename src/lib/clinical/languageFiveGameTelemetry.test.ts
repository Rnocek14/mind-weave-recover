import { describe, expect, it } from 'vitest';
import type { TwoCluesTrialResult } from '@/hooks/useTwoCluesGame';
import type { DescribeGuessTrialResult } from '@/hooks/useDescribeGuessGame';
import type { NarrativeTrialResult } from '@/hooks/useNarrativeRetellGame';
import type { MeaningMatchTrialResult } from '@/hooks/useMeaningMatchGame';
import { auditGameMeasurementFields, getSpeechScoreExclusion } from './gameMeasurementContracts';
import {
  LANGUAGE_GAME_TELEMETRY_VERSION,
  classifyPhotoNamingObservation, describeTwoCluesObservation,
  describeDescribeGuessObservation, describeNarrativeRetellObservation,
  describeMeaningMatchObservation,
} from './languageFiveGameTelemetry';

const clues=(o:Partial<TwoCluesTrialResult>={}):TwoCluesTrialResult=>({
  puzzleId:'puzzle-1', clues:['cold','white'], anchors:['snow'],
  spokenWord:'snow', browserTranscript:'snow',
  completionReason:'answered', matchedWord:'snow',
  tier:'strong', score:100, reachedAnchor:true, semanticSimilarity:1,
  reactionTimeMs:1900, attemptNumber:1, cueLevelUsed:0, cueTypeUsed:'none', ...o,
});

const describe=(o:Partial<DescribeGuessTrialResult>={}):DescribeGuessTrialResult=>({
  trialId:'cup-1',target:'cup',transcript:'used for drinking',
  inputMode:'spoken',browserTranscript:'used for drinking',
  meaningWin:true,wordWin:false,strategyWin:true,communicationWin:true,
  featureTypesUsed:['function'],guessConfidence:0.78,promptsShown:[],
  timeToWordRetrievalMs:null,selfCorrected:false,
  reactionTimeMs:2800,attemptNumber:1,difficulty:3,...o,
});

const narrative=(o:Partial<NarrativeTrialResult>={}):NarrativeTrialResult=>({
  storyId:'story-1',storyTier:1,transcript:'The dog left and came back',
  eventsFound:2,eventsTotal:3,eventCoverage:2/3,
  matchedEvents:['dog left','came back'],
  allKeyEvents:['dog left','looked for dog','came back'],
  coherenceScore:0.5,onTopicScore:0.8,durationMs:12000,
  meanUtteranceLength:7,wordCount:7,skipped:false,
  inputMode:'spoken',completionReason:'completed',responseValid:true,
  browserTranscript:'The dog left and came back',
  structureBreakdown:{
    beginning:{hit:1,total:1,status:'covered'},
    middle:{hit:0,total:1,status:'missed'},
    end:{hit:1,total:1,status:'covered'},
  },nextStepHint:'Tell what happened in the middle',
  depthTelemetry:{taskType:'narrative_retell',eventCoverage:2/3,
    coherenceScore:0.5,ciuRate:null,meanUtteranceLength:7},...o,
});

const meaning=(o:Partial<MeaningMatchTrialResult>={}):MeaningMatchTrialResult=>({
  itemId:'mm-1',correct:true,selectedIndex:2,correctIndex:2,
  presentedOptions:['a','b','c'],reactionTimeMs:3500,
  tier:1,type:'literal',usedHint:false,points:15,...o,
});

describe('5 language-game actual task observation contracts',()=>{
  it('Photo Naming distinguishes verified-channel availability from independent clinical correctness',()=>{
    const spoken=classifyPhotoNamingObservation({
      inputMode:'production',browserTranscript:'apple',cueLevel:0,
    });
    expect(spoken.trialMode).toBe('production');
    expect(spoken.taskParameters).toMatchObject({
      input_mode:'browser_or_service_recognized',
      independently_verified_naming:false,
      spoken_naming_outcome_human_verified:false,
    });
    const tap=classifyPhotoNamingObservation({
      inputMode:'recognition',productionAttempted:true,
      selectedAnswer:'banana',browserTranscript:'apple',cueLevel:1,
    });
    expect(tap.trialMode).toBe('recognition');
    expect(tap.taskParameters).toMatchObject({
      input_mode:'tap',production_attempted_before_choice:true,
      selected_choice_word:'banana',speech_score_eligible:false,
    });
    expect(getSpeechScoreExclusion('photo_naming',tap.trialMode,tap.taskParameters))
      .toBe('source_explicitly_excluded');
    const manual=classifyPhotoNamingObservation({
      inputMode:'manual',manualConfirmed:true,
      confirmedBy:'user',confirmationMode:'manual',cueLevel:1,
    });
    expect(manual.trialMode).toBe('mixed');
    expect(manual.clinicalProgressionEligible).toBe(false);
    expect(manual.taskParameters.human_manual_confirmation).toBe(true);
    const caregiver=classifyPhotoNamingObservation({
      inputMode:'caregiver',manualConfirmed:true,
      confirmedBy:'caregiver',confirmationMode:'caregiver',
    });
    expect(caregiver.taskParameters.response_source).toBe('caregiver');
    expect(caregiver.clinicalProgressionEligible).toBe(false);
  });

  it('Photo Naming treats silent recognizer and broken mic as unknown/technical rather than an unsuccessful patient',()=>{
    const unheard=classifyPhotoNamingObservation({inputMode:'production'});
    expect(unheard.trialMode).toBe('mixed');
    expect(unheard.clinicalProgressionEligible).toBe(false);
    expect(unheard.taskParameters.speech_score_eligible).toBe(false);
    const timeout=classifyPhotoNamingObservation({
      inputMode:'timeout',errorType:'timeout',micTechnicalFailure:true,
    });
    expect(timeout.trialMode).toBe('mixed');
    expect(timeout.clinicalProgressionEligible).toBe(false);
    expect(timeout.taskParameters).toMatchObject({
      completion_reason:'timeout',microphone_technical_failure:true,
    });
    expect(classifyPhotoNamingObservation({}).trialMode).toBe('mixed');
  });

  it('Two Clues records cue delivery separate from app semantic-match quality',()=>{
    const scored=describeTwoCluesObservation(clues({
      cueLevelUsed:1,cueTypeUsed:'semantic',tier:'related',
      semanticSimilarity:0.8,
    }));
    expect(scored.trialMode).toBe('scaffolded');
    expect(scored.clinicalProgressionEligible).toBe(true);
    expect(scored.taskParameters).toMatchObject({
      target_word:'snow',cue_support_used:'semantic',
      first_attempt_without_delivered_help:false,
      app_match_similarity:0.8,clue_diagnosticity:null,
      valid_alternative_human_verified:false,
      browser_recognizer_transcript_available:true,
    });
    expect(auditGameMeasurementFields('two_clues',scored.taskParameters)?.missingProposedFields)
      .toContain('clue_diagnosticity');
  });

  it('Two Clues skips and missing source are recorded but never counted as speech failure/progression',()=>{
    for(const attempt of [
      clues({spokenWord:'',browserTranscript:null,completionReason:'skipped',tier:'uncertain'}),
      clues({browserTranscript:null,completionReason:'answered'}),
    ]){
      const observed=describeTwoCluesObservation(attempt);
      expect(observed.trialMode).toBe('mixed');
      expect(observed.clinicalProgressionEligible).toBe(false);
      expect(observed.taskParameters.speech_score_eligible).toBe(false);
    }
  });

  it('Describe & Guess preserves features detected by the app, not clinician-verified discriminative features or a human partner',()=>{
    const result=describeDescribeGuessObservation(describe());
    expect(result).toMatchObject({
      target_id:'cup-1',discriminative_features:null,partner_confirmed_guess:null,
      app_inferred_feature_types:['function'],app_inferred_meaning_win:true,
      model_or_rule_guess_not_human_confirmation:true,
      response_input_mode:'spoken',
    });
    expect(auditGameMeasurementFields('describe_guess',result)?.missingProposedFields)
      .toEqual(['discriminative_features','partner_confirmed_guess']);
  });

  it('Narrative Retell retains actual matched story-event strings, with narrative coherence unknown',()=>{
    const result=describeNarrativeRetellObservation(narrative());
    expect(result).toMatchObject({
      story_id:'story-1',main_concepts_recalled:null,referent_coherence:null,
      app_matched_story_events:['dog left','came back'],
      app_matched_story_event_count:2,
      app_event_coverage_ratio:2/3,
      input_mode:'spoken',coherence_clinically_verified:false,
      event_match_method:'automated_lexical_heuristic',
    });
    expect(result.app_beginning_middle_end_breakdown.middle.hit).toBe(0);
    expect(auditGameMeasurementFields('narrative_retell',result)?.missingProposedFields)
      .toEqual(['main_concepts_recalled','referent_coherence']);
    const typed=describeNarrativeRetellObservation(narrative({
      inputMode:'typed',browserTranscript:null,completionReason:'completed',
    }));
    expect(typed.input_mode).toBe('typed');
  });

  it('Meaning Match captures selected and correct competitor text with choice-only provenance',()=>{
    const result=describeMeaningMatchObservation(meaning({
      correct:false,selectedIndex:1,correctIndex:2,
    }));
    expect(result).toMatchObject({
      item_id:'mm-1',selected_option_text:'b',correct_option_text:'c',
      semantic_competitor_selection_index:1,
      correct_option_index:2,response_input_mode:'tap',
      human_comprehension_adjudication:false,
      clinical_spoken_production_evidence:false,
    });
    expect(result.presented_options).toEqual(['a','b','c']);
    expect(auditGameMeasurementFields('meaning_match',{
      ...result,type:'literal',
    })?.fieldCoverage).toBe('fields_observed');
    const missing=describeMeaningMatchObservation(meaning({
      presentedOptions:[],selectedIndex:4,correctIndex:-1,
    }));
    expect(missing.selected_option_text).toBeNull();
    expect(missing.correct_option_text).toBeNull();
  });

  it('does not save NaN as pseudo-verified latency or inference confidence',()=>{
    const result=describeDescribeGuessObservation(describe({
      guessConfidence:Number.NaN,timeToWordRetrievalMs:Number.POSITIVE_INFINITY,
    }));
    expect(result.app_inferred_guess_confidence).toBeNull();
    expect(result.time_to_word_retrieval_ms).toBeNull();
    expect(LANGUAGE_GAME_TELEMETRY_VERSION).toContain('app-observation');
  });
});
