/**
 * PR6 (Phase 2.5) — Fix Sentence content selector tests.
 *
 * Validates:
 *   - L1–L3 baseline returns the full bank, no fallback
 *   - L4 narrows to function_error + common-verb sentences
 *   - L4 falls back honestly when the candidate pool is too small
 *   - L5 serves the two-error cohort (two-phase repair loop shipped)
 *   - L6 / L7 / L8 are flagged NOT IMPLEMENTED — selector returns a
 *     `skipped: true` fallback rather than silently downgrading
 *   - level spec contentSelector.implemented mirrors the selector behaviour
 */
import { describe, it, expect } from 'vitest';
import type { FixSentenceTrial } from '@/data/fixSentenceBank';
import {
  selectFixSentencePool,
  L4_COMMON_VERBS,
  MIN_TIER_POOL_SIZE,
} from '../fixSentenceContentSelector';
import { FIX_SENTENCE_LEVELS } from '../fixSentenceLevels';

function trial(
  id: string,
  errorType: FixSentenceTrial['errorType'],
  sentence: string,
  difficulty: 1 | 2 | 3 = 3,
): FixSentenceTrial {
  return {
    id,
    sentence,
    wrongWord: 'x',
    wrongWordIndex: 0,
    acceptedFixes: ['y'],
    fixAliases: {},
    category: 'misc',
    difficulty,
    errorType,
    phonemeTargets: [],
  };
}

describe('selectFixSentencePool', () => {
  it('L1–L3 returns baseline with no fallback', () => {
    const r = selectFixSentencePool(2);
    expect(r.tier).toBe('L1-L3');
    expect(r.fallback).toBeNull();
    expect(r.reason).toBe('baseline');
    expect(r.pool.length).toBeGreaterThan(0);
  });

  it('L4 keeps only function_error + common-verb sentences', () => {
    const r = selectFixSentencePool(4);
    expect(r.tier).toBe('L4');
    if (r.fallback) {
      expect(r.fallback.skipped).toBe(true);
      return;
    }
    expect(r.reason).toBe('single_error_common_verbs');
    for (const t of r.pool) {
      expect(t.errorType).toBe('function_error');
      const hasVerb = L4_COMMON_VERBS.some((v) =>
        new RegExp(`\\b${v}\\b`).test(t.sentence.toLowerCase()),
      );
      expect(hasVerb).toBe(true);
    }
    expect(r.pool.length).toBeGreaterThanOrEqual(MIN_TIER_POOL_SIZE);
  });

  it('L4 falls back honestly when the candidate pool is too small', () => {
    const tinyBank: FixSentenceTrial[] = [
      trial('a', 'category_error', 'The dog and the cat met.'),
      trial('b', 'semantic_swap', 'She poured juice in a cup.'),
    ];
    const r = selectFixSentencePool(4, { bank: tinyBank });
    expect(r.fallback).not.toBeNull();
    expect(r.fallback?.reason).toBe('insufficient_pool_for_tier');
    expect(r.fallback?.skipped).toBe(true);
  });

  it('L5 serves the two-error cohort (game loop shipped)', () => {
    const r = selectFixSentencePool(5);
    expect(r.tier).toBe('L5');
    expect(r.fallback).toBeNull();
    expect(r.reason).toBe('two_error');
    expect(r.pool.length).toBeGreaterThanOrEqual(MIN_TIER_POOL_SIZE);
    for (const t of r.pool) {
      expect(t.secondError).toBeDefined();
    }
  });

  it.each([
    [6, 'morphology_tier_not_implemented'],
    [7, 'embedded_clause_tier_not_implemented'],
    [8, 'open_ended_repair_not_implemented'],
  ] as const)('L%i is flagged NOT implemented and skips honestly', (lvl, reason) => {
    const r = selectFixSentencePool(lvl);
    expect(r.fallback).not.toBeNull();
    expect(r.fallback?.reason).toBe(reason);
    expect(r.fallback?.skipped).toBe(true);
    // baseline pool is still returned so the game can keep playing
    expect(r.pool.length).toBeGreaterThan(0);
  });

  it('level-spec contentSelector.implemented matches selector behaviour', () => {
    for (const lvl of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const spec = FIX_SENTENCE_LEVELS[lvl];
      const r = selectFixSentencePool(lvl);
      const specImplemented = spec.contentSelector?.implemented ?? true;
      const runtimeImplemented = !(r.fallback?.skipped ?? false);
      // L1–L5 implemented (L4/L5 when their pools suffice); L6–L8 planned-only.
      if (runtimeImplemented) {
        expect(specImplemented).toBe(true);
      } else if (lvl >= 6) {
        expect(specImplemented).toBe(false);
      }
    }
  });
});
