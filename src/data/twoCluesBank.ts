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
    // "lightbulb"/"bulb"/"lamp" all genuinely satisfy BOTH "light" and "glass"
    // — they belong in cluster (75pts), not nearMisses.
    cluster: ['pane', 'view', 'curtain', 'sill', 'blinds', 'see-through', 'lightbulb', 'bulb', 'lamp'],
    clusterAliases: { 'lightbulb': ['light bulb', 'bulbs'], 'lamp': ['lamps'] },
    nearMisses: ['mirror', 'door'],
    coachHints: {
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
// CLOTHING PACK
// ============================================
const clothingPuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-clothing-1',
    clues: ['feet', 'laces'],
    category: 'clothing',
    difficulty: 1,
    anchors: ['shoe'],
    anchorAliases: { 'shoe': ['shoes', 'sneaker', 'sneakers'] },
    cluster: ['boot', 'sandal', 'trainer', 'footwear', 'heel', 'sole'],
    nearMisses: ['sock', 'foot', 'leg'],
    coachHints: { 'sock': "Socks go on feet! What has laces?", 'foot': "Feet wear them! What has laces?" }
  },
  {
    id: 'tc-clothing-2',
    clues: ['head', 'shade'],
    category: 'clothing',
    difficulty: 1,
    anchors: ['hat'],
    anchorAliases: { 'hat': ['hats', 'cap'] },
    cluster: ['cap', 'beanie', 'visor', 'helmet', 'brim', 'headwear'],
    nearMisses: ['umbrella', 'sunglasses', 'hood'],
    coachHints: { 'umbrella': "Umbrellas shade! What goes on your head?", 'sunglasses': "Sunglasses shade! What goes on your head?" }
  },
  {
    id: 'tc-clothing-3',
    clues: ['warm', 'zipper'],
    category: 'clothing',
    difficulty: 1,
    anchors: ['jacket', 'coat'],
    anchorAliases: { 'jacket': ['jackets'], 'coat': ['coats'] },
    cluster: ['hoodie', 'parka', 'sweater', 'vest', 'fleece', 'windbreaker'],
    nearMisses: ['blanket', 'scarf', 'bag'],
    coachHints: { 'blanket': "Blankets are warm! What do you wear with a zipper?", 'scarf': "Scarves are warm! What has a zipper?" }
  },
  {
    id: 'tc-clothing-4',
    clues: ['legs', 'pockets'],
    category: 'clothing',
    difficulty: 1,
    anchors: ['pants', 'trousers', 'jeans'],
    anchorAliases: { 'pants': ['pant'], 'jeans': ['jean'] },
    cluster: ['shorts', 'slacks', 'leggings', 'denim', 'khakis'],
    nearMisses: ['skirt', 'dress', 'belt'],
    coachHints: { 'skirt': "Skirts cover legs! What has pockets?", 'belt': "Belts go with them! What covers your legs?" }
  },
];

// ============================================
// NATURE PACK
// ============================================
const naturePuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-nature-1',
    clues: ['grows', 'leaves'],
    category: 'nature',
    difficulty: 1,
    anchors: ['tree'],
    anchorAliases: { 'tree': ['trees'] },
    cluster: ['plant', 'oak', 'maple', 'branch', 'trunk', 'roots', 'forest'],
    nearMisses: ['flower', 'bush', 'grass'],
    coachHints: { 'flower': "Flowers grow! What has leaves and a trunk?", 'bush': "Bushes grow! What's bigger with a trunk?" }
  },
  {
    id: 'tc-nature-2',
    clues: ['petals', 'smell'],
    category: 'nature',
    difficulty: 1,
    anchors: ['flower'],
    anchorAliases: { 'flower': ['flowers'] },
    cluster: ['rose', 'daisy', 'tulip', 'bloom', 'blossom', 'garden', 'bouquet'],
    nearMisses: ['perfume', 'plant', 'tree'],
    coachHints: { 'perfume': "Perfume smells! What has petals?", 'plant': "Plants grow! What has petals?" }
  },
  {
    id: 'tc-nature-3',
    clues: ['flows', 'water'],
    category: 'nature',
    difficulty: 1,
    anchors: ['river'],
    anchorAliases: { 'river': ['rivers', 'creek', 'stream'] },
    cluster: ['stream', 'creek', 'brook', 'current', 'lake', 'waterfall'],
    nearMisses: ['ocean', 'faucet', 'hose'],
    coachHints: { 'ocean': "Oceans have water! What flows through land?", 'faucet': "Faucets flow! What's in nature?" }
  },
  {
    id: 'tc-nature-4',
    clues: ['tall', 'rocky'],
    category: 'nature',
    difficulty: 2,
    anchors: ['mountain'],
    anchorAliases: { 'mountain': ['mountains', 'mount'] },
    cluster: ['hill', 'cliff', 'peak', 'summit', 'ridge', 'volcano'],
    nearMisses: ['building', 'tower', 'wall'],
    coachHints: { 'building': "Buildings are tall! What's rocky in nature?", 'tower': "Towers are tall! What's natural and rocky?" }
  },
  {
    id: 'tc-nature-5',
    clues: ['shines', 'night'],
    category: 'nature',
    difficulty: 1,
    anchors: ['moon', 'star'],
    anchorAliases: { 'moon': ['moons'], 'star': ['stars'] },
    cluster: ['moonlight', 'starlight', 'sky', 'glow', 'crescent', 'constellation'],
    nearMisses: ['lamp', 'flashlight', 'sun'],
    coachHints: { 'lamp': "Lamps shine! What shines at night in the sky?", 'sun': "Sun shines during the day! What shines at night?" }
  },
];

