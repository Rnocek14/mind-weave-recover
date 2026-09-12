/**
 * Every engine level must yield playable phonological content.
 *
 * The bank carries difficulties 1–5, but the clinical bridge and the in-session
 * controller both speak the universal 1–10 engine scale. `getMixedTrials` used
 * to filter on the raw number, so an engine level of 7 or above matched nothing
 * and returned an empty pool: a patient promoted to clinical L6 opened the
 * exercise to a blank screen with no way to finish or record the session, and
 * an escalation past 6 swapped nothing while the UI announced a level-up.
 */
import { describe, it, expect } from 'vitest';
import { getMixedTrials, mapEngineLevelToPhonoBankDifficulty } from '@/data/phonologicalBank';

describe('phonological bank — engine scale', () => {
  it('never returns an empty pool for any engine level', () => {
    for (let level = 1; level <= 10; level++) {
      const trials = getMixedTrials(level, 10);
      expect(trials.length, `engine level ${level} produced no trials`).toBeGreaterThan(0);
    }
  });

  it('collapses the 1-10 engine scale onto the 1-5 bank without inverting it', () => {
    const mapped = Array.from({ length: 10 }, (_, i) => mapEngineLevelToPhonoBankDifficulty(i + 1));
    expect(mapped).toEqual([1, 2, 3, 4, 5, 5, 5, 5, 5, 5]);
    for (let i = 1; i < mapped.length; i++) {
      expect(mapped[i]).toBeGreaterThanOrEqual(mapped[i - 1]);
    }
  });

  it('does not soften any level that already worked', () => {
    // Engine 1-5 must map to themselves; the only defect was the empty pool
    // above the bank's top difficulty.
    for (let level = 1; level <= 5; level++) {
      expect(mapEngineLevelToPhonoBankDifficulty(level)).toBe(level);
    }
  });

  it('keeps out-of-range input inside the bank', () => {
    expect(mapEngineLevelToPhonoBankDifficulty(0)).toBe(1);
    expect(mapEngineLevelToPhonoBankDifficulty(99)).toBe(5);
    expect(mapEngineLevelToPhonoBankDifficulty(NaN)).toBe(1);
  });

  it('serves harder content at the top of the ladder than at the bottom', () => {
    const easy = getMixedTrials(1, 30).map((t) => t.difficulty);
    const hard = getMixedTrials(9, 30).map((t) => t.difficulty);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(hard)).toBeGreaterThan(avg(easy));
  });
});
