/**
 * Integration test — fix_sentence selector + recency.
 * Proves that 20 sequential selections against the T1 pool produce zero
 * repeats while fresh items exist.
 */
import { describe, it, expect } from 'vitest';
import { getFixSentenceTrials, FIX_SENTENCE_BANK } from '@/data/fixSentenceBank';
import { trimRecency } from '@/lib/recency/useRecencyExclusion';

describe('fix_sentence — recency integration', () => {
  it('20 sequential picks at tier 1 produce no repeats while fresh items exist', () => {
    const tier1Size = FIX_SENTENCE_BANK.filter(t => t.difficulty === 1).length;
    expect(tier1Size).toBeGreaterThanOrEqual(15);

    let recentIds: string[] = [];
    const seen = new Set<string>();

    // Pick one trial at a time (count=1) so the selector has to honour recency.
    for (let i = 0; i < tier1Size; i++) {
      const [pick] = getFixSentenceTrials({ difficulty: 1, count: 1, recentIds });
      expect(pick).toBeDefined();
      expect(seen.has(pick.id)).toBe(false);
      seen.add(pick.id);
      recentIds = trimRecency(recentIds, pick.id, 20);
    }

    expect(seen.size).toBe(tier1Size);
  });

  it('after pool exhaustion, selector still returns an item (LRU fallback)', () => {
    const allT1Ids = FIX_SENTENCE_BANK.filter(t => t.difficulty === 1).map(t => t.id);
    const [pick] = getFixSentenceTrials({ difficulty: 1, count: 1, recentIds: allT1Ids });
    expect(pick).toBeDefined();
    // Must be the oldest (first in recentIds).
    expect(pick.id).toBe(allT1Ids[0]);
  });

  it('respects difficulty bucketing — recent T2 ids do not affect T1 picks', () => {
    const t2Ids = FIX_SENTENCE_BANK.filter(t => t.difficulty === 2).map(t => t.id);
    const [pick] = getFixSentenceTrials({ difficulty: 1, count: 1, recentIds: t2Ids });
    expect(pick).toBeDefined();
    expect(pick.difficulty).toBe(1);
  });
});
