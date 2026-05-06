import { describe, it, expect } from 'vitest';
import { pickWithRecency, trimRecency } from '../useRecencyExclusion';

type Item = { id: string; tier: number };
const pool: Item[] = Array.from({ length: 20 }, (_, i) => ({ id: `i${i}`, tier: 1 }));

describe('recency primitive', () => {
  it('prefers items not in recency window', () => {
    const recent = pool.slice(0, 19).map((p) => p.id);
    for (let i = 0; i < 50; i++) {
      const pick = pickWithRecency(pool, recent);
      expect(pick?.id).toBe('i19'); // only fresh item
    }
  });

  it('falls back to least-recently-used when all are recent', () => {
    const recent = pool.map((p) => p.id); // every item recent, oldest=i0
    const pick = pickWithRecency(pool, recent);
    expect(pick?.id).toBe('i0');
  });

  it('returns undefined for empty pool', () => {
    expect(pickWithRecency([], ['x'])).toBeUndefined();
  });

  it('trimRecency moves used id to tail and caps to lookback', () => {
    let list: string[] = [];
    for (let i = 0; i < 25; i++) list = trimRecency(list, `i${i}`, 20);
    expect(list.length).toBe(20);
    expect(list[list.length - 1]).toBe('i24');
    expect(list[0]).toBe('i5');
  });

  it('re-using an id moves it to tail without growing the list', () => {
    let list: string[] = ['a', 'b', 'c'];
    list = trimRecency(list, 'a', 10);
    expect(list).toEqual(['b', 'c', 'a']);
  });

  it('with 20 picks against a 20-item bank, no repeat occurs while marking each', () => {
    let recent: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const pick = pickWithRecency(pool, recent)!;
      expect(seen.has(pick.id)).toBe(false);
      seen.add(pick.id);
      recent = trimRecency(recent, pick.id, 20);
    }
    expect(seen.size).toBe(20);
  });
});
