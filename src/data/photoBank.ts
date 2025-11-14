// Curated photo-naming trials with semantic foils
// Real images for therapy exercises

import houseImg from '@/assets/photos/house.jpg';
import cupImg from '@/assets/photos/cup.jpg';
import dogImg from '@/assets/photos/dog.jpg';
import appleImg from '@/assets/photos/apple.jpg';
import chairImg from '@/assets/photos/chair.jpg';
import phoneImg from '@/assets/photos/phone.jpg';
import birdImg from '@/assets/photos/bird.jpg';
import breadImg from '@/assets/photos/bread.jpg';
import carImg from '@/assets/photos/car.jpg';
import handImg from '@/assets/photos/hand.jpg';
import eyeImg from '@/assets/photos/eye.jpg';
import catImg from '@/assets/photos/cat.jpg';
import bikeImg from '@/assets/photos/bike.jpg';

export interface LinguisticFeatures {
  // Core difficulty factors (from research)
  frequency_rank: number;           // 1-100000 (lower = more common)
  imageability: number;             // 1-7 scale (7 = highly concrete/imageable)
  concreteness: number;             // 1-7 scale (7 = very concrete)
  age_of_acquisition: number;       // Approximate years (2-15+)
  
  // Phonological properties
  syllable_count: number;
  phoneme_count: number;
  phonological_complexity: number;  // 0-3 (0=simple CV, 3=clusters/3+ syllables)
  neighborhood_density: 'sparse' | 'moderate' | 'dense';
  first_phoneme: string;            // For phonemic cueing (e.g., "/k/")
  
  // Semantic properties
  semantic_category: string;        // Fine-grained (e.g., "domestic_animal")
  typicality_rating: number;        // 1-7 (1=very typical, 7=atypical exemplar)
  
  // Metadata
  part_of_speech: 'noun' | 'verb' | 'adjective';
  personal_relevance_flag?: boolean;
}

export interface PhotoTrial {
  id: string;
  imageUrl: string;
  target: string; // Correct answer
  semanticFoils: string[]; // Related distractors
  phonologicalFoils?: string[]; // Sound-similar distractors (for hard mode)
  category: string;
  
  // NEW: Linguistic features
  features: LinguisticFeatures;
  
  // Computed difficulty (from features)
  computed_difficulty: number;      // 1-5, calculated from features
  
  // Legacy fields for backward compatibility
  minLevel: number;
  maxLevel: number;
}

