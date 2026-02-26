/**
 * Dual-Load Naming Stimuli
 * 
 * Memory words + naming targets for executive load tolerance assessment.
 * Task: remember 3 words → name 6 pictures → recall the 3 words.
 */

export interface DualLoadSet {
  id: string;
  /** 3 words to remember */
  memoryWords: string[];
  /** 6 picture-naming targets (emoji + word) */
  namingTargets: Array<{ emoji: string; word: string }>;
  tier: 1 | 2 | 3;
}

export const DUAL_LOAD_SETS: DualLoadSet[] = [
  // Tier 1 — Common, concrete memory words + easy naming targets
  {
    id: 'dl-01',
    memoryWords: ['cat', 'tree', 'book'],
    namingTargets: [
      { emoji: '🍎', word: 'apple' },
      { emoji: '🏠', word: 'house' },
      { emoji: '⭐', word: 'star' },
      { emoji: '🚗', word: 'car' },
      { emoji: '👟', word: 'shoe' },
      { emoji: '🌸', word: 'flower' },
    ],
    tier: 1,
  },
  {
    id: 'dl-02',
    memoryWords: ['dog', 'chair', 'sun'],
    namingTargets: [
      { emoji: '🎩', word: 'hat' },
      { emoji: '🐟', word: 'fish' },
      { emoji: '🔔', word: 'bell' },
      { emoji: '🎈', word: 'balloon' },
      { emoji: '🍌', word: 'banana' },
      { emoji: '✂️', word: 'scissors' },
    ],
    tier: 1,
  },
  {
    id: 'dl-03',
    memoryWords: ['cup', 'rain', 'key'],
    namingTargets: [
      { emoji: '🎸', word: 'guitar' },
      { emoji: '🕰️', word: 'clock' },
      { emoji: '🧲', word: 'magnet' },
      { emoji: '🎪', word: 'tent' },
      { emoji: '🪜', word: 'ladder' },
      { emoji: '🧊', word: 'ice' },
    ],
    tier: 1,
  },

  // Tier 2 — Less common words, harder naming
  {
    id: 'dl-04',
    memoryWords: ['bridge', 'whistle', 'stone'],
    namingTargets: [
      { emoji: '🦉', word: 'owl' },
      { emoji: '⚓', word: 'anchor' },
      { emoji: '🎻', word: 'violin' },
      { emoji: '🪴', word: 'plant' },
      { emoji: '🧤', word: 'glove' },
      { emoji: '🔦', word: 'flashlight' },
    ],
    tier: 2,
  },
  {
    id: 'dl-05',
    memoryWords: ['cloud', 'hammer', 'candle'],
    namingTargets: [
      { emoji: '🦋', word: 'butterfly' },
      { emoji: '🎯', word: 'target' },
      { emoji: '🧭', word: 'compass' },
      { emoji: '🪞', word: 'mirror' },
      { emoji: '🎺', word: 'trumpet' },
      { emoji: '🧲', word: 'magnet' },
    ],
    tier: 2,
  },

  // Tier 3 — Abstract memory words, challenging naming
  {
    id: 'dl-06',
    memoryWords: ['freedom', 'rhythm', 'courage'],
    namingTargets: [
      { emoji: '🦅', word: 'eagle' },
      { emoji: '⚗️', word: 'flask' },
      { emoji: '🪗', word: 'accordion' },
      { emoji: '🗿', word: 'statue' },
      { emoji: '🧬', word: 'DNA' },
      { emoji: '🏛️', word: 'column' },
    ],
    tier: 3,
  },
];

export function getDualLoadSetsByTier(tier: number): DualLoadSet[] {
  return DUAL_LOAD_SETS.filter(s => s.tier === tier);
}