// ============================================
// FOOD PACK
// ============================================
const foodPuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-food-1',
    clues: ['yellow', 'peel'],
    category: 'food',
    difficulty: 1,
    anchors: ['banana'],
    anchorAliases: { 'banana': ['bananas', 'nana'] },
    cluster: ['fruit', 'monkey', 'potassium', 'bunch', 'ripe'],
    nearMisses: ['lemon', 'orange', 'mango'],
    coachHints: { 'lemon': "Lemons are yellow! What do you peel?", 'orange': "Oranges peel! What's yellow?" }
  },
  {
    id: 'tc-food-2',
    clues: ['red', 'round'],
    category: 'food',
    difficulty: 1,
    anchors: ['apple', 'tomato'],
    anchorAliases: { 'apple': ['apples'], 'tomato': ['tomatoes'] },
    // "ball", "balloon", "cherry", "strawberry" are all genuinely red AND round.
    // They satisfy both clues → cluster (75pts), not nearMisses.
    cluster: ['cherry', 'berry', 'fruit', 'pie', 'sauce', 'ketchup', 'ball', 'balloon', 'strawberry', 'cranberry', 'pomegranate'],
    clusterAliases: { 'ball': ['balls'], 'balloon': ['balloons'], 'strawberry': ['strawberries'] },
    nearMisses: ['watermelon', 'beet'],
    coachHints: { 'watermelon': "Watermelons can be round! What red food is small and round?" }
  },
  {
    id: 'tc-food-3',
    clues: ['sliced', 'sandwich'],
    category: 'food',
    difficulty: 1,
    anchors: ['bread'],
    anchorAliases: { 'bread': ['breads', 'loaf'] },
    cluster: ['toast', 'loaf', 'wheat', 'flour', 'crust', 'slice', 'bun'],
    nearMisses: ['cheese', 'meat', 'butter'],
    coachHints: { 'cheese': "Cheese goes in sandwiches! What's sliced around it?", 'meat': "Meat is sliced! What holds a sandwich together?" }
  },
  {
    id: 'tc-food-4',
    clues: ['melts', 'pizza'],
    category: 'food',
    difficulty: 1,
    anchors: ['cheese'],
    anchorAliases: { 'cheese': ['cheeses'] },
    cluster: ['mozzarella', 'cheddar', 'dairy', 'slice', 'grated', 'parmesan'],
    nearMisses: ['butter', 'ice cream', 'chocolate'],
    coachHints: { 'butter': "Butter melts! What goes on pizza?", 'ice cream': "Ice cream melts! What goes on pizza?" }
  },
  {
    id: 'tc-food-5',
    clues: ['morning', 'crack'],
    category: 'food',
    difficulty: 2,
    anchors: ['egg'],
    anchorAliases: { 'egg': ['eggs'] },
    cluster: ['scramble', 'omelette', 'yolk', 'shell', 'breakfast', 'fry', 'boil'],
    nearMisses: ['cereal', 'pancake', 'dawn'],
    coachHints: { 'cereal': "Cereal is for morning! What do you crack?", 'dawn': "Dawn is morning! What food do you crack?" }
  },
];

// ============================================
// TRANSPORT PACK
// ============================================
const transportPuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-transport-1',
    clues: ['wheels', 'pedals'],
    category: 'transport',
    difficulty: 1,
    anchors: ['bicycle', 'bike'],
    anchorAliases: { 'bicycle': ['bicycles'], 'bike': ['bikes', 'cycling'] },
    cluster: ['cycle', 'ride', 'chain', 'handlebars', 'helmet'],
    nearMisses: ['car', 'motorcycle', 'tricycle'],
    coachHints: { 'car': "Cars have wheels! What has pedals?", 'motorcycle': "Motorcycles have wheels! What do you pedal?" }
  },
  {
    id: 'tc-transport-2',
    clues: ['flies', 'wings'],
    category: 'transport',
    difficulty: 1,
    anchors: ['airplane', 'plane'],
    anchorAliases: { 'airplane': ['airplanes', 'aeroplane'], 'plane': ['planes'] },
    cluster: ['jet', 'flight', 'pilot', 'airport', 'runway', 'aircraft'],
    nearMisses: ['bird', 'helicopter', 'kite'],
    coachHints: { 'bird': "Birds fly with wings! What vehicle?", 'helicopter': "Helicopters fly! What has wings?" }
  },
  {
    id: 'tc-transport-3',
    clues: ['sails', 'water'],
    category: 'transport',
    difficulty: 1,
    anchors: ['boat', 'ship'],
    anchorAliases: { 'boat': ['boats'], 'ship': ['ships'] },
    cluster: ['yacht', 'canoe', 'ferry', 'vessel', 'anchor', 'captain', 'deck'],
    nearMisses: ['submarine', 'raft', 'surfboard'],
    coachHints: { 'submarine': "Submarines go in water! What sails?", 'surfboard': "Surfboards ride water! What sails?" }
  },
  {
    id: 'tc-transport-4',
    clues: ['tracks', 'station'],
    category: 'transport',
    difficulty: 1,
    anchors: ['train'],
    anchorAliases: { 'train': ['trains'] },
    cluster: ['railway', 'locomotive', 'conductor', 'platform', 'carriage', 'subway'],
    nearMisses: ['bus', 'tram', 'taxi'],
    coachHints: { 'bus': "Buses stop at stations! What runs on tracks?", 'tram': "Trams run on tracks! What's bigger?" }
  },
];

