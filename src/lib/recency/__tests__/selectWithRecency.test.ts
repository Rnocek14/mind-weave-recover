import { describe, it, expect, beforeEach } from "vitest";
import { orderFreshFirst, markManyUsed, getRecentIds } from "@/lib/recency/selectWithRecency";

interface Item { id: string }
const items = (...ids: string[]): Item[] => ids.map((id) => ({ id }));

beforeEach(() => {
  localStorage.clear();
});

describe("selectWithRecency", () => {
  it("returns the pool unchanged when nothing is recent", () => {
    const pool = items("a", "b", "c");
    expect(orderFreshFirst("t", pool)).toEqual(pool);
  });

  it("moves recently used items to the back, LRU-first", () => {
    markManyUsed("t", ["b"], {});
    markManyUsed("t", ["a"], {});
    const ordered = orderFreshFirst("t", items("a", "b", "c"));
    // c is fresh; b was used before a, so b precedes a in the stale tail.
    expect(ordered.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });

  it("never shrinks the pool (soft exclusion)", () => {
    markManyUsed("t", ["a", "b", "c"], {});
    const ordered = orderFreshFirst("t", items("a", "b", "c"));
    expect(ordered).toHaveLength(3);
  });

  it("keeps tiers isolated", () => {
    markManyUsed("t", ["a"], { tier: 1 });
    expect(getRecentIds("t", 1)).toEqual(["a"]);
    expect(getRecentIds("t", 2)).toEqual([]);
    const orderedTier2 = orderFreshFirst("t", items("a", "b"), { tier: 2 });
    expect(orderedTier2.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("trims to lookback", () => {
    markManyUsed("t", ["a", "b", "c", "d"], { lookback: 2 });
    expect(getRecentIds("t")).toEqual(["c", "d"]);
  });

  it("re-marking moves an id to most-recent", () => {
    markManyUsed("t", ["a", "b"], {});
    markManyUsed("t", ["a"], {});
    expect(getRecentIds("t")).toEqual(["b", "a"]);
  });
});
