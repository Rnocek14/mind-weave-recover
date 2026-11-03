import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrialData } from './useExerciseTelemetry';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(async (_row: unknown) => ({ error: null })),
  trackTrial: vi.fn(),
  reset: vi.fn(),
}));

// Real useExerciseTelemetry and real score-summary reducer under test. Only the
// Supabase network boundary and encouragement side-effect are replaced.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: mocks.insert,
    }),
  },
}));
vi.mock('@/hooks/useMicroEncouragement', () => ({
  useMicroEncouragement: () => ({
    trackTrial: mocks.trackTrial,
    reset: mocks.reset,
  }),
}));
vi.mock('@/lib/adaptiveLevelRegistry', () => ({
  readAdaptiveLevel: () => null,
}));

import { useExerciseTelemetry } from './useExerciseTelemetry';
import { classifyUtteranceValidity } from '@/lib/clinical/classifyUtteranceValidity';
import { reduceAccuracy } from '@/lib/sessionAccuracySummary';
import { describePhrasePracticeEvidence } from '@/lib/phrasePractice/stageEvidence';
import { CANONICAL_EXERCISES } from '@/data/canonicalExerciseRegistry';
import { getClinicalGameEvidence } from '@/lib/clinicalEvidenceRegistry';
import { getGameMeasurementSpec } from '@/lib/clinical/gameMeasurementContracts';

const spokenValidity = () => classifyUtteranceValidity({
  transcript: 'the cup is used for drinking',
  recordingDurationMs: 1800,
  asrVerified: true,
});

async function persist(trial: Partial<TrialData>, slug = 'describe_guess') {
  const { result } = renderHook(() => useExerciseTelemetry('synthetic-session', slug));
  let saved = false;
  await act(async () => {
    saved = await result.current.logTrial({
      correct: true,
      reactionTimeMs: 1800,
      attemptId: 'synthetic-attempt',
      browserTranscript: 'the cup is used for drinking',
      ...trial,
    });
  });
  expect(saved).toBe(true);
  expect(mocks.insert).toHaveBeenCalledTimes(1);
  return mocks.insert.mock.calls[0][0] as Record<string, any>;
}

