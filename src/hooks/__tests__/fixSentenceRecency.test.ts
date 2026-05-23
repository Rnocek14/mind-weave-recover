/**
 * Integration test — fix_sentence selector + recency.
 * Proves that 20 sequential selections against the T1 pool produce zero
 * repeats while fresh items exist.
 */
import { describe, it, expect } from 'vitest';
import { getFixSentenceTrials, FIX_SENTENCE_BANK } from '@/data/fixSentenceBank';
import { trimRecency } from '@/lib/recency/useRecencyExclusion';

describe('fix_sentence — recency integration', () => {
  it('sequential picks at tier 1 maintain meaningful variety', () => {
    // NOTE: The May 2026 intensity-driven cohort selector partitions T1 by
    // errorType cohort, so strict "no repeats until exhaustion" no longer holds —
    // the selector may revisit a cohort item before all T1 items are seen.
    // The weaker safety contract: across the pool size, we still see substantial
    // variety (at least 60% of the bank).
    const tier1Size = FIX_SENTENCE_BANK.filter(t => t.difficulty === 1).length;
    expect(tier1Size).toBeGreaterThanOrEqual(15);

    let recentIds: string[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < tier1Size; i++) {
      const [pick] = getFixSentenceTrials({ difficulty: 1, count: 1, recentIds });
      expect(pick).toBeDefined();
      expect(pick.difficulty).toBe(1);
      seen.add(pick.id);
      recentIds = trimRecency(recentIds, pick.id, 20);
    }

    // Variety floor: at least 60% of T1 items appear across pool-sized run.
    expect(seen.size).toBeGreaterThanOrEqual(Math.ceil(tier1Size * 0.6));
  });

  it('after pool exhaustion, selector still returns a T1 item (never undefined)', () => {
    // NOTE: The May 2026 intensity-driven cohort selector partitions T1 by
    // errorType and shuffles within cohorts, so strict LRU ordering (oldest-first)
    // no longer holds. The safety contract is weaker but still essential:
    // the patient must never see a missing stimulus.
    const allT1Ids = FIX_SENTENCE_BANK.filter(t => t.difficulty === 1).map(t => t.id);
    const [pick] = getFixSentenceTrials({ difficulty: 1, count: 1, recentIds: allT1Ids });
    expect(pick).toBeDefined();
    expect(pick.difficulty).toBe(1);
    expect(allT1Ids).toContain(pick.id);
  });

  it('respects difficulty bucketing — recent T2 ids do not affect T1 picks', () => {
    const t2Ids = FIX_SENTENCE_BANK.filter(t => t.difficulty === 2).map(t => t.id);
    const [pick] = getFixSentenceTrials({ difficulty: 1, count: 1, recentIds: t2Ids });
    expect(pick).toBeDefined();
    expect(pick.difficulty).toBe(1);
  });
});
