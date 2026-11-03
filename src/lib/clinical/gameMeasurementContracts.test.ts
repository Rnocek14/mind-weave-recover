import { describe,expect,it } from 'vitest';
import { CANONICAL_EXERCISES } from '@/data/canonicalExerciseRegistry';
import { getClinicalGameEvidence } from '@/lib/clinicalEvidenceRegistry';
import { getEightLevelCoverage } from '@/lib/clinicalEightLevelCoverage';
import {
  GAME_MEASUREMENT_SPECS,GAME_MEASUREMENT_SPEC_VERSION,
  auditGameMeasurementFields,describeGameMeasurementProvenance,
  getGameMeasurementSpec,getSpeechScoreExclusion,
} from './gameMeasurementContracts';

describe('29 individual research-to-runtime measurement contracts',()=>{
  const slugs=[...CANONICAL_EXERCISES.map(x=>x.slug),'functional-scenes'].sort();
  it('covers each actual adult game once, including the supplemental command scenes',()=>{
    expect(Object.keys(GAME_MEASUREMENT_SPECS).sort()).toEqual(slugs);
    expect(getEightLevelCoverage()).toHaveLength(29);
    const unique=new Set<string>();
    for(const slug of slugs){
      const measurement=getGameMeasurementSpec(slug)!;
      const clinical=getClinicalGameEvidence(slug)!;
      expect(clinical).not.toBeNull();
      expect(measurement.primaryMeasureId.length,slug).toBeGreaterThan(12);
      expect(unique.has(measurement.primaryMeasureId),slug).toBe(false);
      unique.add(measurement.primaryMeasureId);
      expect(measurement.clinicianJudgement.length,slug).toBeGreaterThan(25);
      expect(measurement.proposedTaskFields.length,slug).toBeGreaterThanOrEqual(3);
      expect(new Set(measurement.proposedTaskFields).size,slug).toBe(
        measurement.proposedTaskFields.length,
      );
      expect(measurement.proposedTaskFields.every(field=>/^[a-z][a-z0-9_]+$/.test(field)),slug).toBe(true);
      const observation=describeGameMeasurementProvenance(slug,{});
      expect(observation).toMatchObject({
        measurement_contract_version:GAME_MEASUREMENT_SPEC_VERSION,
        measurement_primary_metric_id:measurement.primaryMeasureId,
        measurement_evidence_track:clinical.track,
        measurement_validation:'unreviewed_app_observation',
        measurement_field_coverage:'missing',
        measurement_fields_observed:[],
        measurement_fields_missing:[...measurement.proposedTaskFields],
      });
    }
  });

  it('resolves the existing telemetry, progression and multi-step planning aliases',()=>{
    expect(getGameMeasurementSpec('minimal_pairs')).toBe(getGameMeasurementSpec('minimal-pairs'));
    expect(getGameMeasurementSpec('multi_step_planning')).toBe(getGameMeasurementSpec('multi-step-plan'));
    expect(getGameMeasurementSpec('functional_scenes')).toBe(getGameMeasurementSpec('functional-scenes'));
    expect(getGameMeasurementSpec('not_registered')).toBeNull();
    expect(describeGameMeasurementProvenance('not_registered',{})).toEqual({});
  });

  it('counts false and zero as actual observed metadata, not missing performance',()=>{
    const observation=auditGameMeasurementFields('meaning_match',{
      item_id:'meaning-01',type:'literal',used_hint:false,
    })!;
    expect(observation).toMatchObject({
      gameSlug:'meaning-match',track:'receptive',fieldCoverage:'fields_observed',
      observedProposedFields:['item_id','type','used_hint'],missingProposedFields:[],
    });
    const partial=auditGameMeasurementFields('meaning-match',{
      item_id:'meaning-02',type:null,used_hint:false,
    })!;
    expect(partial).toMatchObject({
      fieldCoverage:'partial',
      observedProposedFields:['item_id','used_hint'],missingProposedFields:['type'],
    });
    expect(auditGameMeasurementFields('meaning_match',{
      item_id:'',type:null,used_hint:null,
    })?.fieldCoverage).toBe('missing');
  });

  it.each([
    ['minimal-pairs','receptive_task_not_spoken_production'],
    ['meaning-match','receptive_task_not_spoken_production'],
    ['detective-mind','receptive_task_not_spoken_production'],
    ['phonological-awareness','receptive_task_not_spoken_production'],
    ['follow-directions','receptive_task_not_spoken_production'],
    ['sequence-builder','receptive_task_not_spoken_production'],
    ['reach-tap','nonlinguistic_task_not_spoken_production'],
    ['left-side-hunt','nonlinguistic_task_not_spoken_production'],
    ['pattern-match','nonlinguistic_task_not_spoken_production'],
  ] as const)('excludes %s from speech metrics irrespective of a stale true trial flag',(
    slug,reason,
  )=>{
    expect(getSpeechScoreExclusion(slug,'production',{})).toBe(reason);
  });

  it.each(['recognition','exposure','mixed'] as const)(
    'does not infer independent spoken production from %s mode in expressive games',mode=>{
      expect(getSpeechScoreExclusion('fix-sentence',mode,{}))
        .toBe('trial_mode_not_spoken_production');
    },
  );

  it.each(['typed','choice','tap','self_report','skipped_partial'] as const)(
    'does not infer independent spoken production from %s input even if labeled production',mode=>{
      expect(getSpeechScoreExclusion('photo-naming','production',{input_mode:mode}))
        .toBe('input_channel_not_spoken_production');
    },
  );

  it('quarantines nonclinical stage rehearsal even when its source task has an expressive label',()=>{
    expect(getSpeechScoreExclusion('fix_sentence_practice','production',{}))
      .toBe('unvalidated_practice_only');
    expect(getSpeechScoreExclusion('photo-naming','production',{practice_only:true}))
      .toBe('unvalidated_practice_only');
    expect(getSpeechScoreExclusion('photo-naming','production',{clinical_progression_eligible:false}))
      .toBe('progression_ineligible_practice');
    expect(getSpeechScoreExclusion('photo-naming','production',{clinical_score_eligible:false}))
      .toBe('source_explicitly_excluded');
  });

  it('keeps supported spoken responses available for existing separate validity/cue checks',()=>{
    expect(getSpeechScoreExclusion('photo-naming','production',{input_mode:'browser_recognized'})).toBeNull();
    expect(getSpeechScoreExclusion('photo-naming','scaffolded',{input_mode:'browser_recognized'})).toBeNull();
    // An absence of exclusion is not a claim that the recognized words are true.
    expect(getSpeechScoreExclusion('not_registered','production',{})).toBeNull();
  });
});
