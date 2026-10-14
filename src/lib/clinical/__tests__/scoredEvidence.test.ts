import { describe, expect, it } from 'vitest';
import {
  hasDeliveredCue,
  isScoredClinicalEvidence,
  scoredEventPercentages,
} from '../scoredEvidence';

describe('read-side scored evidence eligibility', () => {
  it('keeps a classified measured attempt eligible', () => {
    expect(isScoredClinicalEvidence({ validity_label: 'valid_attempt', counts_toward_score: true })).toBe(true);
  });

  it.each([
    'background_noise', 'filler_only', 'no_response', 'low_confidence',
    'other_speaker_suspected', 'manual_confirmed', 'future_unreviewed_label',
  ])('does not include %s in scored accuracy', (label) => {
    expect(isScoredClinicalEvidence({ validity_label: label })).toBe(false);
    expect(isScoredClinicalEvidence({ validity_label: label, counts_toward_score: true })).toBe(false);
  });

  it('respects an explicit exclusion even if a stale label says valid', () => {
    expect(isScoredClinicalEvidence({ validity_label: 'valid_attempt', counts_toward_score: false })).toBe(false);
  });

  it('preserves legacy rows without falsely relabeling them verified', () => {
    const legacy = { validity_label: null, counts_toward_score: null };
    expect(isScoredClinicalEvidence(legacy)).toBe(true);
    expect(legacy).toEqual({ validity_label: null, counts_toward_score: null });
    expect(isScoredClinicalEvidence({})).toBe(true);
  });

  it('retains existing explicit clinician patient override precedence', () => {
    expect(isScoredClinicalEvidence({
      clinician_validity_override: 'patient', validity_label: 'other_speaker_suspected',
      counts_toward_score: false,
    })).toBe(true);
  });

  it.each(['not_patient', 'noise', 'filler'])('respects a clinician %s override', (override) => {
    expect(isScoredClinicalEvidence({
      clinician_validity_override: override, validity_label: 'valid_attempt', counts_toward_score: true,
    })).toBe(false);
  });

  it('reads the legacy task-parameter validity verdict', () => {
    expect(isScoredClinicalEvidence({
      task_parameters: { speech_validity: { label: 'manual_confirmed' } },
    })).toBe(false);
    expect(isScoredClinicalEvidence({
      taskParameters: { speech_validity: { should_score: false } },
    })).toBe(false);
  });

  it('reads legacy engagement exclusions when top-level metadata is absent', () => {
    expect(isScoredClinicalEvidence({ engagement_flags: { counts_toward_score: false } })).toBe(false);
    expect(isScoredClinicalEvidence({ engagement_flags: { validity_label: 'background_noise' } })).toBe(false);
  });

  it('does not lose a nested explicit exclusion behind a top-level true flag', () => {
    expect(isScoredClinicalEvidence({
      validity_label: 'valid_attempt', counts_toward_score: true,
      task_parameters: { speech_validity: { should_score: false } },
    })).toBe(false);
  });

  it.each([null, 'legacy', [], 7])('tolerates non-object legacy JSON metadata: %s', (value) => {
    expect(isScoredClinicalEvidence({ task_parameters: value, engagement_flags: value })).toBe(true);
  });
});

describe('score preservation', () => {
  it('retains genuine measured zero-score errors in the denominator', () => {
    const scores = scoredEventPercentages([
      { score: 1, validity_label: 'valid_attempt' },
      { score: 0, validity_label: 'valid_attempt' },
      { score: 0, validity_label: 'background_noise', counts_toward_score: false },
      { score: 1, validity_label: 'manual_confirmed', counts_toward_score: false },
    ]);
    expect(scores).toEqual([100, 0]);
    expect(scores.reduce((sum, score) => sum + score, 0) / scores.length).toBe(50);
  });

  it('preserves the existing fraction and percent compatibility rule', () => {
    expect(scoredEventPercentages([
      { score: 0 }, { score: 1 }, { score: 0.5 }, { score: 50 }, { score: 100 },
    ])).toEqual([0, 100, 50, 50, 100]);
  });

  it('never converts unavailable or non-finite scores into patient errors', () => {
    expect(scoredEventPercentages([
      { score: null }, { score: NaN }, { score: Infinity }, { score: -Infinity },
    ])).toEqual([]);
  });

  it('returns no score samples when all evidence is excluded', () => {
    expect(scoredEventPercentages([{ score: 0, counts_toward_score: false }])).toEqual([]);
    expect(scoredEventPercentages([])).toEqual([]);
  });
});

describe('only actual delivered cues count', () => {
  it.each([undefined, null, '', ' ', 'none', ' NONE ', 'None'])('does not count %s', (cue) => {
    expect(hasDeliveredCue(cue)).toBe(false);
  });

  it.each(['semantic', 'phonemic', 'full_word', 'semantic_cue', 'phonemic_cue', 'carrier_phrase'])('counts %s', (cue) => {
    expect(hasDeliveredCue(cue)).toBe(true);
  });
});
