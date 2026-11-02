/**
 * Abstract Comparison: executable L1–L3 PRACTICE, not clinical mastery.
 * The patient sees distinct instructions and actual tier-separated pairs.
 * Stage 1 asks for one concrete similarity, Stage 2 adds a difference on
 * concrete pairs, Stage 3 uses cross-context relationships with less support.
 *
 * The existing similarity keyword scorer cannot establish a correct
 * difference, high-level abstraction, or independent functional transfer.
 * Every staged result must remain practice-only.
 */
import type { AbstractCompareItem } from '@/data/abstractCompareStimuli';
import { ABSTRACT_COMPARE_ITEMS } from '@/data/abstractCompareStimuli';

export type AbstractPracticeStageLevel = 1 | 2 | 3;
export interface AbstractPracticeStage {
  level: AbstractPracticeStageLevel;
  label: string;
  instruction: string;
  /** Existing authored stimulus tier, not a clinical mastery rating. */
  contentTier: 1 | 2;
  /** A visible spoken/written carrier is support even without a hint tap. */
  displayedSupport: string | null;
  /** A patient prompt, not a measured clinical criterion. */
  prompt: string;
}

const STAGES: Record<AbstractPracticeStageLevel, AbstractPracticeStage> = {
  1: {
    level: 1,
    label: 'One thing in common',
    contentTier: 1,
    instruction: 'Look at the two familiar things. Say one way they are alike.',
    prompt: 'How are these two things alike?',
    displayedSupport: 'Try: “Both are …”',
  },
  2: {
    level: 2,
    label: 'Alike and different',
    contentTier: 1,
    instruction: 'Tell one way these familiar things are alike, and one way they are different.',
    prompt: 'What is the same? What is different?',
    displayedSupport: 'Try: “Both …, but one …”',
  },
  3: {
    level: 3,
    label: 'Find the connection',
    contentTier: 2,
    instruction: 'Explain what these different things have in common. Any meaningful connection is worth trying.',
    prompt: 'What idea connects these two things?',
    displayedSupport: null,
  },
};

export const getAbstractPracticeStage = (value: unknown): AbstractPracticeStage | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3
    ? STAGES[value as AbstractPracticeStageLevel]
    : null;

/** No fallback to a neighboring stimulus tier or repeated item ID. */
export function selectAbstractPracticeItems(
  stage: AbstractPracticeStage,
  count: number,
  usedIds: readonly string[] = [],
  random: () => number = Math.random,
): AbstractCompareItem[] {
  if (!Number.isSafeInteger(count) || count < 0) return [];
  const used = new Set(usedIds);
  const pool = ABSTRACT_COMPARE_ITEMS.filter(
    item => item.tier === stage.contentTier && !used.has(item.id),
  );
  // Fisher-Yates on a copy: never mutate the shared clinical stimulus bank.
  for (let i = pool.length - 1; i > 0; i--) {
    const n = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))));
    [pool[i], pool[n]] = [pool[n], pool[i]];
  }
  return pool.slice(0, count);
}
