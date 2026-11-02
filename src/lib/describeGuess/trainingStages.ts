/**
 * Describe & Guess's first three executable functional-description PRACTICE
 * configurations. Clinical advancement is not enabled or asserted here.
 */
import { getDescribeGuessTrials, type DescribeGuessTrial } from '@/data/describeGuessBank';

export interface DescribeGuessTrainingStage {
  level: 1 | 2 | 3;
  label: string;
  itemTier: 1 | 2;
  /** Existing game shows two semantic chips at visiblePrompts=0. */
  initialVisiblePrompts: 0 | 3;
}
const STAGES: Readonly<Record<1 | 2 | 3, DescribeGuessTrainingStage>> = {
  1: {
    level: 1, label: 'Describe a familiar object with full feature help',
    itemTier: 1, initialVisiblePrompts: 3,
  },
  2: {
    level: 2, label: 'Describe a familiar object with less starting help',
    itemTier: 1, initialVisiblePrompts: 0,
  },
  3: {
    level: 3, label: 'Describe a more challenging object with optional help',
    itemTier: 2, initialVisiblePrompts: 0,
  },
};
export function getDescribeGuessTrainingStage(
  level: number | null | undefined,
): DescribeGuessTrainingStage | null {
  if (level == null || !Number.isInteger(level) || level < 1 || level > 3) return null;
  return STAGES[level as 1 | 2 | 3];
}

/**
 * Return only real photographed items in the selected tier. The generic
 * selector pads from neighboring tiers when a bank is short; a configured
 * training stage must not silently change the clinical task complexity.
 */
export function getDescribeGuessStageTrials(
  stage: DescribeGuessTrainingStage,
  count: number,
): DescribeGuessTrial[] {
  if (!Number.isSafeInteger(count) || count < 1) return [];
  // The existing selector accepts ENGINE difficulty, not literal bank tier:
  // engine 1–3 → bank tier 1, engine 4–7 → bank tier 2.
  // Passing literal tier 2 incorrectly selected all tier-1 objects, then
  // this strict filter threw them away and made Stage 3 unplayable.
  const engineDifficulty = stage.itemTier === 1 ? 1 : 5;
  return getDescribeGuessTrials({ difficulty: engineDifficulty, count })
    .filter(t => t.difficulty === stage.itemTier);
}
