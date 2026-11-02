import { describe, expect, it } from 'vitest';
import {
  classifySynonymRoundEvidence,
  getSynonymInputMode,
  getSynonymSuccessThreshold,
} from './roundEvidence';
import { routeTrialMode } from '@/lib/mastery/masterySignalRouting';

describe('Synonym Generator: faithful round evidence and mastery eligibility', () => {
  it('uses the played content difficulty rather than a hardcoded two-match threshold', () => {
    expect(getSynonymSuccessThreshold(1)).toBe(2);
    expect(getSynonymSuccessThreshold(2)).toBe(2);
    expect(getSynonymSuccessThreshold(3)).toBe(3);
    expect(getSynonymSuccessThreshold(4)).toBe(3);
    expect(getSynonymSuccessThreshold(5)).toBe(4);
    expect(getSynonymSuccessThreshold(10)).toBe(4);
    expect(getSynonymSuccessThreshold(NaN)).toBe(4);
  });

  it('classifies the origin of actual entries rather than the last selected toggle', () => {
    expect(getSynonymInputMode(0, 0)).toBe('none');
    expect(getSynonymInputMode(3, 0)).toBe('spoken');
    expect(getSynonymInputMode(0, 3)).toBe('typed');
    expect(getSynonymInputMode(3, 1)).toBe('mixed');
    expect(getSynonymInputMode(NaN, 1)).toBe('typed');
  });

  it('preserves successful typed practice but prevents spoken mastery contamination', () => {
    for (const mode of ['typed', 'mixed', 'none'] as const) {
      const evidence = classifySynonymRoundEvidence({
        inputMode: mode,
        completionReason: 'timer',
        difficulty: 5,
        matchCount: 7,
      });
      expect(evidence.practiceSuccessful).toBe(true);
      expect(evidence.requiredMatches).toBe(4);
      expect(evidence.clinicalProgressionEligible).toBe(false);
      expect(evidence.verifiedSpokenScoreEligible).toBe(false);
      expect(evidence.trialMode).toBe('mixed');
      expect(routeTrialMode('synonym-generator', evidence.trialMode)).toBe('excluded');
    }
  });

  it('records short spoken practice without treating Done early as a complete timed probe', () => {
    const evidence = classifySynonymRoundEvidence({
      inputMode: 'spoken',
      completionReason: 'early',
      difficulty: 7,
      matchCount: 6,
    });
    expect(evidence.practiceSuccessful).toBe(true);
    expect(evidence.clinicalProgressionEligible).toBe(false);
    expect(evidence.verifiedSpokenScoreEligible).toBe(false);
    expect(evidence.trialMode).toBe('mixed');
    expect(routeTrialMode('synonym-generator', evidence.trialMode)).toBe('excluded');
  });

  it('includes full spoken rounds as correctly differentiated positive or negative trials', () => {
    const correct = classifySynonymRoundEvidence({
      inputMode: 'spoken', completionReason: 'timer', difficulty: 6, matchCount: 4,
    });
    const incorrect = classifySynonymRoundEvidence({
      inputMode: 'spoken', completionReason: 'timer', difficulty: 6, matchCount: 2,
    });
    expect(correct).toMatchObject({
      trialMode: 'production',
      clinicalProgressionEligible: true,
      verifiedSpokenScoreEligible: true,
      practiceSuccessful: true,
      requiredMatches: 4,
    });
    expect(incorrect).toMatchObject({
      trialMode: 'production',
      clinicalProgressionEligible: true,
      verifiedSpokenScoreEligible: true,
      practiceSuccessful: false,
      requiredMatches: 4,
    });
    expect(routeTrialMode('synonym-generator', correct.trialMode)).toBe('expressive');
  });

  it('does not treat silence or missing numeric matches as a clinically verified failure', () => {
    expect(classifySynonymRoundEvidence({
      inputMode: 'none', completionReason: 'timer', difficulty: 3, matchCount: 0,
    })).toMatchObject({ trialMode: 'mixed', clinicalProgressionEligible: false });
    expect(classifySynonymRoundEvidence({
      inputMode: 'spoken', completionReason: 'timer', difficulty: 3, matchCount: Number.NaN,
    })).toMatchObject({ practiceSuccessful: false, clinicalProgressionEligible: false });
    expect(classifySynonymRoundEvidence({
      inputMode: 'spoken', completionReason: 'timer', difficulty: Number.NaN, matchCount: 5,
    })).toMatchObject({ clinicalProgressionEligible: false, verifiedSpokenScoreEligible: false });
  });
});
