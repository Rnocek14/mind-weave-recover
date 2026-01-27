/**
 * Two Clues Word Association Game - Puzzle Bank
 * 
 * Each puzzle has 2-3 clue words and multiple valid answers
 * scored by tier: anchors (best), cluster (good), nearMisses (creative)
 */

export type MatchTier = 'strong' | 'related' | 'creative' | 'uncertain';

export interface TwoCluesPuzzle {
  id: string;
  clues: string[];                              // 2-3 clue words
  category: string;                             // e.g., 'animals', 'kitchen'
  difficulty: 1 | 2 | 3;                        // Mapped to word frequency/abstractness
  
  // Answer graph - top tier
  anchors: string[];                            // Top intended answers (e.g., "bird")
  anchorAliases?: Record<string, string[]>;     // ASR variants: { "bird": ["birds", "birb"] }
  
  // Answer graph - related tier
  cluster: string[];                            // Acceptable answers (e.g., "sparrow", "wings")
  clusterAliases?: Record<string, string[]>;    // ASR variants for cluster words
  
  // Answer graph - creative tier
  nearMisses: string[];                         // Plausible but weaker links
  coachHints: Record<string, string>;           // Coaching response for near-misses
}

// ============================================
// ANIMALS PACK
// ============================================
const animalsPuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-animals-1',
    clues: ['tweets', 'flies'],
    category: 'animals',
    difficulty: 1,
    anchors: ['bird'],
    anchorAliases: { 'bird': ['birds', 'birb', 'burd'] },
    cluster: ['sparrow', 'robin', 'eagle', 'wings', 'feathers', 'chirp', 'nest', 'beak', 'crow', 'pigeon', 'finch', 'cardinal'],
    clusterAliases: { 'wings': ['wing'], 'feathers': ['feather'] },
    nearMisses: ['airplane', 'twitter', 'insect', 'butterfly', 'bee'],
    coachHints: {
      'airplane': "That flies! But what tweets?",
      'twitter': "Good thinking! What animal tweets?",
      'insect': "Some insects fly! But which animal tweets?",
      'butterfly': "Butterflies fly! What animal also tweets?",
      'bee': "Bees fly! What animal tweets?"
    }
  },
  {
    id: 'tc-animals-2',
    clues: ['barks', 'wags'],
    category: 'animals',
    difficulty: 1,
    anchors: ['dog'],
    anchorAliases: { 'dog': ['dogs', 'doggy', 'puppy', 'pup'] },
    cluster: ['puppy', 'tail', 'pet', 'canine', 'hound', 'retriever', 'labrador', 'beagle'],
    clusterAliases: { 'tail': ['tails'] },
    nearMisses: ['wolf', 'fox', 'seal'],
    coachHints: {
      'wolf': "Wolves are related! What pet barks and wags?",
      'fox': "Foxes are similar! What pet wags its tail?",
      'seal': "Seals bark! But what wags its tail?"
    }
  },
  {
    id: 'tc-animals-3',
    clues: ['meows', 'purrs'],
    category: 'animals',
    difficulty: 1,
    anchors: ['cat'],
    anchorAliases: { 'cat': ['cats', 'kitty', 'kitten'] },
    cluster: ['kitten', 'feline', 'whiskers', 'paws', 'tabby', 'siamese', 'persian'],
    clusterAliases: { 'whiskers': ['whisker'], 'paws': ['paw'] },
    nearMisses: ['lion', 'tiger', 'panther'],
    coachHints: {
      'lion': "Lions are big cats! What pet purrs?",
      'tiger': "Tigers are felines! What smaller animal meows?",
      'panther': "Panthers are cats! What house pet purrs?"
    }
  },
  {
    id: 'tc-animals-4',
    clues: ['swims', 'scales'],
    category: 'animals',
    difficulty: 1,
    anchors: ['fish'],
    anchorAliases: { 'fish': ['fishes', 'fishy'] },
    cluster: ['salmon', 'trout', 'goldfish', 'fins', 'gills', 'tuna', 'bass', 'cod'],
    clusterAliases: { 'fins': ['fin'], 'gills': ['gill'] },
    nearMisses: ['mermaid', 'dolphin', 'whale', 'shark'],
    coachHints: {
      'mermaid': "Mermaids have scales! What real animal?",
      'dolphin': "Dolphins swim! But what has scales?",
      'whale': "Whales swim! What has scales?",
      'shark': "Sharks swim! What general word for them?"
    }
  },
  {
    id: 'tc-animals-5',
    clues: ['hops', 'long ears'],
    category: 'animals',
    difficulty: 1,
    anchors: ['rabbit', 'bunny'],
    anchorAliases: { 'rabbit': ['rabbits'], 'bunny': ['bunnies'] },
    cluster: ['hare', 'cottontail', 'ears', 'fluffy', 'carrot'],
    nearMisses: ['kangaroo', 'frog'],
    coachHints: {
      'kangaroo': "Kangaroos hop! What has long ears?",
      'frog': "Frogs hop! What has long ears?"
    }
  },
  {
    id: 'tc-animals-6',
    clues: ['moos', 'milk'],
    category: 'animals',
    difficulty: 1,
    anchors: ['cow'],
    anchorAliases: { 'cow': ['cows', 'cattle'] },
    cluster: ['calf', 'bovine', 'udder', 'dairy', 'barn', 'farm', 'heifer'],
    nearMisses: ['goat', 'bull'],
    coachHints: {
      'goat': "Goats give milk! What moos?",
      'bull': "Bulls are related! What gives milk?"
    }
  }
];

