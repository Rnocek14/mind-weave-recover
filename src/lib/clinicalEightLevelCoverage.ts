/**
 * Read-only eight-level coverage inventory across the single clinical registry.
 *
 * DO NOT interpret a defined rung as a validated treatment or an available
 * gameplay level. The live ceiling here is sourced from the same ceiling
 * functions that progression hooks use, while design-only rows explicitly
 * have NO enforced clinical level.
 */
import { CANONICAL_EXERCISES } from '@/data/canonicalExerciseRegistry';
import { CLINICAL_LADDER_REGISTRY, type ClinicalLadderEntry } from './clinicalLadderRegistry';
import { highestImplementedPhotoNamingLevel } from './progression/photoNamingLevels';
import { highestImplementedFixSentenceLevel } from './progression/fixSentenceLevels';
import { highestImplementedMinimalPairsLevel } from './progression/minimalPairsLevels';
import { highestImplementedSemanticFeaturesLevel } from './progression/semanticFeaturesLevels';
import { highestImplementedMeaningMatchLevel } from './progression/meaningMatchLevels';
import { highestImplementedTwoCluesLevel } from './progression/twoCluesLevels';
import { highestImplementedCategoryFluencyLevel } from './progression/categoryFluencyLevels';
import { highestImplementedSentenceConstructionLevel } from './progression/sentenceConstructionLevels';
import { highestImplementedMultiStepPlanningLevel } from './progression/multiStepPlanningLevels';
import { highestImplementedDetectiveMindLevel } from './progression/detectiveMindLevels';
import { highestImplementedSynonymGeneratorLevel } from './progression/synonymGeneratorLevels';
import { highestImplementedDualLoadNamingLevel } from './progression/dualLoadNamingLevels';
import { highestImplementedPhonologicalAwarenessLevel } from './progression/phonologicalAwarenessLevels';

export const CLINICAL_LEVEL_COUNT = 8 as const;

/**
 * Exactly those games with a persisted per-game clinical progression hook.
 * These functions compute the content-limited upper rung, NOT a patient's
 * achieved level or a treatment validation score.
 */
export const LIVE_GAME_LEVEL_CEILINGS: Record<string, () => number> = {
  'photo-naming': highestImplementedPhotoNamingLevel,
  'fix-sentence': highestImplementedFixSentenceLevel,
  'minimal-pairs': highestImplementedMinimalPairsLevel,
  'semantic-features': highestImplementedSemanticFeaturesLevel,
  'meaning-match': highestImplementedMeaningMatchLevel,
  'two-clues': highestImplementedTwoCluesLevel,
  'category-fluency': highestImplementedCategoryFluencyLevel,
  'sentence-construction': highestImplementedSentenceConstructionLevel,
  'multi-step-plan': highestImplementedMultiStepPlanningLevel,
  'detective-mind': highestImplementedDetectiveMindLevel,
  'synonym-generator': highestImplementedSynonymGeneratorLevel,
  'dual-load-naming': highestImplementedDualLoadNamingLevel,
  'phonological-awareness': highestImplementedPhonologicalAwarenessLevel,
};

export interface EightLevelCoverage {
  slug: string;
  status: ClinicalLadderEntry['status'];
  track: ClinicalLadderEntry['track'];
  /** Number of qualitatively distinct L1–L8 designs, not working levels. */
  definedLevels: number;
  /** The app currently persists per-game clinical progression for this game. */
  liveProgression: boolean;
  /** Content-limited ceiling if liveProgression. Otherwise null. */
  liveCeiling: number | null;
  /** Defined-but-not-implemented stage count, including design-only. */
  plannedLevels: number;
  /** Levels that exist but have caveats or thin content. */
  limitedLevels: number;
  /**
   * Flag mismatch among registry, actual ceiling and row content. This is
   * not a runtime promise; the test suite requires an empty list.
   */
  problems: string[];
}

function inspectOne(entry: ClinicalLadderEntry): EightLevelCoverage {
  const rows = entry.rows ?? [];
  const levels = rows.map(row => row.level);
  const sorted = [...levels].sort((a, b) => a - b);
  const problems: string[] = [];
  const expected = Array.from({ length: CLINICAL_LEVEL_COUNT }, (_, i) => i + 1);
  if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
    problems.push('Missing, duplicated or out-of-range clinical level design');
  }

  for (const row of rows) {
    if (!row.description.trim() || !row.targetSupport) {
      problems.push('Level ' + row.level + ' missing clinical purpose or support target');
    }
    if (entry.status === 'design-only' &&
        (row.tierStatus !== 'planned' ||
         row.minOnTargetAttempts !== undefined ||
         row.minOnTargetAccuracy !== undefined)) {
      problems.push('Level ' + row.level + ' falsely advertises live mastery evidence');
    }
  }

  const liveProgression = Object.hasOwn(LIVE_GAME_LEVEL_CEILINGS, entry.slug);
  const liveCeiling = liveProgression ? LIVE_GAME_LEVEL_CEILINGS[entry.slug]() : null;
  if (liveProgression !== (entry.status === 'full' || entry.status === 'structural')) {
    problems.push('Registry runtime status disagrees with persisted progression hooks');
  }
  if (liveCeiling != null) {
    if (!Number.isInteger(liveCeiling) || liveCeiling < 1 || liveCeiling > CLINICAL_LEVEL_COUNT) {
      problems.push('Live ceiling is outside 1–8');
    }
    if (rows.some(row => row.level > liveCeiling && row.tierStatus !== 'planned')) {
      problems.push('Rows above the enforced live ceiling are not marked planned');
    }
    // A full ladder must not silently have planned content holes.
    if (entry.status === 'full' && rows.some(row => row.tierStatus === 'planned')) {
      problems.push('Full ladder contains unavailable content');
    }
  }
  return {
    slug: entry.slug,
    status: entry.status,
    track: entry.track,
    definedLevels: rows.length,
    liveProgression,
    liveCeiling,
    plannedLevels: rows.filter(row => row.tierStatus === 'planned').length,
    limitedLevels: rows.filter(row => row.tierStatus === 'partially-implemented' ||
      row.readiness === 'thin').length,
    problems,
  };
}

export function getEightLevelCoverage(): EightLevelCoverage[] {
  return Object.values(CLINICAL_LADDER_REGISTRY)
    .map(inspectOne)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export interface EightLevelSummary {
  canonicalGames: number;
  supplementalGames: number;
  withEightDefinedLevels: number;
  liveProgressionGames: number;
  allEightSelectable: number;
  designOnlyGames: number;
  gaps: string[];
}

export function summarizeEightLevelCoverage(): EightLevelSummary {
  const coverage = getEightLevelCoverage();
  const canonical = new Set(CANONICAL_EXERCISES.map(ex => ex.slug));
  const gaps = [
    ...CANONICAL_EXERCISES.filter(ex => !CLINICAL_LADDER_REGISTRY[ex.slug])
      .map(ex => ex.slug + ': no clinical ladder registry entry'),
    ...coverage.flatMap(entry => entry.problems.map(p => entry.slug + ': ' + p)),
  ];
  return {
    canonicalGames: canonical.size,
    supplementalGames: coverage.filter(entry => !canonical.has(entry.slug)).length,
    withEightDefinedLevels: coverage.filter(entry => entry.definedLevels === 8).length,
    liveProgressionGames: coverage.filter(entry => entry.liveProgression).length,
    allEightSelectable: coverage.filter(entry => entry.liveCeiling === CLINICAL_LEVEL_COUNT &&
      entry.plannedLevels === 0).length,
    designOnlyGames: coverage.filter(entry => entry.status === 'design-only').length,
    gaps,
  };
}
