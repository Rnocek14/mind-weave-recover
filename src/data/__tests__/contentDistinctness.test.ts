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
import { getTrialsForLevel as getPhraseTrials, mapEngineLevelToPhraseTier } from '@/data/phraseBank';
import { THOUGHT_PROMPTS, mapDiscourseLevelToPromptTier } from '@/data/thoughtPromptBank';
import { selectNextPrompt, createEmptySessionHistory } from '@/lib/adaptivePromptSelector';

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

describe('Content distinctness — PhrasePractice', () => {
  // Engine emits 1..10. The phrase bank has 5 motor-graded tiers.
  // Mapping: 1-2→T1, 3-4→T2, 5-6→T3, 7-8→T4, 9-10→T5.
  it('engine→tier mapping is monotonic across all 10 levels', () => {
    const tiers = [1,2,3,4,5,6,7,8,9,10].map(mapEngineLevelToPhraseTier);
    // eslint-disable-next-line no-console
    console.log(`  PhrasePractice engine→tier: ${tiers.join(' ')}`);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]);
    }
    expect(tiers[0]).toBe(1);
    expect(tiers[9]).toBe(5);
  });

  it('engine L1 (count=10) is exclusively tier 1', () => {
    const trials = getPhraseTrials(1, 10);
    expect(trials.every(t => t.difficulty === 1)).toBe(true);
  });

  it('engine L5 (count=10) is exclusively tier 3', () => {
    const trials = getPhraseTrials(5, 10);
    expect(trials.every(t => t.difficulty === 3)).toBe(true);
  });

  it('engine L8 (count=10) is exclusively tier 4', () => {
    const trials = getPhraseTrials(8, 10);
    expect(trials.every(t => t.difficulty === 4)).toBe(true);
  });

  it('engine L10 (count=10) is exclusively tier 5 — NO L6→L5 collapse anymore', () => {
    const trials = getPhraseTrials(10, 10);
    expect(trials.every(t => t.difficulty === 5)).toBe(true);
  });

  it('engine L1 vs L5 vs L10 pools are pairwise disjoint (Jaccard = 0)', () => {
    const A = new Set(getPhraseTrials(1, 10).map(t => t.id));
    const B = new Set(getPhraseTrials(5, 10).map(t => t.id));
    const C = new Set(getPhraseTrials(10, 10).map(t => t.id));
    const ab = jaccard(A, B), ac = jaccard(A, C), bc = jaccard(B, C);
    // eslint-disable-next-line no-console
    console.log(`  Jaccard L1↔L5=${ab.toFixed(2)} L1↔L10=${ac.toFixed(2)} L5↔L10=${bc.toFixed(2)}`);
    expect(ab).toBe(0);
    expect(ac).toBe(0);
    expect(bc).toBe(0);
  });

  it('every tier has ≥10 unique trials after L1–L10 expansion', () => {
    const sizes: Record<number, number> = {};
    for (const lvl of [1, 3, 5, 7, 10]) {
      const trials = getPhraseTrials(lvl, 200);
      sizes[mapEngineLevelToPhraseTier(lvl)] = new Set(trials.map(t => t.id)).size;
    }
    // eslint-disable-next-line no-console
    console.log(`  PhrasePractice tier sizes: ${JSON.stringify(sizes)}`);
    for (const tier of [1,2,3,4,5]) expect(sizes[tier]).toBeGreaterThanOrEqual(10);
  });

  it('mid-session re-pool from L1 to L9 returns 100% new tier-5 trials', () => {
    const played = getPhraseTrials(1, 5);
    const next = getPhraseTrials(9, 5);
    const playedIds = new Set(played.map(t => t.id));
    expect(next.filter(t => playedIds.has(t.id)).length).toBe(0);
    expect(next.every(t => t.difficulty === 5)).toBe(true);
  });
});

describe('Content distinctness — ThoughtContinuation', () => {
  // The discourse engine emits 1..5; the prompt bank has 3 graded tiers.
  // Mapping: 1-2→T1 (concrete recall), 3-4→T2 (structured expansion),
  // 5→T3 (abstract / multi-step discourse).
  function poolAtLevel(level: number, count: number) {
    const used: string[] = [];
    const out: any[] = [];
    const history = createEmptySessionHistory();
    while (out.length < count && used.length < THOUGHT_PROMPTS.length) {
      const sel = selectNextPrompt(null, history, used, level);
      out.push(sel.prompt);
      used.push(sel.prompt.id);
    }
    return out;
  }

  it('discourse→tier mapping is monotonic across all 5 levels', () => {
    const tiers = [1,2,3,4,5].map(mapDiscourseLevelToPromptTier);
    // eslint-disable-next-line no-console
    console.log(`  ThoughtContinuation discourse→tier: ${tiers.join(' ')}`);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]);
    }
    expect(tiers[0]).toBe(1);
    expect(tiers[4]).toBe(3);
  });

  it('discourse L1 pool is exclusively tier 1', () => {
    const pool = poolAtLevel(1, 8);
    expect(pool.every(p => p.difficultyTier === 1)).toBe(true);
  });

  it('discourse L3 pool is exclusively tier 2', () => {
    const pool = poolAtLevel(3, 8);
    expect(pool.every(p => p.difficultyTier === 2)).toBe(true);
  });

  it('discourse L5 pool is exclusively tier 3 — NO leakage from concrete recall', () => {
    const pool = poolAtLevel(5, 8);
    expect(pool.every(p => p.difficultyTier === 3)).toBe(true);
  });

  it('L1 vs L3 vs L5 pools are pairwise disjoint (Jaccard = 0)', () => {
    const A = new Set(poolAtLevel(1, 8).map(p => p.id));
    const B = new Set(poolAtLevel(3, 8).map(p => p.id));
    const C = new Set(poolAtLevel(5, 8).map(p => p.id));
    const ab = jaccard(A, B), ac = jaccard(A, C), bc = jaccard(B, C);
    // eslint-disable-next-line no-console
    console.log(`  Jaccard L1↔L3=${ab.toFixed(2)} L1↔L5=${ac.toFixed(2)} L3↔L5=${bc.toFixed(2)}`);
    expect(ab).toBe(0);
    expect(ac).toBe(0);
    expect(bc).toBe(0);
  });

  it('every tier has ≥10 unique prompts after T3 expansion', () => {
    const sizes = {
      T1: THOUGHT_PROMPTS.filter((p: any) => p.difficultyTier === 1 && p.isActive).length,
      T2: THOUGHT_PROMPTS.filter((p: any) => p.difficultyTier === 2 && p.isActive).length,
      T3: THOUGHT_PROMPTS.filter((p: any) => p.difficultyTier === 3 && p.isActive).length,
    };
    // eslint-disable-next-line no-console
    console.log(`  ThoughtContinuation tier sizes: ${JSON.stringify(sizes)}`);
    expect(sizes.T1).toBeGreaterThanOrEqual(10);
    expect(sizes.T2).toBeGreaterThanOrEqual(10);
    expect(sizes.T3).toBeGreaterThanOrEqual(10);
  });

  it('mid-session re-pool from L1 to L5 returns 100% new tier-3 prompts', () => {
    const played = poolAtLevel(1, 4);
    const playedIds = new Set(played.map(p => p.id));
    const next = poolAtLevel(5, 4);
    expect(next.filter(p => playedIds.has(p.id)).length).toBe(0);
    expect(next.every(p => p.difficultyTier === 3)).toBe(true);
  });
});
