import { describe, expect, it } from 'vitest';
import { summarizeVerifiedScoreEvents } from './summarizeVerifiedScoreEvents';

describe('legacy daily totals preserve verified-trial denominator', () => {
  it('ignores manual, typed, and unscorable trials even when their raw score is 100', () => {
    expect(summarizeVerifiedScoreEvents([
      { score: 100, counts_toward_score: true },
      { score: 0, counts_toward_score: true },
      { score: 100, counts_toward_score: false }, // user manually clicked "I Said It"
      { score: 100, counts_toward_score: false }, // typed fluency practice
      { score: 0, counts_toward_score: false },   // noise or abandoned speech
      { score: null, counts_toward_score: null },
    ])).toEqual({ correct: 1, total: 2 });
  });

  it('accepts legitimate historical records with missing eligibility flags', () => {
    expect(summarizeVerifiedScoreEvents([
      { score: 100, counts_toward_score: null },
      { score: 0, counts_toward_score: null },
    ])).toEqual({ correct: 1, total: 2 });
  });

  it('does not invent successful attempts for absent, empty or invalid data', () => {
    expect(summarizeVerifiedScoreEvents(null)).toEqual({ correct: 0, total: 0 });
    expect(summarizeVerifiedScoreEvents([
      { score: Number.NaN, counts_toward_score: true },
      { score: null, counts_toward_score: true },
    ])).toEqual({ correct: 0, total: 0 });
  });
});
