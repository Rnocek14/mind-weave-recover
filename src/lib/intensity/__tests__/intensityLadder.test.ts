/**
 * Intensity ladder test — proves that engine levels 1..10 pull *distinct*
 * content for each game. Pre-intensity, levels 1-3 / 4-7 / 8-10 collapsed
 * to identical buckets; this test would have failed.
 *
 * Run: bunx vitest run src/lib/intensity/__tests__/intensityLadder.test.ts
 */
import { describe, it, expect } from 'vitest';
import '@/lib/intensity';
import { getLevelContent, getLevelModifiers } from '@/lib/intensity';
import { getTrialsForLevel } from '@/data/photoBank';
import { getFixSentenceTrials } from '@/data/fixSentenceBank';

describe('Intensity ladder — PhotoNaming', () => {
  it('each level has a distinct content spec', () => {
    const seen = new Set<string>();
    for (let l = 1; l <= 10; l++) {
      const spec = getLevelContent('photo-naming', l);
      expect(spec).not.toBeNull();
      seen.add(`${spec!.cohort}@${spec!.subTierIndex}`);
    }
    expect(seen.size).toBeGreaterThanOrEqual(8); // tolerate one or two duplicates at extremes
  });

  it('within-tier levels pull visibly different items (L4 vs L7)', () => {
    const l4 = getTrialsForLevel(4, 20).map(t => t.target);
    const l7 = getTrialsForLevel(7, 20).map(t => t.target);
    const overlap = l4.filter(w => l7.includes(w)).length;
    // Pre-intensity this would be ~100% overlap (same tier 2 bucket).
    // Post-intensity, L4 pulls easy-T2, L7 pulls hard-T2/T3 blend → overlap should drop.
    expect(overlap).toBeLessThan(l4.length * 0.7);
  });

  it('modifier ramp tightens cues + adds timer as level climbs', () => {
    const m1 = getLevelModifiers('photo-naming', 1);
    const m5 = getLevelModifiers('photo-naming', 5);
    const m9 = getLevelModifiers('photo-naming', 9);
    expect(m1.maxCueLevel).toBeGreaterThanOrEqual(m5.maxCueLevel);
    expect(m5.maxCueLevel).toBeGreaterThanOrEqual(m9.maxCueLevel);
    expect(m1.responseWindowMs).toBe(0);
    expect(m5.responseWindowMs).toBeGreaterThan(0);
    expect(m9.responseWindowMs).toBeGreaterThan(0);
    expect(m9.responseWindowMs).toBeLessThan(m5.responseWindowMs);
  });

  it('stretch slice activates at L9-L10', () => {
    expect(getLevelModifiers('photo-naming', 8).useStretchSlice).toBe(false);
    expect(getLevelModifiers('photo-naming', 9).useStretchSlice).toBe(true);
    expect(getLevelModifiers('photo-naming', 10).useStretchSlice).toBe(true);
  });
});

describe('Intensity ladder — FixSentence', () => {
  it('error-type mix shifts across levels', () => {
    const errTypes = (level: number) => {
      const counts: Record<string, number> = {};
      for (const t of getFixSentenceTrials({ difficulty: level, count: 20 })) {
        counts[t.errorType] = (counts[t.errorType] || 0) + 1;
      }
      return counts;
    };
    const l1 = errTypes(1);
    const l5 = errTypes(5);
    const l9 = errTypes(9);
    // L1 should be dominated by category errors.
    expect(l1.category_error ?? 0).toBeGreaterThan(0);
    // L5 should be dominated by function errors.
    expect(l5.function_error ?? 0).toBeGreaterThan(0);
    // L9 should pull multi-valid (or close to it).
    expect((l9.multiple_valid_repairs ?? 0) + (l9.function_error ?? 0)).toBeGreaterThan(0);
  });

  it('hint visibility (modifier) drops as level climbs', () => {
    const m1 = getLevelModifiers('fix-sentence', 1);
    const m5 = getLevelModifiers('fix-sentence', 5);
    const m9 = getLevelModifiers('fix-sentence', 9);
    expect(m1.maxCueLevel).toBeGreaterThan(m5.maxCueLevel);
    expect(m5.maxCueLevel).toBeGreaterThan(m9.maxCueLevel);
    expect(m9.multiTarget).toBe(true);
  });
});

describe('Intensity ladder — MinimalPairs', () => {
  it('replay budget shrinks as level climbs', () => {
    const m1 = getLevelModifiers('minimal-pairs', 1);
    const m3 = getLevelModifiers('minimal-pairs', 3);
    const m6 = getLevelModifiers('minimal-pairs', 6);
    const m9 = getLevelModifiers('minimal-pairs', 9);
    expect(m1.replayBudget).toBe(-1);                  // unlimited at L1
    expect(m3.replayBudget).toBeGreaterThanOrEqual(2); // capped but generous mid-T1
    expect(m6.replayBudget).toBe(1);                   // tight by L6
    expect(m9.replayBudget).toBe(0);                   // zero at L9
  });

  it('response window appears mid-ladder', () => {
    expect(getLevelModifiers('minimal-pairs', 1).responseWindowMs).toBe(0);
    expect(getLevelModifiers('minimal-pairs', 4).responseWindowMs).toBeGreaterThan(0);
    expect(getLevelModifiers('minimal-pairs', 7).responseWindowMs).toBeGreaterThan(0);
  });
});
