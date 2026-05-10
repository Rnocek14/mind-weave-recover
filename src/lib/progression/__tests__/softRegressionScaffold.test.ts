import { describe, it, expect } from 'vitest';
import {
  clinicalLevelToEngineFloor,
  resolveEffectiveInitialDifficulty,
} from '../photoNamingDifficultyBridge';
import {
  clinicalLevelToFixSentenceEngineFloor,
  resolveEffectiveFixSentenceInitialDifficulty,
} from '../fixSentenceDifficultyBridge';

describe('Soft regression scaffolding (PhotoNaming bridge)', () => {
  it('does nothing when supportBaseline < 2', () => {
    expect(clinicalLevelToEngineFloor(5, 0)).toBe(6);
    expect(clinicalLevelToEngineFloor(5, 1)).toBe(6);
  });

  it('lowers floor by 1 when supportBaseline >= 2', () => {
    expect(clinicalLevelToEngineFloor(5, 2)).toBe(5);
    expect(clinicalLevelToEngineFloor(5, 3)).toBe(5);
  });

  it('clamps to engine floor 1', () => {
    expect(clinicalLevelToEngineFloor(1, 5)).toBe(1);
  });

  it('exposes softRegressionScaffold flag', () => {
    const noScaffold = resolveEffectiveInitialDifficulty({
      sessionAdaptationDifficulty: 1,
      clinicalLevel: 5,
      supportBaseline: 0,
    });
    expect(noScaffold.softRegressionScaffold).toBe(false);
    expect(noScaffold.effective).toBe(6);

    const scaffolded = resolveEffectiveInitialDifficulty({
      sessionAdaptationDifficulty: 1,
      clinicalLevel: 5,
      supportBaseline: 2,
    });
    expect(scaffolded.softRegressionScaffold).toBe(true);
    expect(scaffolded.effective).toBe(5);
  });

  it('is backward compatible when supportBaseline is omitted', () => {
    const r = resolveEffectiveInitialDifficulty({
      sessionAdaptationDifficulty: 1,
      clinicalLevel: 5,
    });
    expect(r.softRegressionScaffold).toBe(false);
    expect(r.effective).toBe(6);
  });
});

describe('Soft regression scaffolding (FixSentence bridge)', () => {
  it('lowers floor by 1 when supportBaseline >= 2', () => {
    expect(clinicalLevelToFixSentenceEngineFloor(5, 0)).toBe(6);
    expect(clinicalLevelToFixSentenceEngineFloor(5, 2)).toBe(5);
  });

  it('clamps to engine floor 1', () => {
    expect(clinicalLevelToFixSentenceEngineFloor(1, 5)).toBe(1);
  });

  it('exposes softRegressionScaffold flag', () => {
    const r = resolveEffectiveFixSentenceInitialDifficulty({
      sessionAdaptationDifficulty: 1,
      clinicalLevel: 5,
      supportBaseline: 2,
    });
    expect(r.softRegressionScaffold).toBe(true);
    expect(r.effective).toBe(5);
  });
});