// ============================================
// KITCHEN PACK
// ============================================
const kitchenPuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-kitchen-1',
    clues: ['cuts', 'sharp'],
    category: 'kitchen',
    difficulty: 1,
    anchors: ['knife'],
    anchorAliases: { 'knife': ['knives', 'knive'] },
    cluster: ['blade', 'scissors', 'cleaver', 'chop', 'slice', 'edge', 'butcher', 'carving'],
    clusterAliases: { 'scissors': ['scissor'] },
    nearMisses: ['sword', 'razor', 'saw'],
    coachHints: {
      'sword': "Swords are sharp! What's in the kitchen?",
      'razor': "Razors cut! What kitchen tool?",
      'saw': "Saws cut! What kitchen tool?"
    }
  },
  {
    id: 'tc-kitchen-2',
    clues: ['stirs', 'metal'],
    category: 'kitchen',
    difficulty: 1,
    anchors: ['spoon'],
    anchorAliases: { 'spoon': ['spoons'] },
    cluster: ['ladle', 'spatula', 'whisk', 'utensil', 'mixing', 'soup'],
    nearMisses: ['fork', 'pot'],
    coachHints: {
      'fork': "Forks are metal! What stirs?",
      'pot': "We stir in pots! What do we stir with?"
    }
  },
  {
    id: 'tc-kitchen-3',
    clues: ['hot', 'cooks'],
    category: 'kitchen',
    difficulty: 1,
    anchors: ['stove', 'oven'],
    anchorAliases: { 'stove': ['stoves'], 'oven': ['ovens'] },
    cluster: ['burner', 'range', 'heat', 'flame', 'bake', 'roast', 'grill'],
    nearMisses: ['fire', 'microwave', 'toaster'],
    coachHints: {
      'fire': "Fire is hot! What kitchen appliance?",
      'microwave': "Microwaves cook! What gets really hot?",
      'toaster': "Toasters get hot! What cooks more things?"
    }
  },
  {
    id: 'tc-kitchen-4',
    clues: ['cold', 'stores food'],
    category: 'kitchen',
    difficulty: 1,
    anchors: ['refrigerator', 'fridge'],
    anchorAliases: { 'refrigerator': ['refrigerators'], 'fridge': ['fridges'] },
    cluster: ['freezer', 'cooler', 'ice', 'cold', 'preserve', 'fresh'],
    nearMisses: ['pantry', 'cabinet', 'cupboard'],
    coachHints: {
      'pantry': "Pantries store food! What keeps it cold?",
      'cabinet': "Cabinets store things! What keeps food cold?",
      'cupboard': "Cupboards store food! What keeps it cold?"
    }
  },
  {
    id: 'tc-kitchen-5',
    clues: ['drinks', 'handle'],
    category: 'kitchen',
    difficulty: 1,
    anchors: ['cup', 'mug'],
    anchorAliases: { 'cup': ['cups'], 'mug': ['mugs'] },
    cluster: ['glass', 'coffee', 'tea', 'beverage', 'sip', 'drink'],
    nearMisses: ['bottle', 'jug', 'pitcher'],
    coachHints: {
      'bottle': "Bottles hold drinks! What has a handle?",
      'jug': "Jugs hold drinks! What's smaller with a handle?",
      'pitcher': "Pitchers have handles! What's for one person?"
    }
  },
  {
    id: 'tc-kitchen-6',
    clues: ['flat', 'food on it'],
    category: 'kitchen',
    difficulty: 1,
    anchors: ['plate'],
    anchorAliases: { 'plate': ['plates', 'platter'] },
    cluster: ['dish', 'saucer', 'serving', 'dinner', 'ceramic'],
    nearMisses: ['table', 'tray', 'bowl'],
    coachHints: {
      'table': "Food goes on tables! What's flat and portable?",
      'tray': "Trays carry food! What's for eating off of?",
      'bowl': "Bowls hold food! What's flat?"
    }
  }
];

