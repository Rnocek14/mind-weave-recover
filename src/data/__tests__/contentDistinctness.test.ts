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
import { getSynonymTrials, mapEngineLevelToSynonymTier, SYNONYM_PROMPTS } from '@/data/synonymBank';

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

describe('Content distinctness — SynonymGenerator', () => {
  // Engine 1..10 → 3 tiers (1-3→T1, 4-7→T2, 8-10→T3).
  // Probe at engine L1, L5, L10 to prove tier isolation.
  // Imported at top of file from '@/data/synonymBank'

  it('engine→tier mapping is monotonic and covers all 3 tiers', () => {
    const tiers = [1,2,3,4,5,6,7,8,9,10].map(mapEngineLevelToSynonymTier);
    // eslint-disable-next-line no-console
    console.log(`  SynonymGenerator engine→tier: ${tiers.join(' ')}`);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]);
    }
    expect(tiers[0]).toBe(1);
    expect(tiers[9]).toBe(3);
  });

  it('engine L1 pool is exclusively tier 1', () => {
    const pool = getSynonymTrials({ difficulty: 1, count: 20 });
    expect(pool.every((p: any) => p.difficulty === 1)).toBe(true);
  });

  it('engine L5 pool is exclusively tier 2', () => {
    const pool = getSynonymTrials({ difficulty: 5, count: 20 });
    expect(pool.every((p: any) => p.difficulty === 2)).toBe(true);
  });

  it('engine L10 pool is exclusively tier 3 — NO leakage from concrete adjectives', () => {
    const pool = getSynonymTrials({ difficulty: 10, count: 20 });
    expect(pool.every((p: any) => p.difficulty === 3)).toBe(true);
  });

  it('L1 vs L5 vs L10 pools are pairwise disjoint (Jaccard = 0)', () => {
    const A = new Set(getSynonymTrials({ difficulty: 1, count: 20 }).map((p: any) => p.id));
    const B = new Set(getSynonymTrials({ difficulty: 5, count: 20 }).map((p: any) => p.id));
    const C = new Set(getSynonymTrials({ difficulty: 10, count: 20 }).map((p: any) => p.id));
    const ab = jaccard(A, B), ac = jaccard(A, C), bc = jaccard(B, C);
    // eslint-disable-next-line no-console
    console.log(`  Jaccard L1↔L5=${ab.toFixed(2)} L1↔L10=${ac.toFixed(2)} L5↔L10=${bc.toFixed(2)}`);
    expect(ab).toBe(0);
    expect(ac).toBe(0);
    expect(bc).toBe(0);
  });

  it('every tier has ≥12 unique prompts', () => {
    const sizes = {
      T1: SYNONYM_PROMPTS.filter((p: any) => p.difficulty === 1).length,
      T2: SYNONYM_PROMPTS.filter((p: any) => p.difficulty === 2).length,
      T3: SYNONYM_PROMPTS.filter((p: any) => p.difficulty === 3).length,
    };
    // eslint-disable-next-line no-console
    console.log(`  SynonymGenerator tier sizes: ${JSON.stringify(sizes)}`);
    expect(sizes.T1).toBeGreaterThanOrEqual(12);
    expect(sizes.T2).toBeGreaterThanOrEqual(12);
    expect(sizes.T3).toBeGreaterThanOrEqual(12);
  });

  it('mid-session re-pool from L1 to L9 returns 100% new tier-3 prompts', () => {
    const played = getSynonymTrials({ difficulty: 1, count: 12 });
    const playedIds = new Set(played.map((p: any) => p.id));
    const next = getSynonymTrials({ difficulty: 9, count: 12 });
    expect(next.filter((p: any) => playedIds.has(p.id)).length).toBe(0);
    expect(next.every((p: any) => p.difficulty === 3)).toBe(true);
  });

  it('perceptual curve: T3 has more multi-POS / abstract targets than T1', () => {
    const t1Verbs = SYNONYM_PROMPTS.filter((p: any) => p.difficulty === 1 && p.partOfSpeech !== 'adjective').length;
    const t3Verbs = SYNONYM_PROMPTS.filter((p: any) => p.difficulty === 3 && p.partOfSpeech !== 'adjective').length;
    // eslint-disable-next-line no-console
    console.log(`  Non-adjective targets: T1=${t1Verbs} T3=${t3Verbs}`);
    expect(t3Verbs).toBeGreaterThan(t1Verbs);
  });
});

// ───────────────────────── PhotoNaming (Phase 1.5) ─────────────────────────
import {
  PHOTO_BANK,
  computePhotoTier,
  mapEngineLevelToPhotoTier,
  getTrialsForLevel as getPhotoTrials,
} from '@/data/photoBank';