// ============================================
// BODY PACK
// ============================================
const bodyPuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-body-1',
    clues: ['sees', 'blinks'],
    category: 'body',
    difficulty: 1,
    anchors: ['eye'],
    anchorAliases: { 'eye': ['eyes'] },
    cluster: ['vision', 'pupil', 'iris', 'sight', 'eyelid', 'retina'],
    nearMisses: ['glasses', 'camera', 'face'],
    coachHints: { 'glasses': "Glasses help you see! What body part sees?", 'camera': "Cameras capture! What body part blinks?" }
  },
  {
    id: 'tc-body-2',
    clues: ['beats', 'pumps'],
    category: 'body',
    difficulty: 1,
    anchors: ['heart'],
    anchorAliases: { 'heart': ['hearts'] },
    cluster: ['pulse', 'blood', 'chest', 'organ', 'cardiac', 'rhythm'],
    nearMisses: ['drum', 'engine', 'muscle'],
    coachHints: { 'drum': "Drums beat! What body part pumps?", 'engine': "Engines pump! What's in your chest?" }
  },
  {
    id: 'tc-body-3',
    clues: ['thinks', 'remembers'],
    category: 'body',
    difficulty: 2,
    anchors: ['brain'],
    anchorAliases: { 'brain': ['brains'] },
    cluster: ['mind', 'head', 'memory', 'thought', 'intelligence', 'skull'],
    nearMisses: ['computer', 'book', 'diary'],
    coachHints: { 'computer': "Computers think! What body part thinks?", 'book': "Books hold knowledge! What remembers?" }
  },
  {
    id: 'tc-body-4',
    clues: ['grabs', 'fingers'],
    category: 'body',
    difficulty: 1,
    anchors: ['hand'],
    anchorAliases: { 'hand': ['hands'] },
    cluster: ['palm', 'fist', 'grip', 'thumb', 'wrist', 'knuckle'],
    nearMisses: ['glove', 'claw', 'arm'],
    coachHints: { 'glove': "Gloves cover them! What has fingers?", 'claw': "Claws grab! What human body part?" }
  },
];

// ============================================
// MUSIC PACK
// ============================================
const musicPuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-music-1',
    clues: ['strings', 'strums'],
    category: 'music',
    difficulty: 1,
    anchors: ['guitar'],
    anchorAliases: { 'guitar': ['guitars'] },
    cluster: ['ukulele', 'banjo', 'chord', 'pick', 'acoustic', 'electric'],
    nearMisses: ['violin', 'harp', 'bass'],
    coachHints: { 'violin': "Violins have strings! What do you strum?", 'harp': "Harps have strings! What do you strum?" }
  },
  {
    id: 'tc-music-2',
    clues: ['keys', 'plays'],
    category: 'music',
    difficulty: 1,
    anchors: ['piano'],
    anchorAliases: { 'piano': ['pianos', 'keyboard'] },
    cluster: ['keyboard', 'organ', 'notes', 'music', 'melody', 'ivories'],
    nearMisses: ['lock', 'computer', 'typewriter'],
    coachHints: { 'lock': "Locks have keys! What instrument plays?", 'computer': "Computers have keys! What makes music?" }
  },
  {
    id: 'tc-music-3',
    clues: ['hits', 'loud'],
    category: 'music',
    difficulty: 1,
    anchors: ['drum'],
    anchorAliases: { 'drum': ['drums', 'drumming'] },
    cluster: ['cymbal', 'beat', 'stick', 'rhythm', 'percussion', 'snare', 'bongo'],
    nearMisses: ['thunder', 'hammer', 'gong'],
    coachHints: { 'thunder': "Thunder is loud! What instrument do you hit?", 'hammer': "Hammers hit! What musical instrument?" }
  },
];

