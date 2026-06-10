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
});
