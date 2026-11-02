/**
 * Abstract Comparison: eight executable PRACTICE formats, not clinical mastery.
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

export type AbstractPracticeStageLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export interface AbstractPracticeStage {
  level: AbstractPracticeStageLevel;
  label: string;
  instruction: string;
  /** Existing authored stimulus tier, not a clinical mastery rating. */
  contentTier: 1 | 2 | 3;
  /** Level 8 uses a separate pool of authored novel pairs. */
  novelOnly?: boolean;
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
  4: {
    level: 4,
    label: 'Compare by purpose',
    contentTier: 2,
    instruction: 'Think about what each thing does. Describe one useful purpose they share, beyond how they look.',
    prompt: 'What job or purpose do these two things share?',
    displayedSupport: 'Try: “Both help us to …”',
  },
  5: {
    level: 5,
    label: 'Find an abstract relationship',
    contentTier: 3,
    instruction: 'Listen to two different ideas. Tell how they might be related, using a familiar example.',
    prompt: 'How could these ideas be connected?',
    displayedSupport: 'Try: “Both are about … For example …”',
  },
  6: {
    level: 6,
    label: 'Explain one abstract connection',
    contentTier: 3,
    instruction: 'Describe one meaningful connection in your own words without a sentence starter.',
    prompt: 'What is one deeper idea they have in common?',
    displayedSupport: null,
  },
  7: {
    level: 7,
    label: 'Two different connections',
    contentTier: 3,
    instruction: 'Describe two ways the ideas are connected. The connections may be different kinds of relationships.',
    prompt: 'What are two ways these ideas are related?',
    displayedSupport: null,
  },
  8: {
    level: 8,
    label: 'Connect unfamiliar ideas',
    contentTier: 3,
    novelOnly: true,
    instruction: 'Explore a new pair of ideas. Describe a relationship and explain it using an everyday example.',
    prompt: 'How might these unfamiliar ideas be connected, and what is an example?',
    displayedSupport: null,
  },
};

export const getAbstractPracticeStage = (value: unknown): AbstractPracticeStage | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 8
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
    item => item.tier === stage.contentTier
      && (stage.novelOnly ? item.id.startsWith('ac-novel-') : !item.id.startsWith('ac-novel-'))
      && !used.has(item.id),
  );
  // Fisher-Yates on a copy: never mutate the shared clinical stimulus bank.
  for (let i = pool.length - 1; i > 0; i--) {
    const n = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))));
    [pool[i], pool[n]] = [pool[n], pool[i]];
  }
  return pool.slice(0, count);
}