// ============================================
// HARD PACK (tier 3 — abstract / multi-step)
// ============================================
const hardPuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-hard-1', clues: ['measures', 'pressure'], category: 'tools', difficulty: 3,
    anchors: ['barometer'], anchorAliases: { 'barometer': ['barometers'] },
    cluster: ['gauge', 'meter', 'forecast', 'weather', 'altimeter'],
    nearMisses: ['thermometer', 'scale', 'clock'],
    coachHints: { 'thermometer': "Thermometers measure heat. What measures pressure?", 'scale': "Scales measure weight. What measures pressure?" }
  },
  {
    id: 'tc-hard-2', clues: ['holds', 'argument'], category: 'abstract', difficulty: 3,
    anchors: ['debate', 'court', 'lawyer'], anchorAliases: { 'debate': ['debates'], 'lawyer': ['lawyers', 'attorney'] },
    cluster: ['judge', 'trial', 'discussion', 'case', 'jury'],
    nearMisses: ['fight', 'meeting', 'class'],
    coachHints: { 'fight': "Fights are physical. What formal setting holds arguments?", 'meeting': "Meetings discuss. What's specifically for arguments?" }
  },
  {
    id: 'tc-hard-3', clues: ['echoes', 'cave'], category: 'nature', difficulty: 3,
    anchors: ['sound', 'voice', 'echo'], anchorAliases: { 'echo': ['echoes'] },
    cluster: ['noise', 'shout', 'reverberation', 'acoustic', 'reflection'],
    nearMisses: ['bat', 'darkness', 'silence'],
    coachHints: { 'bat': "Bats live in caves! What bounces back?", 'silence': "Silence is the opposite. What echoes?" }
  },
  {
    id: 'tc-hard-4', clues: ['carries', 'current'], category: 'science', difficulty: 3,
    anchors: ['wire', 'cable', 'river'], anchorAliases: { 'wire': ['wires'], 'cable': ['cables'] },
    cluster: ['conductor', 'electricity', 'flow', 'channel', 'circuit'],
    nearMisses: ['battery', 'plug', 'switch'],
    coachHints: { 'battery': "Batteries store current. What carries it?", 'plug': "Plugs deliver. What runs between them?" }
  },
  {
    id: 'tc-hard-5', clues: ['silent', 'witness'], category: 'abstract', difficulty: 3,
    anchors: ['camera', 'photograph'], anchorAliases: { 'camera': ['cameras'], 'photograph': ['photo', 'photos'] },
    cluster: ['recording', 'evidence', 'video', 'observer', 'lens'],
    nearMisses: ['ghost', 'mute', 'spy'],
    coachHints: { 'ghost': "Ghosts are silent. What records what it sees?", 'spy': "Spies watch. What captures it silently?" }
  },
  {
    id: 'tc-hard-6', clues: ['weighs', 'evidence'], category: 'abstract', difficulty: 3,
    anchors: ['judge', 'jury'], anchorAliases: { 'judge': ['judges'], 'jury': ['juries'] },
    cluster: ['court', 'verdict', 'decide', 'law', 'trial', 'gavel'],
    nearMisses: ['scale', 'detective', 'lawyer'],
    coachHints: { 'scale': "Scales weigh objects. Who weighs evidence?", 'detective': "Detectives gather it. Who decides on it?" }
  },
  {
    id: 'tc-hard-7', clues: ['ferments', 'grapes'], category: 'food', difficulty: 3,
    anchors: ['wine'], anchorAliases: { 'wine': ['wines'] },
    cluster: ['vineyard', 'cellar', 'red', 'white', 'bottle', 'cork'],
    nearMisses: ['juice', 'beer', 'vinegar'],
    coachHints: { 'juice': "Juice is unfermented! What's the alcoholic version?", 'vinegar': "Vinegar is over-fermented. What comes from grapes?" }
  },
  {
    id: 'tc-hard-8', clues: ['orbits', 'gravity'], category: 'science', difficulty: 3,
    anchors: ['planet', 'moon', 'satellite'], anchorAliases: { 'planet': ['planets'], 'satellite': ['satellites'] },
    cluster: ['earth', 'space', 'astronaut', 'star', 'sun', 'cosmos'],
    nearMisses: ['rocket', 'sky', 'cloud'],
    coachHints: { 'rocket': "Rockets launch into orbit. What stays in orbit?", 'sky': "The sky is above. What orbits in space?" }
  },
  {
    id: 'tc-hard-9', clues: ['hidden', 'meaning'], category: 'abstract', difficulty: 3,
    anchors: ['symbol', 'metaphor', 'code'], anchorAliases: { 'symbol': ['symbols'], 'code': ['codes'] },
    cluster: ['sign', 'puzzle', 'riddle', 'cipher', 'message'],
    nearMisses: ['secret', 'word', 'book'],
    coachHints: { 'secret': "Secrets hide things. What CARRIES hidden meaning?", 'word': "Words have meaning. What hides one inside?" }
  },
  {
    id: 'tc-hard-10', clues: ['heals', 'time'], category: 'abstract', difficulty: 3,
    anchors: ['wound', 'scar', 'grief'], anchorAliases: { 'wound': ['wounds'], 'scar': ['scars'] },
    cluster: ['cut', 'injury', 'pain', 'memory', 'broken heart'],
    nearMisses: ['doctor', 'medicine', 'bandage'],
    coachHints: { 'doctor': "Doctors heal. What gets healed by time?", 'medicine': "Medicine helps. What does TIME heal?" }
  },
  {
    id: 'tc-hard-11', clues: ['conducts', 'orchestra'], category: 'music', difficulty: 3,
    anchors: ['conductor', 'maestro'], anchorAliases: { 'conductor': ['conductors'] },
    cluster: ['baton', 'symphony', 'leader', 'director', 'tempo'],
    nearMisses: ['violinist', 'pianist', 'singer'],
    coachHints: { 'violinist': "Violinists play. Who LEADS the orchestra?", 'singer': "Singers sing. Who waves the baton?" }
  },
  {
    id: 'tc-hard-12', clues: ['ancient', 'ruin'], category: 'history', difficulty: 3,
    anchors: ['castle', 'temple', 'pyramid'], anchorAliases: { 'castle': ['castles'], 'pyramid': ['pyramids'] },
    cluster: ['stone', 'history', 'archaeology', 'fortress', 'monument'],
    nearMisses: ['museum', 'old house', 'rubble'],
    coachHints: { 'museum': "Museums hold ruins. What IS the ruin?", 'rubble': "Rubble is broken stone. What ancient structure?" }
  },
  {
    id: 'tc-hard-13', clues: ['filters', 'blood'], category: 'body', difficulty: 3,
    anchors: ['kidney', 'liver'], anchorAliases: { 'kidney': ['kidneys'], 'liver': ['livers'] },
    cluster: ['organ', 'dialysis', 'urine', 'toxins', 'cleanse'],
    nearMisses: ['heart', 'lung', 'brain'],
    coachHints: { 'heart': "Hearts pump blood. What FILTERS it?", 'lung': "Lungs filter air. What filters blood?" }
  },
  {
    id: 'tc-hard-14', clues: ['breaks', 'silence'], category: 'abstract', difficulty: 3,
    anchors: ['sound', 'noise', 'voice', 'scream'], anchorAliases: { 'noise': ['noises'], 'scream': ['screams'] },
    cluster: ['shout', 'music', 'word', 'whisper', 'shot'],
    nearMisses: ['glass', 'rock', 'hammer'],
    coachHints: { 'glass': "Glass breaks physically. What breaks SILENCE?", 'hammer': "Hammers break objects. What breaks quiet?" }
  },
  {
    id: 'tc-hard-15', clues: ['negotiates', 'peace'], category: 'people', difficulty: 3,
    anchors: ['diplomat', 'ambassador', 'mediator'], anchorAliases: { 'diplomat': ['diplomats'], 'ambassador': ['ambassadors'] },
    cluster: ['treaty', 'embassy', 'envoy', 'politician', 'negotiator'],
    nearMisses: ['soldier', 'general', 'president'],
    coachHints: { 'soldier': "Soldiers fight. Who negotiates peace?", 'general': "Generals lead war. Who LEADS peace talks?" }
  },
  {
    id: 'tc-hard-16', clues: ['fades', 'memory'], category: 'abstract', difficulty: 3,
    anchors: ['photograph', 'memory', 'dream'], anchorAliases: { 'photograph': ['photographs', 'photo'], 'memory': ['memories'], 'dream': ['dreams'] },
    cluster: ['recall', 'past', 'image', 'old', 'forget'],
    nearMisses: ['paint', 'color', 'flower'],
    coachHints: { 'paint': "Paint fades on walls. What fades in your MIND?", 'color': "Colors fade. What mental thing fades?" }
  },
  {
    id: 'tc-hard-17', clues: ['governs', 'country'], category: 'people', difficulty: 3,
    anchors: ['president', 'prime minister', 'government'], anchorAliases: { 'president': ['presidents'] },
    cluster: ['leader', 'parliament', 'congress', 'ruler', 'nation'],
    nearMisses: ['mayor', 'king', 'boss'],
    coachHints: { 'mayor': "Mayors govern cities. Who governs the COUNTRY?", 'king': "Kings ruled. Who governs democratically?" }
  },
  {
    id: 'tc-hard-18', clues: ['absorbs', 'shock'], category: 'science', difficulty: 3,
    anchors: ['cushion', 'spring', 'shock absorber', 'airbag'], anchorAliases: { 'cushion': ['cushions'], 'spring': ['springs'] },
    cluster: ['suspension', 'foam', 'pad', 'buffer', 'bumper'],
    nearMisses: ['pillow', 'tire', 'helmet'],
    coachHints: { 'pillow': "Pillows are soft. What absorbs IMPACT?", 'tire': "Tires roll. What absorbs the bumps?" }
  },
];

