import { describe, expect, it } from 'vitest';
import { classifyDualLoadCompositeEvidence, isDualLoadCombinedSuccess } from './compositeEvidence';
import { routeTrialMode } from '@/lib/mastery/masterySignalRouting';
import type { DualLoadTrialResult } from '@/hooks/useDualLoadNamingGame';

const trial = (overrides: Partial<DualLoadTrialResult> = {}): DualLoadTrialResult => ({
  setId: 'synthetic-set',
  namingAccuracy: 0.8,
  recallAccuracy: 2 / 3,
  namingAttempts: [
    { targetWord: 'apple', userResponse: 'apple', correct: true, reactionTimeMs: 1000 },
    { targetWord: 'dog', userResponse: 'dog', correct: true, reactionTimeMs: 1400 },
    { targetWord: 'chair', userResponse: 'chair', correct: true, reactionTimeMs: 1700 },
  ],
  recalledWords: ['pen', 'door'],
  interferenceIndex: 0.1,
  durationMs: 20000,
  depthTelemetry: {
    taskType: 'dual_load_naming',
    namingAccuracy: 0.8,
    recallAccuracy: 2 / 3,
    interferenceIndex: 0.1,
    baselineSource: 'heuristic',
    baselineAcc: 0.9,
  },
  ...overrides,
});

describe('Dual-Load Naming combined speech/typed memory evidence', () => {
  it('uses the existing GAME criterion rather than the page previous recall-only 1-of-3 rule', () => {
    expect(isDualLoadCombinedSuccess(trial({ namingAccuracy: 0.8, recallAccuracy: 0.34 }))).toBe(false);
    expect(isDualLoadCombinedSuccess(trial({ namingAccuracy: 0.5, recallAccuracy: 1 }))).toBe(false);
    expect(isDualLoadCombinedSuccess(trial({ namingAccuracy: 0.6, recallAccuracy: 0.67 }))).toBe(true);
    expect(isDualLoadCombinedSuccess(trial({ namingAccuracy: Number.NaN, recallAccuracy: 1 }))).toBe(false);
  });

  it('tracks spoken naming and typed recall separately and never credits composite as expressive production', () => {
    const evidence = classifyDualLoadCompositeEvidence(trial({ recallAccuracy: 1 }));
    expect(evidence).toMatchObject({
      combinedSuccess: true,
      clinicalProgressionEligible: true,
      trialMode: 'mixed',
      namingInputMode: 'browser_speech',
      recallInputMode: 'typed',
      namingAttemptCount: 3,
      scorableSpokenNamingAttempts: 3,
      skippedOrUnscorableNamingAttempts: 0,
    });
    expect(routeTrialMode('dual-load-naming', evidence.trialMode)).toBe('excluded');
  });

  it('retains all-skipped or filler-only practice but prevents unscorable mic failures from altering level', () => {
    const evidence = classifyDualLoadCompositeEvidence(trial({
      namingAccuracy: 0,
      recallAccuracy: 1,
      namingAttempts: [
        { targetWord: 'apple', userResponse: '', correct: false, reactionTimeMs: 1000 },
        { targetWord: 'dog', userResponse: 'um', correct: false, reactionTimeMs: 1000 },
        { targetWord: 'chair', userResponse: 'hmm', correct: false, reactionTimeMs: 1000 },
      ],
    }));
    expect(evidence).toMatchObject({
      combinedSuccess: false,
      clinicalProgressionEligible: false,
      trialMode: 'mixed',
      scorableSpokenNamingAttempts: 0,
      namingAttemptCount: 3,
      skippedOrUnscorableNamingAttempts: 3,
    });
  });

  it('does not interpret invalid/missing component accuracy as measurable clinical improvement', () => {
    expect(classifyDualLoadCompositeEvidence(trial({
      namingAccuracy: Number.NaN, recallAccuracy: 1,
    })).clinicalProgressionEligible).toBe(false);
    expect(classifyDualLoadCompositeEvidence(trial({
      namingAccuracy: 0.8, recallAccuracy: 2,
    })).clinicalProgressionEligible).toBe(false);
    expect(classifyDualLoadCompositeEvidence(trial({
      namingAccuracy: 1, recallAccuracy: 1, namingAttempts: [],
    })).clinicalProgressionEligible).toBe(false);
  });
});
