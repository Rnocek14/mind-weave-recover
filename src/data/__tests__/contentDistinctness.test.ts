/**
 * Content Distinctness Audit (test-as-tool)
 *
 * Verifies that after the cumulative-filter fix, the FixSentence and
 * DescribeGuess banks produce BAND-ISOLATED pools.
 *
 * IMPORTANT: `difficulty` passed to the selectors is now treated as the
 * engine level (1..10). The selector centrally maps:
 *   engine 1..3  → tier 1
 *   engine 4..7  → tier 2
 *   engine 8..10 → tier 3
 * To prove tier isolation, we probe at engine levels 1, 5, and 10.
 */
import { describe, it, expect } from 'vitest';
import { getFixSentenceTrials } from '@/data/fixSentenceBank';
import { getDescribeGuessTrials } from '@/data/describeGuessBank';

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
  it('logs pool composition per engine level', () => {
    summarize('engine L1 (→ tier 1)', getFixSentenceTrials({ difficulty: 1, count: 10 }));
    summarize('engine L5 (→ tier 2)', getFixSentenceTrials({ difficulty: 5, count: 10 }));
    summarize('engine L10 (→ tier 3)', getFixSentenceTrials({ difficulty: 10, count: 10 }));
  });

  it('engine L1 (count=10) is exclusively tier 1', () => {
    const small = getFixSentenceTrials({ difficulty: 1, count: 10 });
    expect(small.every(t => t.difficulty === 1)).toBe(true);
  });

  it('engine L5 (count=10) is exclusively tier 2', () => {
    const small = getFixSentenceTrials({ difficulty: 5, count: 10 });
    expect(small.every(t => t.difficulty === 2)).toBe(true);
  });

  it('engine L10 (count=10) is exclusively tier 3', () => {
    const small = getFixSentenceTrials({ difficulty: 10, count: 10 });
    expect(small.every(t => t.difficulty === 3)).toBe(true);
  });

  it('engine L1 vs L5 vs L10 pools are pairwise disjoint (Jaccard = 0)', () => {
    const A = new Set(getFixSentenceTrials({ difficulty: 1, count: 10 }).map(t => t.id));
    const B = new Set(getFixSentenceTrials({ difficulty: 5, count: 10 }).map(t => t.id));
    const C = new Set(getFixSentenceTrials({ difficulty: 10, count: 10 }).map(t => t.id));
    const ab = jaccard(A, B), ac = jaccard(A, C), bc = jaccard(B, C);
    // eslint-disable-next-line no-console
    console.log(`  Jaccard L1↔L5=${ab.toFixed(2)} L1↔L10=${ac.toFixed(2)} L5↔L10=${bc.toFixed(2)}`);
    expect(ab).toBe(0);
    expect(ac).toBe(0);
    expect(bc).toBe(0);
  });

  it('engine L4 and L7 both resolve to tier 2 (denser pool after L4–L10 expansion: ~20 trials)', () => {
    const a = getFixSentenceTrials({ difficulty: 4, count: 10 });
    const b = getFixSentenceTrials({ difficulty: 7, count: 10 });
    expect(a.every(t => t.difficulty === 2)).toBe(true);
    expect(b.every(t => t.difficulty === 2)).toBe(true);
  });

  it('each tier now has ≥20 trials after FixSentence L1–L10 expansion', () => {
    const t1 = getFixSentenceTrials({ difficulty: 1, count: 100 }).filter(t => t.difficulty === 1);
    const t2 = getFixSentenceTrials({ difficulty: 5, count: 100 }).filter(t => t.difficulty === 2);
    const t3 = getFixSentenceTrials({ difficulty: 10, count: 100 }).filter(t => t.difficulty === 3);
    // eslint-disable-next-line no-console
    console.log(`  FixSentence tier sizes: T1=${t1.length} T2=${t2.length} T3=${t3.length}`);
    expect(t1.length).toBeGreaterThanOrEqual(20);
    expect(t2.length).toBeGreaterThanOrEqual(20);
    expect(t3.length).toBeGreaterThanOrEqual(20);
  });

  it('mid-session re-pool from L1 to L8 returns 100% new tier-3 trials', () => {
    const played = getFixSentenceTrials({ difficulty: 1, count: 5 });
    const next = getFixSentenceTrials({ difficulty: 8, count: 5 });
    const playedIds = new Set(played.map(t => t.id));
    expect(next.filter(t => playedIds.has(t.id)).length).toBe(0);
    expect(next.every(t => t.difficulty === 3)).toBe(true);
  });
});

