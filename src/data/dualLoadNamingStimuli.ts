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

  // === Wave-1 expansion: bring every tier ≥20 ===
  // Tier 1 add (T1: 8 → 20)
  { id: 'dl-26', memoryWords: ['rain', 'desk', 'spoon'], tier: 1, namingTargets: [
    { emoji: '🥛', word: 'milk' }, { emoji: '🍇', word: 'grape' }, { emoji: '🪥', word: 'toothbrush' },
    { emoji: '🛏️', word: 'bed' }, { emoji: '☂️', word: 'umbrella' }, { emoji: '🪑', word: 'chair' },
  ]},
  { id: 'dl-27', memoryWords: ['bowl', 'rope', 'lamp'], tier: 1, namingTargets: [
    { emoji: '🍐', word: 'pear' }, { emoji: '🧦', word: 'sock' }, { emoji: '📚', word: 'book' },
    { emoji: '🐰', word: 'rabbit' }, { emoji: '🍞', word: 'bread' }, { emoji: '🥄', word: 'spoon' },
  ]},
  { id: 'dl-28', memoryWords: ['plate', 'soap', 'truck'], tier: 1, namingTargets: [
    { emoji: '🐔', word: 'chicken' }, { emoji: '🍊', word: 'orange' }, { emoji: '🪞', word: 'mirror' },
    { emoji: '🧦', word: 'sock' }, { emoji: '🚌', word: 'bus' }, { emoji: '🥔', word: 'potato' },
  ]},
  { id: 'dl-29', memoryWords: ['cake', 'leaf', 'comb'], tier: 1, namingTargets: [
    { emoji: '🐄', word: 'cow' }, { emoji: '🍋', word: 'lemon' }, { emoji: '🪜', word: 'ladder' },
    { emoji: '🧢', word: 'cap' }, { emoji: '🥖', word: 'baguette' }, { emoji: '🛋️', word: 'couch' },
  ]},
  { id: 'dl-30', memoryWords: ['pot', 'rug', 'corn'], tier: 1, namingTargets: [
    { emoji: '🐷', word: 'pig' }, { emoji: '🍑', word: 'peach' }, { emoji: '👒', word: 'hat' },
    { emoji: '🦆', word: 'duck' }, { emoji: '🪟', word: 'window' }, { emoji: '🥯', word: 'bagel' },
  ]},
  { id: 'dl-31', memoryWords: ['glass', 'belt', 'bread'], tier: 1, namingTargets: [
    { emoji: '🐑', word: 'sheep' }, { emoji: '🍉', word: 'watermelon' }, { emoji: '🧴', word: 'lotion' },
    { emoji: '🚂', word: 'train' }, { emoji: '🪣', word: 'bucket' }, { emoji: '🥒', word: 'cucumber' },
  ]},
  { id: 'dl-32', memoryWords: ['rope', 'kite', 'rice'], tier: 1, namingTargets: [
    { emoji: '🐎', word: 'horse' }, { emoji: '🍍', word: 'pineapple' }, { emoji: '🛏️', word: 'bed' },
    { emoji: '⛵', word: 'boat' }, { emoji: '🧴', word: 'bottle' }, { emoji: '🥨', word: 'pretzel' },
  ]},
  { id: 'dl-33', memoryWords: ['wave', 'jar', 'frog'], tier: 1, namingTargets: [
    { emoji: '🐢', word: 'turtle' }, { emoji: '🍈', word: 'melon' }, { emoji: '🪣', word: 'pail' },
    { emoji: '🚜', word: 'tractor' }, { emoji: '🧀', word: 'cheese' }, { emoji: '🎒', word: 'backpack' },
  ]},
  { id: 'dl-34', memoryWords: ['nail', 'soup', 'card'], tier: 1, namingTargets: [
    { emoji: '🐌', word: 'snail' }, { emoji: '🥭', word: 'mango' }, { emoji: '🧹', word: 'broom' },
    { emoji: '🚁', word: 'helicopter' }, { emoji: '🍩', word: 'donut' }, { emoji: '🧴', word: 'shampoo' },
  ]},
  { id: 'dl-35', memoryWords: ['cone', 'mat', 'wire'], tier: 1, namingTargets: [
    { emoji: '🐝', word: 'bee' }, { emoji: '🍒', word: 'cherry' }, { emoji: '🪒', word: 'razor' },
    { emoji: '🛵', word: 'scooter' }, { emoji: '🥧', word: 'pie' }, { emoji: '🪥', word: 'toothbrush' },
  ]},
  { id: 'dl-36', memoryWords: ['fan', 'oar', 'mop'], tier: 1, namingTargets: [
    { emoji: '🦔', word: 'hedgehog' }, { emoji: '🥥', word: 'coconut' }, { emoji: '🧦', word: 'sock' },
    { emoji: '🚤', word: 'speedboat' }, { emoji: '🍪', word: 'cookie' }, { emoji: '🧂', word: 'salt' },
  ]},
  { id: 'dl-37', memoryWords: ['stem', 'gum', 'pin'], tier: 1, namingTargets: [
    { emoji: '🐞', word: 'ladybug' }, { emoji: '🥕', word: 'carrot' }, { emoji: '🪞', word: 'mirror' },
    { emoji: '🚙', word: 'jeep' }, { emoji: '🍯', word: 'honey' }, { emoji: '👟', word: 'sneaker' },
  ]},

  // Tier 2 add (T2: 9 → 21)
  { id: 'dl-38', memoryWords: ['anchor', 'pebble', 'lantern'], tier: 2, namingTargets: [
    { emoji: '🦝', word: 'raccoon' }, { emoji: '🧰', word: 'toolbox' }, { emoji: '🪔', word: 'oil-lamp' },
    { emoji: '🦢', word: 'swan' }, { emoji: '🪕', word: 'banjo' }, { emoji: '🪤', word: 'mousetrap' },
  ]},
  { id: 'dl-39', memoryWords: ['cobweb', 'velvet', 'meadow'], tier: 2, namingTargets: [
    { emoji: '🦦', word: 'otter' }, { emoji: '🧯', word: 'extinguisher' }, { emoji: '🎺', word: 'trumpet' },
    { emoji: '🦩', word: 'flamingo' }, { emoji: '🪃', word: 'boomerang' }, { emoji: '🪨', word: 'boulder' },
  ]},
  { id: 'dl-40', memoryWords: ['canyon', 'crumb', 'tassel'], tier: 2, namingTargets: [
    { emoji: '🦨', word: 'skunk' }, { emoji: '🪛', word: 'screwdriver' }, { emoji: '🎻', word: 'violin' },
    { emoji: '🦡', word: 'badger' }, { emoji: '🪂', word: 'parachute' }, { emoji: '🧭', word: 'compass' },
  ]},
  { id: 'dl-41', memoryWords: ['barrel', 'shimmer', 'thorn'], tier: 2, namingTargets: [
    { emoji: '🦫', word: 'beaver' }, { emoji: '🪚', word: 'saw' }, { emoji: '🪈', word: 'flute' },
    { emoji: '🦃', word: 'turkey' }, { emoji: '🛷', word: 'sled' }, { emoji: '🏺', word: 'vase' },
  ]},
  { id: 'dl-42', memoryWords: ['drift', 'thicket', 'plume'], tier: 2, namingTargets: [
    { emoji: '🦒', word: 'giraffe' }, { emoji: '🧪', word: 'beaker' }, { emoji: '🪗', word: 'accordion' },
    { emoji: '🦉', word: 'owl' }, { emoji: '🪁', word: 'kite' }, { emoji: '🧱', word: 'brick' },
  ]},
  { id: 'dl-43', memoryWords: ['ember', 'glaze', 'spire'], tier: 2, namingTargets: [
    { emoji: '🦘', word: 'kangaroo' }, { emoji: '🧲', word: 'magnet' }, { emoji: '🎷', word: 'saxophone' },
    { emoji: '🦔', word: 'hedgehog' }, { emoji: '🛼', word: 'skates' }, { emoji: '🪖', word: 'helmet' },
  ]},
  { id: 'dl-44', memoryWords: ['gully', 'plait', 'wedge'], tier: 2, namingTargets: [
    { emoji: '🐪', word: 'camel' }, { emoji: '🪟', word: 'window' }, { emoji: '🪘', word: 'drum' },
    { emoji: '🦚', word: 'peacock' }, { emoji: '🪜', word: 'ladder' }, { emoji: '🪙', word: 'coin' },
  ]},
  { id: 'dl-45', memoryWords: ['burrow', 'satin', 'gable'], tier: 2, namingTargets: [
    { emoji: '🦬', word: 'bison' }, { emoji: '🧯', word: 'extinguisher' }, { emoji: '🪕', word: 'banjo' },
    { emoji: '🦜', word: 'parrot' }, { emoji: '🛎️', word: 'bell' }, { emoji: '🪞', word: 'mirror' },
  ]},
  { id: 'dl-46', memoryWords: ['crater', 'tinder', 'lattice'], tier: 2, namingTargets: [
    { emoji: '🐃', word: 'buffalo' }, { emoji: '🧰', word: 'toolbox' }, { emoji: '🎻', word: 'violin' },
    { emoji: '🦦', word: 'otter' }, { emoji: '🪂', word: 'parachute' }, { emoji: '🧱', word: 'brick' },
  ]},
  { id: 'dl-47', memoryWords: ['gusset', 'reef', 'spool'], tier: 2, namingTargets: [
    { emoji: '🐗', word: 'boar' }, { emoji: '🪒', word: 'razor' }, { emoji: '🪗', word: 'accordion' },
    { emoji: '🦫', word: 'beaver' }, { emoji: '🛷', word: 'sled' }, { emoji: '🪖', word: 'helmet' },
  ]},
  { id: 'dl-48', memoryWords: ['marsh', 'glint', 'cradle'], tier: 2, namingTargets: [
    { emoji: '🦙', word: 'llama' }, { emoji: '🧪', word: 'beaker' }, { emoji: '🪕', word: 'banjo' },
    { emoji: '🦩', word: 'flamingo' }, { emoji: '🪁', word: 'kite' }, { emoji: '🧭', word: 'compass' },
  ]},
  { id: 'dl-49', memoryWords: ['sash', 'orchard', 'flicker'], tier: 2, namingTargets: [
    { emoji: '🐫', word: 'camel' }, { emoji: '🪨', word: 'boulder' }, { emoji: '🎺', word: 'trumpet' },
    { emoji: '🦔', word: 'hedgehog' }, { emoji: '🪛', word: 'screwdriver' }, { emoji: '🪙', word: 'coin' },
  ]},

  // Tier 3 add (T3: 8 → 20)
  { id: 'dl-50', memoryWords: ['nostalgia', 'paradox', 'lineage'], tier: 3, namingTargets: [
    { emoji: '🏛️', word: 'column' }, { emoji: '🪐', word: 'planet' }, { emoji: '⚗️', word: 'flask' },
    { emoji: '🦂', word: 'scorpion' }, { emoji: '🗿', word: 'monolith' }, { emoji: '🪈', word: 'flute' },
  ]},
  { id: 'dl-51', memoryWords: ['humility', 'verdict', 'aurora'], tier: 3, namingTargets: [
    { emoji: '🧬', word: 'helix' }, { emoji: '🦏', word: 'rhinoceros' }, { emoji: '🏺', word: 'amphora' },
    { emoji: '🪧', word: 'placard' }, { emoji: '🦦', word: 'otter' }, { emoji: '⚱️', word: 'urn' },
  ]},
  { id: 'dl-52', memoryWords: ['ambition', 'silhouette', 'plateau'], tier: 3, namingTargets: [
    { emoji: '🗝️', word: 'skeleton-key' }, { emoji: '🪐', word: 'saturn' }, { emoji: '🪕', word: 'banjo' },
    { emoji: '🦢', word: 'swan' }, { emoji: '🛕', word: 'temple' }, { emoji: '🔭', word: 'telescope' },
  ]},
  { id: 'dl-53', memoryWords: ['serenity', 'mosaic', 'epoch'], tier: 3, namingTargets: [
    { emoji: '🦚', word: 'peacock' }, { emoji: '🗡️', word: 'sword' }, { emoji: '🎼', word: 'score' },
    { emoji: '🧿', word: 'amulet' }, { emoji: '🦙', word: 'llama' }, { emoji: '⚖️', word: 'scale' },
  ]},
  { id: 'dl-54', memoryWords: ['curiosity', 'tundra', 'meridian'], tier: 3, namingTargets: [
    { emoji: '🦡', word: 'badger' }, { emoji: '🪨', word: 'boulder' }, { emoji: '🪂', word: 'parachute' },
    { emoji: '🏯', word: 'pagoda' }, { emoji: '🪺', word: 'nest' }, { emoji: '🪖', word: 'helmet' },
  ]},
  { id: 'dl-55', memoryWords: ['resilience', 'estuary', 'mantle'], tier: 3, namingTargets: [
    { emoji: '🦫', word: 'beaver' }, { emoji: '⚗️', word: 'retort' }, { emoji: '🎷', word: 'saxophone' },
    { emoji: '🛕', word: 'shrine' }, { emoji: '🦂', word: 'scorpion' }, { emoji: '🪈', word: 'flute' },
  ]},
  { id: 'dl-56', memoryWords: ['altruism', 'precipice', 'chronicle'], tier: 3, namingTargets: [
    { emoji: '🪐', word: 'planet' }, { emoji: '🗿', word: 'statue' }, { emoji: '🪕', word: 'banjo' },
    { emoji: '🦏', word: 'rhinoceros' }, { emoji: '🎻', word: 'violin' }, { emoji: '🧬', word: 'DNA' },
  ]},
  { id: 'dl-57', memoryWords: ['paragon', 'twilight', 'sanctuary'], tier: 3, namingTargets: [
    { emoji: '🦢', word: 'swan' }, { emoji: '🪔', word: 'oil-lamp' }, { emoji: '🪂', word: 'parachute' },
    { emoji: '🦡', word: 'badger' }, { emoji: '🪨', word: 'boulder' }, { emoji: '⚱️', word: 'urn' },
  ]},
  { id: 'dl-58', memoryWords: ['epiphany', 'archive', 'glacier'], tier: 3, namingTargets: [
    { emoji: '🧬', word: 'helix' }, { emoji: '🦂', word: 'scorpion' }, { emoji: '🛕', word: 'temple' },
    { emoji: '🦫', word: 'beaver' }, { emoji: '🎼', word: 'score' }, { emoji: '🔭', word: 'telescope' },
  ]},
  { id: 'dl-59', memoryWords: ['solace', 'mirage', 'coterie'], tier: 3, namingTargets: [
    { emoji: '🦦', word: 'otter' }, { emoji: '🏯', word: 'pagoda' }, { emoji: '🗡️', word: 'sword' },
    { emoji: '🦏', word: 'rhinoceros' }, { emoji: '🪕', word: 'banjo' }, { emoji: '⚖️', word: 'scale' },
  ]},
  { id: 'dl-60', memoryWords: ['reverie', 'cipher', 'savant'], tier: 3, namingTargets: [
    { emoji: '🪐', word: 'planet' }, { emoji: '🦚', word: 'peacock' }, { emoji: '🧿', word: 'amulet' },
    { emoji: '🛕', word: 'shrine' }, { emoji: '🦙', word: 'llama' }, { emoji: '🎷', word: 'saxophone' },
  ]},
  { id: 'dl-61', memoryWords: ['threshold', 'liturgy', 'cadence'], tier: 3, namingTargets: [
    { emoji: '⚗️', word: 'flask' }, { emoji: '🦂', word: 'scorpion' }, { emoji: '🏛️', word: 'column' },
    { emoji: '🦢', word: 'swan' }, { emoji: '🪨', word: 'boulder' }, { emoji: '🧬', word: 'DNA' },
  ]},
];

export function getDualLoadSetsByTier(tier: number): DualLoadSet[] {
  return DUAL_LOAD_SETS.filter(s => s.tier === tier);
}
