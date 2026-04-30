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
    photoBankId: 'flower_2',
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
    target: 'feather',
    photoBankId: 'feather_1',
    acceptedWords: ['feather', 'plume', 'quill'],
    wordAliases: { feather: ['feathers', 'father'], plume: ['plumes'] },
    featureKeywords: {
      function: ['fly', 'float', 'write', 'decorate', 'tickle', 'insulate'],
      location: ['bird', 'wing', 'ground', 'pillow', 'nest'],
      appearance: ['light', 'soft', 'fluffy', 'curved', 'thin', 'striped'],
      material: ['keratin', 'down'],
      category: ['bird part', 'plumage', 'natural object'],
    },
    difficulty: 3,
    category: 'nature',
  },
  {
    id: 'dg_spider',
    target: 'spider',
    photoBankId: 'spider_1',
    acceptedWords: ['spider', 'arachnid', 'tarantula'],
    wordAliases: { spider: ['spiders', 'spyder'], arachnid: ['arachnids'] },
    featureKeywords: {
      function: ['spin', 'web', 'crawl', 'catch', 'hunt', 'bite'],
      location: ['web', 'corner', 'ceiling', 'garden', 'basement', 'attic'],
      appearance: ['eight legs', 'small', 'hairy', 'black', 'long legs'],
      material: ['silk', 'web'],
      category: ['arachnid', 'bug', 'insect', 'creature'],
    },
    difficulty: 3,
    category: 'animals',
  },
  {
    id: 'dg_wagon',
    target: 'wagon',
    photoBankId: 'wagon_1',
    acceptedWords: ['wagon', 'cart', 'trolley'],
    wordAliases: { wagon: ['wagons', 'wagen'], cart: ['carts'] },
    featureKeywords: {
      function: ['pull', 'carry', 'haul', 'transport', 'load'],
      location: ['yard', 'farm', 'barn', 'driveway', 'garden'],
      appearance: ['wheels', 'four wheels', 'handle', 'red', 'wooden', 'open'],
      material: ['wood', 'metal', 'steel'],
      category: ['vehicle', 'cart', 'transport'],
    },
    difficulty: 3,
    category: 'vehicles',
  },
  {
    id: 'dg_pillow',
    target: 'pillow',
    photoBankId: 'pillow_1',
    acceptedWords: ['pillow', 'cushion'],
    wordAliases: { pillow: ['pillows', 'pillo'], cushion: ['cushions'] },
    featureKeywords: {
      function: ['sleep', 'rest', 'support', 'lay', 'comfort', 'head'],
      location: ['bed', 'couch', 'sofa', 'bedroom'],
      appearance: ['soft', 'fluffy', 'square', 'rectangle', 'plush'],
      material: ['cotton', 'feather', 'down', 'foam', 'fabric'],
      category: ['bedding', 'cushion', 'home item'],
    },
    difficulty: 3,
    category: 'household',
  },
  {
    id: 'dg_puzzle',
    target: 'puzzle',
    photoBankId: 'puzzle_1',
    acceptedWords: ['puzzle', 'jigsaw'],
    wordAliases: { puzzle: ['puzzles', 'puzzel'], jigsaw: ['jigsaws'] },
    featureKeywords: {
      function: ['solve', 'assemble', 'fit', 'play', 'think', 'piece together'],
      location: ['table', 'box', 'floor', 'shelf'],
      appearance: ['pieces', 'colorful', 'interlocking', 'flat', 'small parts'],
      material: ['cardboard', 'wood', 'paper'],
      category: ['game', 'toy', 'activity'],
    },
    difficulty: 3,
    category: 'games',
  },

  // ══════════════ ADDITIONAL WORDS ══════════════

  // Difficulty 1
  {
    id: 'dg_hat',
    target: 'hat',
    photoBankId: 'hat_1',
    acceptedWords: ['hat', 'cap'],
    wordAliases: { hat: ['hats'], cap: ['caps'] },
    featureKeywords: {
      function: ['wear', 'cover', 'protect', 'shade', 'sun'],
      location: ['head', 'closet', 'hook', 'rack'],
      appearance: ['brim', 'round', 'visor', 'soft'],
      material: ['cloth', 'cotton', 'wool', 'fabric', 'straw'],
      category: ['clothing', 'accessory', 'headwear'],
    },
    difficulty: 1,
    category: 'clothing',
  },
  {
    id: 'dg_bed',
    target: 'bed',
    photoBankId: 'bed_1',
    acceptedWords: ['bed'],
    wordAliases: { bed: ['beds', 'bad'] },
    featureKeywords: {
      function: ['sleep', 'rest', 'lie down', 'nap', 'dream'],
      location: ['bedroom', 'room', 'hotel', 'house'],
      appearance: ['big', 'flat', 'soft', 'pillow', 'blanket', 'sheets', 'mattress'],
      material: ['wood', 'metal', 'fabric', 'foam', 'cotton'],
      category: ['furniture'],
    },
    difficulty: 1,
    category: 'furniture',
  },
  {
    id: 'dg_ball',
    target: 'ball',
    photoBankId: 'ball_1',
    acceptedWords: ['ball'],
    wordAliases: { ball: ['balls', 'bawl'] },
    featureKeywords: {
      function: ['throw', 'catch', 'kick', 'bounce', 'play', 'roll'],
      location: ['field', 'gym', 'park', 'ground', 'yard'],
      appearance: ['round', 'sphere', 'smooth', 'colorful'],
      material: ['rubber', 'leather', 'plastic', 'foam'],
      category: ['toy', 'sports', 'equipment'],
    },
    difficulty: 1,
    category: 'sports',
  },
  {
    id: 'dg_book',
    target: 'book',
    photoBankId: 'book_1',
    acceptedWords: ['book', 'novel'],
    wordAliases: { book: ['books', 'buk'], novel: ['novels'] },
    featureKeywords: {
      function: ['read', 'learn', 'study', 'story', 'stories'],
      location: ['shelf', 'library', 'table', 'desk', 'school', 'bookstore'],
      appearance: ['pages', 'cover', 'rectangular', 'thick', 'thin', 'spine'],
      material: ['paper', 'cardboard', 'cloth'],
      category: ['literature', 'reading material'],
    },
    difficulty: 1,
    category: 'objects',
  },

  // Difficulty 2
  {
    id: 'dg_umbrella',
    target: 'umbrella',
    photoBankId: 'umbrella_1',
    acceptedWords: ['umbrella', 'parasol'],
    wordAliases: { umbrella: ['umbrellas', 'umberella'] },
    featureKeywords: {
      function: ['rain', 'protect', 'cover', 'dry', 'shade', 'shelter'],
      location: ['outside', 'hand', 'car', 'door', 'stand'],
      appearance: ['round', 'curved', 'handle', 'canopy', 'fabric', 'fold'],
      material: ['nylon', 'metal', 'plastic', 'fabric', 'cloth'],
      category: ['accessory', 'tool', 'rain gear'],
    },
    difficulty: 2,
    category: 'accessories',
  },
  {
    id: 'dg_scissors',
    target: 'scissors',
    photoBankId: 'scissors_1',
    acceptedWords: ['scissors', 'shears'],
    wordAliases: { scissors: ['scissor', 'sizors'], shears: ['sheers'] },
    featureKeywords: {
      function: ['cut', 'cutting', 'trim', 'snip', 'paper', 'hair'],
      location: ['desk', 'drawer', 'office', 'school', 'kitchen'],
      appearance: ['two blades', 'sharp', 'handles', 'holes', 'pointed'],
      material: ['metal', 'steel', 'plastic', 'rubber'],
      category: ['tool', 'office supply', 'stationery'],
    },
    difficulty: 2,
    category: 'tools',
  },
  {
    id: 'dg_clock',
    target: 'clock',
    photoBankId: 'clock_1',
    acceptedWords: ['clock'],
    wordAliases: { clock: ['clocks', 'clok'] },
    featureKeywords: {
      function: ['time', 'tell time', 'alarm', 'wake up', 'tick'],
      location: ['wall', 'table', 'bedroom', 'kitchen', 'office', 'tower'],
      appearance: ['round', 'face', 'hands', 'numbers', 'dial'],
      material: ['plastic', 'metal', 'wood', 'glass'],
      category: ['electronics', 'device', 'timepiece'],
    },
    difficulty: 2,
    category: 'home',
  },
  {
    id: 'dg_cat',
    target: 'cat',
    photoBankId: 'cat_1',
    acceptedWords: ['cat', 'kitten', 'kitty'],
    wordAliases: { cat: ['cats', 'kat'], kitten: ['kittens'] },
    featureKeywords: {
      function: ['pet', 'purr', 'meow', 'scratch', 'hunt', 'cuddle'],
      location: ['house', 'home', 'couch', 'lap', 'window', 'bed'],
      appearance: ['fur', 'whiskers', 'tail', 'paws', 'ears', 'eyes', 'claws'],
      material: ['fur', 'hair'],
      category: ['animal', 'pet', 'mammal'],
    },
    difficulty: 2,
    category: 'animals',
  },

  // Difficulty 3
  {
    id: 'dg_bridge',
    target: 'bridge',
    photoBankId: 'bridge_1',
    acceptedWords: ['bridge'],
    wordAliases: { bridge: ['bridges', 'brij'] },
    featureKeywords: {
      function: ['cross', 'connect', 'walk over', 'drive over', 'span'],
      location: ['river', 'water', 'road', 'highway', 'city'],
      appearance: ['long', 'arches', 'cables', 'tall', 'wide', 'railings'],
      material: ['steel', 'concrete', 'stone', 'wood', 'metal', 'iron'],
      category: ['structure', 'infrastructure', 'construction'],
    },
    difficulty: 3,
    category: 'places',
  },
  {
    id: 'dg_candle',
    target: 'candle',
    photoBankId: 'candle_1',
    acceptedWords: ['candle'],
    wordAliases: { candle: ['candles', 'kandel'] },
    featureKeywords: {
      function: ['light', 'burn', 'smell', 'melt', 'glow', 'flame'],
      location: ['table', 'cake', 'church', 'bathroom', 'dinner'],
      appearance: ['tall', 'thin', 'wick', 'flame', 'dripping', 'cylindrical'],
      material: ['wax', 'paraffin', 'cotton'],
      category: ['decoration', 'lighting'],
    },
    difficulty: 3,
    category: 'home',
  },
  {
    id: 'dg_bicycle',
    target: 'bicycle',
    photoBankId: 'bicycle_1',
    acceptedWords: ['bicycle', 'bike'],
    wordAliases: { bicycle: ['bicycles', 'bycicle'], bike: ['bikes', 'bik'] },
    featureKeywords: {
      function: ['ride', 'pedal', 'exercise', 'travel', 'race'],
      location: ['road', 'path', 'park', 'garage', 'sidewalk', 'street'],
      appearance: ['wheels', 'two wheels', 'handlebars', 'seat', 'pedals', 'chain', 'spokes'],
      material: ['metal', 'steel', 'aluminum', 'rubber', 'carbon'],
      category: ['vehicle', 'transportation', 'sports equipment'],
    },
    difficulty: 3,
    category: 'transportation',
  },
  {
    id: 'dg_window',
    target: 'window',
    photoBankId: 'window_1',
    acceptedWords: ['window'],
    wordAliases: { window: ['windows', 'windo'] },
    featureKeywords: {
      function: ['see', 'look', 'open', 'close', 'light', 'air', 'view', 'ventilate'],
      location: ['wall', 'house', 'building', 'car', 'room'],
      appearance: ['glass', 'frame', 'pane', 'rectangular', 'square', 'curtains'],
      material: ['glass', 'wood', 'metal', 'aluminum', 'plastic'],
      category: ['part of house', 'building', 'architecture'],
    },
    difficulty: 3,
    category: 'home',
  },

  // ══════════════ TIER 1 EXPANSION (engine L1–L3): high-frequency monosyllabic concrete nouns ══════════════
  {
    id: 'dg_apple',
    target: 'apple',
    photoBankId: 'apple_1',
    acceptedWords: ['apple'],
    wordAliases: { apple: ['apples', 'apel'] },
    featureKeywords: {
      function: ['eat', 'bite', 'snack', 'juice', 'cook', 'bake'],
      location: ['kitchen', 'fridge', 'tree', 'bowl', 'lunchbox', 'store'],
      appearance: ['round', 'red', 'green', 'shiny', 'small', 'stem'],
      material: ['fruit', 'organic'],
      category: ['fruit', 'food', 'snack'],
    },
    difficulty: 1,
    category: 'food',
  },
  {
    id: 'dg_hand',
    target: 'hand',
    photoBankId: 'hand_3',
    acceptedWords: ['hand'],
    wordAliases: { hand: ['hands', 'hend'] },
    featureKeywords: {
      function: ['hold', 'grab', 'wave', 'write', 'touch', 'shake'],
      location: ['arm', 'wrist', 'body'],
      appearance: ['fingers', 'palm', 'thumb', 'five fingers', 'knuckles'],
      material: ['skin'],
      category: ['body part', 'limb'],
    },
    difficulty: 1,
    category: 'body',
  },
  {
    id: 'dg_bag',
    target: 'bag',
    photoBankId: 'bag_1',
    acceptedWords: ['bag', 'sack'],
    wordAliases: { bag: ['bags', 'beg'], sack: ['sacks'] },
    featureKeywords: {
      function: ['carry', 'hold', 'store', 'shopping', 'pack'],
      location: ['shoulder', 'hand', 'closet', 'store', 'car'],
      appearance: ['handles', 'strap', 'open', 'rectangular', 'soft'],
      material: ['cloth', 'plastic', 'paper', 'leather', 'canvas'],
      category: ['container', 'accessory'],
    },
    difficulty: 1,
    category: 'objects',
  },
  {
    id: 'dg_pen',
    target: 'pen',
    photoBankId: 'pen_1',
    acceptedWords: ['pen'],
    wordAliases: { pen: ['pens', 'pin'] },
    featureKeywords: {
      function: ['write', 'sign', 'draw', 'note'],
      location: ['desk', 'pocket', 'office', 'school', 'bag'],
      appearance: ['long', 'thin', 'point', 'cap', 'cylindrical'],
      material: ['plastic', 'metal', 'ink'],
      category: ['writing tool', 'office supply', 'stationery'],
    },
    difficulty: 1,
    category: 'office',
  },
  {
    id: 'dg_coat',
    target: 'coat',
    photoBankId: 'coat_1',
    acceptedWords: ['coat', 'jacket'],
    wordAliases: { coat: ['coats', 'cot'], jacket: ['jackets'] },
    featureKeywords: {
      function: ['wear', 'warm', 'cold', 'winter', 'cover'],
      location: ['closet', 'hook', 'body', 'rack', 'door'],
      appearance: ['long', 'sleeves', 'buttons', 'zipper', 'collar', 'pockets'],
      material: ['wool', 'cotton', 'leather', 'fabric', 'down'],
      category: ['clothing', 'outerwear'],
    },
    difficulty: 1,
    category: 'clothing',
  },

  // ══════════════ TIER 2 EXPANSION (engine L4–L7): mid-frequency, closer competitors ══════════════
  {
    id: 'dg_banana',
    target: 'banana',
    photoBankId: 'banana_1',
    acceptedWords: ['banana'],
    wordAliases: { banana: ['bananas', 'bnana'] },
    featureKeywords: {
      function: ['eat', 'peel', 'snack', 'breakfast', 'smoothie'],
      location: ['kitchen', 'tree', 'bowl', 'fridge', 'store'],
      appearance: ['yellow', 'long', 'curved', 'peel', 'soft'],
      material: ['fruit', 'organic'],
      category: ['fruit', 'food'],
    },
    difficulty: 2,
    category: 'food',
  },
  {
    id: 'dg_basket',
    target: 'basket',
    photoBankId: 'basket_1',
    acceptedWords: ['basket'],
    wordAliases: { basket: ['baskets', 'bascet'] },
    featureKeywords: {
      function: ['carry', 'hold', 'store', 'collect', 'pick'],
      location: ['kitchen', 'porch', 'farm', 'store', 'picnic'],
      appearance: ['woven', 'handle', 'round', 'open', 'deep'],
      material: ['wicker', 'straw', 'wood', 'plastic', 'cane'],
      category: ['container'],
    },
    difficulty: 2,
    category: 'objects',
  },
  {
    id: 'dg_glove',
    target: 'glove',
    photoBankId: 'glove_1',
    acceptedWords: ['glove', 'mitten'],
    wordAliases: { glove: ['gloves', 'gluv'], mitten: ['mittens'] },
    featureKeywords: {
      function: ['wear', 'warm', 'protect', 'work', 'cold', 'winter'],
      location: ['hand', 'closet', 'pocket', 'drawer'],
      appearance: ['five fingers', 'soft', 'matching pair', 'wrist'],
      material: ['leather', 'wool', 'cotton', 'rubber', 'fabric'],
      category: ['clothing', 'accessory', 'handwear'],
    },
    difficulty: 2,
    category: 'clothing',
  },
  {
    id: 'dg_lemon',
    target: 'lemon',
    photoBankId: 'lemon_1',
    acceptedWords: ['lemon'],
    wordAliases: { lemon: ['lemons', 'lemmon'] },
    featureKeywords: {
      function: ['cook', 'flavor', 'juice', 'sour', 'drink', 'squeeze'],
      location: ['kitchen', 'tree', 'bowl', 'fridge', 'store'],
      appearance: ['yellow', 'oval', 'small', 'round', 'bumpy skin'],
      material: ['fruit', 'organic'],
      category: ['fruit', 'food', 'citrus'],
    },
    difficulty: 2,
    category: 'food',
  },
  {
    id: 'dg_frog',
    target: 'frog',
    photoBankId: 'frog_1',
    acceptedWords: ['frog', 'toad'],
    wordAliases: { frog: ['frogs', 'frawg'], toad: ['toads'] },
    featureKeywords: {
      function: ['jump', 'hop', 'swim', 'croak', 'catch flies'],
      location: ['pond', 'water', 'lily pad', 'swamp', 'grass'],
      appearance: ['green', 'small', 'wet', 'long legs', 'big eyes', 'webbed feet'],
      material: ['skin'],
      category: ['animal', 'amphibian', 'wildlife'],
    },
    difficulty: 2,
    category: 'animals',
  },

  // ══════════════ TIER 3 EXPANSION (engine L8–L10): low-frequency, multi-syllable, harder lexical access ══════════════
  {
    id: 'dg_treasure',
    target: 'treasure',
    photoBankId: 'treasure_1',
    acceptedWords: ['treasure', 'gold', 'jewels'],
    wordAliases: { treasure: ['treasures', 'trezure'], jewels: ['jewel'] },
    featureKeywords: {
      function: ['find', 'discover', 'hide', 'value', 'spend'],
      location: ['chest', 'island', 'cave', 'pirate ship', 'buried'],
      appearance: ['gold', 'shiny', 'sparkle', 'coins', 'gems', 'jewels'],
      material: ['gold', 'silver', 'gemstones', 'metal'],
      category: ['valuables', 'wealth', 'riches'],
    },
    difficulty: 3,
    category: 'objects',
  },
  {
    id: 'dg_pigeon',
    target: 'pigeon',
    photoBankId: 'pigeon_1',
    acceptedWords: ['pigeon', 'dove'],
    wordAliases: { pigeon: ['pigeons', 'pidgeon'], dove: ['doves'] },
    featureKeywords: {
      function: ['fly', 'coo', 'peck', 'eat crumbs'],
      location: ['city', 'park', 'sidewalk', 'roof', 'square', 'statue'],
      appearance: ['gray', 'small', 'wings', 'feathers', 'beak', 'red feet'],
      material: ['feathers'],
      category: ['bird', 'animal', 'wildlife'],
    },
    difficulty: 3,
    category: 'animals',
  },
  {
    id: 'dg_garage',
    target: 'garage',
    photoBankId: 'garage_1',
    acceptedWords: ['garage'],
    wordAliases: { garage: ['garages', 'grage'] },
    featureKeywords: {
      function: ['park', 'store', 'fix', 'work on cars', 'shelter'],
      location: ['house', 'driveway', 'yard', 'building'],
      appearance: ['big door', 'wide', 'concrete floor', 'roll up door'],
      material: ['concrete', 'wood', 'metal', 'brick'],
      category: ['part of house', 'building', 'storage'],
    },
    difficulty: 3,
    category: 'home',
  },
  {
    id: 'dg_ladder',
    target: 'ladder',
    photoBankId: 'ladder_1',
    acceptedWords: ['ladder'],
    wordAliases: { ladder: ['ladders', 'later'] },
    featureKeywords: {
      function: ['climb', 'reach', 'paint', 'fix', 'go up', 'access'],
      location: ['garage', 'house', 'wall', 'roof', 'shed'],
      appearance: ['tall', 'rungs', 'two sides', 'straight', 'steps'],
      material: ['wood', 'metal', 'aluminum', 'fiberglass'],
      category: ['tool', 'equipment'],
    },
    difficulty: 3,
    category: 'tools',
  },
  {
    id: 'dg_mirror',
    target: 'mirror',
    photoBankId: 'mirror_1',
    acceptedWords: ['mirror'],
    wordAliases: { mirror: ['mirrors', 'meeror'] },
    featureKeywords: {
      function: ['see yourself', 'reflect', 'check', 'look', 'shave', 'makeup'],
      location: ['bathroom', 'bedroom', 'wall', 'car', 'hallway'],
      appearance: ['shiny', 'flat', 'reflective', 'frame', 'rectangular', 'oval'],
      material: ['glass', 'silver', 'metal'],
      category: ['decor', 'home item'],
    },
    difficulty: 3,
    category: 'home',
  },
];

