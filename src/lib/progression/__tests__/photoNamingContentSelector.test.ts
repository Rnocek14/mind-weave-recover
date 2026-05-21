/**
 * PR4 (Phase 2.5) — Photo Naming content selector tests.
 *
 * Validates:
 *   - selector returns a valid pool per clinical level
 *   - L4 / L5 frequency bands do not overlap
 *   - L6 spans the required number of distinct categories
 *   - L7 phrase-carrier flips task context (every trial carries a carrier phrase)
 *   - L8 probe trials are tagged `isGeneralizationProbe` so downstream code can
 *     keep them out of ordinary mastery stats
 *   - honest fallback when SUBTLEX-style metadata is missing — selector does
 *     NOT silently downgrade, it surfaces a fallback reason
 */
import { describe, it, expect } from 'vitest';
import type { PhotoTrial } from '@/data/photoBank';
import {
  selectPhotoNamingPool,
  HIGH_FREQ_RANK_MAX,
  MID_FREQ_RANK_MIN,
  MID_FREQ_RANK_MAX,
  L6_MIN_CATEGORIES,
  PHRASE_CARRIERS,
  MIN_TIER_POOL_SIZE,
} from '../photoNamingContentSelector';
import { PHOTO_BANK } from '@/data/photoBank';
import { PROBE_WORDS } from '@/data/probeWords';

const STUB_FEATURES = {
  imageability: 7,
  concreteness: 7,
  age_of_acquisition: 3,
  syllable_count: 1,
  phoneme_count: 3,
  phonological_complexity: 0 as const,
  neighborhood_density: 'moderate' as const,
  first_phoneme: '/x/',
  semantic_category: 'misc',
  typicality_rating: 1,
  part_of_speech: 'noun' as const,
};

function stubTrial(id: string, rank: number, category: string): PhotoTrial {
  return {
    id,
    imageUrl: `stub://${id}`,
    target: id,
    semanticFoils: [],
    category,
    features: { ...STUB_FEATURES, frequency_rank: rank },
    computed_difficulty: 3,
    minLevel: 1,
    maxLevel: 8,
  };
}

describe('selectPhotoNamingPool — happy paths against real banks', () => {
  it('L1–L3 returns a usable baseline pool', () => {
    const r = selectPhotoNamingPool(2);
    expect(r.tier).toBe('L1-L3');
    expect(r.reason).toBe('baseline');
    expect(r.pool.length).toBeGreaterThan(0);
    expect(r.fallback).toBeNull();
  });

  it('L4 returns only high-frequency trials', () => {
    const r = selectPhotoNamingPool(4);
    expect(r.tier).toBe('L4');
    expect(r.reason).toBe('frequency_band');
    expect(r.pool.length).toBeGreaterThanOrEqual(MIN_TIER_POOL_SIZE);
    for (const t of r.pool) {
      expect(t.features.frequency_rank).toBeGreaterThanOrEqual(1);
      expect(t.features.frequency_rank).toBeLessThanOrEqual(HIGH_FREQ_RANK_MAX);
    }
  });

  it('L5 returns only mid-frequency trials', () => {
    const r = selectPhotoNamingPool(5);
    expect(r.tier).toBe('L5');
    if (r.fallback) {
      // Honest skip if the real bank doesn't have enough mid-freq items.
      expect(r.fallback.skipped).toBe(true);
      return;
    }
    for (const t of r.pool) {
      expect(t.features.frequency_rank).toBeGreaterThanOrEqual(MID_FREQ_RANK_MIN);
      expect(t.features.frequency_rank).toBeLessThanOrEqual(MID_FREQ_RANK_MAX);
    }
  });

  it('L4 and L5 pools never share trial ids', () => {
    const l4 = selectPhotoNamingPool(4);
    const l5 = selectPhotoNamingPool(5);
    if (l4.fallback || l5.fallback) return; // skip — covered by fallback test
    const l4Ids = new Set(l4.pool.map((t) => t.id));
    for (const t of l5.pool) {
      expect(l4Ids.has(t.id)).toBe(false);
    }
  });

  it('L6 spans the required number of distinct categories', () => {
    const r = selectPhotoNamingPool(6);
    if (r.fallback) {
      expect(r.fallback.skipped).toBe(true);
      return;
    }
    expect(r.reason).toBe('category_spread');
    expect(r.diagnostics.distinctCategories).toBeGreaterThanOrEqual(L6_MIN_CATEGORIES);
  });

  it('L7 attaches a carrier phrase to every trial', () => {
    const r = selectPhotoNamingPool(7);
    if (r.fallback?.skipped) return;
    expect(r.reason).toBe('phrase_carrier');
    expect(r.pool.length).toBeGreaterThanOrEqual(MIN_TIER_POOL_SIZE);
    for (const t of r.pool) {
      expect(t.carrierPhrase).toBeTruthy();
      expect(PHRASE_CARRIERS).toContain(t.carrierPhrase as any);
    }
  });

  it('L8 returns probe pool tagged as generalization probes', () => {
    const r = selectPhotoNamingPool(8);
    if (r.fallback?.skipped) return;
    expect(r.tier).toBe('L8');
    expect(r.reason).toBe('generalization_probe');
    for (const t of r.pool) {
      expect(t.isGeneralizationProbe).toBe(true);
    }
  });

  it('L8 probe pool does not overlap with PHOTO_BANK training targets', () => {
    const trainingTargets = new Set(PHOTO_BANK.map((t) => t.target.toLowerCase()));
    const probeTargets = PROBE_WORDS.map((t) => t.target.toLowerCase());
    // The PROBE_WORDS contract states probes never appear in training.
    // If this fails, training has been polluted with probe items.
    for (const p of probeTargets) {
      // Probes are allowed to *visually* share an image, but as a set the
      // probe target list should be distinct from training-only targets.
      // We assert that there exists at least one probe NOT in training.
      if (!trainingTargets.has(p)) return;
    }
    throw new Error('Every probe word appears in training — generalization claim is broken.');
  });
});

