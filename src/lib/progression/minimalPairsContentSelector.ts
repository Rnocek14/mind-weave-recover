/**
 * Minimal Pairs — clinical content selector (PR5, Phase 2.5).
 *
 * Translates clinical level → content pool by *phonological contrast class*
 * and *signal condition*. Sister module to `photoNamingContentSelector.ts`.
 *
 * Tier rationale (see docs/clinical-evidence/minimal-pairs.md):
 *   L1–L3 baseline (existing engine difficulty bands handle this).
 *   L4    place-of-articulation contrasts only, quiet listening condition.
 *   L5    manner-of-articulation contrasts only, quiet condition.
 *   L6    voicing contrasts only, quiet — higher acoustic confusability.
 *   L7    ANY contrast under degraded signal (SNR / low-pass). The audio
 *         pipeline does NOT yet support signal degradation, so L7 is
 *         honestly SKIPPED with `signal_condition_not_implemented`.
 *   L8    triplet discrimination (3-AFC) + reaction-time pressure band.
 *         Neither the triplet trial type nor RT-band logic exists, so L8
 *         is honestly SKIPPED with `triplet_mode_not_implemented`.
 *
 * Honest fallbacks: no silent downgrade. Caller inspects `fallback`.
 *
 * Pure module — no I/O, no React, no DB.
 */

import type { MinimalPairTrial, MinimalPair } from '@/data/minimalPairsBank';
import { getMinimalPairTrials } from '@/data/minimalPairsBank';

export type ContrastClass = 'place' | 'manner' | 'voicing' | 'vowel' | 'mixed';
export type SignalCondition = 'quiet' | 'noise_snr_low' | 'low_pass';

export const MIN_PAIR_TIER_POOL_SIZE = 4;

/**
 * Coarse contrast-class taxonomy. The bank stores fine-grained labels
 * like `stop_fricative` or `nasal_approximant` (manner-type contrasts),
 * `place_voicing` (mixed), etc. This classifier collapses them onto the
 * four high-level contrast classes used in clinical discrimination work.
 */
export function classifyContrast(pair: MinimalPair): ContrastClass {
  const c = pair.category;
  if (c === 'place') return 'place';
  if (c === 'voicing' || c === 'final_voicing') return 'voicing';
  if (c === 'vowel') return 'vowel';
  if (c === 'place_voicing') return 'mixed';
  // Everything else (stop_fricative, fricative_affricate, nasal_*,
  // cluster_*, liquid, th_contrast, zh_sound, y_sound, stop_approximant,
  // fricative_approximant, manner, nasal) is a manner-class contrast.
  return 'manner';
}

export type MinimalPairsSelectorTier = 'L1-L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8';

export type MinimalPairsFallbackReason =
  | 'insufficient_pool_for_class'
  | 'no_photos_for_class'
  | 'signal_condition_not_implemented'
  | 'triplet_mode_not_implemented';

export interface MinimalPairsFallback {
  reason: MinimalPairsFallbackReason;
  detail: string;
  skipped: boolean;
}

export interface MinimalPairsSelectorDiagnostics {
  totalCandidates: number;
  poolSize: number;
  contrastClass?: ContrastClass;
  signalCondition: SignalCondition;
  classCounts?: Record<string, number>;
}

export interface ClinicalTieredMinimalPairTrial extends MinimalPairTrial {
  /** Contrast class assigned by the selector. */
  __contrastClass?: ContrastClass;
  /** Signal condition the trial was selected under (always 'quiet' today). */
  __signalCondition?: SignalCondition;
  /** Tier the selector placed this trial in. */
  __selectorTier?: MinimalPairsSelectorTier;
}

export interface MinimalPairsSelectorResult {
  tier: MinimalPairsSelectorTier;
  pool: ClinicalTieredMinimalPairTrial[];
  reason: 'baseline' | 'place_contrast' | 'manner_contrast' | 'voicing_contrast' | 'degraded_signal' | 'triplet_rt';
  fallback: MinimalPairsFallback | null;
  diagnostics: MinimalPairsSelectorDiagnostics;
}

interface SelectOptions {
  /** Override the source bank (used by tests). */
  trials?: MinimalPairTrial[];
}

function tierFor(level: number): MinimalPairsSelectorTier {
  if (level <= 3) return 'L1-L3';
  if (level === 4) return 'L4';
  if (level === 5) return 'L5';
  if (level === 6) return 'L6';
  if (level === 7) return 'L7';
  return 'L8';
}