// ============================================
// WEATHER PACK
// ============================================
const weatherPuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-weather-1',
    clues: ['falls', 'cold'],
    category: 'weather',
    difficulty: 1,
    anchors: ['snow'],
    anchorAliases: { 'snow': ['snows', 'snowing'] },
    cluster: ['ice', 'sleet', 'hail', 'winter', 'frost', 'freeze', 'flakes', 'blizzard', 'white'],
    clusterAliases: { 'flakes': ['flake', 'snowflake', 'snowflakes'] },
    nearMisses: ['rain', 'cold', 'icicle'],
    coachHints: {
      'rain': "Rain falls! What's cold and white?",
      'cold': "It is cold! What falls from the sky?",
      'icicle': "Icicles are cold! What falls from clouds?"
    }
  },
  {
    id: 'tc-weather-2',
    clues: ['wet', 'drops'],
    category: 'weather',
    difficulty: 1,
    anchors: ['rain'],
    anchorAliases: { 'rain': ['rains', 'raining', 'rainy'] },
    cluster: ['shower', 'storm', 'drizzle', 'puddle', 'umbrella', 'water', 'clouds'],
    clusterAliases: { 'drops': ['drop', 'droplet', 'droplets'] },
    nearMisses: ['snow', 'tears', 'shower'],
    coachHints: {
      'snow': "Snow is wet! What comes in drops?",
      'tears': "Tears are drops! What falls from clouds?",
      'shower': "Showers are wet! What weather word?"
    }
  },
  {
    id: 'tc-weather-3',
    clues: ['bright', 'hot'],
    category: 'weather',
    difficulty: 1,
    anchors: ['sun'],
    anchorAliases: { 'sun': ['sunny', 'sunshine'] },
    cluster: ['sunshine', 'summer', 'warm', 'light', 'rays', 'heat', 'sunny'],
    clusterAliases: { 'rays': ['ray', 'sunray', 'sunrays'] },
    nearMisses: ['fire', 'lamp', 'star'],
    coachHints: {
      'fire': "Fire is hot! What's in the sky?",
      'lamp': "Lamps are bright! What's in the sky?",
      'star': "Stars are bright! What's our closest one?"
    }
  },
  {
    id: 'tc-weather-4',
    clues: ['blows', 'invisible'],
    category: 'weather',
    difficulty: 2,
    anchors: ['wind'],
    anchorAliases: { 'wind': ['winds', 'windy'] },
    cluster: ['breeze', 'gust', 'air', 'blow', 'storm', 'hurricane', 'tornado'],
    nearMisses: ['breath', 'fan', 'ghost'],
    coachHints: {
      'breath': "Breath blows! What weather?",
      'fan': "Fans blow! What's natural?",
      'ghost': "Ghosts are invisible! What weather?"
    }
  }
];

