/**
 * selectWithRecency — pure, non-hook companions to useRecencyExclusion for
 * game selectors that build their whole trial pool up front.
 *
 * Same localStorage store and semantics as the hook (per-slug/tier LRU,
 * soft exclusion — never returns fewer items than requested when the pool
 * has them). Adoption is a two-line change at a selector's shuffle site:
 *
 *   const ordered = orderFreshFirst('two_clues', shuffled, { tier, getId });
 *   const picked = ordered.slice(0, n);
 *   markManyUsed('two_clues', picked.map(getId), { tier });
 */

const STORAGE_KEY = 'recency.v1'; // shared with useRecencyExclusion

interface RecencyStore {
  [slug: string]: { [tierKey: string]: string[] };
}

function loadStore(): RecencyStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecencyStore) : {};
  } catch {
    return {};
  }
}

function saveStore(store: RecencyStore) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota or disabled — silent */
  }
}

const tierKeyOf = (tier?: number | string) => (tier !== undefined ? String(tier) : '*');

export function getRecentIds(slug: string, tier?: number | string): string[] {
  return loadStore()[slug]?.[tierKeyOf(tier)] ?? [];
}

/**
 * Stable-partition a (pre-shuffled) pool into fresh-first order: items not
 * seen in the recency window keep their shuffled order up front, recently
 * seen items follow in least-recently-used-first order. slice(0, n) of the
 * result is therefore "prefer unseen, then oldest".
 */
export function orderFreshFirst<T>(
  slug: string,
  pool: T[],
  opts: { tier?: number | string; getId?: (it: T) => string } = {}
): T[] {
  const getId = opts.getId ?? ((it: T) => (it as { id?: string })?.id ?? String(it));
  const recentArr = getRecentIds(slug, opts.tier); // oldest → newest
  if (recentArr.length === 0) return pool;
  const recentRank = new Map(recentArr.map((id, i) => [id, i]));

  const fresh: T[] = [];
  const stale: T[] = [];
  for (const it of pool) {
    (recentRank.has(getId(it)) ? stale : fresh).push(it);
  }
  stale.sort((a, b) => (recentRank.get(getId(a)) ?? 0) - (recentRank.get(getId(b)) ?? 0));
  return [...fresh, ...stale];
}

/** Commit a batch of picks as just-used for (slug, tier). */
export function markManyUsed(
  slug: string,
  ids: string[],
  opts: { tier?: number | string; lookback?: number } = {}
): void {
  if (ids.length === 0) return;
  const lookback = Math.max(1, opts.lookback ?? 20);
  const store = loadStore();
  const bucket = (store[slug] ??= {});
  const k = tierKeyOf(opts.tier);
  let list = bucket[k] ?? [];
  for (const id of ids) {
    if (!id) continue;
    list = list.filter((x) => x !== id);
    list.push(id);
  }
  while (list.length > lookback) list.shift();
  bucket[k] = list;
  saveStore(store);
}