function classCountsOf(trials: MinimalPairTrial[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const t of trials) {
    const k = classifyContrast(t.pair);
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

function tagPool(
  trials: MinimalPairTrial[],
  tier: MinimalPairsSelectorTier,
  signal: SignalCondition,
): ClinicalTieredMinimalPairTrial[] {
  return trials.map((t) => ({
    ...t,
    __contrastClass: classifyContrast(t.pair),
    __signalCondition: signal,
    __selectorTier: tier,
  }));
}

export function selectMinimalPairsPool(
  clinicalLevel: number,
  opts: SelectOptions = {},
): MinimalPairsSelectorResult {
  const trials = opts.trials ?? getMinimalPairTrials();
  const tier = tierFor(clinicalLevel);
  const counts = classCountsOf(trials);

  // L1–L3 → baseline; selector is a no-op (engine bands handle content).
  if (tier === 'L1-L3') {
    return {
      tier,
      pool: tagPool(trials, tier, 'quiet'),
      reason: 'baseline',
      fallback: null,
      diagnostics: {
        totalCandidates: trials.length,
        poolSize: trials.length,
        signalCondition: 'quiet',
        classCounts: counts,
      },
    };
  }

  // L4 / L5 / L6 → contrast-class filtered, quiet listening condition.
  if (tier === 'L4' || tier === 'L5' || tier === 'L6') {
    const targetClass: ContrastClass =
      tier === 'L4' ? 'place' : tier === 'L5' ? 'manner' : 'voicing';
    const reason: MinimalPairsSelectorResult['reason'] =
      tier === 'L4' ? 'place_contrast' : tier === 'L5' ? 'manner_contrast' : 'voicing_contrast';
    const filtered = trials.filter((t) => classifyContrast(t.pair) === targetClass);
    if (filtered.length < MIN_PAIR_TIER_POOL_SIZE) {
      return {
        tier,
        pool: tagPool(trials, 'L1-L3', 'quiet'),
        reason: 'baseline',
        fallback: {
          reason: 'insufficient_pool_for_class',
          detail: `Need ≥${MIN_PAIR_TIER_POOL_SIZE} ${targetClass}-class pairs with photos; got ${filtered.length}.`,
          skipped: true,
        },
        diagnostics: {
          totalCandidates: trials.length,
          poolSize: filtered.length,
          contrastClass: targetClass,
          signalCondition: 'quiet',
          classCounts: counts,
        },
      };
    }
    return {
      tier,
      pool: tagPool(filtered, tier, 'quiet'),
      reason,
      fallback: null,
      diagnostics: {
        totalCandidates: trials.length,
        poolSize: filtered.length,
        contrastClass: targetClass,
        signalCondition: 'quiet',
        classCounts: counts,
      },
    };
  }

  // L7 → degraded-signal condition (noise SNR or low-pass).
  // The audio pipeline does NOT support signal degradation today. Per
  // honesty rules, we MUST skip and surface a fallback — never silently
  // present a quiet trial labeled "noise condition".
  if (tier === 'L7') {
    return {
      tier,
      pool: tagPool(trials, 'L1-L3', 'quiet'),
      reason: 'baseline',
      fallback: {
        reason: 'signal_condition_not_implemented',
        detail:
          'L7 requires noise/low-pass signal degradation; the audio pipeline does not yet support SNR or low-pass injection. Tier is skipped — do not claim degraded-signal evidence.',
        skipped: true,
      },
      diagnostics: {
        totalCandidates: trials.length,
        poolSize: trials.length,
        signalCondition: 'quiet',
        classCounts: counts,
      },
    };
  }

  // L8 → triplet (3-AFC) discrimination under RT pressure.
  // Neither the triplet trial type nor RT-band scoring exists. Skip.
  return {
    tier: 'L8',
    pool: [],
    reason: 'triplet_rt',
    fallback: {
      reason: 'triplet_mode_not_implemented',
      detail:
        'L8 requires triplet (3-AFC) discrimination + reaction-time pressure band. Neither the triplet trial type nor RT-band scoring exists. Tier is skipped — do not claim triplet evidence.',
      skipped: true,
    },
    diagnostics: {
      totalCandidates: trials.length,
      poolSize: 0,
      signalCondition: 'quiet',
      classCounts: counts,
    },
  };
}

// ── Diagnostics persistence (browser-only) ───────────────────────────────

const DIAG_KEY = 'minimalPairsSelectorDiagnostics';

export function writeMinimalPairsSelectorDiagnostics(
  result: MinimalPairsSelectorResult,
  clinicalLevel: number,
): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const payload = {
      at: new Date().toISOString(),
      clinicalLevel,
      tier: result.tier,
      reason: result.reason,
      fallback: result.fallback,
      diagnostics: result.diagnostics,
      samplePairs: result.pool.slice(0, 6).map((t) => `${t.pair.word1}/${t.pair.word2}`),
    };
    sessionStorage.setItem(DIAG_KEY, JSON.stringify(payload));
  } catch {
    /* noop */
  }
}

export function readMinimalPairsSelectorDiagnostics(): unknown | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(DIAG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