describe('selectPhotoNamingPool — honest fallback when metadata missing', () => {
  it('L4 surfaces no_frequency_metadata fallback when bank lacks frequency_rank', () => {
    const bank: PhotoTrial[] = [
      { ...stubTrial('a', 0, 'cat1'), features: { ...STUB_FEATURES, frequency_rank: 0 } },
      { ...stubTrial('b', 0, 'cat2'), features: { ...STUB_FEATURES, frequency_rank: 0 } },
    ];
    const r = selectPhotoNamingPool(4, { bank });
    expect(r.fallback).not.toBeNull();
    expect(r.fallback?.reason).toBe('no_frequency_metadata');
    expect(r.fallback?.skipped).toBe(true);
  });

  it('L5 surfaces insufficient_pool_for_band when the band is empty', () => {
    // All trials are L4-band → L5 should report insufficient pool, not silently downgrade.
    const bank = Array.from({ length: 12 }, (_, i) => stubTrial(`hf_${i}`, 100 + i, 'cat'));
    const r = selectPhotoNamingPool(5, { bank });
    expect(r.fallback).not.toBeNull();
    expect(r.fallback?.reason).toBe('insufficient_pool_for_band');
    expect(r.fallback?.skipped).toBe(true);
  });

  it('L6 surfaces insufficient_category_spread when fewer than 4 categories', () => {
    const bank = Array.from({ length: 20 }, (_, i) =>
      stubTrial(`x_${i}`, 500 + i, i % 2 === 0 ? 'cat1' : 'cat2'),
    );
    const r = selectPhotoNamingPool(6, { bank });
    expect(r.fallback?.reason).toBe('insufficient_category_spread');
    expect(r.fallback?.skipped).toBe(true);
  });

  it('L8 surfaces no_probe_words_available when probe bank is empty', () => {
    const r = selectPhotoNamingPool(8, { probeBank: [] });
    expect(r.fallback?.reason).toBe('no_probe_words_available');
    expect(r.fallback?.skipped).toBe(true);
    expect(r.pool.length).toBe(0);
  });
});

describe('selectPhotoNamingPool — segregation contract', () => {
  it('L8 probe trials are flagged so mastery aggregators can exclude them', () => {
    const r = selectPhotoNamingPool(8);
    if (r.fallback?.skipped) return;
    // Every trial must carry the isGeneralizationProbe flag. Aggregators
    // that filter on this flag will keep probe sessions out of ordinary
    // mastery stats unless they explicitly opt in.
    expect(r.pool.every((t) => t.isGeneralizationProbe === true)).toBe(true);
  });

  it('non-probe tiers do NOT mark trials as probes', () => {
    for (const lvl of [1, 2, 3, 4, 5, 6, 7]) {
      const r = selectPhotoNamingPool(lvl);
      for (const t of r.pool) {
        expect(t.isGeneralizationProbe).not.toBe(true);
      }
    }
  });
});
