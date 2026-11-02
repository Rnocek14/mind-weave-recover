/**
 * Narrative Retell: the first three *training configurations* that the
 * current story bank and visual-scaffold renderer can actually deliver.
 *
 * Not a clinical outcome ladder. No automated advancement thresholds exist;
 * clinical levels 4–8 remain design-of-record pending distinct tasks,
 * validated discourse measures, and clinician review.
 */
import { stallRevealLevel, type VisualSupportLevel } from '@/lib/narrative/visualSupport';

export type NarrativeTrainingStage = {
  level: 1 | 2 | 3;
  label: string;
  storyTier: 1 | 2;
  baselineSupport: VisualSupportLevel;
};

const STAGES: Readonly<Record<1 | 2 | 3, NarrativeTrainingStage>> = {
  1: { level: 1, label: 'Short story with scene help', storyTier: 1, baselineSupport: 3 },
  2: { level: 2, label: 'Short story with picture clues', storyTier: 1, baselineSupport: 2 },
  3: { level: 3, label: 'Cause-and-effect story with a sequence guide', storyTier: 2, baselineSupport: 1 },
};

/** Never silently label a legacy higher-level profile as a supported stage. */
export function getNarrativeTrainingStage(level: number | null | undefined): NarrativeTrainingStage | null {
  if (!Number.isInteger(level) || level == null || level < 1 || level > 3) return null;
  return STAGES[level as 1 | 2 | 3];
}

/** Existing stall rescue always adds support. It never hides the starter aid. */
export function resolveNarrativeTrainingVisualSupport(
  stage: NarrativeTrainingStage,
  stallPromptIndex: number,
): { baseline: VisualSupportLevel; stallReveal: VisualSupportLevel; level: VisualSupportLevel } {
  const stallReveal = stallRevealLevel(stallPromptIndex);
  return {
    baseline: stage.baselineSupport,
    stallReveal,
    level: Math.max(stage.baselineSupport, stallReveal) as VisualSupportLevel,
  };
}
