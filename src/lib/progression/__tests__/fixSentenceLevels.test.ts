import { describe, it, expect } from 'vitest';
import {
  evidenceMetForFixSentenceLevel,
  calculateFixSentenceProgressDelta,
  isOnTargetFixSentenceTrial,
  getFixSentenceLevelSpec,
} from '../fixSentenceLevels';
import {
  clinicalLevelToFixSentenceEngineFloor,
  resolveEffectiveFixSentenceInitialDifficulty,
} from '../fixSentenceDifficultyBridge';

describe('fixSentenceLevels — on-target evidence semantics', () => {
  it('L1 accepts highlight_plus_choice as on-target', () => {
    expect(isOnTargetFixSentenceTrial({ support: 'highlight_plus_choice' }, 1)).toBe(true);
    expect(isOnTargetFixSentenceTrial({ support: 'open_response' }, 1)).toBe(true);
  });

  it('L3+ requires open_response (not choice_based)', () => {
    expect(isOnTargetFixSentenceTrial({ support: 'choice_based' }, 3)).toBe(false);
    expect(isOnTargetFixSentenceTrial({ support: 'open_response' }, 3)).toBe(true);
  });

  it('evidenceMet false when below min on-target attempts', () => {
    const trials = Array.from({ length: 2 }, () => ({
      correct: true, support: 'open_response' as const,
    }));
    expect(evidenceMetForFixSentenceLevel(trials, 3)).toBe(false);
  });

  it('evidenceMet true at L3 with 4 open-response corrects', () => {
    const trials = Array.from({ length: 4 }, () => ({
      correct: true, support: 'open_response' as const,
    }));
    expect(evidenceMetForFixSentenceLevel(trials, 3)).toBe(true);
  });

  it('scaffolded-only session cannot graduate L3', () => {
    const trials = Array.from({ length: 8 }, () => ({
      correct: true, support: 'choice_based' as const,
    }));
    expect(evidenceMetForFixSentenceLevel(trials, 3)).toBe(false);
  });

  it('L8 demands 85% accuracy across ≥6 on-target trials', () => {
    const spec = getFixSentenceLevelSpec(8);
    expect(spec.minOnTargetAttempts).toBe(6);
    expect(spec.minOnTargetAccuracy).toBeCloseTo(0.85);
  });
});

describe('calculateFixSentenceProgressDelta', () => {
  it('on-target correct earns more than below-target correct', () => {
    const onTarget = calculateFixSentenceProgressDelta(
      [{ correct: true, support: 'open_response' }], 3,
    );
    const belowTarget = calculateFixSentenceProgressDelta(
      [{ correct: true, support: 'choice_based' }], 3,
    );
    expect(onTarget).toBeGreaterThan(belowTarget);
  });

  it('incorrect trials contribute zero', () => {
    const d = calculateFixSentenceProgressDelta(
      [{ correct: false, support: 'open_response' }], 3,
    );
    expect(d).toBe(0);
  });
});

describe('clinicalLevelToFixSentenceEngineFloor — bridge', () => {
  it('crosses tier breakpoints (1→T1, 4→T2, 7→T3)', () => {
    expect(clinicalLevelToFixSentenceEngineFloor(1)).toBe(1);
    expect(clinicalLevelToFixSentenceEngineFloor(3)).toBe(3); // top of Tier 1
    expect(clinicalLevelToFixSentenceEngineFloor(4)).toBe(4); // Tier 2
    expect(clinicalLevelToFixSentenceEngineFloor(7)).toBe(8); // Tier 3
    expect(clinicalLevelToFixSentenceEngineFloor(8)).toBe(9);
  });

  it('clamps null / out-of-range', () => {
    expect(clinicalLevelToFixSentenceEngineFloor(null)).toBe(1);
    expect(clinicalLevelToFixSentenceEngineFloor(99)).toBe(9);
    expect(clinicalLevelToFixSentenceEngineFloor(0)).toBe(1);
  });
});

describe('resolveEffectiveFixSentenceInitialDifficulty', () => {
  it('raises adaptation start to clinical floor when below', () => {
    const r = resolveEffectiveFixSentenceInitialDifficulty({
      sessionAdaptationDifficulty: 1, clinicalLevel: 5,
    });
    expect(r.clinicalFloor).toBe(6);
    expect(r.effective).toBe(6);
    expect(r.raised).toBe(true);
  });

  it('respects higher session adaptation start', () => {
    const r = resolveEffectiveFixSentenceInitialDifficulty({
      sessionAdaptationDifficulty: 8, clinicalLevel: 2,
    });
    expect(r.effective).toBe(8);
    expect(r.raised).toBe(false);
  });
});