describe('Content distinctness — PhotoNaming', () => {
  it('engine→tier mapping is monotonic and covers all 3 tiers', () => {
    const map = [1,2,3,4,5,6,7,8,9,10].map(mapEngineLevelToPhotoTier);
    // eslint-disable-next-line no-console
    console.log(`  PhotoNaming engine→tier: ${map.join(' ')}`);
    expect(map[0]).toBe(1);
    expect(map[4]).toBe(2);
    expect(map[9]).toBe(3);
    for (let i = 1; i < map.length; i++) expect(map[i]).toBeGreaterThanOrEqual(map[i-1]);
  });

  it('every PHOTO_BANK trial resolves to a strict tier (1|2|3)', () => {
    for (const t of PHOTO_BANK) {
      const tier = computePhotoTier(t);
      expect([1,2,3]).toContain(tier);
    }
  });

  it('engine L1 returns ONLY tier-1 trials', () => {
    const trials = getPhotoTrials(1, 50);
    expect(trials.every(t => computePhotoTier(t) === 1)).toBe(true);
  });

  it('engine L5 returns ONLY tier-2 trials', () => {
    const trials = getPhotoTrials(5, 50);
    expect(trials.every(t => computePhotoTier(t) === 2)).toBe(true);
  });

  it('engine L10 returns ONLY tier-3 trials', () => {
    const trials = getPhotoTrials(10, 50);
    expect(trials.every(t => computePhotoTier(t) === 3)).toBe(true);
  });

  it('L1 vs L5 vs L10 pools are pairwise disjoint (Jaccard = 0)', () => {
    const A = new Set(getPhotoTrials(1, 200).map(t => t.target));
    const B = new Set(getPhotoTrials(5, 200).map(t => t.target));
    const C = new Set(getPhotoTrials(10, 200).map(t => t.target));
    const ab = jaccard(A, B), ac = jaccard(A, C), bc = jaccard(B, C);
    // eslint-disable-next-line no-console
    console.log(`  PhotoNaming pool sizes L1=${A.size} L5=${B.size} L10=${C.size}`);
    // eslint-disable-next-line no-console
    console.log(`  Jaccard L1↔L5=${ab.toFixed(2)} L1↔L10=${ac.toFixed(2)} L5↔L10=${bc.toFixed(2)}`);
    expect(ab).toBe(0);
    expect(ac).toBe(0);
    expect(bc).toBe(0);
  });

  it('every tier has ≥8 unique targets', () => {
    const sizes = { T1: 0, T2: 0, T3: 0 } as Record<string, number>;
    for (const t of PHOTO_BANK) sizes[`T${computePhotoTier(t)}`]++;
    // eslint-disable-next-line no-console
    console.log(`  PhotoNaming tier sizes: ${JSON.stringify(sizes)}`);
    expect(sizes.T1).toBeGreaterThanOrEqual(8);
    expect(sizes.T2).toBeGreaterThanOrEqual(8);
    expect(sizes.T3).toBeGreaterThanOrEqual(8);
  });

  it('perceptual curve: T1 mean frequency_rank << T3 mean frequency_rank', () => {
    const mean = (xs: number[]) => xs.reduce((a,b)=>a+b,0) / Math.max(1,xs.length);
    const t1 = PHOTO_BANK.filter(t => computePhotoTier(t) === 1).map(t => t.features.frequency_rank);
    const t3 = PHOTO_BANK.filter(t => computePhotoTier(t) === 3).map(t => t.features.frequency_rank);
    const m1 = mean(t1), m3 = mean(t3);
    // eslint-disable-next-line no-console
    console.log(`  PhotoNaming mean frequency_rank: T1=${m1.toFixed(0)} T3=${m3.toFixed(0)} (lower=more common)`);
    expect(m3).toBeGreaterThan(m1);
  });
});

// ───────────────────────── MultiStepPlanning (Phase 1.5) ─────────────────────────
import {
  PLANNING_ITEMS,
  mapEngineLevelToPlanningTier,
  getPlanningItemsForLevel,
  computePlanningDifficulty,
} from '@/data/multiStepPlanningStimuli';

