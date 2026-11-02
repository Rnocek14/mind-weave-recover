/**
 * Per-Game Level-Up + Regression Contract
 *
 * Parametrized read-only assertions across every progression module that
 * powers a live `use*Progression` hook. Validates the shared shape:
 *
 *   - evidenceMetForXLevel(trials, level)   → boolean
 *   - calculateXProgressDelta(trials, level) → number
 *   - highestImplementedXLevel()             → number in [1, MAX_LEVEL]
 *
 * For each slug we assert:
 *   1. highestImplementedLevel() is a sane integer in [1, MAX_LEVEL].
 *   2. A "perfect" trial pool (many corrects, independent across every
 *      support tier) → evidenceMet === true at L1.
 *   3. An empty pool → evidenceMet === false at L1.
 *   4. An all-incorrect pool → evidenceMet === false at L1.
 *   5. Perfect pool yields STRICTLY MORE progress than the all-incorrect
 *      pool (regression-pressure: failure must never out-credit success).
 *
 * Pure functions only. No I/O, no logic changes, no hook mounting.
 *
 * narrative_retell intentionally excluded — it does not yet expose the
 * uniform contract shape (no evidenceMetForXLevel export).
 */
import { describe, it, expect } from 'vitest';
import { MAX_LEVEL, applySessionToState, defaultProgressionState, type SupportLevel } from '@/lib/progression/clinicalProgression';

import * as PhotoNaming from '@/lib/progression/photoNamingLevels';
import * as FixSentence from '@/lib/progression/fixSentenceLevels';
import * as TwoClues from '@/lib/progression/twoCluesLevels';
import * as MeaningMatch from '@/lib/progression/meaningMatchLevels';
import * as Synonym from '@/lib/progression/synonymGeneratorLevels';
import * as Detective from '@/lib/progression/detectiveMindLevels';
import * as MultiStep from '@/lib/progression/multiStepPlanningLevels';
import * as SemanticFeatures from '@/lib/progression/semanticFeaturesLevels';
import * as PhonoAware from '@/lib/progression/phonologicalAwarenessLevels';
import * as DualLoad from '@/lib/progression/dualLoadNamingLevels';
import * as MinimalPairs from '@/lib/progression/minimalPairsLevels';
import * as CategoryFluency from '@/lib/progression/categoryFluencyLevels';
import * as SentenceConstruction from '@/lib/progression/sentenceConstructionLevels';

type Trial = { correct: boolean; support: SupportLevel };

interface SlugSpec {
  slug: string;
  evidenceMet: (trials: Trial[], level: number) => boolean;
  progressDelta: (trials: Trial[], level: number) => number;
  highestImplemented: () => number;
}

const SLUGS: SlugSpec[] = [
  {
    slug: 'photo_naming',
    evidenceMet: PhotoNaming.evidenceMetForLevel,
    progressDelta: PhotoNaming.calculateLevelAwareProgressDelta,
    highestImplemented: PhotoNaming.highestImplementedPhotoNamingLevel,
  },
  {
    slug: 'fix_sentence',
    evidenceMet: FixSentence.evidenceMetForFixSentenceLevel,
    progressDelta: FixSentence.calculateFixSentenceProgressDelta,
    highestImplemented: FixSentence.highestImplementedFixSentenceLevel,
  },
  {
    slug: 'two_clues',
    evidenceMet: TwoClues.evidenceMetForTwoCluesLevel,
    progressDelta: TwoClues.calculateTwoCluesProgressDelta,
    highestImplemented: TwoClues.highestImplementedTwoCluesLevel,
  },
  {
    slug: 'meaning_match',
    evidenceMet: MeaningMatch.evidenceMetForMeaningMatchLevel,
    progressDelta: MeaningMatch.calculateMeaningMatchProgressDelta,
    highestImplemented: MeaningMatch.highestImplementedMeaningMatchLevel,
  },
  {
    slug: 'synonym_generator',
    evidenceMet: Synonym.evidenceMetForSynonymGeneratorLevel,
    progressDelta: Synonym.calculateSynonymGeneratorProgressDelta,
    highestImplemented: Synonym.highestImplementedSynonymGeneratorLevel,
  },
  {
    slug: 'detective_mind',
    evidenceMet: Detective.evidenceMetForDetectiveMindLevel,
    progressDelta: Detective.calculateDetectiveMindProgressDelta,
    highestImplemented: Detective.highestImplementedDetectiveMindLevel,
  },
  {
    slug: 'multi_step_planning',
    evidenceMet: MultiStep.evidenceMetForMultiStepPlanningLevel,
    progressDelta: MultiStep.calculateMultiStepPlanningProgressDelta,
    highestImplemented: MultiStep.highestImplementedMultiStepPlanningLevel,
  },
  {
    slug: 'semantic_features',
    evidenceMet: SemanticFeatures.evidenceMetForSemanticFeaturesLevel,
    progressDelta: SemanticFeatures.calculateSemanticFeaturesProgressDelta,
    highestImplemented: SemanticFeatures.highestImplementedSemanticFeaturesLevel,
  },
  {
    slug: 'phonological_awareness',
    evidenceMet: PhonoAware.evidenceMetForPhonologicalAwarenessLevel,
    progressDelta: PhonoAware.calculatePhonologicalAwarenessProgressDelta,
    highestImplemented: PhonoAware.highestImplementedPhonologicalAwarenessLevel,
  },
  {
    slug: 'dual_load_naming',
    evidenceMet: DualLoad.evidenceMetForDualLoadNamingLevel,
    progressDelta: DualLoad.calculateDualLoadNamingProgressDelta,
    highestImplemented: DualLoad.highestImplementedDualLoadNamingLevel,
  },
  {
    slug: 'minimal_pairs',
    evidenceMet: MinimalPairs.evidenceMetForMinimalPairsLevel,
    progressDelta: MinimalPairs.calculateMinimalPairsProgressDelta,
    highestImplemented: MinimalPairs.highestImplementedMinimalPairsLevel,
  },
  {
    slug: 'category_fluency',
    evidenceMet: CategoryFluency.evidenceMetForCategoryFluencyLevel,
    progressDelta: CategoryFluency.calculateCategoryFluencyProgressDelta,
    highestImplemented: CategoryFluency.highestImplementedCategoryFluencyLevel,
  },
  {
    slug: 'sentence_construction',
    evidenceMet: SentenceConstruction.evidenceMetForSentenceConstructionLevel,
    progressDelta: SentenceConstruction.calculateSentenceConstructionProgressDelta,
    highestImplemented: SentenceConstruction.highestImplementedSentenceConstructionLevel,
  },
];

