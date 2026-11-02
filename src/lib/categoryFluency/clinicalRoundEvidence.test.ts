import { describe, expect, it } from 'vitest';
import {
  COMPARABLE_FLUENCY_SECONDS,
  categoryTierIndexForDifficulty,
  classifyFluencyRoundEvidence,
  getFluencyCueLevel,
  getFluencyInputMode,
} from '../clinicalRoundEvidence';

describe('category-fluency clinical evidence constraints', () => {
  it('uses a fixed sixty-second comparison regardless of category tier', () => {
    expect(COMPARABLE_FLUENCY_SECONDS).toBe(60);
    expect(categoryTierIndexForDifficulty(1, 3)).toBe(0);
    expect(categoryTierIndexForDifficulty(2, 3)).toBe(0);
    expect(categoryTierIndexForDifficulty(3, 3)).toBe(1);
    expect(categoryTierIndexForDifficulty(4, 3)).toBe(1);
    expect(categoryTierIndexForDifficulty(5, 3)).toBe(2);
    expect(categoryTierIndexForDifficulty(10, 3)).toBe(2);
    expect(categoryTierIndexForDifficulty(Number.NaN, 3)).toBe(0);
    expect(categoryTierIndexForDifficulty(5, 0)).toBe(0);
  });

  it('counts actual visible examples as delivered support, including L1 defaults', () => {
    expect(getFluencyCueLevel(false, 0)).toBe(0);
    expect(getFluencyCueLevel(false, 99)).toBe(0);
    expect(getFluencyCueLevel(true, 0)).toBe(1);
    expect(getFluencyCueLevel(true, 1)).toBe(2);
    expect(getFluencyCueLevel(true, 4)).toBe(3);
    expect(getFluencyCueLevel(true, Number.NaN)).toBe(1);
  });

  it('does not confuse typed, mixed and recognized speech input modes', () => {
    expect(getFluencyInputMode(0, 0)).toBe('none');
    expect(getFluencyInputMode(2, 0)).toBe('spoken');
    expect(getFluencyInputMode(0, 2)).toBe('typed');
    expect(getFluencyInputMode(2, 1)).toBe('mixed');
    expect(getFluencyInputMode(Number.NaN, 1)).toBe('typed');
  });

  const classify = (mode: 'spoken' | 'typed' | 'mixed' | 'none', cueLevelUsed: number, timeLimitSec = 60, uniqueWordCount = 6) =>
    classifyFluencyRoundEvidence({ mode, cueLevelUsed, timeLimitSec, uniqueWordCount });

  it('treats unassisted spoken output as conditional expressive evidence', () => {
    expect(classify('spoken', 0)).toEqual({
      trialMode: 'production',
      clinicalProgressionEligible: true,
      independentSpoken: true,
    });
    expect(classify('spoken', 1)).toEqual({
      trialMode: 'scaffolded',
      clinicalProgressionEligible: true,
      independentSpoken: false,
    });
    expect(classify('spoken', 2)).toMatchObject({ trialMode: 'scaffolded', independentSpoken: false });
  });

  it('does not let typed, mixed, silent or noncomparable timed tasks advance spoken therapy', () => {
    for (const mode of ['typed', 'mixed', 'none'] as const) {
      const outcome = classify(mode, 0);
      expect(outcome.clinicalProgressionEligible, mode).toBe(false);
      expect(outcome.independentSpoken, mode).toBe(false);
      expect(outcome.trialMode, mode).toBe('mixed');
    }
    expect(classify('spoken', 0, 30)).toMatchObject({
      trialMode: 'production',
      clinicalProgressionEligible: false,
      independentSpoken: false,
    });
    expect(classify('spoken', 0, 60, 0)).toMatchObject({
      clinicalProgressionEligible: false,
      independentSpoken: false,
      trialMode: 'mixed',
    });
  });
});