export const PHOTO_BANK: PhotoTrial[] = [
  // EASY TRIALS (Levels 1-2): High frequency, early acquisition, simple structure
  {
    id: 'house_1',
    imageUrl: houseImg,
    target: 'house',
    semanticFoils: ['tree', 'car', 'apple'],
    category: 'buildings',
    features: {
      frequency_rank: 450,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'moderate',
      first_phoneme: '/h/',
      semantic_category: 'dwelling',
      typicality_rating: 1,
      part_of_speech: 'noun'
    },
    computed_difficulty: 1,
    minLevel: 1,
    maxLevel: 4,
  },
  {
    id: 'cup_1',
    imageUrl: cupImg,
    target: 'cup',
    semanticFoils: ['shoe', 'book', 'chair'],
    category: 'kitchenware',
    features: {
      frequency_rank: 2800,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 2,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'dense',
      first_phoneme: '/k/',
      semantic_category: 'drinking_vessel',
      typicality_rating: 1,
      part_of_speech: 'noun'
    },
    computed_difficulty: 1,
    minLevel: 1,
    maxLevel: 4,
  },
  {
    id: 'dog_1',
    imageUrl: dogImg,
    target: 'dog',
    semanticFoils: ['car', 'tree', 'house'],
    category: 'animals',
    features: {
      frequency_rank: 950,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 2,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'moderate',
      first_phoneme: '/d/',
      semantic_category: 'domestic_animal',
      typicality_rating: 1,
      part_of_speech: 'noun'
    },
    computed_difficulty: 1,
    minLevel: 1,
    maxLevel: 4,
  },
  {
    id: 'apple_1',
    imageUrl: appleImg,
    target: 'apple',
    semanticFoils: ['shoe', 'car', 'chair'],
    category: 'food',
    features: {
      frequency_rank: 3500,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 2,
      phoneme_count: 4,
      phonological_complexity: 0,
      neighborhood_density: 'moderate',
      first_phoneme: '/æ/',
      semantic_category: 'fruit',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 2,
    minLevel: 1,
    maxLevel: 4,
  },
  
  // MEDIUM TRIALS (Levels 3-4): Close semantic foils, same category
  {
    id: 'chair_2',
    imageUrl: chairImg,
    target: 'chair',
    semanticFoils: ['table', 'stool', 'bench', 'couch'],
    category: 'furniture',
    features: {
      frequency_rank: 1800,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 1,
      neighborhood_density: 'moderate',
      first_phoneme: '/tʃ/',
      semantic_category: 'seating',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 2,
    minLevel: 4,
    maxLevel: 8,
  },
  {
    id: 'phone_2',
    imageUrl: phoneImg,
    target: 'phone',
    semanticFoils: ['tablet', 'computer', 'watch', 'remote'],
    category: 'electronics',
    features: {
      frequency_rank: 1200,
      imageability: 6,
      concreteness: 7,
      age_of_acquisition: 4,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'moderate',
      first_phoneme: '/f/',
      semantic_category: 'communication_device',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 3,
    minLevel: 4,
    maxLevel: 8,
  },
  {
    id: 'dog_2',
    imageUrl: dogImg,
    target: 'dog',
    semanticFoils: ['cat', 'wolf', 'fox', 'puppy'],
    category: 'animals',
    features: {
      frequency_rank: 950,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 2,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'moderate',
      first_phoneme: '/d/',
      semantic_category: 'domestic_animal',
      typicality_rating: 1,
      part_of_speech: 'noun'
    },
    computed_difficulty: 3,
    minLevel: 4,
    maxLevel: 8,
  },
  {
    id: 'bird_2',
    imageUrl: birdImg,
    target: 'bird',
    semanticFoils: ['eagle', 'robin', 'sparrow', 'crow'],
    category: 'animals',
    features: {
      frequency_rank: 2200,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 1,
      neighborhood_density: 'moderate',
      first_phoneme: '/b/',
      semantic_category: 'flying_animal',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 3,
    minLevel: 4,
    maxLevel: 8,
  },
  {
    id: 'bread_2',
    imageUrl: breadImg,
    target: 'bread',
    semanticFoils: ['toast', 'roll', 'bagel', 'bun'],
    category: 'food',
    features: {
      frequency_rank: 3800,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 1,
      phoneme_count: 4,
      phonological_complexity: 1,
      neighborhood_density: 'moderate',
      first_phoneme: '/b/',
      semantic_category: 'baked_good',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 3,
    minLevel: 4,
    maxLevel: 8,
  },
  {
    id: 'car_2',
    imageUrl: carImg,
    target: 'car',
    semanticFoils: ['truck', 'van', 'suv', 'sedan'],
    category: 'transportation',
    features: {
      frequency_rank: 700,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'dense',
      first_phoneme: '/k/',
      semantic_category: 'vehicle',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 3,
    minLevel: 4,
    maxLevel: 8,
  },
  
  // HARD TRIALS (Levels 4-5): Phonological similarity + semantic overlap
  {
    id: 'hand_3',
    imageUrl: handImg,
    target: 'hand',
    semanticFoils: ['arm', 'wrist', 'finger', 'palm'],
    phonologicalFoils: ['sand', 'band', 'land'],
    category: 'body',
    features: {
      frequency_rank: 600,
      imageability: 6,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 1,
      phoneme_count: 4,
      phonological_complexity: 1,
      neighborhood_density: 'dense',
      first_phoneme: '/h/',
      semantic_category: 'body_part',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 4,
    minLevel: 7,
    maxLevel: 10,
  },
  {
    id: 'eye_3',
    imageUrl: eyeImg,
    target: 'eye',
    semanticFoils: ['nose', 'face', 'brow', 'lid'],
    phonologicalFoils: ['aye', 'rye', 'pie'],
    category: 'body',
    features: {
      frequency_rank: 850,
      imageability: 6,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 1,
      phoneme_count: 2,
      phonological_complexity: 0,
      neighborhood_density: 'dense',
      first_phoneme: '/aɪ/',
      semantic_category: 'body_part',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 4,
    minLevel: 7,
    maxLevel: 10,
  },
  {
    id: 'cat_3',
    imageUrl: catImg,
    target: 'cat',
    semanticFoils: ['kitten', 'feline', 'tiger', 'lion'],
    phonologicalFoils: ['hat', 'bat', 'mat'],
    category: 'animals',
    features: {
      frequency_rank: 1500,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 2,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'dense',
      first_phoneme: '/k/',
      semantic_category: 'domestic_animal',
      typicality_rating: 1,
      part_of_speech: 'noun'
    },
    computed_difficulty: 4,
    minLevel: 7,
    maxLevel: 10,
  },
  {
    id: 'bike_3',
    imageUrl: bikeImg,
    target: 'bike',
    semanticFoils: ['cycle', 'scooter', 'moped', 'trike'],
    phonologicalFoils: ['hike', 'pike', 'mike'],
    category: 'transportation',
    features: {
      frequency_rank: 4200,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 4,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'moderate',
      first_phoneme: '/b/',
      semantic_category: 'vehicle',
      typicality_rating: 3,
      part_of_speech: 'noun'
    },
    computed_difficulty: 4,
    minLevel: 7,
    maxLevel: 10,
  },
];

/**
 * Calculate difficulty score (1-5) from linguistic features
 * Based on research: frequency, imageability, AoA, length, typicality
 */
export const calculateDifficulty = (features: LinguisticFeatures): number => {
  let score = 0;
  
  // Frequency (30% weight) - lower rank = easier
  if (features.frequency_rank < 2000) score += 0;
  else if (features.frequency_rank < 5000) score += 0.3;
  else if (features.frequency_rank < 10000) score += 0.6;
  else score += 0.9;
  
  // Imageability (25% weight) - higher = easier
  score += (7 - features.imageability) * 0.036;
  
  // Age of Acquisition (20% weight) - lower age = easier
  if (features.age_of_acquisition <= 4) score += 0;
  else if (features.age_of_acquisition <= 7) score += 0.2;
  else score += 0.4;
  
  // Length/Complexity (15% weight)
  score += features.phonological_complexity * 0.05;
  score += (features.syllable_count - 1) * 0.03;
  
  // Typicality (10% weight) - atypical = harder
  score += (features.typicality_rating - 1) * 0.017;
  
  // Convert to 1-5 scale
  return Math.max(1, Math.min(5, Math.round(score * 5 + 1)));
};

/**
 * Get trials appropriate for current difficulty level (1-10)
 * Maps game difficulty to linguistic difficulty (1-5)
 */
export const getTrialsForLevel = (
  level: number, 
  count: number,
  filterOptions?: {
    categories?: string[];
    excludeAtypical?: boolean;
    requirePhonologicalFoils?: boolean;
  }
): PhotoTrial[] => {
  // Map game level (1-10) to linguistic difficulty (1-5)
  const linguisticDifficulty = Math.ceil(level / 2);
  
  let filtered = PHOTO_BANK.filter(trial => {
    // Primary filter: difficulty match (±1 tolerance)
    if (Math.abs(trial.computed_difficulty - linguisticDifficulty) > 1) return false;
    
    // Optional filters
    if (filterOptions?.categories && 
        !filterOptions.categories.includes(trial.features.semantic_category)) {
      return false;
    }
    
    if (filterOptions?.excludeAtypical && 
        trial.features.typicality_rating > 5) {
      return false;
    }
    
    if (filterOptions?.requirePhonologicalFoils && 
        !trial.phonologicalFoils?.length) {
      return false;
    }
    
    return true;
  });
  
  // If no matches, expand tolerance
  if (filtered.length === 0) {
    filtered = PHOTO_BANK.filter(trial => 
      Math.abs(trial.computed_difficulty - linguisticDifficulty) <= 2
    );
  }
  
  // Shuffle and return
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

export const getRandomTrials = (count: number): PhotoTrial[] => {
  const shuffled = [...PHOTO_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, PHOTO_BANK.length));
};

export const generateChoices = (trial: PhotoTrial, level: number): string[] => {
  const choiceCount = level <= 3 ? 3 : 4;
  const usePhonological = level >= 8 && trial.phonologicalFoils;
  
  let foils: string[];
  if (usePhonological) {
    foils = [
      ...trial.semanticFoils.slice(0, 2),
      ...(trial.phonologicalFoils || []).slice(0, 1),
    ];
  } else {
    foils = trial.semanticFoils;
  }
  
  const allChoices = [trial.target, ...foils.slice(0, choiceCount - 1)];
  return allChoices.sort(() => Math.random() - 0.5);
};
