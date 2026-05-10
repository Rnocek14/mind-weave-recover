import { describe, it, expect } from 'vitest';
import {
  clinicalLevelToMinimalPairsEngineFloor,
  resolveEffectiveMinimalPairsInitialDifficulty,
  MINIMAL_PAIRS_SOFT_REGRESSION_SCAFFOLD_THRESHOLD,
} from '../minimalPairsDifficultyBridge';
import { mapMinimalPairsSupport } from '@/hooks/useMinimalPairsProgression';

describe('mapMinimalPairsSupport — replay-count → support-tier', () => {
  it('audioReplayCount 0 → first_listen', () => {
    expect(mapMinimalPairsSupport({ audioReplayCount: 0 })).toBe('first_listen');
  });

  it('audioReplayCount 1 → after_replay', () => {
    expect(mapMinimalPairsSupport({ audioReplayCount: 1 })).toBe('after_replay');
  });

  it('audioReplayCount 2 collapses to after_replay (after_multiple_replays not surfaced yet)', () => {
    expect(mapMinimalPairsSupport({ audioReplayCount: 2 })).toBe('after_replay');
    expect(mapMinimalPairsSupport({ audioReplayCount: 5 })).toBe('after_replay');
  });

  it('clamps negative / fractional inputs', () => {
    expect(mapMinimalPairsSupport({ audioReplayCount: -3 })).toBe('first_listen');
    expect(mapMinimalPairsSupport({ audioReplayCount: 0.4 })).toBe('first_listen');
    expect(mapMinimalPairsSupport({ audioReplayCount: 0.6 })).toBe('after_replay');
  });
});

describe('MinimalPairs bridge — clinical level → engine floor', () => {
  it('maps L1..L8 to engine 1..8 with no scaffolding', () => {
    for (let l = 1; l <= 8; l++) {
      expect(clinicalLevelToMinimalPairsEngineFloor(l, 0)).toBe(l);
    }
  });

  it('clamps unknown / invalid levels to 1', () => {
    expect(clinicalLevelToMinimalPairsEngineFloor(null)).toBe(1);
    expect(clinicalLevelToMinimalPairsEngineFloor(undefined)).toBe(1);
    expect(clinicalLevelToMinimalPairsEngineFloor(99)).toBe(8);
    expect(clinicalLevelToMinimalPairsEngineFloor(-1)).toBe(1);
  });
});

describe('MinimalPairs bridge — soft regression parity with PhotoNaming/FixSentence', () => {
  it('uses the same supportBaseline threshold (>= 2)', () => {
    expect(MINIMAL_PAIRS_SOFT_REGRESSION_SCAFFOLD_THRESHOLD).toBe(2);
  });

  it('does nothing when supportBaseline < threshold', () => {
    expect(clinicalLevelToMinimalPairsEngineFloor(5, 0)).toBe(5);
    expect(clinicalLevelToMinimalPairsEngineFloor(5, 1)).toBe(5);
  });

  it('lowers engine floor by exactly 1 step when supportBaseline >= threshold', () => {
    expect(clinicalLevelToMinimalPairsEngineFloor(5, 2)).toBe(4);
    expect(clinicalLevelToMinimalPairsEngineFloor(5, 3)).toBe(4);
    expect(clinicalLevelToMinimalPairsEngineFloor(8, 4)).toBe(7);
  });

  it('clamps to engine floor 1', () => {
    expect(clinicalLevelToMinimalPairsEngineFloor(1, 5)).toBe(1);
  });

  it('exposes softRegressionScaffold flag on resolveEffective…', () => {
    const noScaffold = resolveEffectiveMinimalPairsInitialDifficulty({
      sessionAdaptationDifficulty: 1,
      clinicalLevel: 5,
      supportBaseline: 0,
    });
    expect(noScaffold.softRegressionScaffold).toBe(false);
    expect(noScaffold.effective).toBe(5);

    const scaffolded = resolveEffectiveMinimalPairsInitialDifficulty({
      sessionAdaptationDifficulty: 1,
      clinicalLevel: 5,
      supportBaseline: 2,
    });
    expect(scaffolded.softRegressionScaffold).toBe(true);
    expect(scaffolded.effective).toBe(4);
  });

  it('is backward compatible when supportBaseline is omitted', () => {
    const r = resolveEffectiveMinimalPairsInitialDifficulty({
      sessionAdaptationDifficulty: 1,
      clinicalLevel: 5,
    });
    expect(r.softRegressionScaffold).toBe(false);
    expect(r.effective).toBe(5);
  });

  it('still honors session adaptation above the clinical floor', () => {
    const r = resolveEffectiveMinimalPairsInitialDifficulty({
      sessionAdaptationDifficulty: 7,
      clinicalLevel: 3,
      supportBaseline: 0,
    });
    expect(r.effective).toBe(7);
    expect(r.raised).toBe(false);
    expect(r.clinicalFloor).toBe(3);
  });
});
