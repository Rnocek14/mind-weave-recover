/**
 * useRecencyExclusion — shared recency primitive for content selection.
 *
 * Goal: prevent the same stimulus from being shown twice in a short window,
 * across rounds AND across sessions on the same device. With most banks at
 * 15–20 items per tier and 20 trials per round, naive random selection makes
 * repeats mathematically unavoidable. This hook fixes that.
 *
 * Design rules:
 *   - Pure utility. No network. No mastery, no scoring, no UI.
 *   - Per-slug LRU stored in localStorage so recency survives a reload.
 *   - `tierAware`: keep separate recency lists per tier so swapping difficulty
 *     does not nuke history for the previous tier.
 *   - Soft-exclusion: if every candidate is excluded (small banks), the hook
 *     falls back to the LEAST recently used item — never returns nothing.
 *   - Side-effect free during render. Caller commits a pick via `markUsed()`.
 *
 * NOT wired into any game yet. Adopt one game at a time:
 *
 *   const { pick, markUsed } = useRecencyExclusion('photo_naming', items, {
 *     lookback: 20, tierAware: true, getTier: (it) => computePhotoTier(it),
 *   });
 *   const next = pick(currentTier);
 *   markUsed(next.id);
 */
import { useCallback, useMemo, useRef } from 'react';

const STORAGE_KEY = 'recency.v1';

export interface RecencyOptions<T> {
  /** Max number of recent IDs to remember per (slug, tier). Default 20. */
  lookback?: number;
  /** Track recency separately per tier. Default true. */
  tierAware?: boolean;
  /** Tier extractor — required when tierAware=true. */
  getTier?: (item: T) => number | string;
  /** ID extractor. Defaults to (it as any).id. */
  getId?: (item: T) => string;
}

interface RecencyStore {
  // slug -> tierKey -> ordered list of IDs (oldest → newest)
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

export interface RecencyApi<T> {
  /** Pick the next item, preferring those not in the recency window. */
  pick: (tier?: number | string, candidates?: T[]) => T | undefined;
  /** Commit an item as "just used". Trims to lookback. */
  markUsed: (idOrItem: string | T, tier?: number | string) => void;
  /** Read-only: current recency IDs for a tier (newest last). */
  getRecent: (tier?: number | string) => string[];
  /** Clear recency for this slug (e.g. clinician override / debug). */
  clear: () => void;
}

export function useRecencyExclusion<T>(
  slug: string,
  items: T[],
  opts: RecencyOptions<T> = {}
): RecencyApi<T> {
  const lookback = Math.max(1, opts.lookback ?? 20);
  const tierAware = opts.tierAware ?? true;
  const getId = opts.getId ?? ((it: T) => (it as any)?.id ?? String(it));
  const getTier = opts.getTier;

  // Hold a ref so multiple calls per render don't double-load.
  const storeRef = useRef<RecencyStore | null>(null);
  const getStore = useCallback((): RecencyStore => {
    if (!storeRef.current) storeRef.current = loadStore();
    return storeRef.current;
  }, []);

  const tierKey = useCallback(
    (tier?: number | string) => (tierAware && tier !== undefined ? String(tier) : '*'),
    [tierAware]
  );

  const getRecent = useCallback(
    (tier?: number | string): string[] => {
      const store = getStore();
      return store[slug]?.[tierKey(tier)] ?? [];
    },
    [getStore, slug, tierKey]
  );

  const candidatesForTier = useCallback(
    (tier?: number | string, override?: T[]): T[] => {
      const pool = override ?? items;
      if (!tierAware || tier === undefined || !getTier) return pool;
      return pool.filter((it) => String(getTier(it)) === String(tier));
    },
    [items, tierAware, getTier]
  );

  const pick = useCallback(
    (tier?: number | string, candidates?: T[]): T | undefined => {
      const pool = candidatesForTier(tier, candidates);
      if (pool.length === 0) return undefined;
      const recent = new Set(getRecent(tier));

      // Prefer items NOT in the recency window.
      const fresh = pool.filter((it) => !recent.has(getId(it)));
      if (fresh.length > 0) {
        return fresh[Math.floor(Math.random() * fresh.length)];
      }

      // Soft-exclude fallback: every item is "recent". Pick the least-recently-used.
      const recentArr = getRecent(tier); // oldest → newest
      for (const id of recentArr) {
        const found = pool.find((it) => getId(it) === id);
        if (found) return found;
      }
      // Last resort: random from pool.
      return pool[Math.floor(Math.random() * pool.length)];
    },
    [candidatesForTier, getRecent, getId]
  );

  const markUsed = useCallback(
    (idOrItem: string | T, tier?: number | string) => {
      const id = typeof idOrItem === 'string' ? idOrItem : getId(idOrItem);
      if (!id) return;
      const store = getStore();
      const k = tierKey(tier);
      const slugBucket = (store[slug] ??= {});
      const list = (slugBucket[k] ??= []);
      // Remove existing occurrence then push to end.
      const idx = list.indexOf(id);
      if (idx >= 0) list.splice(idx, 1);
      list.push(id);
      // Trim to lookback.
      while (list.length > lookback) list.shift();
      saveStore(store);
    },
    [getId, getStore, lookback, slug, tierKey]
  );

  const clear = useCallback(() => {
    const store = getStore();
    delete store[slug];
    saveStore(store);
  }, [getStore, slug]);

  // Stable API object.
  return useMemo(() => ({ pick, markUsed, getRecent, clear }), [pick, markUsed, getRecent, clear]);
}

/* --------------------------------------------------------------------------
 * Pure helpers (no React) — used by tests and any non-hook caller.
 * ------------------------------------------------------------------------ */

export function pickWithRecency<T>(
  pool: T[],
  recentIds: string[],
  getId: (it: T) => string = (it) => (it as any).id
): T | undefined {
  if (pool.length === 0) return undefined;
  const recent = new Set(recentIds);
  const fresh = pool.filter((it) => !recent.has(getId(it)));
  if (fresh.length > 0) return fresh[Math.floor(Math.random() * fresh.length)];
  for (const id of recentIds) {
    const found = pool.find((it) => getId(it) === id);
    if (found) return found;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function trimRecency(list: string[], id: string, lookback: number): string[] {
  const next = list.filter((x) => x !== id);
  next.push(id);
  while (next.length > lookback) next.shift();
  return next;
}
