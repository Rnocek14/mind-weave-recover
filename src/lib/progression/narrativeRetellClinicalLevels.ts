/**
 * Clinical recall ladder for Narrative Retell.
 *
 * The scored construct in this implementation is MAIN-FACT COVERAGE.
 * L1–L3 have genuine one-/two-/three-fact input. L4–L8 increase
 * story length and number of factual targets, but do not claim validated
 * order, coherence, or discourse analysis.
 *
 * Thresholds are engineering defaults pending SLP review.
 */
import type { SupportLevel } from './clinicalProgression';
import { trialCredit } from './clinicalProgression';
import { selectNarrativeContent } from './narrativeRetellContentSelector';

export interface NarrativeRetellClinicalLevelSpec {
  level: number;
  description: string;
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  trialWeight: number;
  readiness: 'ready' | 'thin' | 'aspirational';
  contentSelector: { tierKey: string; description: string; implemented: boolean };
}

const CONTENT_DESCRIPTIONS: Record<number, string> = {
  1: 'Single concrete fact, one spoken sentence',
  2: 'Two concrete facts, two short sentences',
  3: 'Three concrete facts, three short sentences',
  4: 'Four facts in a short everyday narrative',
  5: 'Four facts in an episodic story',
  6: 'Five details from a connected episodic story',
  7: 'Five facts from an inferential story (order not scored)',
  8: 'Six facts from an inferential story (coherence not scored)',
};

export const NARRATIVE_RETELL_CLINICAL_LEVELS: Record<number, NarrativeRetellClinicalLevelSpec> =
  Object.fromEntries(Array.from({ length: 8 }, (_, i) => {
    const level = i + 1;
    const content = selectNarrativeContent(level);
    const spec: NarrativeRetellClinicalLevelSpec = {
      level,
      description: CONTENT_DESCRIPTIONS[level],
      targetSupport: level <= 3 ? 'semantic_cue' : 'independent',
      minOnTargetAttempts: 3,
      minOnTargetAccuracy: level <= 3 ? 0.67 : 0.75,
      trialWeight: level <= 3 ? 0.4 : 0.7,
      readiness: level <= 3 ? 'ready' : 'thin',
      contentSelector: {
        tierKey: `fact_recall_${level}`,
        description: content.label,
        implemented: content.stories.length >= 3,
      },
    };
    return [level, spec];
  })) as Record<number, NarrativeRetellClinicalLevelSpec>;

export function getNarrativeRetellClinicalLevelSpec(level: number): NarrativeRetellClinicalLevelSpec {
  return NARRATIVE_RETELL_CLINICAL_LEVELS[level] ?? NARRATIVE_RETELL_CLINICAL_LEVELS[1];
}

export function highestImplementedNarrativeRetellLevel(): number {
  let result = 1;
  for (let level = 1; level <= 8; level++) {
    if (!NARRATIVE_RETELL_CLINICAL_LEVELS[level].contentSelector.implemented) break;
    result = level;
  }
  return result;
}

export function isOnTargetNarrativeRetellTrial(trial: { support: SupportLevel }, level: number): boolean {
  const required = getNarrativeRetellClinicalLevelSpec(level).targetSupport;
  if (required === 'semantic_cue') {
    return trial.support === 'semantic_cue' || trial.support === 'independent';
  }
  return trial.support === 'independent';
}

export function evidenceMetForNarrativeRetellLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getNarrativeRetellClinicalLevelSpec(level);
  const targeted = trials.filter(t => isOnTargetNarrativeRetellTrial(t, level));
  return targeted.length >= spec.minOnTargetAttempts
    && targeted.filter(t => t.correct).length / targeted.length >= spec.minOnTargetAccuracy;
}

export function calculateNarrativeRetellProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): number {
  const weight = getNarrativeRetellClinicalLevelSpec(level).trialWeight;
  return trials.reduce((sum, t) => sum + trialCredit(t), 0) / weight;
}

/**
 * A single story attempt is successful only when the actual number of
 * distinct matched facts meets the current level's demand. A ratio of
 * 0.5 on a two-fact story cannot be called two-fact recall success.
 */
export function storyMeetsNarrativeRecallTarget(
  result: { eventsFound: number; eventsTotal: number; skipped: boolean },
  level: number,
): boolean {
  const needed = selectNarrativeContent(level).minFactsToRecall;
  return !result.skipped && result.eventsTotal >= needed && result.eventsFound >= needed;
}
