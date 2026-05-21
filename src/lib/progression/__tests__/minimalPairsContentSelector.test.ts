/**
 * PR5 (Phase 2.5) — Minimal Pairs content selector tests.
 *
 * Validates:
 *   - selector returns a valid pool per clinical level
 *   - L4 returns ONLY place-class contrasts
 *   - L5 returns ONLY manner-class contrasts
 *   - L6 returns ONLY voicing-class contrasts
 *   - L4/L5/L6 pools are disjoint by contrast class
 *   - L7 (degraded signal) honestly skips with `signal_condition_not_implemented`
 *   - L8 (triplet + RT band) honestly skips with `triplet_mode_not_implemented`
 *   - insufficient pool for a contrast class surfaces a fallback (no silent downgrade)
 */
import { describe, it, expect } from 'vitest';
import {
  selectMinimalPairsPool,
  classifyContrast,
  MIN_PAIR_TIER_POOL_SIZE,
  type ContrastClass,
} from '../minimalPairsContentSelector';
import type { MinimalPair, MinimalPairTrial } from '@/data/minimalPairsBank';

function stubPair(id: string, category: MinimalPair['category'] | string, difficulty = 2): MinimalPair {
  return {
    id,
    word1: `${id}_a`,
    word2: `${id}_b`,
    contrastType: 'initial',
    phoneme1: '/p/',
    phoneme2: '/b/',
    contrastDescription: 'stub',
    difficulty: difficulty as 1 | 2 | 3,
    category: category as MinimalPair['category'],
  };
}

function stubTrial(pair: MinimalPair): MinimalPairTrial {
  return {
    pair,
    trial1: { id: `${pair.id}_t1` } as any,
    trial2: { id: `${pair.id}_t2` } as any,
    targetIndex: 0,
    targetWord: pair.word1,
  };
}

describe('classifyContrast', () => {
  it('maps fine-grained categories onto contrast classes', () => {
    expect(classifyContrast(stubPair('a', 'place'))).toBe('place');
    expect(classifyContrast(stubPair('b', 'voicing'))).toBe('voicing');
    expect(classifyContrast(stubPair('c', 'final_voicing'))).toBe('voicing');
    expect(classifyContrast(stubPair('d', 'vowel'))).toBe('vowel');
    expect(classifyContrast(stubPair('e', 'place_voicing'))).toBe('mixed');
    expect(classifyContrast(stubPair('f', 'stop_fricative'))).toBe('manner');
    expect(classifyContrast(stubPair('g', 'nasal_approximant'))).toBe('manner');
    expect(classifyContrast(stubPair('h', 'liquid'))).toBe('manner');
  });
});

describe('selectMinimalPairsPool — happy paths against real bank', () => {
  it('L1–L3 returns a usable baseline pool, quiet condition', () => {
    const r = selectMinimalPairsPool(2);
    expect(r.tier).toBe('L1-L3');
    expect(r.reason).toBe('baseline');
    expect(r.fallback).toBeNull();
    expect(r.diagnostics.signalCondition).toBe('quiet');
    expect(r.pool.length).toBeGreaterThan(0);
  });

  it('L4 returns ONLY place-class contrasts', () => {
    const r = selectMinimalPairsPool(4);
    if (r.fallback?.skipped) {
      // bank-too-small skip is acceptable but must be honest.
      expect(r.fallback.reason).toBe('insufficient_pool_for_class');
      return;
    }
    expect(r.reason).toBe('place_contrast');
    expect(r.pool.length).toBeGreaterThanOrEqual(MIN_PAIR_TIER_POOL_SIZE);
    for (const t of r.pool) {
      expect(classifyContrast(t.pair)).toBe<ContrastClass>('place');
      expect(t.__signalCondition).toBe('quiet');
    }
  });

  it('L5 returns ONLY manner-class contrasts', () => {
    const r = selectMinimalPairsPool(5);
    if (r.fallback?.skipped) return;
    expect(r.reason).toBe('manner_contrast');
    for (const t of r.pool) {
      expect(classifyContrast(t.pair)).toBe<ContrastClass>('manner');
    }
  });

  it('L6 returns ONLY voicing-class contrasts', () => {
    const r = selectMinimalPairsPool(6);
    if (r.fallback?.skipped) return;
    expect(r.reason).toBe('voicing_contrast');
    for (const t of r.pool) {
      expect(classifyContrast(t.pair)).toBe<ContrastClass>('voicing');
    }
  });

  it('L4 / L5 / L6 pools are disjoint by contrast class', () => {
    const l4 = selectMinimalPairsPool(4);
    const l5 = selectMinimalPairsPool(5);
    const l6 = selectMinimalPairsPool(6);
    if (l4.fallback || l5.fallback || l6.fallback) return;
    const l4Ids = new Set(l4.pool.map((t) => t.pair.id));
    const l5Ids = new Set(l5.pool.map((t) => t.pair.id));
    const l6Ids = new Set(l6.pool.map((t) => t.pair.id));
    for (const id of l4Ids) {
      expect(l5Ids.has(id)).toBe(false);
      expect(l6Ids.has(id)).toBe(false);
    }
    for (const id of l5Ids) expect(l6Ids.has(id)).toBe(false);
  });
});

describe('selectMinimalPairsPool — honest skips for unimplemented mechanics', () => {
  it('L7 (degraded signal) skips honestly — does NOT silently present quiet trials as noise', () => {
    const r = selectMinimalPairsPool(7);
    expect(r.tier).toBe('L7');
    expect(r.fallback).not.toBeNull();
    expect(r.fallback?.reason).toBe('signal_condition_not_implemented');
    expect(r.fallback?.skipped).toBe(true);
    // Any pool returned for callback purposes must be tagged with the
    // actual (quiet) signal condition — never lie about the condition.
    for (const t of r.pool) {
      expect(t.__signalCondition).toBe('quiet');
    }
  });

  it('L8 (triplet + RT) skips honestly — does NOT silently present 2-AFC as triplet', () => {
    const r = selectMinimalPairsPool(8);
    expect(r.tier).toBe('L8');
    expect(r.fallback).not.toBeNull();
    expect(r.fallback?.reason).toBe('triplet_mode_not_implemented');
    expect(r.fallback?.skipped).toBe(true);
    expect(r.pool.length).toBe(0);
  });
});

describe('selectMinimalPairsPool — bank-too-small fallback', () => {
  it('L4 surfaces insufficient_pool_for_class when there are too few place pairs', () => {
    const trials = [stubTrial(stubPair('m1', 'manner')), stubTrial(stubPair('m2', 'manner'))];
    const r = selectMinimalPairsPool(4, { trials });
    expect(r.fallback?.reason).toBe('insufficient_pool_for_class');
    expect(r.fallback?.skipped).toBe(true);
  });

  it('L6 surfaces insufficient_pool_for_class when voicing bank is empty', () => {
    const trials = [
      stubTrial(stubPair('p1', 'place')),
      stubTrial(stubPair('p2', 'place')),
      stubTrial(stubPair('p3', 'place')),
      stubTrial(stubPair('p4', 'place')),
      stubTrial(stubPair('p5', 'place')),
    ];
    const r = selectMinimalPairsPool(6, { trials });
    expect(r.fallback?.reason).toBe('insufficient_pool_for_class');
    expect(r.fallback?.skipped).toBe(true);
  });
});
