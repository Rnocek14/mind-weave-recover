import { describe, expect, it } from 'vitest';
import { countsTowardUnclassifiedVerifiedScore } from './verifiedScoreEligibility';

describe('unclassified score-denominator integrity', () => {
  it('excludes mixed input even when a separate game-specific progression is eligible', () => {
    expect(countsTowardUnclassifiedVerifiedScore({
      trial_mode: 'mixed',
      clinical_progression_eligible: true,
    })).toBe(false);
  });
  it('retains eligible pure spoken/tapped scores from legacy games', () => {
    expect(countsTowardUnclassifiedVerifiedScore({
      trial_mode: 'production',
      clinical_progression_eligible: true,
    })).toBe(true);
    expect(countsTowardUnclassifiedVerifiedScore({
      trial_mode: 'recognition',
    })).toBe(true);
    expect(countsTowardUnclassifiedVerifiedScore({})).toBe(true);
  });
  it('excludes practice-only trials even without a mode tag', () => {
    expect(countsTowardUnclassifiedVerifiedScore({
      clinical_progression_eligible: false,
    })).toBe(false);
  });
});