/**
 * Get trials filtered by difficulty — guaranteed no repeated targets
 */
import { PHOTO_BANK } from './photoBank';

/** Quiet remap for trials whose original photoBankId is missing in PHOTO_BANK. */
const PHOTO_ID_REMAP: Record<string, string> = {
  cat_1: 'cat_3',
};

/**
 * Returns playable trials only. A trial is "playable" iff its (possibly
 * remapped) photoBankId resolves to an entry in PHOTO_BANK. This is the
 * single guard that prevents the blank-card regression in Describe & Guess.
 */
/**
 * Map an engine difficulty (1..10) to the DescribeGuess content tier (1..3).
 * Until L4-L10 content lands, the bank only has 3 tiers; this collapse is
 * explicit and centralized so callers can pass either a tier or an engine level.
 */
function toDescribeGuessTier(d: number): 1 | 2 | 3 {
  if (!Number.isFinite(d)) return 2;
  if (d <= 3) return 1;
  if (d <= 7) return 2;
  return 3;
}

export function getDescribeGuessTrials(options?: {
  /** Tier 1..3 OR engine level 1..10. Both accepted; engine levels collapse to a tier. */
  difficulty?: number;
  count?: number;
}): DescribeGuessTrial[] {
  const validPhotoIds = new Set(PHOTO_BANK.map(p => p.id));

  // Normalize photo IDs and drop trials whose photo is missing.
  const all = DESCRIBE_GUESS_BANK
    .map(t => {
      const remapped = PHOTO_ID_REMAP[t.photoBankId] ?? t.photoBankId;
      return remapped === t.photoBankId ? t : { ...t, photoBankId: remapped };
    })
    .filter(t => {
      if (validPhotoIds.has(t.photoBankId)) return true;
      if (typeof console !== 'undefined') {
        console.warn(`[describeGuessBank] dropping trial ${t.id} — missing photo "${t.photoBankId}"`);
      }
      return false;
    });

  // ── BAND-ISOLATED selection (no more cumulative `<=` filter) ──
  // Pick the exact target tier. If the pool is too small for the requested
  // count, pad from the nearest neighbor tier(s), nearest first. Never the
  // full bank — that's what made L4 and L7 look identical.
  let pool: DescribeGuessTrial[];
  if (options?.difficulty != null) {
    const targetTier = toDescribeGuessTier(options.difficulty);
    const exact = all.filter(t => t.difficulty === targetTier);
    const requested = options.count ?? exact.length;

    if (exact.length >= requested) {
      pool = exact;
    } else {
      // Padding policy: prefer the HARDER neighbor first.
      // Rationale — when an adaptive engine asks for tier N and the bank
      // can't fill the request, contaminating with easier content silently
      // drops the perceived difficulty (the exact bug we just fixed).
      // Padding upward preserves the challenge direction.
      const neighbors: number[] =
        targetTier === 1 ? [2, 3] :          // tier 1 has nowhere to go but up
        targetTier === 3 ? [2, 1] :          // tier 3 falls to 2 first, then 1
        [3, 1];                              // tier 2: prefer tier 3 over tier 1
      const padded = [...exact];
      for (const n of neighbors) {
        if (padded.length >= requested) break;
        padded.push(...all.filter(t => t.difficulty === n));
      }
      pool = padded;
    }
  } else {
    pool = all;
  }

  // Deduplicate by target word (safety net)
  const seen = new Set<string>();
  let trials = pool.filter(t => {
    const key = t.target.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

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

