import { describe, expect, it } from 'vitest';
import {
  buildDailyPracticeAccuracy, formatPracticePercent, isComparableScoredEvent,
  localDateKey, summarizePresentationEvents, summarizePresentationTrials,
  summarizeRecentPracticeAccuracy,
} from '../metricsPresentation';

describe('read-only metric presentation without rewriting clinical scores', () => {
  it('distinguishes absent measurements from a genuine scored zero', () => {
    expect(summarizePresentationEvents([])).toEqual({
      attempted: 0, eligible: 0, unscored: 0, averagePct: null,
    });
    expect(summarizePresentationEvents([
      { score: null, exercise_slug: 'photo_naming' },
      { score: 0, counts_toward_score: false, validity_label: 'background_noise' },
    ])).toMatchObject({ attempted: 2, eligible: 0, unscored: 2, averagePct: null });
    expect(summarizePresentationEvents([{ score: 0, exercise_slug: 'photo_naming', validity_label: 'valid_attempt' }]))
      .toMatchObject({ attempted: 1, eligible: 1, averagePct: 0 });
    expect(formatPracticePercent(null)).toBe('—');
    expect(formatPracticePercent(0)).toBe('0%');
  });

  it('honors the production validity gate, clinician overrides and non-comparable tasks', () => {
    const rows = [
      { score: 1, exercise_slug: 'photo_naming', validity_label: 'valid_attempt' },
      { score: 0, exercise_slug: 'photo_naming', validity_label: 'valid_attempt' },
      { score: 100, exercise_slug: 'photo_naming', validity_label: 'background_noise', counts_toward_score: false },
      { score: 100, exercise_slug: 'voice_practice', validity_label: 'valid_attempt' },
      { score: 100, exercise_slug: 'conversation_coach', validity_label: 'valid_attempt' },
      { score: 100, exercise_slug: 'photo_naming', validity_label: 'manual_confirmed' },
      { score: 100, exercise_slug: 'photo_naming', clinician_validity_override: 'not_patient' },
      { score: 100, exercise_slug: 'photo_naming', task_parameters: { speech_validity: { should_score: false } } },
      { score: 1, exercise_slug: 'photo_naming', clinician_validity_override: 'patient', counts_toward_score: false },
    ];
    expect(summarizePresentationEvents(rows)).toMatchObject({
      attempted: 9, eligible: 3, unscored: 6, averagePct: 67,
    });
    expect(rows.filter(isComparableScoredEvent)).toHaveLength(3);
  });

  it('normalizes the existing fraction-or-percent representation without treating null as zero', () => {
    const result = summarizePresentationEvents([
      { score: 0.5 }, { score: 1 }, { score: 50 }, { score: 100 },
      { score: -1 }, { score: 101 }, { score: NaN }, { score: Infinity }, { score: null },
    ]);
    expect(result).toMatchObject({ attempted: 9, eligible: 4, unscored: 5, averagePct: 75 });
  });

  it('counts cues only for eligible answers and labels excluded/unknown attempts separately', () => {
    const summary = summarizePresentationTrials([
      { is_correct: true, cue_type_given: 'none', exercise_slug: 'photo_naming' },
      { is_correct: false, cue_type_given: 'phonemic', exercise_slug: 'photo_naming' },
      { is_correct: true, cue_type_given: 'semantic', exercise_slug: 'photo_naming',
        validity_label: 'background_noise', counts_toward_score: false },
      { is_correct: null, cue_type_given: 'full_word', exercise_slug: 'photo_naming' },
      { is_correct: false, cue_type_given: 'full_word', exercise_slug: 'photo_naming',
        clinician_validity_override: 'filler' },
    ]);
    expect(summary).toMatchObject({
      attempted: 5, eligible: 2, excludedOrUnscored: 3,
      correct: 1, cued: 1, accuracyPct: 50, cueDependencyPct: 50,
      validityBuckets: { valid: 2, filler: 1, silence: 0, noise: 1, flagged: 1 },
    });
  });

  it('never turns only excluded responses into zero accuracy or zero cue dependency', () => {
    expect(summarizePresentationTrials([
      { is_correct: false, validity_label: 'no_response', counts_toward_score: false },
      { is_correct: null, validity_label: 'low_confidence' },
    ])).toMatchObject({ eligible: 0, attempted: 2, accuracyPct: null, cueDependencyPct: null });
  });
});

describe('sparse speech-practice trends', () => {
  const first = '2026-10-01';
  const second = '2026-10-02';
  const third = '2026-10-03';

  it('does not join unobserved days to measured 0% failure days', () => {
    const days = buildDailyPracticeAccuracy([
      { created_at: new Date(2026, 9, 1, 12).toISOString(), is_correct: false, validity_label: 'valid_attempt' },
      { created_at: new Date(2026, 9, 3, 12).toISOString(), is_correct: true, validity_label: 'valid_attempt' },
      { created_at: new Date(2026, 9, 2, 12).toISOString(), is_correct: false,
        counts_toward_score: false, validity_label: 'background_noise' },
    ], [first, second, third]);
    expect(days).toEqual([
      { date: first, correct: 0, count: 1, accuracy: 0 },
      { date: second, correct: 0, count: 0, accuracy: null },
      { date: third, correct: 1, count: 1, accuracy: 100 },
    ]);
  });

  it('computes a weighted recent average rather than giving a one-attempt day equal weight', () => {
    const days = [
      { date: first, correct: 1, count: 1, accuracy: 100 },
      { date: second, correct: 0, count: 0, accuracy: null },
      { date: third, correct: 0, count: 9, accuracy: 0 },
    ];
    expect(summarizeRecentPracticeAccuracy(days)).toEqual({ accuracyPct: 10, eligible: 10, activeDays: 2 });
    expect(summarizeRecentPracticeAccuracy([])).toEqual({ accuracyPct: null, eligible: 0, activeDays: 0 });
  });

  it('uses the user's local calendar day, not the UTC date substring', () => {
    const local = new Date(2026, 9, 31, 22);
    expect(localDateKey(local)).toBe('2026-10-31');
    expect(buildDailyPracticeAccuracy([
      { created_at: local.toISOString(), is_correct: true },
    ], ['2026-10-31'])[0].accuracy).toBe(100);
  });
});
