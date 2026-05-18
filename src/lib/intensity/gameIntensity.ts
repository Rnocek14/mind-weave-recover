/**
 * Per-Game Intensity primitive.
 *
 * The progression engine operates on 10 levels, but every game's content
 * bank collapses to 3 tiers. That means levels 4→5→6→7 historically pull
 * identical items — the level number changes, nothing else does.
 *
 * This module is the shared *machinery* that lets each game declare:
 *   1. how its 10 engine levels map to a content cohort + sub-tier slice
 *   2. which pressure modifiers (cues, time, replay budget, foils) apply
 *   3. how candidate items are sorted inside that cohort
 *
 * Per-game *meaning* lives in `{slug}Intensity.ts` files. This file owns the
 * registry, the selector, and the modifier accessor — nothing more.
 *
 * Pure module. No React. No I/O. Fully unit-testable.
 */

/** Universal pressure-modifier shape. Each game uses only the keys it cares about. */
export interface LevelModifiers {
  /** Highest cue tier the patient can still get on this level.
   *  0 = none, 1 = semantic, 2 = phonemic, 3 = carrier/full. */
  maxCueLevel: 0 | 1 | 2 | 3;
  /** Silence before a cue auto-offers (ms). 0 = no auto cue. */
  cueAutoOfferAfterMs: number;
  /** Soft per-trial response window in ms. 0 = no timer. */
  responseWindowMs: number;
  /** Hard cap (replay/hint budget). -1 = unlimited. */
  replayBudget: number;
  /** Foil chip count for recognition fallback. 0 = no chips shown. */
  foilChipCount: 0 | 2 | 3 | 4;
  /** When true, prefer phonologically-similar foils (harder confusion). */
  preferConfusableFoils: boolean;
  /** Pull from the "stretch" slice (rarest / hardest items) when available. */
  useStretchSlice: boolean;
  /** Trial may carry two errors / two-step targets (only for games that support it). */
  multiTarget: boolean;
  /** Free-form per-game label, e.g. "T2 mid-frequency, semantic on tap". */
  label: string;
}

/** Default modifiers — a game gets these if its registry didn't override at a level. */
export const DEFAULT_MODIFIERS: LevelModifiers = {
  maxCueLevel: 3,
  cueAutoOfferAfterMs: 0,
  responseWindowMs: 0,
  replayBudget: -1,
  foilChipCount: 0,
  preferConfusableFoils: false,
  useStretchSlice: false,
  multiTarget: false,
  label: '',
};

/**
 * What content cohort to pull for this level + which sub-slice of it.
 *
 * `cohort` is a stable opaque key the per-game selector knows how to filter
 * by (e.g. tier id, error type, contrast category). `subTierIndex` is in
 * [0..1] — after the cohort is filtered + sorted, the selector picks the
 * window centred on this index.
 *
 * `cohortMix` lets a level pull from multiple cohorts in proportion
 * (e.g. "70% function_error, 30% multiple_valid"). Sums should be ~1.0.
 */
export interface LevelContentSpec {
  cohort: string;
  cohortMix?: Array<{ cohort: string; weight: number }>;
  /** 0 = easy end of cohort, 1 = hard end. */
  subTierIndex: number;
}

/** Per-game registry: 10 entries (level 1..10). */
export interface GameIntensityConfig {
  slug: string;
  /** content + sub-slice per level */
  levelContent: Record<number, LevelContentSpec>;
  /** modifiers per level (any keys omitted fall back to DEFAULT_MODIFIERS) */
  levelModifiers: Record<number, Partial<LevelModifiers>>;
}

// ────────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────────

const REGISTRY = new Map<string, GameIntensityConfig>();

export function registerGameIntensity(config: GameIntensityConfig): void {
  REGISTRY.set(config.slug, config);
}

export function getGameIntensityConfig(slug: string): GameIntensityConfig | null {
  return REGISTRY.get(slug) ?? null;
}

// ────────────────────────────────────────────────────────────────────────
// Public accessors
// ────────────────────────────────────────────────────────────────────────

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(10, Math.round(level)));
}

export function getLevelContent(slug: string, level: number): LevelContentSpec | null {
  const cfg = getGameIntensityConfig(slug);
  if (!cfg) return null;
  const l = clampLevel(level);
  return cfg.levelContent[l] ?? null;
}

export function getLevelModifiers(slug: string, level: number): LevelModifiers {
  const cfg = getGameIntensityConfig(slug);
  const l = clampLevel(level);
  const override = cfg?.levelModifiers?.[l] ?? {};
  return { ...DEFAULT_MODIFIERS, ...override };
}

/**
 * Sort + slice a candidate pool to the level's sub-tier window.
 *
 * Strategy:
 *   1. Sort candidates by `sortKey` (lower = easier).
 *   2. Compute the centre index from subTierIndex × (pool length - 1).
 *   3. Take a symmetric window of `windowFraction` around the centre.
 *      Default window = 0.5 (half the pool around the centre), so:
 *        subTierIndex 0.0 → easiest 50%
 *        subTierIndex 0.5 → middle 50%
 *        subTierIndex 1.0 → hardest 50%
 *   4. From that window, return the first `count` items (caller may shuffle).
 *
 * If the window has fewer than `count` items, falls back to the full pool
 * — never returns 0 items when candidates exist.
 */
export function sliceCohortByIntensity<T>(
  candidates: T[],
  sortKey: (item: T) => number,
  subTierIndex: number,
  count: number,
  windowFraction = 0.5
): T[] {
  if (candidates.length === 0) return [];
  if (candidates.length <= count) return [...candidates];

  const sorted = [...candidates].sort((a, b) => sortKey(a) - sortKey(b));
  const idx = Math.max(0, Math.min(1, subTierIndex));
  const halfWindow = Math.max(
    Math.ceil(count / 2),
    Math.floor((sorted.length * windowFraction) / 2)
  );
  const centre = Math.round(idx * (sorted.length - 1));
  const lo = Math.max(0, centre - halfWindow);
  const hi = Math.min(sorted.length, centre + halfWindow + 1);
  const window = sorted.slice(lo, hi);
  return window.length >= count ? window : sorted;
}

/**
 * Resolve a `cohortMix` to a normalised count per cohort. Caller still does
 * the per-cohort filtering + selection (we don't know cohort semantics here).
 */
export function resolveCohortMix(
  spec: LevelContentSpec,
  totalCount: number
): Array<{ cohort: string; count: number }> {
  if (!spec.cohortMix || spec.cohortMix.length === 0) {
    return [{ cohort: spec.cohort, count: totalCount }];
  }
  const sum = spec.cohortMix.reduce((s, m) => s + Math.max(0, m.weight), 0) || 1;
  const out = spec.cohortMix.map(m => ({
    cohort: m.cohort,
    count: Math.max(0, Math.floor((m.weight / sum) * totalCount)),
  }));
  // Distribute rounding remainder to the largest-weight cohort.
  const distributed = out.reduce((s, m) => s + m.count, 0);
  if (distributed < totalCount && out.length > 0) {
    out[0].count += totalCount - distributed;
  }
  return out;
}