describe('Content distinctness — DescribeGuess', () => {
  it('logs pool composition per engine level', () => {
    summarize('engine L1 (→ tier 1)', getDescribeGuessTrials({ difficulty: 1, count: 8 }));
    summarize('engine L5 (→ tier 2)', getDescribeGuessTrials({ difficulty: 5, count: 8 }));
    summarize('engine L10 (→ tier 3)', getDescribeGuessTrials({ difficulty: 10, count: 8 }));
  });

  it('engine L1 (count=8) is exclusively tier 1', () => {
    const small = getDescribeGuessTrials({ difficulty: 1, count: 8 });
    expect(small.every(t => t.difficulty === 1)).toBe(true);
  });

  it('engine L5 (count=8) is exclusively tier 2 after L4–L7 expansion', () => {
    // After tier-2 expansion (banana, basket, glove, lemon, frog) the playable
    // tier-2 pool is large enough to satisfy count=8 from the tier alone.
    const small = getDescribeGuessTrials({ difficulty: 5, count: 8 });
    expect(small.every(t => t.difficulty === 2)).toBe(true);
  });

  it('each playable tier now has ≥8 trials after DescribeGuess L1–L10 expansion', () => {
    const t1 = getDescribeGuessTrials({ difficulty: 1, count: 100 }).filter(t => t.difficulty === 1);
    const t2 = getDescribeGuessTrials({ difficulty: 5, count: 100 }).filter(t => t.difficulty === 2);
    const t3 = getDescribeGuessTrials({ difficulty: 10, count: 100 }).filter(t => t.difficulty === 3);
    // eslint-disable-next-line no-console
    console.log(`  DescribeGuess playable tier sizes: T1=${t1.length} T2=${t2.length} T3=${t3.length}`);
    expect(t1.length).toBeGreaterThanOrEqual(8);
    expect(t2.length).toBeGreaterThanOrEqual(8);
    expect(t3.length).toBeGreaterThanOrEqual(8);
  });

  it('engine L10 (count=8) contains tier-3 trials and ZERO tier-1 leak', () => {
    const small = getDescribeGuessTrials({ difficulty: 10, count: 8 });
    expect(small.some(t => t.difficulty === 3)).toBe(true);
    expect(small.every(t => t.difficulty !== 1)).toBe(true);
  });

  it('engine L1 vs L5 pools are disjoint (no easy↔medium overlap)', () => {
    const A = new Set(getDescribeGuessTrials({ difficulty: 1, count: 8 }).map(t => t.id));
    const B = new Set(getDescribeGuessTrials({ difficulty: 5, count: 8 }).map(t => t.id));
    expect(jaccard(A, B)).toBe(0);
  });

  it('engine L1 vs L10 pools are disjoint (no easy/hard cross-contamination)', () => {
    const A = new Set(getDescribeGuessTrials({ difficulty: 1, count: 8 }).map(t => t.id));
    const C = new Set(getDescribeGuessTrials({ difficulty: 10, count: 8 }).map(t => t.id));
    expect(jaccard(A, C)).toBe(0);
  });

  it('mid-session re-pool from L1 to L9 returns 100% new trials with NO tier-1 leak', () => {
    const played = getDescribeGuessTrials({ difficulty: 1, count: 5 });
    const next = getDescribeGuessTrials({ difficulty: 9, count: 5 });
    const playedIds = new Set(played.map(t => t.id));
    expect(next.filter(t => playedIds.has(t.id)).length).toBe(0);
    expect(next.every(t => t.difficulty !== 1)).toBe(true);
  });
});
