import { describe, it, expect } from 'vitest';
import { mapTrialToSkills, isExcludedFromMastery } from '../skillMapping';

describe('Mastery quarantine — open-ended discourse exercises', () => {
  it('flags conversation-partner and conversation-coach as excluded', () => {
    expect(isExcludedFromMastery('conversation-partner')).toBe(true);
    expect(isExcludedFromMastery('conversation-coach')).toBe(true);
    expect(isExcludedFromMastery('CONVERSATION-PARTNER')).toBe(true);
  });

  it('does not flag structured exercises', () => {
    expect(isExcludedFromMastery('photo-naming')).toBe(false);
    expect(isExcludedFromMastery('minimal-pairs')).toBe(false);
    expect(isExcludedFromMastery('narrative-retell')).toBe(false);
  });

  it('mapTrialToSkills returns [] for quarantined exercises (no mastery contamination)', () => {
    expect(mapTrialToSkills({ exerciseSlug: 'conversation-partner', inputs: null })).toEqual([]);
    expect(mapTrialToSkills({ exerciseSlug: 'conversation-coach', inputs: { difficulty: 5 } }))
      .toEqual([]);
  });

  it('narrative-retell still maps to discourse.narrative (structured retell unaffected)', () => {
    expect(mapTrialToSkills({ exerciseSlug: 'narrative-retell', inputs: null }))
      .toEqual(['discourse.narrative']);
  });
});
