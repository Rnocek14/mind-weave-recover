import { describe, it, expect } from 'vitest';
import { reduceAccuracy } from '@/lib/sessionAccuracySummary';

describe('reduceAccuracy (session summary accuracy fix)', () => {
  it('returns null fields when there are no scored trials', () => {
    const r = reduceAccuracy([]);
    expect(r.accuracy).toBeNull();
    expect(r.independent_accuracy).toBeNull();
    expect(r.cue_assisted_accuracy).toBeNull();
    expect(r.scored_trials).toBe(0);
  });

  it('computes overall accuracy as mean of scores (0..100)', () => {
    const r = reduceAccuracy([
      { score: 100, cue_level: 0, counts_toward_score: true },
      { score: 0, cue_level: 0, counts_toward_score: true },
      { score: 100, cue_level: 0, counts_toward_score: true },
      { score: 100, cue_level: 0, counts_toward_score: true },
    ]);
    expect(r.accuracy).toBe(75);
    expect(r.scored_trials).toBe(4);
  });

  it('splits independent (cue_level 0) vs cue-assisted (cue_level > 0)', () => {
    const r = reduceAccuracy([
      { score: 100, cue_level: 0, counts_toward_score: true }, // independent correct
      { score: 0, cue_level: 0, counts_toward_score: true },   // independent wrong
      { score: 100, cue_level: 2, counts_toward_score: true }, // cued correct
      { score: 100, cue_level: 1, counts_toward_score: true }, // cued correct
    ]);
    expect(r.independent_accuracy).toBe(50);
    expect(r.cue_assisted_accuracy).toBe(100);
    expect(r.independent_trials).toBe(2);
    expect(r.cue_assisted_trials).toBe(2);
  });

  it('excludes validity-filtered rows (counts_toward_score === false)', () => {
    const r = reduceAccuracy([
      { score: 100, cue_level: 0, counts_toward_score: true },
      { score: 0, cue_level: 0, counts_toward_score: false }, // no-response, excluded
      { score: 0, cue_level: 0, counts_toward_score: false }, // noise, excluded
    ]);
    expect(r.accuracy).toBe(100);
    expect(r.scored_trials).toBe(1);
  });

  it('excludes non-trial telemetry rows with null score', () => {
    const r = reduceAccuracy([
      { score: null, cue_level: null, counts_toward_score: null }, // telemetry_write_failure
      { score: 100, cue_level: 0, counts_toward_score: true },
    ]);
    expect(r.accuracy).toBe(100);
    expect(r.scored_trials).toBe(1);
  });

  it('treats missing counts_toward_score (legacy rows) as scored', () => {
    const r = reduceAccuracy([
      { score: 100, cue_level: 0, counts_toward_score: null },
      { score: 0, cue_level: 0, counts_toward_score: null },
    ]);
    expect(r.accuracy).toBe(50);
    expect(r.scored_trials).toBe(2);
  });

  // ── Phase 1B: manual_confirmed handling ──
  it('excludes manual_confirmed from clean accuracy / independent / asr', () => {
    const r = reduceAccuracy([
      { score: 100, cue_level: 0, counts_toward_score: true, validity_label: 'valid_attempt' },
      { score: 0, cue_level: 0, counts_toward_score: true, validity_label: 'valid_attempt' },
      // manual-confirmed correct — must NOT touch clean accuracy
      { score: 100, cue_level: 0, counts_toward_score: false, validity_label: 'manual_confirmed' },
    ]);
    expect(r.accuracy).toBe(50); // only the 2 ASR-verified trials
    expect(r.asr_accuracy).toBe(50);
    expect(r.independent_accuracy).toBe(50);
    expect(r.scored_trials).toBe(2);
  });

  it('includes manual_confirmed in practice accuracy + participation', () => {
    const r = reduceAccuracy([
      { score: 100, cue_level: 0, counts_toward_score: true, validity_label: 'valid_attempt' },
      { score: 0, cue_level: 0, counts_toward_score: true, validity_label: 'valid_attempt' },
      { score: 100, cue_level: 0, counts_toward_score: false, validity_label: 'manual_confirmed' },
      { score: 100, cue_level: 0, counts_toward_score: false, validity_label: 'manual_confirmed' },
    ]);
    // practice = mean(100, 0, 100, 100) = 75
    expect(r.practice_accuracy).toBe(75);
    expect(r.manual_confirmed_trials).toBe(2);
    expect(r.participation_trials).toBe(4); // 2 ASR + 2 manual
  });

  it('manual_confirmed only session: clean accuracy null, practice non-null', () => {
    const r = reduceAccuracy([
      { score: 100, cue_level: 0, counts_toward_score: false, validity_label: 'manual_confirmed' },
      { score: 100, cue_level: 0, counts_toward_score: false, validity_label: 'manual_confirmed' },
    ]);
    expect(r.accuracy).toBeNull();
    expect(r.independent_accuracy).toBeNull();
    expect(r.practice_accuracy).toBe(100);
    expect(r.participation_trials).toBe(2);
  });
  it('excludes Pattern Match visual-memory successes from ASR accuracy, including legacy rows', () => {
    const result = reduceAccuracy([
      { score: 100, cue_level: 0, counts_toward_score: true, exercise_slug: 'pattern_match' },
      { score: 0, cue_level: 0, counts_toward_score: null, exercise_slug: 'pattern_match' },
      { score: 0, cue_level: 0, counts_toward_score: true, exercise_slug: 'photo_naming' },
    ]);
    expect(result.asr_accuracy).toBe(0);
    expect(result.independent_accuracy).toBe(0);
    expect(result.scored_trials).toBe(1);
    expect(result.participation_trials).toBe(1);
  });

  it('does not turn a visual-only session into a fabricated speech score', () => {
    const result = reduceAccuracy([
      { score: 100, cue_level: 0, counts_toward_score: true, exercise_slug: 'pattern_match' },
    ]);
    expect(result.asr_accuracy).toBeNull();
    expect(result.independent_accuracy).toBeNull();
    expect(result.practice_accuracy).toBeNull();
    expect(result.scored_trials).toBe(0);
  });

  it('never promotes Thought Organization choice, manual, or open-attempt scores into ASR/independent accuracy',()=>{
    const result=reduceAccuracy([
      {score:100,cue_level:0,counts_toward_score:true,
        exercise_slug:'thought_organization'},
      {score:0,cue_level:1,counts_toward_score:false,
        exercise_slug:'thought_organization'},
      {score:100,cue_level:0,counts_toward_score:false,
        validity_label:'manual_confirmed',exercise_slug:'thought_organization'},
      {score:0,cue_level:0,counts_toward_score:true,
        exercise_slug:'photo_naming'},
    ]);
    expect(result.asr_accuracy).toBe(0);
    expect(result.independent_accuracy).toBe(0);
    expect(result.practice_accuracy).toBe(0);
    expect(result.scored_trials).toBe(1);
    expect(result.manual_confirmed_trials).toBe(0);
    expect(result.participation_trials).toBe(1);
  });

  it('never treats scripted conversation choices, typing, or ASR as independent clinical accuracy',()=>{
    const result=reduceAccuracy([
      // Defend against accidental legacy/mislabeled true score flags.
      {score:100,cue_level:0,counts_toward_score:true,
        exercise_slug:'conversation_partner'},
      {score:100,cue_level:0,counts_toward_score:true,
        exercise_slug:'conversation_coach'},
      {score:0,cue_level:3,counts_toward_score:false,
        validity_label:'manual_confirmed',exercise_slug:'conversation_coach'},
      {score:0,cue_level:0,counts_toward_score:true,
        exercise_slug:'photo_naming'},
    ]);
    expect(result.asr_accuracy).toBe(0);
    expect(result.independent_accuracy).toBe(0);
    expect(result.practice_accuracy).toBe(0);
    expect(result.scored_trials).toBe(1);
    expect(result.participation_trials).toBe(1);
    expect(result.manual_confirmed_trials).toBe(0);
  });

  it('excludes unvalidated Abstract Compare coverage from ASR speech scores', () => {
    const result = reduceAccuracy([
      { score: 100, cue_level: 0, counts_toward_score: true, exercise_slug: 'abstract_compare' },
      { score: 0, cue_level: 0, counts_toward_score: true, exercise_slug: 'photo_naming' },
    ]);
    expect(result.asr_accuracy).toBe(0);
    expect(result.scored_trials).toBe(1);
  });

  it('quarantines stale scored receptive and motor successes without erasing spoken target errors',()=>{
    const rows=[
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'minimal_pairs'},
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'meaning_match'},
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'detective_mind'},
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'phonological_awareness'},
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'reach_tap'},
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'left_side_hunt'},
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'follow_directions'},
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'sequence_builder'},
      {score:0,cue_level:0,counts_toward_score:true,exercise_slug:'photo_naming',
        validity_label:'valid_attempt'},
    ];
    const reduced=reduceAccuracy(rows);
    expect(reduced).toMatchObject({
      accuracy:0,asr_accuracy:0,independent_accuracy:0,
      practice_accuracy:0,scored_trials:1,independent_trials:1,
    });
  });

  it('excludes legacy Fix Sentence tapped and typed attempts when the task recorded its actual channel',()=>{
    const summary=reduceAccuracy([
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'fix_sentence',
        task_parameters:{trial_mode:'recognition',input_mode:'choice'}},
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'fix_sentence',
        task_parameters:{trial_mode:'production',input_mode:'typed'}},
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'fix_sentence',
        task_parameters:{trial_mode:'mixed',input_mode:'browser_recognized'}},
      {score:0,cue_level:0,counts_toward_score:true,exercise_slug:'photo_naming',
        task_parameters:{trial_mode:'production',input_mode:'browser_recognized'}},
    ]);
    expect(summary.asr_accuracy).toBe(0);
    expect(summary.independent_accuracy).toBe(0);
    expect(summary.scored_trials).toBe(1);
  });

  it('keeps a separately marked scaffolded spoken observation out of the independent denominator',()=>{
    const summary=reduceAccuracy([
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'photo_naming',
        task_parameters:{trial_mode:'scaffolded',
          input_mode:'browser_recognized',independent_spoken_score_eligible:false}},
      {score:0,cue_level:0,counts_toward_score:true,exercise_slug:'photo_naming',
        task_parameters:{trial_mode:'production',
          input_mode:'browser_recognized',independent_spoken_score_eligible:true}},
    ]);
    expect(summary).toMatchObject({
      asr_accuracy:50,scored_trials:2,
      independent_accuracy:0,independent_trials:1,
      cue_assisted_accuracy:100,cue_assisted_trials:1,
    });
  });

  it('treats a delivered semantic cue as assisted even if an old caller wrote cue_level zero',()=>{
    const summary=reduceAccuracy([
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'photo_naming',
        task_parameters:{support_used:'semantic_cue'}},
      {score:0,cue_level:0,counts_toward_score:true,exercise_slug:'photo_naming',
        task_parameters:{support_used:'independent'}},
    ]);
    expect(summary).toMatchObject({
      asr_accuracy:50,independent_accuracy:0,
      cue_assisted_accuracy:100,independent_trials:1,cue_assisted_trials:1,
    });
  });

  it('returns unavailable rather than zero independent speech accuracy for nonspoken-only sessions',()=>{
    const summary=reduceAccuracy([
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'meaning_match'},
      {score:0,cue_level:1,counts_toward_score:true,exercise_slug:'minimal_pairs'},
      {score:100,cue_level:0,counts_toward_score:true,exercise_slug:'reach_tap'},
    ]);
    expect(summary.asr_accuracy).toBeNull();
    expect(summary.independent_accuracy).toBeNull();
    expect(summary.scored_trials).toBe(0);
  });

});