// ============================================
// MID PACK (Wave-1 expansion — bring T2 from 6 → 20)
// ============================================
const midPuzzles: TwoCluesPuzzle[] = [
  { id: 'tc-mid-1', clues: ['carries', 'mail'], category: 'people', difficulty: 2,
    anchors: ['mailman', 'postman', 'mail carrier'],
    anchorAliases: { 'mailman': ['mailmen'], 'postman': ['postmen'] },
    cluster: ['letter', 'package', 'delivery', 'post', 'envelope', 'route'],
    nearMisses: ['driver', 'courier', 'truck'],
    coachHints: { 'driver': "Drivers carry many things. Who carries MAIL?", 'truck': "Trucks carry things. Who DELIVERS the mail?" } },
  { id: 'tc-mid-2', clues: ['cuts', 'hair'], category: 'people', difficulty: 2,
    anchors: ['barber', 'hairdresser', 'stylist'],
    anchorAliases: { 'barber': ['barbers'], 'hairdresser': ['hairdressers'] },
    cluster: ['salon', 'scissors', 'clippers', 'shop', 'comb', 'razor'],
    nearMisses: ['surgeon', 'butcher', 'gardener'],
    coachHints: { 'surgeon': "Surgeons cut tissue. Who cuts HAIR?", 'gardener': "Gardeners cut plants. Who cuts hair?" } },
  { id: 'tc-mid-3', clues: ['locks', 'opens'], category: 'home', difficulty: 2,
    anchors: ['key', 'door'], anchorAliases: { 'key': ['keys'], 'door': ['doors'] },
    cluster: ['padlock', 'gate', 'handle', 'knob', 'bolt', 'latch'],
    nearMisses: ['safe', 'window', 'cabinet'],
    coachHints: { 'safe': "Safes get locked. What unlocks them?", 'window': "Windows open too. What uses a key?" } },
  { id: 'tc-mid-4', clues: ['stings', 'honey'], category: 'animals', difficulty: 2,
    anchors: ['bee', 'wasp'], anchorAliases: { 'bee': ['bees'], 'wasp': ['wasps'] },
    cluster: ['hive', 'sting', 'buzz', 'wings', 'pollen', 'flower'],
    nearMisses: ['ant', 'spider', 'mosquito'],
    coachHints: { 'ant': "Ants don't make honey. What MAKES honey?", 'mosquito': "Mosquitoes bite. What stings AND makes honey?" } },
  { id: 'tc-mid-5', clues: ['shines', 'night'], category: 'nature', difficulty: 2,
    anchors: ['moon', 'star'], anchorAliases: { 'moon': ['moons'], 'star': ['stars'] },
    cluster: ['glow', 'crescent', 'orbit', 'sky', 'lunar', 'satellite'],
    nearMisses: ['lamp', 'lantern', 'firefly'],
    coachHints: { 'lamp': "Lamps shine indoors. What shines in the NIGHT sky?", 'firefly': "Fireflies glow. What's big in the night sky?" } },
  { id: 'tc-mid-6', clues: ['paints', 'canvas'], category: 'people', difficulty: 2,
    anchors: ['artist', 'painter'], anchorAliases: { 'artist': ['artists'], 'painter': ['painters'] },
    cluster: ['easel', 'brush', 'palette', 'studio', 'gallery', 'portrait'],
    nearMisses: ['decorator', 'sculptor', 'photographer'],
    coachHints: { 'decorator': "Decorators paint walls. Who paints CANVAS?", 'sculptor': "Sculptors carve. Who PAINTS?" } },
  { id: 'tc-mid-7', clues: ['drips', 'faucet'], category: 'home', difficulty: 2,
    anchors: ['water', 'sink', 'tap'], anchorAliases: { 'water': ['waters'], 'sink': ['sinks'] },
    cluster: ['drop', 'leak', 'plumbing', 'pipe', 'kitchen', 'bathroom'],
    nearMisses: ['ice', 'rain', 'oil'],
    coachHints: { 'ice': "Ice melts but doesn't drip from faucets. What comes OUT?", 'rain': "Rain falls outside. What drips inside?" } },
  { id: 'tc-mid-8', clues: ['stretches', 'snaps'], category: 'home', difficulty: 2,
    anchors: ['rubber band', 'elastic'], anchorAliases: { 'rubber band': ['rubber bands'], 'elastic': ['elastics'] },
    cluster: ['band', 'rubber', 'sling', 'stretchy', 'cord'],
    nearMisses: ['rope', 'string', 'wire'],
    coachHints: { 'rope': "Ropes don't snap back. What stretches AND snaps?", 'string': "Strings break. What stretches like elastic?" } },
  { id: 'tc-mid-9', clues: ['climbs', 'reaches'], category: 'home', difficulty: 2,
    anchors: ['ladder', 'stairs'], anchorAliases: { 'ladder': ['ladders'], 'stairs': ['staircase', 'steps'] },
    cluster: ['rung', 'step', 'height', 'roof', 'wall'],
    nearMisses: ['rope', 'mountain', 'elevator'],
    coachHints: { 'rope': "Ropes can be climbed. What has RUNGS?", 'elevator': "Elevators reach high too. What do you CLIMB?" } },
  { id: 'tc-mid-10', clues: ['wraps', 'gift'], category: 'home', difficulty: 2,
    anchors: ['paper', 'ribbon', 'wrapping paper'],
    anchorAliases: { 'paper': ['papers'], 'ribbon': ['ribbons'] },
    cluster: ['bow', 'box', 'tape', 'wrap', 'present'],
    nearMisses: ['plastic', 'foil', 'bag'],
    coachHints: { 'plastic': "Plastic wraps food. What wraps GIFTS?", 'foil': "Foil wraps leftovers. What wraps presents?" } },
  { id: 'tc-mid-11', clues: ['stings', 'salt'], category: 'body', difficulty: 2,
    anchors: ['wound', 'cut'], anchorAliases: { 'wound': ['wounds'], 'cut': ['cuts'] },
    cluster: ['injury', 'scrape', 'gash', 'sore', 'skin'],
    nearMisses: ['eye', 'mouth', 'tongue'],
    coachHints: { 'eye': "Eyes sting from salt too. What OPEN injury stings?", 'tongue': "Tongues taste salt. What HURTS from salt?" } },
  { id: 'tc-mid-12', clues: ['holds', 'water'], category: 'home', difficulty: 2,
    anchors: ['bucket', 'cup', 'glass'], anchorAliases: { 'bucket': ['buckets'], 'glass': ['glasses'] },
    cluster: ['container', 'pail', 'jug', 'pot', 'tank', 'bottle'],
    nearMisses: ['sponge', 'cloth', 'bag'],
    coachHints: { 'sponge': "Sponges soak water. What HOLDS it without leaking?", 'bag': "Bags leak. What rigid thing holds water?" } },
  { id: 'tc-mid-13', clues: ['marks', 'paper'], category: 'home', difficulty: 2,
    anchors: ['pen', 'pencil', 'marker'],
    anchorAliases: { 'pen': ['pens'], 'pencil': ['pencils'], 'marker': ['markers'] },
    cluster: ['ink', 'lead', 'write', 'draw', 'sketch'],
    nearMisses: ['eraser', 'paint', 'crayon'],
    coachHints: { 'eraser': "Erasers REMOVE marks. What MAKES them?", 'paint': "Paint goes on canvas. What writes on paper?" } },
  { id: 'tc-mid-14', clues: ['burns', 'wax'], category: 'home', difficulty: 2,
    anchors: ['candle'], anchorAliases: { 'candle': ['candles'] },
    cluster: ['wick', 'flame', 'light', 'holder', 'birthday'],
    nearMisses: ['lamp', 'torch', 'lighter'],
    coachHints: { 'lamp': "Lamps don't use wax. What WAX item burns?", 'lighter': "Lighters use fuel. What burns wax with a wick?" } },
  // === T3 top-up (Phase 6) — abstract/figurative pairings ===
  { id: 'tc-hard-t3-1', clues: ['keeps', 'secret'], category: 'people', difficulty: 3,
    anchors: ['diary', 'journal'], anchorAliases: { 'diary': ['diaries'], 'journal': ['journals'] },
    cluster: ['notebook', 'private', 'lock', 'entry', 'confide', 'log'],
    nearMisses: ['vault', 'whisper', 'friend'],
    coachHints: { 'vault': "Vaults keep secrets too. What PERSONAL book do you write in?", 'friend': "Friends keep secrets. What BOOK holds them?" } },
  { id: 'tc-hard-t3-2', clues: ['guides', 'darkness'], category: 'home', difficulty: 3,
    anchors: ['lighthouse', 'flashlight'], anchorAliases: { 'lighthouse': ['lighthouses'], 'flashlight': ['flashlights', 'torch'] },
    cluster: ['beacon', 'lantern', 'beam', 'signal', 'guide', 'navigate'],
    nearMisses: ['star', 'compass', 'map'],
    coachHints: { 'star': "Stars guide too. What man-made LIGHT guides in darkness?", 'compass': "Compasses guide direction. What gives LIGHT in the dark?" } },
];

