/**
 * Photo Naming — recency primitive bank coverage.
 *
 * `usePhotoNamingGame` adopts `useRecencyExclusion`. The hook itself is
 * exercised against localStorage in production; here we lock the contract
 * one layer down: against the *real PHOTO_BANK*, the pure primitive must
 *   1. cover the full T1 pool with no repeats in `bankSize` sequential
 *      picks while marking each used, and
 *   2. still return an item after pool exhaustion (LRU fallback — never
 *      leave the game with no stimulus).
 *
 * Mirrors `fixSentenceRecency.test.ts` so adoption of the shared recency
 * primitive remains symmetric.
 *
 * Pure. Read-only. No localStorage, no hook mounting.
 */
import { describe, it, expect } from 'vitest';
import { PHOTO_BANK, computePhotoTier } from '@/data/photoBank';
import { pickWithRecency, trimRecency } from '@/lib/recency/useRecencyExclusion';

const T1 = PHOTO_BANK.filter((p) => computePhotoTier(p) === 1);

describe('photo_naming — recency integration', () => {
  it('T1 pool meets the floor (sanity for the test that follows)', () => {
    expect(T1.length).toBeGreaterThanOrEqual(15);
  });

  it('sequential picks across T1 produce no repeats while fresh items exist', () => {
    let recent: string[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < T1.length; i++) {
      const pick = pickWithRecency(T1, recent);
      expect(pick, `pick ${i} returned undefined`).toBeDefined();
      expect(seen.has(pick!.id), `repeat at pick ${i}: ${pick!.id}`).toBe(false);
      seen.add(pick!.id);
      recent = trimRecency(recent, pick!.id, T1.length);
    }
    expect(seen.size).toBe(T1.length);
  });

  it('after exhaustion, primitive still returns the LRU item (never undefined)', () => {
    const allIds = T1.map((p) => p.id);
    const pick = pickWithRecency(T1, allIds);
    expect(pick).toBeDefined();
    // LRU = oldest = first in recent list.
    expect(pick!.id).toBe(allIds[0]);
  });

  it('respects difficulty bucketing — recent T2/T3 ids do not affect T1 picks', () => {
    const t2t3Ids = PHOTO_BANK
      .filter((p) => computePhotoTier(p) !== 1)
      .map((p) => p.id);
    const pick = pickWithRecency(T1, t2t3Ids);
    expect(pick).toBeDefined();
    expect(computePhotoTier(pick!)).toBe(1);
  });
});
