/**
 * Describe & Guess Trial Bank
 * 
 * Reuses PHOTO_BANK images. Each trial maps a target word to
 * structured feature prompts and acceptance criteria.
 * 
 * Feature types (deterministic via prompt chips):
 * - function: "What do you use it for?"
 * - location: "Where do you see it?"
 * - appearance: "What does it look like?"
 * - material: "What's it made of?"
 * - category: "What kind of thing is it?"
 */

export type FeatureType = 'function' | 'location' | 'appearance' | 'material' | 'category';

export interface DescribeGuessTrial {
  id: string;
  /** Target word (maps to a PHOTO_BANK entry) */
  target: string;
  /** Photo bank trial ID for image lookup */
  photoBankId: string;
  /** Synonyms and close words that count as "Word Win" */
  acceptedWords: string[];
  /** ASR aliases */
  wordAliases: Record<string, string[]>;
  /** Keywords per feature type — used for "Strategy Win" verification */
  featureKeywords: Partial<Record<FeatureType, string[]>>;
  /** Difficulty 1-3 */
  difficulty: 1 | 2 | 3;
  category: string;
}

export const DESCRIBE_GUESS_BANK: DescribeGuessTrial[] = [
  // ══════════════ DIFFICULTY 1: Common household items ══════════════
  {
    id: 'dg_cup',
    target: 'cup',
    photoBankId: 'cup_1',
    acceptedWords: ['cup', 'mug', 'glass'],
    wordAliases: { cup: ['cups', 'cop'], mug: ['mugs'], glass: ['glasses'] },
    featureKeywords: {
      function: ['drink', 'drinking', 'hold', 'pour', 'sip', 'coffee', 'tea', 'water'],
      location: ['kitchen', 'table', 'counter', 'cupboard', 'cabinet'],
      appearance: ['round', 'handle', 'small', 'white', 'ceramic'],
      material: ['ceramic', 'glass', 'plastic', 'porcelain', 'china'],
      category: ['container', 'dish', 'kitchenware', 'drinkware'],
    },
    difficulty: 1,
    category: 'kitchen',
  },
  {
    id: 'dg_dog',
    target: 'dog',
    photoBankId: 'dog_1',
    acceptedWords: ['dog', 'puppy', 'pup'],
    wordAliases: { dog: ['dogs', 'doggy', 'dawg'], puppy: ['puppies', 'pupy'] },
    featureKeywords: {
      function: ['pet', 'companion', 'friend', 'walk', 'play', 'fetch', 'guard'],
      location: ['house', 'home', 'yard', 'park', 'outside'],
      appearance: ['fur', 'furry', 'tail', 'ears', 'paws', 'four legs', 'wet nose'],
      material: ['fur', 'hair'],
      category: ['animal', 'pet', 'mammal'],
    },
    difficulty: 1,
    category: 'animals',
  },
  {
    id: 'dg_chair',
    target: 'chair',
    photoBankId: 'chair_2',
    acceptedWords: ['chair', 'seat'],
    wordAliases: { chair: ['chairs', 'share'], seat: ['seats'] },
    featureKeywords: {
      function: ['sit', 'sitting', 'rest', 'seat'],
      location: ['kitchen', 'living room', 'office', 'table', 'desk', 'dining'],
      appearance: ['legs', 'four legs', 'back', 'flat'],
      material: ['wood', 'wooden', 'metal', 'plastic', 'fabric', 'leather'],
      category: ['furniture', 'seating'],
    },
    difficulty: 1,
    category: 'furniture',
  },
  {
    id: 'dg_door',
    target: 'door',
    photoBankId: 'door_2',
    acceptedWords: ['door', 'doorway'],
    wordAliases: { door: ['doors', 'dor'] },
    featureKeywords: {
      function: ['open', 'close', 'enter', 'exit', 'knock', 'lock'],
      location: ['house', 'room', 'building', 'entrance', 'front'],
      appearance: ['tall', 'rectangle', 'handle', 'knob', 'hinges'],
      material: ['wood', 'wooden', 'metal', 'glass'],
      category: ['part of house', 'building'],
    },
    difficulty: 1,
    category: 'home',
  },
  {
    id: 'dg_key',
    target: 'key',
    photoBankId: 'key_2',
    acceptedWords: ['key'],
    wordAliases: { key: ['keys', 'ki'] },
    featureKeywords: {
      function: ['lock', 'unlock', 'open', 'start', 'turn'],
      location: ['pocket', 'door', 'car', 'keychain'],
      appearance: ['small', 'metal', 'teeth', 'shiny'],
      material: ['metal', 'brass', 'steel', 'iron'],
      category: ['tool'],
    },
    difficulty: 1,
    category: 'home',
  },
  {
    id: 'dg_shoe',
    target: 'shoe',
    photoBankId: 'shoe_2',
    acceptedWords: ['shoe', 'sneaker', 'boot'],
    wordAliases: { shoe: ['shoes', 'shoo'], sneaker: ['sneakers'], boot: ['boots'] },
    featureKeywords: {
      function: ['wear', 'walk', 'run', 'protect', 'foot'],
      location: ['closet', 'floor', 'feet', 'store'],
      appearance: ['laces', 'sole', 'heel', 'toe'],
      material: ['leather', 'rubber', 'canvas', 'cloth'],
      category: ['clothing', 'footwear'],
    },
    difficulty: 1,
    category: 'clothing',
  },
  {
    id: 'dg_phone',
    target: 'phone',
    photoBankId: 'phone_2',
    acceptedWords: ['phone', 'telephone', 'cell phone', 'mobile'],
    wordAliases: { phone: ['phones', 'fone'], telephone: ['telephones'], mobile: ['mobiles'] },
    featureKeywords: {
      function: ['call', 'talk', 'text', 'message', 'ring', 'communicate'],
      location: ['pocket', 'hand', 'table', 'desk', 'purse'],
      appearance: ['screen', 'flat', 'rectangular', 'buttons'],
      material: ['glass', 'metal', 'plastic'],
      category: ['electronics', 'device', 'technology'],
    },
    difficulty: 1,
    category: 'electronics',
  },

  // ══════════════ DIFFICULTY 2: Less frequent / closer competitors ══════════════
  {
    id: 'dg_spoon',
    target: 'spoon',
    photoBankId: 'spoon_2',
    acceptedWords: ['spoon'],
    wordAliases: { spoon: ['spoons', 'spun'] },
    featureKeywords: {
      function: ['eat', 'stir', 'scoop', 'soup', 'cereal', 'mix'],
      location: ['kitchen', 'drawer', 'table', 'bowl'],
      appearance: ['round', 'curved', 'long', 'handle', 'shiny'],
      material: ['metal', 'silver', 'stainless steel', 'wood', 'plastic'],
      category: ['utensil', 'cutlery', 'silverware'],
    },
    difficulty: 2,
    category: 'kitchen',
  },
  {
    id: 'dg_bird',
    target: 'bird',
    photoBankId: 'bird_2',
    acceptedWords: ['bird', 'robin', 'sparrow'],
    wordAliases: { bird: ['birds', 'berd'] },
    featureKeywords: {
      function: ['fly', 'sing', 'chirp', 'nest', 'tweet'],
      location: ['sky', 'tree', 'outside', 'garden', 'park', 'roof'],
      appearance: ['wings', 'feathers', 'beak', 'small', 'tail'],
      material: ['feathers'],
      category: ['animal', 'flying', 'wildlife'],
    },
    difficulty: 2,
    category: 'animals',
  },
  {
    id: 'dg_watch',
    target: 'watch',
    photoBankId: 'watch_3',
    acceptedWords: ['watch', 'wristwatch'],
    wordAliases: { watch: ['watches', 'wotch'], wristwatch: ['wrist watch'] },
    featureKeywords: {
      function: ['time', 'tell time', 'wear', 'check'],
      location: ['wrist', 'arm', 'hand'],
      appearance: ['round', 'face', 'hands', 'strap', 'band', 'numbers'],
      material: ['metal', 'leather', 'glass', 'plastic', 'gold', 'silver'],
      category: ['jewelry', 'accessory', 'electronics'],
    },
    difficulty: 2,
    category: 'accessories',
  },
  {
    id: 'dg_flower',
    target: 'flower',
    photoBankId: 'flower_1',
    acceptedWords: ['flower', 'rose', 'daisy', 'blossom'],
    wordAliases: { flower: ['flowers', 'flour'], rose: ['roses'] },
    featureKeywords: {
      function: ['smell', 'decorate', 'gift', 'grow', 'bloom'],
      location: ['garden', 'vase', 'outside', 'park', 'field', 'pot'],
      appearance: ['petals', 'colorful', 'pretty', 'stem', 'leaves', 'beautiful'],
      material: ['plant', 'organic', 'natural'],
      category: ['plant', 'nature', 'living thing'],
    },
    difficulty: 2,
    category: 'nature',
  },
  {
    id: 'dg_lamp',
    target: 'lamp',
    photoBankId: 'lamp_1',
    acceptedWords: ['lamp', 'light'],
    wordAliases: { lamp: ['lamps'], light: ['lights', 'lite'] },
    featureKeywords: {
      function: ['light', 'illuminate', 'read', 'see', 'bright', 'turn on'],
      location: ['table', 'desk', 'bedroom', 'nightstand', 'living room'],
      appearance: ['shade', 'tall', 'base', 'bulb', 'bright'],
      material: ['metal', 'glass', 'fabric', 'ceramic', 'plastic'],
      category: ['furniture', 'electronics', 'lighting'],
    },
    difficulty: 2,
    category: 'home',
  },
  {
    id: 'dg_fish',
    target: 'fish',
    photoBankId: 'fish_1',
    acceptedWords: ['fish'],
    wordAliases: { fish: ['fishes', 'phish'] },
    featureKeywords: {
      function: ['swim', 'eat', 'catch', 'fishing'],
      location: ['water', 'ocean', 'sea', 'lake', 'river', 'aquarium', 'tank'],
      appearance: ['fins', 'scales', 'tail', 'gills', 'slippery', 'shiny'],
      material: ['scales'],
      category: ['animal', 'sea creature', 'wildlife', 'food'],
    },
    difficulty: 2,
    category: 'animals',
  },

  // ══════════════ DIFFICULTY 3: Abstract-ish / multi-syllable ══════════════
  {
    id: 'dg_tree',
    target: 'tree',
    photoBankId: 'tree_1',
    acceptedWords: ['tree', 'oak', 'elm', 'pine'],
    wordAliases: { tree: ['trees', 'three'] },
    featureKeywords: {
      function: ['shade', 'climb', 'grow', 'oxygen', 'breathe', 'shelter'],
      location: ['outside', 'forest', 'yard', 'park', 'garden', 'woods'],
      appearance: ['tall', 'trunk', 'branches', 'leaves', 'bark', 'green', 'big'],
      material: ['wood', 'bark', 'leaves'],
      category: ['plant', 'nature', 'living thing'],
    },
    difficulty: 3,
    category: 'nature',
  },
  {
    id: 'dg_ring',
    target: 'ring',
    photoBankId: 'ring_1',
    acceptedWords: ['ring', 'band'],
    wordAliases: { ring: ['rings', 'rang'], band: ['bands'] },
    featureKeywords: {
      function: ['wear', 'wedding', 'engagement', 'decorate', 'propose'],
      location: ['finger', 'hand', 'jewelry box', 'store'],
      appearance: ['round', 'circle', 'shiny', 'sparkle', 'gem', 'diamond', 'stone'],
      material: ['gold', 'silver', 'metal', 'platinum', 'diamond'],
      category: ['jewelry', 'accessory'],
    },
    difficulty: 3,
    category: 'accessories',
  },
  {
    id: 'dg_star',
    target: 'star',
    photoBankId: 'star_1',
    acceptedWords: ['star'],
    wordAliases: { star: ['stars', 'stare'] },
    featureKeywords: {
      function: ['shine', 'twinkle', 'light', 'guide', 'navigate'],
      location: ['sky', 'night', 'space', 'universe', 'above'],
      appearance: ['bright', 'point', 'points', 'twinkle', 'small', 'far away'],
      material: ['gas', 'fire', 'light'],
      category: ['space', 'nature', 'sky'],
    },
    difficulty: 3,
    category: 'nature',
  },
  {
    id: 'dg_leaf',
    target: 'leaf',
    photoBankId: 'leaf_1',
    acceptedWords: ['leaf', 'leaves'],
    wordAliases: { leaf: ['leafs', 'leave', 'leaves'] },
    featureKeywords: {
      function: ['grow', 'fall', 'shade', 'breathe', 'photosynthesis'],
      location: ['tree', 'ground', 'branch', 'garden', 'forest'],
      appearance: ['green', 'flat', 'veins', 'stem', 'thin', 'brown', 'red', 'yellow'],
      material: ['plant', 'organic'],
      category: ['plant', 'nature', 'part of tree'],
    },
    difficulty: 3,
    category: 'nature',
  },
];

/**
 * Get trials filtered by difficulty
 */
export function getDescribeGuessTrials(options?: {
  difficulty?: number;
  count?: number;
}): DescribeGuessTrial[] {
  let trials = [...DESCRIBE_GUESS_BANK];
  
  if (options?.difficulty) {
    trials = trials.filter(t => t.difficulty <= options.difficulty!);
  }
  
  // Shuffle
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trials[i], trials[j]] = [trials[j], trials[i]];
  }
  
  if (options?.count) {
    trials = trials.slice(0, options.count);
  }
  
  return trials;
}