// ============================================
// EXPORT ALL PUZZLES
// ============================================
// ============================================
// EXPANSION PACK (launch content wave)
// T2/T3 pools were 20 each — repeats within two sessions. Same answer-graph
// conventions as the packs above. Flagged for SLP review like all content.
// ============================================
const expansionPuzzles: TwoCluesPuzzle[] = [
  {
    id: 'tc-exp-1', clues: ['sticky', 'bees'], category: 'food', difficulty: 2,
    anchors: ['honey'], anchorAliases: { 'honey': ['hunny'] },
    cluster: ['hive', 'beehive', 'nectar', 'honeycomb', 'sweet', 'syrup'],
    nearMisses: ['sugar', 'glue', 'jam'],
    coachHints: {
      'sugar': "Sugar is sweet! What do bees make?",
      'glue': "Glue is sticky! What sticky thing comes from bees?",
      'jam': "Jam is sweet and sticky! What do bees make?"
    }
  },
  {
    id: 'tc-exp-2', clues: ['locks', 'pocket'], category: 'home', difficulty: 2,
    anchors: ['key'], anchorAliases: { 'key': ['keys'] },
    cluster: ['keychain', 'keyring', 'lock', 'door key', 'house key'],
    nearMisses: ['wallet', 'phone', 'coin'],
    coachHints: {
      'wallet': "Wallets go in pockets! What opens locks?",
      'phone': "Phones fit in pockets! What works with locks?",
      'coin': "Coins live in pockets! What opens a lock?"
    }
  },
  {
    id: 'tc-exp-3', clues: ['melts', 'cone'], category: 'food', difficulty: 2,
    anchors: ['ice cream'], anchorAliases: { 'ice cream': ['icecream', 'ice creams'] },
    cluster: ['scoop', 'gelato', 'soft serve', 'sundae', 'vanilla', 'chocolate'],
    nearMisses: ['snow', 'ice', 'candle'],
    coachHints: {
      'snow': "Snow melts! What melts on a cone?",
      'ice': "Ice melts! What sweet treat comes on a cone?",
      'candle': "Candles melt! What food melts on a cone?"
    }
  },
  {
    id: 'tc-exp-4', clues: ['rings', 'tower'], category: 'home', difficulty: 2,
    anchors: ['bell'], anchorAliases: { 'bell': ['bells'] },
    cluster: ['church bell', 'chime', 'clock tower', 'steeple', 'gong'],
    nearMisses: ['phone', 'alarm', 'castle'],
    coachHints: {
      'phone': "Phones ring! What rings in a tower?",
      'alarm': "Alarms ring! What big thing rings in a tower?",
      'castle': "Castles have towers! What rings inside one?"
    }
  },
  {
    id: 'tc-exp-5', clues: ['bounces', 'hoop'], category: 'sports', difficulty: 2,
    anchors: ['basketball'], anchorAliases: { 'basketball': ['basket ball', 'basketballs'] },
    cluster: ['ball', 'dribble', 'court', 'net', 'rim', 'backboard'],
    nearMisses: ['tennis ball', 'trampoline', 'ring'],
    coachHints: {
      'tennis ball': "Tennis balls bounce! What goes through a hoop?",
      'trampoline': "You bounce on those! What ball uses a hoop?",
      'ring': "A hoop is like a ring! What ball goes through it?"
    }
  },
  {
    id: 'tc-exp-6', clues: ['glows', 'night'], category: 'nature', difficulty: 2,
    anchors: ['moon', 'firefly', 'star'], anchorAliases: { 'star': ['stars'], 'firefly': ['fireflies', 'lightning bug'] },
    cluster: ['moonlight', 'starlight', 'lantern', 'glow worm', 'candle'],
    nearMisses: ['sun', 'lamp', 'flashlight'],
    coachHints: {
      'sun': "The sun glows by day! What glows at night?",
      'lamp': "Lamps glow indoors! What glows in the night sky?",
      'flashlight': "Good practical answer! What glows in nature at night?"
    }
  },
  {
    id: 'tc-exp-7', clues: ['balances', 'justice'], category: 'abstract', difficulty: 3,
    anchors: ['scale', 'judge'], anchorAliases: { 'scale': ['scales'], 'judge': ['judges'] },
    cluster: ['court', 'law', 'fairness', 'verdict', 'weighing'],
    nearMisses: ['police', 'jail', 'lawyer'],
    coachHints: {
      'police': "Police enforce law. What symbol balances justice?",
      'jail': "Jail comes after. What weighs both sides?",
      'lawyer': "Close! Lawyers argue. What weighs the sides?"
    }
  },
  {
    id: 'tc-exp-8', clues: ['borrowed', 'returned'], category: 'abstract', difficulty: 3,
    anchors: ['book', 'library book', 'loan'], anchorAliases: { 'book': ['books'], 'loan': ['loans'] },
    cluster: ['library', 'rental', 'money', 'favor', 'tool'],
    nearMisses: ['gift', 'store', 'friend'],
    coachHints: {
      'gift': "Gifts are kept! What gets returned?",
      'store': "Stores sell things! Where do you borrow and return?",
      'friend': "Friends lend things! What do they lend?"
    }
  },
  {
    id: 'tc-exp-9', clues: ['rises', 'dough'], category: 'kitchen', difficulty: 3,
    anchors: ['bread', 'yeast'], anchorAliases: { 'bread': ['breads'], 'yeast': ['yeasts'] },
    cluster: ['baking', 'oven', 'flour', 'loaf', 'pizza dough', 'rolls'],
    nearMisses: ['sun', 'balloon', 'cake'],
    coachHints: {
      'sun': "The sun rises! What rises in the kitchen?",
      'balloon': "Balloons rise! What rises before baking?",
      'cake': "So close! Cakes rise too — what makes dough rise?"
    }
  },
  {
    id: 'tc-exp-10', clues: ['keeps', 'secrets'], category: 'abstract', difficulty: 3,
    anchors: ['diary', 'friend', 'safe'], anchorAliases: { 'diary': ['diaries', 'journal'], 'safe': ['safes'] },
    cluster: ['vault', 'confidant', 'lockbox', 'trust', 'whisper'],
    nearMisses: ['spy', 'password', 'box'],
    coachHints: {
      'spy': "Spies steal secrets! What keeps them safe?",
      'password': "Passwords protect! What holds written secrets?",
      'box': "Getting close! What special box or book keeps secrets?"
    }
  },
  {
    id: 'tc-exp-11', clues: ['stretches', 'horizon'], category: 'nature', difficulty: 3,
    anchors: ['ocean', 'sky', 'road'], anchorAliases: { 'ocean': ['oceans', 'sea'], 'sky': ['skies'] },
    cluster: ['sunset', 'view', 'desert', 'plain', 'landscape', 'highway'],
    nearMisses: ['rubber band', 'yoga', 'line'],
    coachHints: {
      'rubber band': "Those stretch! What stretches to the horizon?",
      'yoga': "Good stretch! What view stretches far away?",
      'line': "The horizon is a line! What stretches toward it?"
    }
  },
  {
    id: 'tc-exp-12', clues: ['fades', 'photograph'], category: 'abstract', difficulty: 3,
    anchors: ['memory', 'color', 'ink'], anchorAliases: { 'memory': ['memories'], 'color': ['colors', 'colour'] },
    cluster: ['picture', 'image', 'past', 'album', 'moment'],
    nearMisses: ['camera', 'frame', 'paper'],
    coachHints: {
      'camera': "Cameras take photos! What fades in an old one?",
      'frame': "Frames hold photos! What fades inside them?",
      'paper': "Photos are on paper! What fades over time?"
    }
  },
];