// ============================================
// SPORTS PACK
// ============================================
const sportsPuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-sports-1',
    clues: ['throws', 'scores'],
    category: 'sports',
    difficulty: 1,
    anchors: ['ball', 'football', 'basketball'],
    anchorAliases: { 
      'ball': ['balls'],
      'football': ['footballs'],
      'basketball': ['basketballs']
    },
    cluster: ['baseball', 'catch', 'pass', 'touchdown', 'goal', 'throw', 'game', 'sports'],
    nearMisses: ['frisbee', 'javelin', 'dart'],
    coachHints: {
      'frisbee': "Frisbees are thrown! What scores points?",
      'javelin': "Javelins are thrown! What's in team sports?",
      'dart': "Darts score! What's thrown in big games?"
    }
  },
  {
    id: 'tc-sports-2',
    clues: ['kicks', 'goal'],
    category: 'sports',
    difficulty: 1,
    anchors: ['soccer', 'football'],
    anchorAliases: { 
      'soccer': ['soccer ball'],
      'football': ['footballs', 'futbol']
    },
    cluster: ['ball', 'field', 'score', 'net', 'team', 'kick', 'game'],
    nearMisses: ['shoe', 'leg'],
    coachHints: {
      'shoe': "Shoes kick! What's the sport?",
      'leg': "Legs kick! What sport uses goals?"
    }
  },
  {
    id: 'tc-sports-3',
    clues: ['swings', 'hole'],
    category: 'sports',
    difficulty: 2,
    anchors: ['golf'],
    anchorAliases: { 'golf': ['golfing', 'golfer'] },
    cluster: ['club', 'putt', 'course', 'green', 'ball', 'tee', 'drive', 'caddy'],
    nearMisses: ['baseball', 'swing', 'bat'],
    coachHints: {
      'baseball': "Baseball has swings! What has holes?",
      'swing': "You swing! At what sport?",
      'bat': "Bats swing! What sport has holes?"
    }
  },
  {
    id: 'tc-sports-4',
    clues: ['runs', 'bases'],
    category: 'sports',
    difficulty: 1,
    anchors: ['baseball'],
    anchorAliases: { 'baseball': ['baseballs'] },
    cluster: ['bat', 'pitch', 'home', 'hit', 'diamond', 'innings', 'batter'],
    nearMisses: ['track', 'marathon'],
    coachHints: {
      'track': "Runners on track! What has bases?",
      'marathon': "Marathons involve running! What has bases?"
    }
  }
];