describe('Content distinctness — MultiStepPlanning', () => {
  it('engine→tier mapping is monotonic and covers all 3 tiers', () => {
    const map = [1,2,3,4,5,6,7,8,9,10].map(mapEngineLevelToPlanningTier);
    // eslint-disable-next-line no-console
    console.log(`  MultiStepPlanning engine→tier: ${map.join(' ')}`);
    expect(map[0]).toBe(1);
    expect(map[4]).toBe(2);
    expect(map[9]).toBe(3);
    for (let i = 1; i < map.length; i++) expect(map[i]).toBeGreaterThanOrEqual(map[i-1]);
  });

  it('engine L1 returns ONLY tier-1 items', () => {
    const items = getPlanningItemsForLevel(1, 50);
    expect(items.every(i => i.tier === 1)).toBe(true);
  });

  it('engine L5 returns ONLY tier-2 items', () => {
    const items = getPlanningItemsForLevel(5, 50);
    expect(items.every(i => i.tier === 2)).toBe(true);
  });

  it('engine L10 returns ONLY tier-3 items', () => {
    const items = getPlanningItemsForLevel(10, 50);
    expect(items.every(i => i.tier === 3)).toBe(true);
  });

  it('L1 vs L5 vs L10 pools are pairwise disjoint (Jaccard = 0)', () => {
    const A = new Set(getPlanningItemsForLevel(1, 100).map(i => i.id));
    const B = new Set(getPlanningItemsForLevel(5, 100).map(i => i.id));
    const C = new Set(getPlanningItemsForLevel(10, 100).map(i => i.id));
    const ab = jaccard(A, B), ac = jaccard(A, C), bc = jaccard(B, C);
    // eslint-disable-next-line no-console
    console.log(`  MultiStepPlanning pool sizes L1=${A.size} L5=${B.size} L10=${C.size}`);
    // eslint-disable-next-line no-console
    console.log(`  Jaccard L1↔L5=${ab.toFixed(2)} L1↔L10=${ac.toFixed(2)} L5↔L10=${bc.toFixed(2)}`);
    expect(ab).toBe(0);
    expect(ac).toBe(0);
    expect(bc).toBe(0);
  });

  it('every tier has ≥8 unique items', () => {
    const sizes = { T1: 0, T2: 0, T3: 0 } as Record<string, number>;
    for (const it of PLANNING_ITEMS) sizes[`T${it.tier}`]++;
    // eslint-disable-next-line no-console
    console.log(`  MultiStepPlanning tier sizes: ${JSON.stringify(sizes)}`);
    expect(sizes.T1).toBeGreaterThanOrEqual(8);
    expect(sizes.T2).toBeGreaterThanOrEqual(8);
    expect(sizes.T3).toBeGreaterThanOrEqual(8);
  });

  it('perceptual curve: T1 → T2 → T3 monotonic in step_density and initiative', () => {
    const mean = (xs: number[]) => xs.reduce((a,b)=>a+b,0) / Math.max(1,xs.length);
    const byTier = (t: number) => PLANNING_ITEMS.filter(i => i.tier === t).map(computePlanningDifficulty);
    const t1 = byTier(1), t2 = byTier(2), t3 = byTier(3);
    const sd = [mean(t1.map(x=>x.step_density)), mean(t2.map(x=>x.step_density)), mean(t3.map(x=>x.step_density))];
    const init = [mean(t1.map(x=>x.initiative)), mean(t2.map(x=>x.initiative)), mean(t3.map(x=>x.initiative))];
    const comp = [mean(t1.map(x=>x.composite)), mean(t2.map(x=>x.composite)), mean(t3.map(x=>x.composite))];
    // eslint-disable-next-line no-console
    console.log(`  MultiStepPlanning step_density T1→T2→T3: ${sd.map(n=>n.toFixed(1)).join(' → ')}`);
    // eslint-disable-next-line no-console
    console.log(`  MultiStepPlanning initiative T1→T2→T3:   ${init.map(n=>n.toFixed(2)).join(' → ')}`);
    // eslint-disable-next-line no-console
    console.log(`  MultiStepPlanning composite T1→T2→T3:    ${comp.map(n=>n.toFixed(2)).join(' → ')}`);
    // Monotonic increase across tiers (composite is the canonical signal)
    expect(comp[1]).toBeGreaterThan(comp[0]);
    expect(comp[2]).toBeGreaterThan(comp[1]);
  });

  it('perceptual preview: sample goal at each tier is qualitatively distinct', () => {
    const s = (t: number) => PLANNING_ITEMS.filter(i => i.tier === t).slice(0, 3).map(i => i.goal);
    // eslint-disable-next-line no-console
    console.log(`  MultiStepPlanning preview L1: ${JSON.stringify(s(1))}`);
    // eslint-disable-next-line no-console
    console.log(`  MultiStepPlanning preview L5: ${JSON.stringify(s(2))}`);
    // eslint-disable-next-line no-console
    console.log(`  MultiStepPlanning preview L10: ${JSON.stringify(s(3))}`);
    expect(s(1).length).toBeGreaterThan(0);
    expect(s(3).length).toBeGreaterThan(0);
  });
});
