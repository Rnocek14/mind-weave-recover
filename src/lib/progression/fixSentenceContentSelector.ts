/**
 * Fix Sentence — clinical content selector (PR6, Phase 2.5).
 *
 * Translates the *clinical* level (L1–L8) into a *content pool*. Before this
 * module existed, L4–L8 only raised accuracy bars — the patient saw the same
 * bank items as L1–L3. That made the upper levels clinically dishonest.
 *
 * Conservative tier mapping (mirrors PR4/PR5 honesty contract):
 *   L1–L3   baseline pool (engine difficulty bands already restrict content).
 *   L4      single-error sentences with common action verbs — drawn from the
 *           bank's `function_error` cohort (action→object mismatch on a
 *           common transitive verb is exactly what the cohort encodes).
 *   L5      two-error sentences — NOT IMPLEMENTED. The bank carries one
 *           `wrongWord` per item; multi-error scoring and detection UI do
 *           not exist. Selector returns a fallback and refuses to silently
 *           downgrade.
 *   L6      mixed morphology — NOT IMPLEMENTED. The bank has no
 *           morphology / inflection tags; the scorer cannot distinguish a
 *           morphological repair from a lexical one. Skipped honestly.
 *   L7      embedded clauses — NOT IMPLEMENTED. A small number of items
 *           are multi-clause *coordinated*, but no items are marked as
 *           true embedded (relative / complement) clauses, and there is
 *           no syntactic tag to filter on. Skipped honestly.
 *   L8      open-ended repair — NOT IMPLEMENTED. Today every trial scores
 *           against a closed `acceptedFixes` set; an open-ended repair
 *           tier requires an LLM-graded judge (or expanded fix banks).
 *           Until that exists, do NOT pretend L8 is open-ended.
 *
 * Honest fallbacks: when a tier is not implemented, the selector returns
 * a `fallback` description with `skipped: true` and an upstream baseline
 * pool. We deliberately DO NOT silently downgrade — callers must inspect
 * `fallback` and surface the reason in diagnostics (see ProgressionStateDev).
 *
 * Pure module — no I/O, no React, no DB.
 */

import type { FixSentenceTrial } from '@/data/fixSentenceBank';
import { FIX_SENTENCE_BANK } from '@/data/fixSentenceBank';

// ── Tunables ───────────────────────────────────────────────────────────
export const MIN_TIER_POOL_SIZE = 6;

/**
 * Common transitive action verbs used by the L4 filter. Calibration default
 * — derived from inspection of the bank's tier-3 function_error cohort, not
 * from a published frequency list. Tunable.
 */
export const L4_COMMON_VERBS = [
  'washed','brushed','tied','wagged','drove','turned','sang','poured',
  'cut','opened','closed','wrote','read','ate','drank','cooked','baked',
  'fried','boiled','swept','mopped','wiped','dried','combed','shaved',
  'painted','hammered','nailed','sewed','watered','tightened','mailed',
  'measured','checked','put','pulled','pushed','threw','caught','held',
  'carried','lifted','dropped','poured','dialed','typed','called','locked',
  'unlocked','knocked','rang','seasoned','set','lit','raised','drained',
] as const;

export type SelectorTier = 'L1-L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8';

export type SelectorFallbackReason =
  | 'insufficient_pool_for_tier'
  | 'two_error_mode_not_implemented'
  | 'morphology_tier_not_implemented'
  | 'embedded_clause_tier_not_implemented'
  | 'open_ended_repair_not_implemented';

export interface SelectorFallback {
  reason: SelectorFallbackReason;
  detail: string;
  /** When true, caller should NOT advance level-up logic that depended on this tier. */
  skipped: boolean;
}

export interface SelectorDiagnostics {
  totalCandidates: number;
  poolSize: number;
  errorTypeCounts: Record<string, number>;
  /** Present when L4 verb filter applied. */
  verbMatched?: number;
}

export interface ClinicalTieredFixSentenceTrial extends FixSentenceTrial {
  __selectorTier?: SelectorTier;
}

export interface SelectorResult {
  tier: SelectorTier;
  pool: ClinicalTieredFixSentenceTrial[];
  reason:
    | 'baseline'
    | 'single_error_common_verbs'
    | 'two_error'
    | 'mixed_morphology'
    | 'embedded_clauses'
    | 'open_ended_repair';
  fallback: SelectorFallback | null;
  diagnostics: SelectorDiagnostics;
}

interface SelectOptions {
  bank?: FixSentenceTrial[];
}

