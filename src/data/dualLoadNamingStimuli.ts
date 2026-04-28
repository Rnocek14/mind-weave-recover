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

  // Tier 2 — Additional sets
  {
    id: 'dl-06',
    memoryWords: ['moon', 'pillow', 'garden'],
    namingTargets: [
      { emoji: '🎯', word: 'target' },
      { emoji: '🧲', word: 'magnet' },
      { emoji: '🎻', word: 'violin' },
      { emoji: '🪜', word: 'ladder' },
      { emoji: '🧤', word: 'glove' },
      { emoji: '🔑', word: 'key' },
    ],
    tier: 2,
  },
  {
    id: 'dl-07',
    memoryWords: ['river', 'basket', 'snow'],
    namingTargets: [
      { emoji: '🦋', word: 'butterfly' },
      { emoji: '🧭', word: 'compass' },
      { emoji: '🪞', word: 'mirror' },
      { emoji: '🎺', word: 'trumpet' },
      { emoji: '⚓', word: 'anchor' },
      { emoji: '🪴', word: 'plant' },
    ],
    tier: 2,
  },

  // Tier 3 — Abstract memory words, challenging naming
  {
    id: 'dl-08',
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
  {
    id: 'dl-09',
    memoryWords: ['patience', 'balance', 'silence'],
    namingTargets: [
      { emoji: '🔭', word: 'telescope' },
      { emoji: '🎭', word: 'mask' },
      { emoji: '⚖️', word: 'scale' },
      { emoji: '🪶', word: 'feather' },
      { emoji: '🧪', word: 'test tube' },
      { emoji: '🏺', word: 'vase' },
    ],
    tier: 3,
  },
  {
    id: 'dl-10',
    memoryWords: ['justice', 'melody', 'wisdom'],
    namingTargets: [
      { emoji: '🦉', word: 'owl' },
      { emoji: '🗡️', word: 'sword' },
      { emoji: '🧵', word: 'thread' },
      { emoji: '🪨', word: 'boulder' },
      { emoji: '🎷', word: 'saxophone' },
      { emoji: '🏗️', word: 'crane' },
    ],
    tier: 3,
  },
  // === Tier 1 expansion ===
  {
    id: 'dl-11', memoryWords: ['ball', 'lamp', 'door'],
    namingTargets: [
      { emoji: '🍞', word: 'bread' }, { emoji: '🥕', word: 'carrot' }, { emoji: '🛏️', word: 'bed' },
      { emoji: '🪑', word: 'chair' }, { emoji: '📱', word: 'phone' }, { emoji: '🧦', word: 'sock' },
    ], tier: 1,
  },
  {
    id: 'dl-12', memoryWords: ['fork', 'leaf', 'sock'],
    namingTargets: [
      { emoji: '🚲', word: 'bike' }, { emoji: '🪥', word: 'toothbrush' }, { emoji: '🧴', word: 'bottle' },
      { emoji: '🧣', word: 'scarf' }, { emoji: '🍪', word: 'cookie' }, { emoji: '🐝', word: 'bee' },
    ], tier: 1,
  },
  {
    id: 'dl-13', memoryWords: ['pen', 'milk', 'fan'],
    namingTargets: [
      { emoji: '🧀', word: 'cheese' }, { emoji: '🛁', word: 'bathtub' }, { emoji: '🧺', word: 'basket' },
      { emoji: '🪞', word: 'mirror' }, { emoji: '🧻', word: 'paper' }, { emoji: '🔨', word: 'hammer' },
    ], tier: 1,
  },
  {
    id: 'dl-14', memoryWords: ['hat', 'box', 'cup'],
    namingTargets: [
      { emoji: '🍓', word: 'strawberry' }, { emoji: '🥚', word: 'egg' }, { emoji: '🌽', word: 'corn' },
      { emoji: '🐢', word: 'turtle' }, { emoji: '🪟', word: 'window' }, { emoji: '🧤', word: 'glove' },
    ], tier: 1,
  },
  {
    id: 'dl-15', memoryWords: ['shoe', 'fish', 'sun'],
    namingTargets: [
      { emoji: '🎂', word: 'cake' }, { emoji: '🪀', word: 'yoyo' }, { emoji: '🐸', word: 'frog' },
      { emoji: '🍿', word: 'popcorn' }, { emoji: '👜', word: 'purse' }, { emoji: '🎁', word: 'gift' },
    ], tier: 1,
  },

  // === Tier 2 expansion ===
  {
    id: 'dl-16', memoryWords: ['lantern', 'thunder', 'feather'],
    namingTargets: [
      { emoji: '🦒', word: 'giraffe' }, { emoji: '🪁', word: 'kite' }, { emoji: '🛼', word: 'skates' },
      { emoji: '🪕', word: 'banjo' }, { emoji: '🧱', word: 'brick' }, { emoji: '🪖', word: 'helmet' },
    ], tier: 2,
  },
  {
    id: 'dl-17', memoryWords: ['marble', 'whisper', 'kettle'],
    namingTargets: [
      { emoji: '🦔', word: 'hedgehog' }, { emoji: '🪺', word: 'nest' }, { emoji: '🧲', word: 'magnet' },
      { emoji: '🪛', word: 'screwdriver' }, { emoji: '🪂', word: 'parachute' }, { emoji: '🪙', word: 'coin' },
    ], tier: 2,
  },
  {
    id: 'dl-18', memoryWords: ['arrow', 'bucket', 'cherry'],
    namingTargets: [
      { emoji: '🐪', word: 'camel' }, { emoji: '🎲', word: 'dice' }, { emoji: '🧯', word: 'extinguisher' },
      { emoji: '🪃', word: 'boomerang' }, { emoji: '🪤', word: 'mousetrap' }, { emoji: '🛎️', word: 'bell' },
    ], tier: 2,
  },
  {
    id: 'dl-19', memoryWords: ['ladder', 'island', 'thunder'],
    namingTargets: [
      { emoji: '🪂', word: 'parachute' }, { emoji: '🧰', word: 'toolbox' }, { emoji: '🪓', word: 'axe' },
      { emoji: '🦩', word: 'flamingo' }, { emoji: '🔭', word: 'telescope' }, { emoji: '🎺', word: 'trumpet' },
    ], tier: 2,
  },
  {
    id: 'dl-20', memoryWords: ['compass', 'shadow', 'ribbon'],
    namingTargets: [
      { emoji: '🧪', word: 'beaker' }, { emoji: '🪟', word: 'window' }, { emoji: '🪜', word: 'ladder' },
      { emoji: '🦚', word: 'peacock' }, { emoji: '🛷', word: 'sled' }, { emoji: '🪞', word: 'mirror' },
    ], tier: 2,
  },

  // === Tier 3 expansion ===
  {
    id: 'dl-21', memoryWords: ['dignity', 'rumor', 'horizon'],
    namingTargets: [
      { emoji: '🏯', word: 'castle' }, { emoji: '⚜️', word: 'crest' }, { emoji: '🪈', word: 'flute' },
      { emoji: '🦂', word: 'scorpion' }, { emoji: '🪔', word: 'lamp' }, { emoji: '⚱️', word: 'urn' },
    ], tier: 3,
  },
  {
    id: 'dl-22', memoryWords: ['integrity', 'echo', 'frontier'],
    namingTargets: [
      { emoji: '🧭', word: 'compass' }, { emoji: '🏺', word: 'amphora' }, { emoji: '🪐', word: 'planet' },
      { emoji: '🦏', word: 'rhinoceros' }, { emoji: '🎻', word: 'violin' }, { emoji: '🗝️', word: 'key' },
    ], tier: 3,
  },
  {
    id: 'dl-23', memoryWords: ['solitude', 'destiny', 'whisper'],
    namingTargets: [
      { emoji: '🦢', word: 'swan' }, { emoji: '🎼', word: 'sheet' }, { emoji: '🧬', word: 'helix' },
      { emoji: '🪕', word: 'banjo' }, { emoji: '🛕', word: 'temple' }, { emoji: '⚗️', word: 'flask' },
    ], tier: 3,
  },
  {
    id: 'dl-24', memoryWords: ['empathy', 'mirage', 'origin'],
    namingTargets: [
      { emoji: '🦦', word: 'otter' }, { emoji: '🛞', word: 'wheel' }, { emoji: '🪧', word: 'sign' },
      { emoji: '🪯', word: 'symbol' }, { emoji: '🪨', word: 'boulder' }, { emoji: '🦙', word: 'llama' },
    ], tier: 3,
  },
  {
    id: 'dl-25', memoryWords: ['legacy', 'shadow', 'tide'],
    namingTargets: [
      { emoji: '🧱', word: 'brick' }, { emoji: '🦚', word: 'peacock' }, { emoji: '🎷', word: 'saxophone' },
      { emoji: '🪤', word: 'trap' }, { emoji: '🧿', word: 'amulet' }, { emoji: '🕯️', word: 'candle' },
    ], tier: 3,
  },
];

export function getDualLoadSetsByTier(tier: number): DualLoadSet[] {
  return DUAL_LOAD_SETS.filter(s => s.tier === tier);
}