// ============================================
// HOME PACK
// ============================================
const homePuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-home-1',
    clues: ['sits', 'comfort'],
    category: 'home',
    difficulty: 1,
    anchors: ['chair', 'couch', 'sofa'],
    anchorAliases: { 
      'chair': ['chairs'],
      'couch': ['couches'],
      'sofa': ['sofas']
    },
    cluster: ['seat', 'cushion', 'relax', 'furniture', 'armchair', 'recliner', 'loveseat'],
    nearMisses: ['bed', 'floor', 'bench'],
    coachHints: {
      'bed': "Beds are comfy! What do you sit on?",
      'floor': "You can sit on floors! What's more comfortable?",
      'bench': "Benches are seats! What's softer?"
    }
  },
  {
    id: 'tc-home-2',
    clues: ['sleeps', 'soft'],
    category: 'home',
    difficulty: 1,
    anchors: ['bed'],
    anchorAliases: { 'bed': ['beds', 'bedroom'] },
    cluster: ['mattress', 'pillow', 'blanket', 'sheets', 'sleep', 'rest', 'nap'],
    clusterAliases: { 'sheets': ['sheet'], 'blanket': ['blankets'] },
    nearMisses: ['couch', 'hammock', 'floor'],
    coachHints: {
      'couch': "Couches are soft! Where do you sleep at night?",
      'hammock': "Hammocks are for sleeping! What's in the bedroom?",
      'floor': "Floors are for sleeping sometimes! What's softer?"
    }
  },
  {
    id: 'tc-home-3',
    clues: ['opens', 'outside'],
    category: 'home',
    difficulty: 1,
    anchors: ['door'],
    anchorAliases: { 'door': ['doors', 'doorway'] },
    cluster: ['entrance', 'exit', 'gate', 'knob', 'handle', 'front', 'back'],
    nearMisses: ['window', 'wall', 'garage'],
    coachHints: {
      'window': "Windows open! What do you walk through?",
      'wall': "Walls have openings! What opens to outside?",
      'garage': "Garages open! What's for people?"
    }
  },
  {
    id: 'tc-home-4',
    clues: ['light', 'glass'],
    category: 'home',
    difficulty: 1,
    anchors: ['window'],
    anchorAliases: { 'window': ['windows'] },
    cluster: ['pane', 'view', 'curtain', 'sill', 'blinds', 'see-through'],
    nearMisses: ['lamp', 'mirror', 'door'],
    coachHints: {
      'lamp': "Lamps give light! What's made of glass?",
      'mirror': "Mirrors are glass! What lets light in?",
      'door': "Doors have glass sometimes! What's for looking out?"
    }
  },
  {
    id: 'tc-home-5',
    clues: ['tells time', 'ticks'],
    category: 'home',
    difficulty: 1,
    anchors: ['clock'],
    anchorAliases: { 'clock': ['clocks'] },
    cluster: ['watch', 'time', 'hands', 'alarm', 'hour', 'minute', 'second'],
    nearMisses: ['timer', 'calendar', 'phone'],
    coachHints: {
      'timer': "Timers tick! What tells the time always?",
      'calendar': "Calendars track time! What ticks?",
      'phone': "Phones tell time! What ticks on the wall?"
    }
  }
];