// Every support tier the system understands, all correct. This guarantees
// whatever the slug's L1 on-target tier is, it's well-represented.
const ALL_SUPPORTS: SupportLevel[] = [
  'independent',
  'semantic_cue',
  'phonemic_cue',
  'carrier_or_full_model',
  'recognition_only',
  'open_response',
  'choice_based',
  'highlight_plus_choice',
  'first_listen',
  'after_replay',
  'after_multiple_replays',
];

function perfectPool(): Trial[] {
  const trials: Trial[] = [];
  // 4 correct of every support → 44 trials, comfortably above any
  // minOnTargetAttempts threshold in the level specs.
  for (const support of ALL_SUPPORTS) {
    for (let i = 0; i < 4; i++) trials.push({ correct: true, support });
  }
  return trials;
}

function failurePool(): Trial[] {
  const trials: Trial[] = [];
  for (const support of ALL_SUPPORTS) {
    for (let i = 0; i < 4; i++) trials.push({ correct: false, support });
  }
  return trials;
}

describe('Per-Game Progression Contract — level-up + regression', () => {
  describe.each(SLUGS)('$slug', (spec) => {
    it('highestImplementedLevel() returns an integer in [1, MAX_LEVEL]', () => {
      const top = spec.highestImplemented();
      expect(Number.isInteger(top), `top=${top}`).toBe(true);
      expect(top).toBeGreaterThanOrEqual(1);
      expect(top).toBeLessThanOrEqual(MAX_LEVEL);
    });

    it('evidenceMet === true for a perfect L1 trial pool', () => {
      expect(spec.evidenceMet(perfectPool(), 1)).toBe(true);
    });

    it('evidenceMet === false for an empty trial pool at L1', () => {
      expect(spec.evidenceMet([], 1)).toBe(false);
    });

    it('evidenceMet === false for an all-incorrect L1 pool', () => {
      expect(spec.evidenceMet(failurePool(), 1)).toBe(false);
    });

    it('regression contract: perfect pool yields strictly more progress than failure pool', () => {
      const win = spec.progressDelta(perfectPool(), 1);
      const lose = spec.progressDelta(failurePool(), 1);
      expect(win, `win=${win} lose=${lose}`).toBeGreaterThan(lose);
      // Failure pool must never grant net-positive progress.
      expect(lose).toBeLessThanOrEqual(0);
    });
  });

  it('each implemented rung rejects no evidence and all-wrong evidence', () => {
    for (const spec of SLUGS) {
      for (let level = 1; level <= spec.highestImplemented(); level++) {
        expect(spec.evidenceMet([], level), spec.slug + ' L' + level + ' empty').toBe(false);
        expect(spec.evidenceMet(failurePool(), level), spec.slug + ' L' + level + ' wrong').toBe(false);
        expect(spec.progressDelta(perfectPool(), level),
          spec.slug + ' L' + level + ' should reward observed success')
          .toBeGreaterThan(spec.progressDelta(failurePool(), level));
      }
    }
  });

  it('no session can award an aspirational level above the shipped game ceiling', () => {
    for (const spec of SLUGS) {
      const cap = spec.highestImplemented();
      const prev = {
        ...defaultProgressionState({
          userId: 'synthetic', profileId: 'synthetic-patient',
          exerciseSlug: spec.slug,
        }),
        currentLevel: cap,
        stableLevel: cap,
        progressPct: 99,
      };
      const next = applySessionToState(prev, {
        trials: Array.from({ length: 20 }, () => ({
          correct: true, support: 'independent' as const,
        })),
        evidenceMet: true,
        progressDelta: 500,
        maxImplementedLevel: cap,
        masteryVerdict: 'pass',
      });
      expect(next.currentLevel, spec.slug).toBe(cap);
      expect(next.progressPct, spec.slug).toBe(100);
    }
  });

  it('all 13 adopted slugs are covered (sanity)', () => {
    expect(SLUGS.map((s) => s.slug).sort()).toEqual(
      [
        'category_fluency',
        'detective_mind',
        'dual_load_naming',
        'fix_sentence',
        'meaning_match',
        'minimal_pairs',
        'multi_step_planning',
        'phonological_awareness',
        'photo_naming',
        'semantic_features',
        'sentence_construction',
        'synonym_generator',
        'two_clues',
      ].sort(),
    );
  });
});
