import { describe, expect, it } from 'vitest';
import { summarizeRecordedPractice } from './todayPracticeSummary';

describe('patient recorded-practice summary', () => {
  it('does not count noise, manual confirmation, or non-patient audio as correct', () => {
    expect(summarizeRecordedPractice([
      { score: 100, validity_label: 'valid_attempt', counts_toward_score: true },
      { score: 0, validity_label: 'valid_attempt', counts_toward_score: true },
      { score: 100, validity_label: 'background_noise', counts_toward_score: false },
      { score: 100, validity_label: 'manual_confirmed', counts_toward_score: false },
      { score: 100, clinician_validity_override: 'not_patient' },
    ])).toEqual({ correct: 1, total: 2, averagePracticeScorePct: 50 });
  });

  it('excludes unscorable scores and preserves graded averages', () => {
    expect(summarizeRecordedPractice([
      { score: null }, { score: 50 }, { score: 100 }, { score: 0 },
    ])).toEqual({ correct: 1, total: 3, averagePracticeScorePct: 50 });
  });

  it('does not manufacture a zero-percent result when no attempts are eligible', () => {
    expect(summarizeRecordedPractice([
      { score: 100, counts_toward_score: false },
    ])).toEqual({ correct: 0, total: 0, averagePracticeScorePct: null });
  });
});
