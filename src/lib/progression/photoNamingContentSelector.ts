/**
 * Photo Naming — clinical content selector (PR4, Phase 2.5).
 *
 * Translates the *clinical* level (L1–L8) into a *content pool*. Until this
 * module existed, L4–L8 only raised accuracy bars — the patient saw the
 * same content. That made the upper levels clinically dishonest.
 *
 * Tier rationale (see docs/clinical-evidence/photo-naming.md):
 *   L1–L3   baseline pool, no extra filter (the engine's existing
 *           difficulty bands already restrict L1–L3 to easy items).
 *   L4      high-frequency concrete nouns (SUBTLEX rank ≤ HIGH_FREQ_RANK).
 *   L5      mid-frequency nouns (HIGH_FREQ_RANK < rank ≤ MID_FREQ_RANK).
 *           Disjoint from L4 by construction.
 *   L6      cross-category semantic spread (pool must span ≥ MIN_CATEGORIES
 *           distinct semantic categories, no single category > MAX_CAT_SHARE
 *           of the pool).
 *   L7      phrase-carrier mode: every trial is tagged with a carrier
 *           sentence ("Pass me the ___", etc). The trial's task context
 *           changes from single-word retrieval to lexical retrieval inside
 *           a syntactic frame.
 *   L8      generalization probe pool — sourced from PROBE_WORDS, which by
 *           design never appears in regular training. Trials are tagged
 *           `isGeneralizationProbe: true` so downstream consumers can
 *           segregate probe results from ordinary mastery stats.
 *
 * Honest fallbacks: if SUBTLEX-style frequency metadata is missing or the
 * candidate pool is too small for a tier's constraint, the selector returns
 * a `fallback` description and the upstream baseline pool. We deliberately
 * DO NOT silently downgrade — callers must inspect `fallback` and surface
 * the reason in diagnostics (see ProgressionStateDev).
 *
 * Pure module — no I/O, no React, no DB.
 */

import type { PhotoTrial } from '@/data/photoBank';
import { PHOTO_BANK } from '@/data/photoBank';
import { PROBE_WORDS } from '@/data/probeWords';

// ── Tunables (calibration defaults — see docs/clinical-evidence) ────────
export const HIGH_FREQ_RANK_MAX = 2000;   // L4 upper bound
export const MID_FREQ_RANK_MIN = 2001;    // L5 lower bound
export const MID_FREQ_RANK_MAX = 6000;    // L5 upper bound
export const L6_FREQ_RANK_MAX = 8000;     // L6 upper bound (broader)
export const L6_MIN_CATEGORIES = 4;
export const L6_MAX_CATEGORY_SHARE = 0.45;
export const MIN_TIER_POOL_SIZE = 8;      // honesty floor

// L7 carrier phrases — small fixed bank, cycled deterministically per id.
export const PHRASE_CARRIERS = [
  'I see a ___',
  'Pass me the ___',
  'Here is the ___',
  'I want the ___',
  'Look at the ___',
] as const;

export type SelectorTier = 'L1-L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8';

export type SelectorFallbackReason =
  | 'no_frequency_metadata'
  | 'insufficient_pool_for_band'
  | 'insufficient_category_spread'
  | 'no_probe_words_available';

export interface SelectorFallback {
  reason: SelectorFallbackReason;
  detail: string;
  /** When true, caller should NOT advance level-up logic that depended on this tier. */
  skipped: boolean;
}

export interface SelectorDiagnostics {
  totalCandidates: number;
  poolSize: number;
  distinctCategories: number;
  /** [min, max] when a frequency band was applied. */
  frequencyBand?: [number, number];
}

/** Trial enriched with tier-specific task-context metadata. */
export interface ClinicalTieredTrial extends PhotoTrial {
  /** Present on L7 trials. UI may render this above the image. */
  carrierPhrase?: string;
  /** True on L8 trials. Downstream code must NOT roll these into mastery stats. */
  isGeneralizationProbe?: boolean;
  /** Tier the selector assigned this trial to. */
  __selectorTier?: SelectorTier;
}

export interface SelectorResult {
  tier: SelectorTier;
  pool: ClinicalTieredTrial[];
  reason: 'frequency_band' | 'category_spread' | 'phrase_carrier' | 'generalization_probe' | 'baseline';
  fallback: SelectorFallback | null;
  diagnostics: SelectorDiagnostics;
}

interface SelectOptions {
  /** Override the source bank (used by tests). */
  bank?: PhotoTrial[];
  /** Override the probe bank (used by tests). */
  probeBank?: PhotoTrial[];
}