function tierFor(clinicalLevel: number): SelectorTier {
  if (clinicalLevel <= 3) return 'L1-L3';
  if (clinicalLevel === 4) return 'L4';
  if (clinicalLevel === 5) return 'L5';
  if (clinicalLevel === 6) return 'L6';
  if (clinicalLevel === 7) return 'L7';
  return 'L8';
}

function countErrorTypes(pool: FixSentenceTrial[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const t of pool) m[t.errorType] = (m[t.errorType] ?? 0) + 1;
  return m;
}

function sentenceContainsCommonVerb(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return L4_COMMON_VERBS.some((v) => new RegExp(`\\b${v}\\b`).test(lower));
}

function baselineResult(
  tier: SelectorTier,
  bank: FixSentenceTrial[],
  fallback: SelectorFallback | null,
  reason: SelectorResult['reason'] = 'baseline',
): SelectorResult {
  return {
    tier,
    pool: bank.map((t) => ({ ...t, __selectorTier: tier })),
    reason,
    fallback,
    diagnostics: {
      totalCandidates: bank.length,
      poolSize: bank.length,
      errorTypeCounts: countErrorTypes(bank),
    },
  };
}

export function selectFixSentencePool(
  clinicalLevel: number,
  opts: SelectOptions = {},
): SelectorResult {
  const bank = opts.bank ?? FIX_SENTENCE_BANK;
  const tier = tierFor(clinicalLevel);

  // L1–L3 — baseline; engine difficulty bands already restrict content.
  if (tier === 'L1-L3') {
    return baselineResult(tier, bank, null);
  }

  // L4 — single-error sentences with common action verbs.
  if (tier === 'L4') {
    const candidates = bank.filter(
      (t) => t.errorType === 'function_error' && sentenceContainsCommonVerb(t.sentence),
    );
    if (candidates.length < MIN_TIER_POOL_SIZE) {
      return {
        ...baselineResult(tier, bank, {
          reason: 'insufficient_pool_for_tier',
          detail: `Only ${candidates.length} single-error/common-verb trials; need ≥${MIN_TIER_POOL_SIZE}. Falling back to baseline pool.`,
          skipped: true,
        }),
      };
    }
    return {
      tier,
      pool: candidates.map((t) => ({ ...t, __selectorTier: tier })),
      reason: 'single_error_common_verbs',
      fallback: null,
      diagnostics: {
        totalCandidates: bank.length,
        poolSize: candidates.length,
        errorTypeCounts: countErrorTypes(candidates),
        verbMatched: candidates.length,
      },
    };
  }

  // L5 — two-error sentences. NOT IMPLEMENTED.
  if (tier === 'L5') {
    return baselineResult(tier, bank, {
      reason: 'two_error_mode_not_implemented',
      detail:
        'Bank carries one wrongWord per trial; multi-error detection and scoring do not exist. Selector skips honestly — do NOT claim two-error tier.',
      skipped: true,
    });
  }

  // L6 — mixed morphology. NOT IMPLEMENTED.
  if (tier === 'L6') {
    return baselineResult(tier, bank, {
      reason: 'morphology_tier_not_implemented',
      detail:
        'No morphology/inflection tags on the bank; scorer cannot distinguish morphological repair from lexical. Selector skips honestly.',
      skipped: true,
    });
  }

  // L7 — embedded clauses. NOT IMPLEMENTED.
  if (tier === 'L7') {
    return baselineResult(tier, bank, {
      reason: 'embedded_clause_tier_not_implemented',
      detail:
        'No syntactic-structure tag on the bank. A few items are multi-clause coordinated, none are marked as true embedded (relative/complement) clauses. Selector skips honestly.',
      skipped: true,
    });
  }

  // L8 — open-ended repair. NOT IMPLEMENTED.
  return baselineResult(tier, bank, {
    reason: 'open_ended_repair_not_implemented',
    detail:
      'Every trial scores against a closed `acceptedFixes` set; open-ended repair needs an LLM-graded judge or expanded fix banks. Selector skips honestly — do NOT claim open-ended tier.',
    skipped: true,
  });
}

// ── Diagnostics persistence (browser-only; no-op in tests/SSR) ─────────
const DIAG_KEY = 'fixSentenceSelectorDiagnostics';

export function writeFixSentenceSelectorDiagnostics(
  result: SelectorResult,
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
      sampleSentences: result.pool.slice(0, 4).map((t) => t.sentence),
    };
    sessionStorage.setItem(DIAG_KEY, JSON.stringify(payload));
  } catch {
    /* noop */
  }
}

export function readFixSentenceSelectorDiagnostics(): unknown | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(DIAG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
