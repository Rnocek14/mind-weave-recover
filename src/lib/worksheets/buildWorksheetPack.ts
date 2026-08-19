/**
 * buildWorksheetPack — assembles the free printable Home Practice Pack from
 * the app's real content banks.
 *
 * Deterministic by design (fixed seed, no Math.random): the PDF we host, the
 * page a user prints, and the answer key must all agree. Change the seed or
 * the composition and the whole pack regenerates consistently.
 *
 * Pure data — no React, no DOM — so the composition is unit-testable.
 */

import { FIX_SENTENCE_BANK, type FixSentenceTrial } from '@/data/fixSentenceBank';
import { TWO_CLUES_PUZZLES } from '@/data/twoCluesBank';
import { MINIMAL_PAIRS } from '@/data/minimalPairsBank';

/** Deterministic PRNG (mulberry32) so every build produces the same pack. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function take<T>(items: T[], count: number, rand: () => number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export interface SentenceItem {
  sentence: string;
  wrongWord: string;
  answer: string;
  alternatives: string[];
}

export interface CategoryPage {
  label: string;
  prompt: string;
  hint: string;
  lines: number;
}

export interface ClueItem {
  clues: string[];
  answer: string;
  alternatives: string[];
}

export interface PairScript {
  word1: string;
  word2: string;
  contrast: string;
}

export interface WorksheetSection {
  id: string;
  title: string;
  /** One-line instruction printed under the section title. */
  instruction: string;
  /** Shown to the practice partner, not the person practicing. */
  partnerNote: string;
  /** Deep link to the same exercise as a playable session. */
  playPath: string;
}

export interface WorksheetPack {
  version: string;
  sections: WorksheetSection[];
  sentences: { level: 1 | 2 | 3; items: SentenceItem[] }[];
  categories: CategoryPage[];
  clues: ClueItem[];
  pairs: PairScript[];
}

const CATEGORY_PAGES: Array<Omit<CategoryPage, 'lines'>> = [
  { label: 'Animals', prompt: 'Name as many animals as you can.', hint: 'pets · farm · ocean · wild' },
  { label: 'Foods', prompt: 'Name as many foods as you can.', hint: 'fruit · vegetables · meals · snacks' },
  { label: 'Things in a kitchen', prompt: 'Name as many kitchen things as you can.', hint: 'utensils · pots · appliances' },
  { label: 'Clothing', prompt: 'Name as many pieces of clothing as you can.', hint: 'tops · shoes · outerwear' },
  { label: 'Jobs', prompt: 'Name as many jobs as you can.', hint: 'trades · medical · office · service' },
  { label: 'Places in town', prompt: 'Name as many places in town as you can.', hint: 'shops · services · outdoors' },
  { label: 'Tools', prompt: 'Name as many tools as you can.', hint: 'garage · garden · workshop' },
  { label: 'Things that fly', prompt: 'Name as many things that fly as you can.', hint: 'birds · insects · machines' },
];

export function buildWorksheetPack(): WorksheetPack {
  const rand = seeded(20260819);

  const byLevel = (level: 1 | 2 | 3, count: number) => {
    const pool = FIX_SENTENCE_BANK.filter(
      (t: FixSentenceTrial) =>
        t.difficulty === level && !t.secondError && !t.morphology && t.acceptedFixes.length > 0
    );
    return take(pool, count, rand).map((t) => ({
      sentence: t.sentence,
      wrongWord: t.wrongWord,
      answer: t.acceptedFixes[0],
      alternatives: t.acceptedFixes.slice(1, 4),
    }));
  };

  const clues = take(
    TWO_CLUES_PUZZLES.filter((p) => p.difficulty === 1 && p.anchors.length > 0),
    12,
    rand
  ).map((p) => ({
    clues: p.clues.slice(0, 2),
    answer: p.anchors[0],
    alternatives: [...p.anchors.slice(1, 3), ...p.cluster.slice(0, 2)],
  }));

  const pairs = take(
    MINIMAL_PAIRS.filter((p) => p.difficulty === 1),
    24,
    rand
  ).map((p) => ({
    word1: p.word1,
    word2: p.word2,
    contrast: p.contrastDescription,
  }));

  return {
    version: '1.0',
    sections: [
      {
        id: 'sentences',
        title: 'Fix the Sentence',
        instruction: 'One word in each sentence is wrong. Say or write the word that fixes it.',
        partnerNote:
          'Wait a full 10 seconds before helping. Then use the cueing ladder on page 2 — category first, then first sound, then a choice of two.',
        playPath: '/aphasia-sentence-exercises',
      },
      {
        id: 'categories',
        title: 'Word-Finding Sprints',
        instruction: 'Name as many as you can. Write them down, or say them while your partner writes.',
        partnerNote:
          'Set a timer for 60 seconds. Count anything reasonable — creative answers are still successful word finding.',
        playPath: '/free-aphasia-games',
      },
      {
        id: 'clues',
        title: 'Two Clues',
        instruction: 'Two words point at one answer. What word connects them?',
        partnerNote:
          'If they stall, give the first sound of the answer rather than the answer itself.',
        playPath: '/free-aphasia-games',
      },
      {
        id: 'pairs',
        title: 'Listening Pairs (partner reads aloud)',
        instruction: 'Your partner reads one word. Point to the word you heard.',
        partnerNote:
          'Read only ONE of the two words, in a normal voice, without pointing or looking at it. Mix up which one you read.',
        playPath: '/free-aphasia-games',
      },
    ],
    sentences: [
      { level: 1, items: byLevel(1, 12) },
      { level: 2, items: byLevel(2, 12) },
      { level: 3, items: byLevel(3, 8) },
    ],
    categories: CATEGORY_PAGES.map((c) => ({ ...c, lines: 12 })),
    clues,
    pairs,
  };
}