// ============================================
// PEOPLE PACK
// ============================================
const peoplePuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-people-1',
    clues: ['teaches', 'school'],
    category: 'people',
    difficulty: 1,
    anchors: ['teacher'],
    anchorAliases: { 'teacher': ['teachers', 'teach'] },
    cluster: ['professor', 'instructor', 'class', 'lesson', 'educate', 'tutor', 'educator'],
    nearMisses: ['student', 'principal', 'parent'],
    coachHints: {
      'student': "Students learn! Who teaches them?",
      'principal': "Principals work at school! Who teaches the class?",
      'parent': "Parents teach too! Who teaches at school?"
    }
  },
  {
    id: 'tc-people-2',
    clues: ['heals', 'hospital'],
    category: 'people',
    difficulty: 1,
    anchors: ['doctor', 'nurse'],
    anchorAliases: { 
      'doctor': ['doctors', 'doc', 'physician'],
      'nurse': ['nurses']
    },
    cluster: ['medicine', 'patient', 'health', 'care', 'medical', 'surgeon', 'clinic'],
    nearMisses: ['medicine', 'ambulance', 'bed'],
    coachHints: {
      'medicine': "Medicine heals! Who gives it?",
      'ambulance': "Ambulances go to hospitals! Who works there?",
      'bed': "Hospital beds! Who helps patients in them?"
    }
  },
  {
    id: 'tc-people-3',
    clues: ['cooks', 'restaurant'],
    category: 'people',
    difficulty: 1,
    anchors: ['chef'],
    anchorAliases: { 'chef': ['chefs', 'cook'] },
    cluster: ['cook', 'kitchen', 'food', 'meal', 'recipe', 'prepare'],
    nearMisses: ['waiter', 'customer', 'food'],
    coachHints: {
      'waiter': "Waiters serve! Who cooks?",
      'customer': "Customers eat! Who makes the food?",
      'food': "Food is cooked! By whom?"
    }
  },
  {
    id: 'tc-people-4',
    clues: ['drives', 'truck'],
    category: 'people',
    difficulty: 1,
    anchors: ['driver', 'trucker'],
    anchorAliases: { 
      'driver': ['drivers'],
      'trucker': ['truckers', 'truck driver']
    },
    cluster: ['road', 'delivery', 'haul', 'cab', 'transport', 'highway'],
    nearMisses: ['car', 'wheel', 'engine'],
    coachHints: {
      'car': "Cars are driven! Who drives a truck?",
      'wheel': "Wheels turn! Who turns them?",
      'engine': "Engines run! Who operates them?"
    }
  },
  {
    id: 'tc-people-5',
    clues: ['protects', 'uniform'],
    category: 'people',
    difficulty: 2,
    anchors: ['police', 'officer', 'firefighter'],
    anchorAliases: { 
      'police': ['policeman', 'policewoman', 'cop'],
      'officer': ['officers'],
      'firefighter': ['firefighters', 'fireman']
    },
    cluster: ['badge', 'safety', 'help', 'emergency', 'guard', 'soldier'],
    nearMisses: ['army', 'security', 'hero'],
    coachHints: {
      'army': "Army protects! Who wears a local uniform?",
      'security': "Security guards! What's the official job?",
      'hero': "Heroes protect! What's their job title?"
    }
  },
  {
    id: 'tc-people-6',
    clues: ['builds', 'hammer'],
    category: 'people',
    difficulty: 1,
    anchors: ['carpenter', 'builder'],
    anchorAliases: { 
      'carpenter': ['carpenters'],
      'builder': ['builders', 'construction worker']
    },
    cluster: ['construction', 'wood', 'nails', 'tools', 'craft', 'work'],
    nearMisses: ['house', 'wood', 'tool'],
    coachHints: {
      'house': "Houses are built! By whom?",
      'wood': "Wood is hammered! By whom?",
      'tool': "Tools are used! By whom?"
    }
  }
];

// ============================================
// EXPORT ALL PUZZLES
// ============================================
export const TWO_CLUES_PUZZLES: TwoCluesPuzzle[] = [
  ...animalsPuzzles,
  ...kitchenPuzzles,
  ...weatherPuzzles,
  ...sportsPuzzles,
  ...homePuzzles,
  ...peoplePuzzles,
];

export const PUZZLE_CATEGORIES = ['animals', 'kitchen', 'weather', 'sports', 'home', 'people'] as const;
export type PuzzleCategory = typeof PUZZLE_CATEGORIES[number];

/**
 * Get puzzles filtered by category and/or difficulty
 */
export function getPuzzles(options?: { 
  category?: PuzzleCategory; 
  difficulty?: 1 | 2 | 3;
  limit?: number;
}): TwoCluesPuzzle[] {
  let puzzles = [...TWO_CLUES_PUZZLES];
  
  if (options?.category) {
    puzzles = puzzles.filter(p => p.category === options.category);
  }
  
  if (options?.difficulty) {
    puzzles = puzzles.filter(p => p.difficulty === options.difficulty);
  }
  
  if (options?.limit) {
    puzzles = puzzles.slice(0, options.limit);
  }
  
  return puzzles;
}

/**
 * Shuffle puzzles for random order
 */
export function shufflePuzzles(puzzles: TwoCluesPuzzle[]): TwoCluesPuzzle[] {
  const shuffled = [...puzzles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
