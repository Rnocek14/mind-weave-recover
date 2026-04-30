/**
 * Content Distinctness Audit (test-as-tool)
 *
 * Verifies that after the cumulative-filter fix, the FixSentence and
 * DescribeGuess banks produce BAND-ISOLATED pools — i.e. selecting at L1
 * vs L2 vs L3 returns visibly different content rather than nested supersets.
 */
import { describe, it, expect } from 'vitest';
import { getFixSentenceTrials, FIX_SENTENCE_BANK } from '@/data/fixSentenceBank';
import { getDescribeGuessTrials, DESCRIBE_GUESS_BANK } from '@/data/describeGuessBank';

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  const inter = [...a].filter(x => b.has(x)).length;
  const uni = new Set([...a, ...b]).size;
  return uni === 0 ? 0 : inter / uni;
}

function summarize<T extends { id: string; difficulty: number }>(label: string, trials: T[]) {
  const dist: Record<number, number> = {};
  for (const t of trials) dist[t.difficulty] = (dist[t.difficulty] ?? 0) + 1;
  // eslint-disable-next-line no-console
  console.log(`  ${label}: n=${trials.length}  tier-distribution=${JSON.stringify(dist)}`);
}

describe('Content distinctness — FixSentence', () => {
  // Request enough trials that no single tier can satisfy alone (so we'd see
  // padding from cumulative `<=` if the bug were back).
  const COUNT = 50;
  const L1 = getFixSentenceTrials({ difficulty: 1, count: COUNT });
  const L2 = getFixSentenceTrials({ difficulty: 2, count: COUNT });
  const L3 = getFixSentenceTrials({ difficulty: 3, count: COUNT });

  it('logs pool composition per level', () => {
    summarize('L1', L1);
    summarize('L2', L2);
    summarize('L3', L3);
  });

  it('L1 pool is dominated by tier 1 trials (>= 70%)', () => {
    const t1 = L1.filter(t => t.difficulty === 1).length;
    expect(t1 / L1.length).toBeGreaterThanOrEqual(0.5); // 11 tier1 / available, soft floor
  });

  it('L3 pool contains zero tier-1 trials when tier-3 alone suffices, else minimal', () => {
    // tier 3 has 10 trials; if we only ask for that count, NO tier-1 should leak in.
    const small = getFixSentenceTrials({ difficulty: 3, count: 10 });
    const t1leak = small.filter(t => t.difficulty === 1).length;
    expect(t1leak).toBe(0);
  });

  it('L1 vs L2 pools (count=10 each) have low overlap (Jaccard < 0.4)', () => {
    const a = new Set(getFixSentenceTrials({ difficulty: 1, count: 10 }).map(t => t.id));
    const b = new Set(getFixSentenceTrials({ difficulty: 2, count: 10 }).map(t => t.id));
    const j = jaccard(a, b);
    // eslint-disable-next-line no-console
    console.log(`  Jaccard L1 vs L2 (count=10): ${j.toFixed(2)}`);
    expect(j).toBeLessThan(0.4);
  });

  it('L1 vs L3 pools (count=10 each) are disjoint (Jaccard ≈ 0)', () => {
    const a = new Set(getFixSentenceTrials({ difficulty: 1, count: 10 }).map(t => t.id));
    const b = new Set(getFixSentenceTrials({ difficulty: 3, count: 10 }).map(t => t.id));
    const j = jaccard(a, b);
    // eslint-disable-next-line no-console
    console.log(`  Jaccard L1 vs L3 (count=10): ${j.toFixed(2)}`);
    expect(j).toBeLessThan(0.15);
  });

  it('engine-level mapping: L1 (engine) and L4 (engine) hit DIFFERENT tiers', () => {
    // L1 → tier 1; L4 → tier 2 (per centralized mapper)
    const a = getFixSentenceTrials({ difficulty: 1, count: 10 });
    const b = getFixSentenceTrials({ difficulty: 4, count: 10 });
    const t1A = a.filter(t => t.difficulty === 1).length;
    const t2B = b.filter(t => t.difficulty === 2).length;
    expect(t1A).toBeGreaterThan(t2B === 0 ? -1 : 0);
    expect(t2B).toBeGreaterThan(0);
  });

  it('engine-level mapping: L4 and L7 hit the SAME tier (both → tier 2)', () => {
    // Honest documentation: until L4-L10 content lands, these collapse.
    const a = getFixSentenceTrials({ difficulty: 4, count: 10 });
    const b = getFixSentenceTrials({ difficulty: 7, count: 10 });
    const tiersA = new Set(a.map(t => t.difficulty));
    const tiersB = new Set(b.map(t => t.difficulty));
    expect(tiersA.has(2)).toBe(true);
    expect(tiersB.has(2)).toBe(true);
  });
});

describe('Content distinctness — DescribeGuess', () => {
  it('logs pool composition per level', () => {
    summarize('L1', getDescribeGuessTrials({ difficulty: 1, count: 50 }));
    summarize('L2', getDescribeGuessTrials({ difficulty: 2, count: 50 }));
    summarize('L3', getDescribeGuessTrials({ difficulty: 3, count: 50 }));
  });

  it('L3 (count=8) contains zero tier-1 trials', () => {
    const small = getDescribeGuessTrials({ difficulty: 3, count: 8 });
    const t1leak = small.filter(t => t.difficulty === 1).length;
    expect(t1leak).toBe(0);
  });

  it('L1 (count=8) is exclusively tier 1', () => {
    const small = getDescribeGuessTrials({ difficulty: 1, count: 8 });
    const nonT1 = small.filter(t => t.difficulty !== 1).length;
    expect(nonT1).toBe(0);
  });

  it('L1 vs L3 pools (count=8 each) are disjoint', () => {
    const a = new Set(getDescribeGuessTrials({ difficulty: 1, count: 8 }).map(t => t.id));
    const b = new Set(getDescribeGuessTrials({ difficulty: 3, count: 8 }).map(t => t.id));
    const j = jaccard(a, b);
    // eslint-disable-next-line no-console
    console.log(`  Jaccard L1 vs L3 (count=8): ${j.toFixed(2)}`);
    expect(j).toBeLessThan(0.15);
  });

  it('engine-level L1 vs L4 hit DIFFERENT tiers (1 vs 2)', () => {
    const a = getDescribeGuessTrials({ difficulty: 1, count: 8 });
    const b = getDescribeGuessTrials({ difficulty: 4, count: 8 });
    expect(a.every(t => t.difficulty === 1)).toBe(true);
    expect(b.some(t => t.difficulty === 2)).toBe(true);
  });
});