describe('useExerciseTelemetry verified-score eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
  });

  it.each([...CANONICAL_EXERCISES.map(game=>game.slug),'functional-scenes'])(
    'final raw writer records the unique proposed measurement contract for %s',
    async slug=>{
      const raw=await persist({
        browserTranscript:undefined,validity:undefined,
        taskParameters:{synthetic_telemetry_probe:true},
      },slug);
      const spec=getGameMeasurementSpec(slug)!;
      const evidence=getClinicalGameEvidence(slug)!;
      expect(raw.task_parameters).toMatchObject({
        measurement_contract_version:'research-2026-11-02-v1',
        measurement_primary_metric_id:spec.primaryMeasureId,
        measurement_unit:spec.unit,
        measurement_evidence_track:evidence.track,
        measurement_validation:'unreviewed_app_observation',
        measurement_field_coverage:'missing',
        measurement_fields_missing:[...spec.proposedTaskFields],
      });
      if(evidence.track!=='expressive'){
        expect(raw.task_parameters.speech_score_eligible).toBe(false);
        expect(raw.engagement_flags.counts_toward_asr_accuracy).toBe(false);
      }
    },
  );

  it('excludes explicit practice-only attempts even with a valid speech verdict', async () => {
    const raw = await persist({
      validity: spokenValidity(),
      taskParameters: {
        clinical_progression_eligible: false,
        input_mode: 'spoken',
        trial_mode: 'scaffolded',
      },
    });

    expect(raw).toMatchObject({
      score: 100, // Practice outcome retained; not scored in verified metrics.
      validity_label: 'valid_attempt',
      counts_toward_score: false,
      engagement_flags: {
        counts_toward_score: false,
        counts_toward_asr_accuracy: false,
        counts_toward_practice_accuracy: true,
      },
      task_parameters: {
        clinical_progression_eligible: false,
        speech_validity: {
          should_score: false,
          should_feed_adaptation: false,
          counts_toward_asr_accuracy: false,
        },
      },
    });

    const summary = reduceAccuracy([{
      score: raw.score,
      cue_level: raw.cue_level,
      counts_toward_score: raw.counts_toward_score,
      validity_label: raw.validity_label,
      exercise_slug: raw.exercise_slug,
    }]);
    expect(summary).toMatchObject({
      accuracy: null,
      asr_accuracy: null,
      independent_accuracy: null,
      scored_trials: 0,
      independent_trials: 0,
    });
  });

  it('a supported tapped Fix Sentence answer can remain receptive progression evidence without becoming an ASR success', async () => {
    const row = await persist({
      correct:true,
      browserTranscript:undefined,
      validity:undefined,
      taskParameters:{
        trial_mode:'recognition',
        input_mode:'choice',
        clinical_progression_eligible:true,
        clinical_score_eligible:false,
      },
    },'fix_sentence');
    expect(row).toMatchObject({
      score:100,counts_toward_score:false,
      task_parameters:{
        clinical_progression_eligible:true,clinical_score_eligible:false,
        trial_mode:'recognition',input_mode:'choice',
      },
    });
    expect(row.browser_transcript).toBeUndefined();
    expect(reduceAccuracy([{
      score:row.score,cue_level:row.cue_level,
      counts_toward_score:row.counts_toward_score,
      exercise_slug:row.exercise_slug,
    }])).toMatchObject({asr_accuracy:null,independent_accuracy:null,scored_trials:0});
  });

  it('even valid recognized speech with on-screen repair options cannot silently count as independent ASR success',async()=>{
    const row=await persist({
      correct:true,
      validity:spokenValidity(),
      taskParameters:{
        trial_mode:'scaffolded',input_mode:'browser_recognized',
        clinical_progression_eligible:true,clinical_score_eligible:false,
      },
    },'fix_sentence');
    expect(row).toMatchObject({
      score:100,validity_label:'valid_attempt',counts_toward_score:false,
      task_parameters:{speech_validity:{
        should_score:false,counts_toward_asr_accuracy:false,
      }},
      engagement_flags:{counts_toward_score:false,counts_toward_asr_accuracy:false},
    });
  });

  it.each(['fix_sentence_practice','detective_mind_practice'])(
    '%s records a correct practice tile without adding ASR or independent speech accuracy',
    async slug=>{
      const raw=await persist({
        correct:true,browserTranscript:undefined,validity:undefined,
        taskParameters:{
          practice_only:true,reasoning_practice:true,
          reasoning_input_mode:'choice',trial_mode:'recognition',
          clinical_progression_eligible:false,clinical_score_eligible:false,
          independent_spoken_score_eligible:false,
        },
      },slug);
      expect(raw).toMatchObject({
        exercise_slug:slug,score:100,counts_toward_score:false,
        task_parameters:{
          practice_only:true,clinical_progression_eligible:false,
          clinical_score_eligible:false,independent_spoken_score_eligible:false,
        },
      });
      expect(raw.browser_transcript).toBeUndefined();
      expect(reduceAccuracy([{
        score:raw.score,cue_level:raw.cue_level,
        counts_toward_score:raw.counts_toward_score,
        validity_label:raw.validity_label,exercise_slug:raw.exercise_slug,
      }])).toMatchObject({
        accuracy:null,asr_accuracy:null,independent_accuracy:null,scored_trials:0,
      });
    },
  );

  it('an ungraded spoken reasoning hypothesis remains practice even with valid browser text',async()=>{
    const raw=await persist({
      correct:false,browserTranscript:'I would check the labels',
      validity:spokenValidity(),
      taskParameters:{
        practice_only:true,reasoning_practice_stage:8,
        reasoning_input_mode:'browser_recognized',trial_mode:'mixed',
        clinical_progression_eligible:false,clinical_score_eligible:false,
        independent_spoken_score_eligible:false,
      },
    },'detective_mind_practice');
    expect(raw).toMatchObject({
      score:0,validity_label:'valid_attempt',counts_toward_score:false,
      task_parameters:{
        speech_validity:{should_score:false,counts_toward_asr_accuracy:false},
      },
    });
  });

  it('retains receptive Meaning Match task accuracy while keeping it outside ASR statistics',async()=>{
    const raw=await persist({
      correct:true,browserTranscript:undefined,validity:undefined,
      taskParameters:{
        clinical_progression_eligible:true,
        trial_mode:'recognition',
        speech_score_eligible:false,
        measurement_evidence_track:'receptive',
      },
    },'meaning_match');
    expect(raw).toMatchObject({
      score:100,counts_toward_score:true,
      task_parameters:{
        clinical_progression_eligible:true,
        speech_score_eligible:false,
      },
      engagement_flags:{counts_toward_asr_accuracy:false},
    });
    expect(raw.browser_transcript).toBeUndefined();
    const accuracy=reduceAccuracy([{
      score:raw.score,cue_level:raw.cue_level,
      counts_toward_score:raw.counts_toward_score,
      validity_label:raw.validity_label,exercise_slug:raw.exercise_slug,
      task_parameters:raw.task_parameters,
    }]);
    expect(accuracy.asr_accuracy).toBeNull();
    expect(accuracy.independent_accuracy).toBeNull();
    expect(accuracy.scored_trials).toBe(0);
  });

  it('maintains game-specific score but rejects ASR counting even if an unrelated speech verdict is valid',async()=>{
    const raw=await persist({
      correct:true,validity:spokenValidity(),
      taskParameters:{
        clinical_progression_eligible:true,
        speech_score_eligible:false,
        trial_mode:'recognition',
      },
    },'minimal_pairs');
    expect(raw).toMatchObject({
      score:100,counts_toward_score:true,
      task_parameters:{speech_validity:{
        should_score:true,counts_toward_asr_accuracy:false,
      }},
      engagement_flags:{
        counts_toward_score:true,counts_toward_asr_accuracy:false,
      },
    });
  });

  it('preserves eligible valid speech in the verified denominator', async () => {
    const raw = await persist({
      validity: spokenValidity(),
      taskParameters: {
        clinical_progression_eligible: true,
        input_mode: 'spoken',
        trial_mode: 'production',
      },
    });

    expect(raw).toMatchObject({
      counts_toward_score: true,
      task_parameters: {
        speech_validity: {
          should_score: true,
          should_feed_adaptation: true,
          counts_toward_asr_accuracy: true,
        },
      },
      engagement_flags: {
        counts_toward_score: true,
      },
    });

    const summary = reduceAccuracy([{
      score: raw.score,
      cue_level: raw.cue_level,
      counts_toward_score: raw.counts_toward_score,
      validity_label: raw.validity_label,
      exercise_slug: raw.exercise_slug,
    }]);
    expect(summary).toMatchObject({
      accuracy: 100,
      independent_accuracy: 100,
      scored_trials: 1,
    });
  });

  it('also excludes practice-only attempts when no validity verdict exists', async () => {
    const raw = await persist({
      validity: undefined,
      taskParameters: {
        clinical_progression_eligible: false,
        input_mode: 'typed',
        trial_mode: 'mixed',
      },
      browserTranscript: undefined,
    });

    expect(raw).toMatchObject({
      counts_toward_score: false,
      task_parameters: { clinical_progression_eligible: false },
    });
    expect(raw.browser_transcript).toBeUndefined();
  });

  it('retains the original validity rejection even if a caller requests eligibility', async () => {
    const rejected = classifyUtteranceValidity({
      transcript: '',
      recordingDurationMs: 1600,
    });
    expect(rejected.countsTowardScore).toBe(false);

    const raw = await persist({
      validity: rejected,
      taskParameters: { clinical_progression_eligible: true },
      browserTranscript: undefined,
    });
    expect(raw).toMatchObject({
      counts_toward_score: false,
      task_parameters: {
        speech_validity: { should_score: false },
      },
    });
  });
  it('does not count a correct STAGE-2 spoken phrase completion as independent clinical speech', async () => {
    const raw = await persist({
      correct: true,
      browserTranscript: 'you',
      taskParameters: {
        ...describePhrasePracticeEvidence({
          trainingStage: 2,
          scriptSupport: 'partial_script',
          fullScriptRevealed: false,
          practiceStageSource: 'care_partner_selection',
        }),
        phrase_id: 'thanks',
      },
    }, 'phrase-practice');
    expect(raw).toMatchObject({
      score: 100,
      counts_toward_score: false,
      task_parameters: {
        training_stage: 2,
        clinical_progression_eligible: false,
        independent_spoken_score_eligible: false,
      },
    });
    const summary = reduceAccuracy([{
      score: raw.score,
      cue_level: raw.cue_level,
      counts_toward_score: raw.counts_toward_score,
      exercise_slug: raw.exercise_slug,
    }]);
    expect(summary).toMatchObject({
      accuracy: null, asr_accuracy: null,
      independent_accuracy: null, scored_trials: 0,
    });
  });

});