function hasFrequencyMetadata(t: PhotoTrial): boolean {
  return typeof t.features?.frequency_rank === 'number' && t.features.frequency_rank > 0;
}

function tierFor(clinicalLevel: number): SelectorTier {
  if (clinicalLevel <= 3) return 'L1-L3';
  if (clinicalLevel === 4) return 'L4';
  if (clinicalLevel === 5) return 'L5';
  if (clinicalLevel === 6) return 'L6';
  if (clinicalLevel === 7) return 'L7';
  return 'L8';
}

function diag(pool: PhotoTrial[], band?: [number, number]): SelectorDiagnostics {
  const cats = new Set(pool.map((t) => t.category));
  return {
    totalCandidates: pool.length,
    poolSize: pool.length,
    distinctCategories: cats.size,
    ...(band ? { frequencyBand: band } : {}),
  };
}

export function selectPhotoNamingPool(
  clinicalLevel: number,
  opts: SelectOptions = {},
): SelectorResult {
  const bank = opts.bank ?? PHOTO_BANK;
  const probeBank = opts.probeBank ?? PROBE_WORDS;
  const tier = tierFor(clinicalLevel);

  // L1–L3 → baseline; selector is a no-op other than tagging tier.
  if (tier === 'L1-L3') {
    return {
      tier,
      pool: bank.map((t) => ({ ...t, __selectorTier: tier })),
      reason: 'baseline',
      fallback: null,
      diagnostics: diag(bank),
    };
  }

  // L4 / L5 → frequency-banded selection.
  if (tier === 'L4' || tier === 'L5') {
    const tagged = bank.filter(hasFrequencyMetadata);
    if (tagged.length === 0) {
      return {
        tier,
        pool: bank.map((t) => ({ ...t, __selectorTier: 'L1-L3' })),
        reason: 'baseline',
        fallback: {
          reason: 'no_frequency_metadata',
          detail: 'No PhotoNaming trials carry frequency_rank metadata; cannot apply frequency band.',
          skipped: true,
        },
        diagnostics: diag(bank),
      };
    }
    const band: [number, number] =
      tier === 'L4' ? [1, HIGH_FREQ_RANK_MAX] : [MID_FREQ_RANK_MIN, MID_FREQ_RANK_MAX];
    const inBand = tagged.filter((t) => {
      const r = t.features.frequency_rank;
      return r >= band[0] && r <= band[1];
    });
    if (inBand.length < MIN_TIER_POOL_SIZE) {
      return {
        tier,
        pool: tagged.map((t) => ({ ...t, __selectorTier: 'L1-L3' })),
        reason: 'baseline',
        fallback: {
          reason: 'insufficient_pool_for_band',
          detail: `Only ${inBand.length} trials in rank band [${band[0]}, ${band[1]}]; need ≥${MIN_TIER_POOL_SIZE}.`,
          skipped: true,
        },
        diagnostics: diag(tagged, band),
      };
    }
    return {
      tier,
      pool: inBand.map((t) => ({ ...t, __selectorTier: tier })),
      reason: 'frequency_band',
      fallback: null,
      diagnostics: diag(inBand, band),
    };
  }

  // L6 → cross-category semantic spread.
  if (tier === 'L6') {
    const tagged = bank.filter(hasFrequencyMetadata);
    const sourcePool = tagged.length > 0 ? tagged : bank;
    const band: [number, number] = [1, L6_FREQ_RANK_MAX];
    const candidates = tagged.length > 0
      ? sourcePool.filter((t) => t.features.frequency_rank <= L6_FREQ_RANK_MAX)
      : sourcePool;
    const byCat = new Map<string, PhotoTrial[]>();
    for (const t of candidates) {
      const k = t.category || 'uncategorized';
      const list = byCat.get(k) ?? [];
      list.push(t);
      byCat.set(k, list);
    }
    if (byCat.size < L6_MIN_CATEGORIES || candidates.length < MIN_TIER_POOL_SIZE) {
      return {
        tier,
        pool: candidates.map((t) => ({ ...t, __selectorTier: 'L1-L3' })),
        reason: 'baseline',
        fallback: {
          reason: 'insufficient_category_spread',
          detail: `Need ≥${L6_MIN_CATEGORIES} categories and ≥${MIN_TIER_POOL_SIZE} trials; got ${byCat.size} categories / ${candidates.length} trials.`,
          skipped: true,
        },
        diagnostics: diag(candidates, band),
      };
    }
    // Enforce max-share cap: round-robin across categories.
    const cats = Array.from(byCat.keys());
    const maxFromAny = Math.max(
      MIN_TIER_POOL_SIZE,
      Math.floor(candidates.length * L6_MAX_CATEGORY_SHARE),
    );
    const out: PhotoTrial[] = [];
    let added = true;
    const cursors = new Map<string, number>(cats.map((c) => [c, 0]));
    while (added) {
      added = false;
      for (const c of cats) {
        const list = byCat.get(c)!;
        const i = cursors.get(c)!;
        const fromCatSoFar = out.filter((t) => t.category === c).length;
        if (i < list.length && fromCatSoFar < maxFromAny) {
          out.push(list[i]);
          cursors.set(c, i + 1);
          added = true;
        }
      }
    }
    return {
      tier,
      pool: out.map((t) => ({ ...t, __selectorTier: tier })),
      reason: 'category_spread',
      fallback: null,
      diagnostics: diag(out, band),
    };
  }

  // L7 → phrase-carrier mode.
  if (tier === 'L7') {
    const tagged = bank.filter(hasFrequencyMetadata);
    const sourcePool = tagged.length > 0 ? tagged : bank;
    // Keep targets that work in a carrier (single-noun referents).
    // We approximate this by requiring concrete imageable nouns; if the
    // metadata is missing for that filter, we still apply the carrier but
    // mark a fallback so it's visible in diagnostics.
    const noMeta = sourcePool.some((t) => !hasFrequencyMetadata(t));
    const filtered = sourcePool.filter((t) => (t.features?.syllable_count ?? 99) <= 4);
    if (filtered.length < MIN_TIER_POOL_SIZE) {
      return {
        tier,
        pool: sourcePool.map((t) => ({ ...t, __selectorTier: 'L1-L3' })),
        reason: 'baseline',
        fallback: {
          reason: 'insufficient_pool_for_band',
          detail: `Need ≥${MIN_TIER_POOL_SIZE} short-syllable trials for carrier-phrase mode; got ${filtered.length}.`,
          skipped: true,
        },
        diagnostics: diag(filtered),
      };
    }
    const tieredPool: ClinicalTieredTrial[] = filtered.map((t, i) => ({
      ...t,
      carrierPhrase: PHRASE_CARRIERS[i % PHRASE_CARRIERS.length],
      __selectorTier: tier,
    }));
    return {
      tier,
      pool: tieredPool,
      reason: 'phrase_carrier',
      fallback: noMeta
        ? {
            reason: 'no_frequency_metadata',
            detail: 'Some trials lacked frequency metadata; carrier applied but frequency band could not be enforced.',
            skipped: false,
          }
        : null,
      diagnostics: diag(filtered),
    };
  }

  // L8 → generalization probe pool.
  if (probeBank.length < MIN_TIER_POOL_SIZE) {
    return {
      tier: 'L8',
      pool: [],
      reason: 'baseline',
      fallback: {
        reason: 'no_probe_words_available',
        detail: `Need ≥${MIN_TIER_POOL_SIZE} probe words; only ${probeBank.length} available.`,
        skipped: true,
      },
      diagnostics: { totalCandidates: 0, poolSize: 0, distinctCategories: 0 },
    };
  }
  const probePool: ClinicalTieredTrial[] = probeBank.map((t) => ({
    ...t,
    isGeneralizationProbe: true,
    __selectorTier: 'L8',
  }));
  return {
    tier: 'L8',
    pool: probePool,
    reason: 'generalization_probe',
    fallback: null,
    diagnostics: diag(probeBank),
  };
}

/**
 * Persist the latest selector decision to sessionStorage so dev tools
 * (e.g. /dev/progression-state) can show what the engine actually used.
 * Browser-only — no-op in tests/SSR.
 */
const DIAG_KEY = 'photoNamingSelectorDiagnostics';

export function writeSelectorDiagnostics(result: SelectorResult, clinicalLevel: number): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const payload = {
      at: new Date().toISOString(),
      clinicalLevel,
      tier: result.tier,
      reason: result.reason,
      fallback: result.fallback,
      diagnostics: result.diagnostics,
      sampleTargets: result.pool.slice(0, 6).map((t) => t.target),
    };
    sessionStorage.setItem(DIAG_KEY, JSON.stringify(payload));
  } catch {
    /* noop */
  }
}

export function readSelectorDiagnostics(): unknown | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(DIAG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
