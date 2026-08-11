/**
 * Semantic Features d=5 tier integrity — the L8 unlock contract.
 *
 * The L8 rung went live when the bank's difficulty-5 pool was expanded
 * (9 → 20). These tests pin the tier's empirical register so future
 * additions stay calibrated (longitudinal-difficulty directive):
 *   - pool depth matches the other tiers (≥ 20)
 *   - the low-frequency cohort carries ≥2 abstractness-5 correct features
 *     (what separates d=5 from d=4's single-'specialized' register)
 *   - options stay well-formed (no distractor also listed as correct)
 *   - the ladder ceiling actually reaches L8
 */
import { describe, it, expect } from 'vitest';
import { SEMANTIC_TRIALS } from '@/data/semanticFeatureBank';
import {
  SEMANTIC_FEATURES_LEVELS,
  highestImplementedSemanticFeaturesLevel,
} from '@/lib/progression/semanticFeaturesLevels';

const d5 = SEMANTIC_TRIALS.filter((t) => t.difficulty === 5);

/** HF items that predate the low-frequency register; exempt from it. */
const GRANDFATHERED_HF = new Set(['house', 'hand']);

describe('semantic feature bank — difficulty-5 tier integrity', () => {
  it('holds at least 20 trials (matches every other tier)', () => {
    expect(d5.length).toBeGreaterThanOrEqual(20);
  });

  it('has no duplicate words within the tier', () => {
    const words = d5.map((t) => t.word);
    expect(new Set(words).size).toBe(words.length);
  });

  it('low-frequency cohort matches the d=5 register: low frequency + ≥2 abstractness-5 features', () => {
    for (const t of d5) {
      if (GRANDFATHERED_HF.has(t.word)) continue;
      expect(t.wordFrequency, `${t.word} should be low-frequency`).toBe('low');
      const abs5 = t.correctFeatures.filter((f) => f.abstractness === 5).length;
      expect(abs5, `${t.word} needs ≥2 abstractness-5 correct features, has ${abs5}`)
        .toBeGreaterThanOrEqual(2);
    }
  });

  it('every trial is well-formed: 4–8 correct features, ≥4 distractors, no overlap', () => {
    for (const t of d5) {
      expect(t.correctFeatures.length, t.word).toBeGreaterThanOrEqual(4);
      expect(t.correctFeatures.length, t.word).toBeLessThanOrEqual(8);
      expect(t.typicalDistractors.length, t.word).toBeGreaterThanOrEqual(4);
      const correctTexts = new Set(t.correctFeatures.map((f) => f.text));
      for (const d of t.typicalDistractors) {
        expect(correctTexts.has(d.text), `${t.word}: distractor "${d.text}" is also a correct feature`).toBe(false);
      }
      // No duplicate feature texts within either list.
      expect(correctTexts.size).toBe(t.correctFeatures.length);
      const distractorTexts = new Set(t.typicalDistractors.map((f) => f.text));
      expect(distractorTexts.size).toBe(t.typicalDistractors.length);
    }
  });

  it('the ladder ceiling reaches L8 and the spec mirrors the pool', () => {
    expect(highestImplementedSemanticFeaturesLevel()).toBe(8);
    expect(SEMANTIC_FEATURES_LEVELS[8].contentSelector?.implemented).toBe(true);
    expect(SEMANTIC_FEATURES_LEVELS[8].readiness).toBe('thin');
  });
});
