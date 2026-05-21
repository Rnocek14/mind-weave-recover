/**
 * Category Fluency — discourse/generative-retrieval ladder (Phase 1, Wave 1).
 *
 * Expressive generative task: "name as many [category] members as you can."
 * Per-trial submission emits `trialMode: 'production'`; slug is added to
 * ADOPTED_TRIAL_MODE_SLUGS.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/category-fluency.md.
 * TL;DR: Semantic-category verbal fluency is a long-standing aphasia and
 * dementia metric (animals being the most common probe; Troyer 2000 for
 * cluster/switch analysis). Difficulty grading by category breadth and
 * specificity here is a DESIGN CHOICE, not a literature-proven hierarchy.
 * Per-level "unique-words-produced" bars and trialWeights are clinically
 * motivated calibration defaults.
 *
 * Support ladder (lexical axis, generative-retrieval mode):
 *   independent → semantic_cue (category sub-prompt shown)
 * Category Fluency does not escalate to phonemic_cue or full-model.
 *
 * NOTE on "trial" semantics: a Category Fluency *round* is one category
 * probe with N words produced under a time cap. We treat one ROUND as one
 * progression trial — `correct = uniqueWordCount >= threshold`. The
 * threshold is rung-specific.
 *
 * Pure module — no I/O, no React, no DB.
 */

import type { SupportLevel } from './clinicalProgression';
import { SUPPORT_CREDIT, trialCredit } from './clinicalProgression';
import { computeImplementedCeiling } from './_shared/implementedCeiling';

const SUPPORT_RANK: Record<string, number> = {
  recognition_only: 0,
  carrier_or_full_model: 1,
  phonemic_cue: 2,
  semantic_cue: 3,
  independent: 4,
};

function rank(s: SupportLevel): number {
  return SUPPORT_RANK[s] ?? -1;
}

export interface CategoryFluencyLevelSpec {
  level: number;
  description: string;
  targetSupport: SupportLevel;
  /** Minimum unique items required for the round to count as "correct" at
   *  this rung. Used by the page's submitTrial to derive isCorrect. */
  minUniqueWords: number;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  readiness: 'ready' | 'thin' | 'aspirational';
  trialWeight: number;
  contentSelector?: {
    tierKey:
      | 'broad_concrete'
      | 'mid_concrete'
      | 'narrow_concrete'
      | 'abstract_intro'
      | 'abstract_narrow'
      | 'action_verbs'
      | 'figurative_set';
    description: string;
    implemented: boolean;
  };
}

/**
 * Level ladder (clinical meaning):
 *   L1 broad concrete categories (animals, foods); sub-prompt OK
 *   L2 broad concrete; independent
 *   L3 mid-breadth concrete (vehicles, clothing); independent
 *   L4 narrow concrete (kitchen tools, sports equipment); independent
 *   L5 abstract categories introduced (emotions, professions)
 *   L6 narrow abstract (occupations by setting; thin bank)
 *   L7 action-verb fluency / cross-category switching (thin bank)
 *   L8 figurative / cross-domain abstract sets (aspirational)
 */
export const CATEGORY_FLUENCY_LEVELS: Record<number, CategoryFluencyLevelSpec> = {
  1: {
    level: 1,
    description: 'Broad concrete categories — sub-prompt allowed',
    targetSupport: 'semantic_cue',
    minUniqueWords: 4,
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.4,
    contentSelector: { tierKey: 'broad_concrete', description: 'Animals, foods, body parts.', implemented: true },
  },
  2: {
    level: 2,
    description: 'Broad concrete — independent',
    targetSupport: 'independent',
    minUniqueWords: 5,
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'broad_concrete', description: 'Broad concrete categories; no sub-prompt.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Mid-breadth concrete — independent',
    targetSupport: 'independent',
    minUniqueWords: 6,
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'mid_concrete', description: 'Vehicles, clothing, furniture.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Narrow concrete — independent',
    targetSupport: 'independent',
    minUniqueWords: 6,
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'narrow_concrete', description: 'Kitchen tools, sports equipment, instruments.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Abstract categories introduced',
    targetSupport: 'independent',
    minUniqueWords: 5,
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'abstract_intro', description: 'Emotions, professions, holidays.', implemented: true },
  },
  6: {
    level: 6,
    description: 'Narrow abstract — context-bound retrieval',
    targetSupport: 'independent',
    minUniqueWords: 5,
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 1.7,
    contentSelector: { tierKey: 'abstract_narrow', description: 'Narrow abstract categories; thin bank, rotation only.', implemented: true },
  },
  7: {
    level: 7,
    description: 'Action-verb fluency / cross-category switching',
    targetSupport: 'independent',
    minUniqueWords: 6,
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 2.0,
    contentSelector: { tierKey: 'action_verbs', description: 'Verb fluency and switching probes; thin bank.', implemented: true },
  },
  8: {
    level: 8,
    description: 'Figurative / cross-domain abstract sets — design-of-record',
    targetSupport: 'independent',
    minUniqueWords: 6,
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.85,
    readiness: 'aspirational',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'figurative_set',
      description: 'Cross-domain abstract / figurative sets — bank not yet shipped; ceiling clamp blocks advancement.',
      implemented: false,
    },
  },
};

export function getCategoryFluencyLevelSpec(level: number): CategoryFluencyLevelSpec {
  return CATEGORY_FLUENCY_LEVELS[level] ?? CATEGORY_FLUENCY_LEVELS[1];
}

export function isOnTargetCategoryFluencyTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getCategoryFluencyLevelSpec(level);
  return rank(trial.support) >= rank(spec.targetSupport);
}

export function evidenceMetForCategoryFluencyLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getCategoryFluencyLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetCategoryFluencyTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

export function calculateCategoryFluencyProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getCategoryFluencyLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetCategoryFluencyTrial(t, level)) total += base * 1.25;
    else total += base * 0.4;
  }
  return total / weight;
}

export { SUPPORT_CREDIT };

export function highestImplementedCategoryFluencyLevel(): number {
  return computeImplementedCeiling(CATEGORY_FLUENCY_LEVELS);
}
