import { describe, expect, it } from 'vitest';
import { evaluateDualLoadNamingEvidence, DUAL_LOAD_NAMING_GATE, DUAL_LOAD_RECALL_GATE } from './clinicalEvidence';
import { routeTrialMode } from '@/lib/mastery/masterySignalRouting';

const naming = (correctCount: number, total = 5) =>
  Array.from({ length: total }, (_, i) => ({
    targetWord: `word-${i}`,
    userResponse: i < correctCount ? `word-${i}` : `other-${i}`,
    correct: i < correctCount,
  }));

describe('Dual-Load Naming: mixed cognition and speech cannot inflate independent language recovery', () => {
  it('preserves existing combined naming AND memory success gates', () => {
    expect(DUAL_LOAD_NAMING_GATE).toBe(0.6);
    expect(DUAL_LOAD_RECALL_GATE).toBe(0.67);
    const good = evaluateDualLoadNamingEvidence({
      namingAccuracy: 0.6, recallAccuracy: 1, namingAttempts: naming(3),
    });
    expect(good).toMatchObject({
      practiceSuccessful: true,
      clinicalProgressionEligible: true,
      namingInputMode: 'spoken',
      recallInputMode: 'typed',
      trialMode: 'mixed',
      verifiedExpressiveMasteryEligible: false,
      unscorableReason: null,
      scorableSpokenNamingAttempts: 5,
    });
    expect(routeTrialMode('dual-load-naming', good.trialMode)).toBe('excluded');
  });

  it('never treats typed recall alone as successful expressive naming', () => {
    const poorNaming = evaluateDualLoadNamingEvidence({
      namingAccuracy: 0, recallAccuracy: 1, namingAttempts: naming(0),
    });
    expect(poorNaming).toMatchObject({
      practiceSuccessful: false,
      clinicalProgressionEligible: true,
      trialMode: 'mixed',
    });
    const poorRecall = evaluateDualLoadNamingEvidence({
      namingAccuracy: 0.8, recallAccuracy: 1 / 3, namingAttempts: naming(4),
    });
    expect(poorRecall.practiceSuccessful).toBe(false);
    // Historical .67 cutoff does not equal an exact 2/3; do not silently
    // change a clinical threshold without a clinician-approved version bump.
    const borderline = evaluateDualLoadNamingEvidence({
      namingAccuracy: 0.8, recallAccuracy: 2 / 3, namingAttempts: naming(4),
    });
    expect(borderline.practiceSuccessful).toBe(false);
  });

  it('excludes no-mic, skipped, filler-only or inconsistent speech from clinical level movement', () => {
    const base = {
      namingAccuracy: 0.6,
      recallAccuracy: 1,
      namingAttempts: naming(3),
    };
    expect(evaluateDualLoadNamingEvidence({
      ...base, namingAttempts: [],
    })).toMatchObject({
      clinicalProgressionEligible: false,
      unscorableReason: 'naming_attempts_unavailable',
    });
    expect(evaluateDualLoadNamingEvidence({
      ...base, namingAttempts: [{ targetWord: 'cat', userResponse: '', correct: false }],
    })).toMatchObject({
      clinicalProgressionEligible: false,
      unscorableReason: 'missing_or_filler_speech',
      scorableSpokenNamingAttempts: 0,
    });
    expect(evaluateDualLoadNamingEvidence({
      ...base, namingAttempts: [{ targetWord: 'cat', userResponse: 'um', correct: false }],
    })).toMatchObject({
      clinicalProgressionEligible: false,
      unscorableReason: 'missing_or_filler_speech',
      scorableSpokenNamingAttempts: 0,
    });
    expect(evaluateDualLoadNamingEvidence({
      ...base, namingAccuracy: 1,
    })).toMatchObject({
      clinicalProgressionEligible: false,
      unscorableReason: 'inconsistent_naming_score',
    });
    expect(evaluateDualLoadNamingEvidence({
      ...base, recallAccuracy: Number.NaN,
    })).toMatchObject({
      clinicalProgressionEligible: false,
      unscorableReason: 'invalid_metrics',
    });
  });
});