export const TWO_CLUES_PUZZLES: TwoCluesPuzzle[] = [
  ...expansionPuzzles,
  ...animalsPuzzles,
  ...kitchenPuzzles,
  ...weatherPuzzles,
  ...sportsPuzzles,
  ...homePuzzles,
  ...peoplePuzzles,
  ...clothingPuzzles,
  ...naturePuzzles,
  ...foodPuzzles,
  ...transportPuzzles,
  ...bodyPuzzles,
  ...musicPuzzles,
  ...hardPuzzles,
  ...midPuzzles,
];

export const PUZZLE_CATEGORIES = ['animals', 'kitchen', 'weather', 'sports', 'home', 'people', 'clothing', 'nature', 'food', 'transport', 'body', 'music'] as const;
export type PuzzleCategory = typeof PUZZLE_CATEGORIES[number];

/**
 * Get puzzles filtered by category and/or difficulty
 */
export function getPuzzles(options?: { 
  category?: PuzzleCategory; 
  difficulty?: 1 | 2 | 3;
  limit?: number;
  focusPhonemes?: string[];
}): TwoCluesPuzzle[] {
  let puzzles = [...TWO_CLUES_PUZZLES];
  
  if (options?.category) {
    puzzles = puzzles.filter(p => p.category === options.category);
  }
  
  if (options?.difficulty) {
    puzzles = puzzles.filter(p => p.difficulty === options.difficulty);
  }
  
  // Phoneme-targeted sorting: prioritize puzzles whose anchors contain focus phonemes
  if (options?.focusPhonemes && options.focusPhonemes.length > 0) {
    const normalizedFocus = new Set(options.focusPhonemes.map(p => p.replace(/\//g, '').toLowerCase()));
    
    puzzles.sort((a, b) => {
      const aScore = countAnchorPhonemeOverlap(a.anchors, normalizedFocus);
      const bScore = countAnchorPhonemeOverlap(b.anchors, normalizedFocus);
      if (aScore !== bScore) return bScore - aScore;
      return Math.random() - 0.5;
    });
  }
  
  if (options?.limit) {
    puzzles = puzzles.slice(0, options.limit);
  }
  
  return puzzles;
}

/**
 * Count phoneme overlap between anchor words and focus phonemes.
 * Uses simple substring matching on the word characters.
 */
function countAnchorPhonemeOverlap(anchors: string[], normalizedFocus: Set<string>): number {
  let score = 0;
  for (const anchor of anchors) {
    const chars = anchor.toLowerCase();
    for (const phoneme of normalizedFocus) {
      // Simple heuristic: check if phoneme grapheme appears in word
      if (chars.includes(phoneme.charAt(0))) score++;
    }
  }
  return score;
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
