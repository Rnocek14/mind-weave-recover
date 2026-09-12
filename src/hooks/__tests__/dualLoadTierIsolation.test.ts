/**
 * Dual-Load Naming's content tiers must be distinct.
 *
 * The set filter was upper-bound only (`tier <= min(tier + 1, 3)`), so tier 2
 * and tier 3 resolved to the same pool — crossing that boundary changed nothing
 * the patient could see while the adaptation badge announced "Made it harder" —
 * and tier 1 drew a large share of its candidates from tier 2. Content tier is
 * this game's only difficulty lever, so a blended pool means the game does not
 * really adapt.
 */
import { describe, it, expect } from 'vitest';
import { buildSets } from '@/hooks/useDualLoadNamingGame';

describe('dual-load naming tier isolation', () => {
  it('serves only the requested tier', () => {
    for (const tier of [1, 2, 3]) {
      const served = buildSets(tier, 6, [], new Set()).map((s) => s.tier);
      expect(served.length).toBeGreaterThan(0);
      expect(new Set(served), `tier ${tier} blended other tiers`).toEqual(new Set([tier]));
    }
  });

  it('gives each tier its own content', () => {
    const ids = [1, 2, 3].map((t) => new Set(buildSets(t, 50, [], new Set()).map((s) => s.id)));
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const overlap = [...ids[a]].filter((id) => ids[b].has(id));
        expect(overlap, `tiers ${a + 1} and ${b + 1} share content`).toEqual([]);
      }
    }
  });

  it('repeats within the tier rather than blending when exclusions exhaust it', () => {
    const all = buildSets(3, 50, [], new Set());
    const exhausted = buildSets(3, 4, [], new Set(all.map((s) => s.id)));
    expect(exhausted.length).toBeGreaterThan(0);
    expect(new Set(exhausted.map((s) => s.tier))).toEqual(new Set([3]));
  });
});
