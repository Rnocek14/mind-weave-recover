/**
 * Untrained probe words for testing generalization
 * These words should NEVER appear in therapy trials
 * Used to measure true learning vs. item-specific memorization
 */

import type { PhotoTrial, LinguisticFeatures } from './photoBank';

// Note: These are placeholder image paths - you'll need to add actual images to assets/photos/
const PROBE_WORDS: PhotoTrial[] = [
  // EASY PROBES (Difficulty 1-2)
  {
    id: 'probe_tree',
    imageUrl: '/placeholder-tree.jpg', // TODO: Add actual image
    target: 'tree',
    semanticFoils: ['bush', 'plant', 'flower'],
    phonologicalFoils: ['three', 'free'],
    category: 'nature',
    features: {
      frequency_rank: 800,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 2,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'dense',
      first_phoneme: '/t/',
      semantic_category: 'plant',
      typicality_rating: 1,
      part_of_speech: 'noun'
    },
    computed_difficulty: 1,
    minLevel: 1,
    maxLevel: 3
  },
  {
    id: 'probe_book',
    imageUrl: '/placeholder-book.jpg', // TODO: Add actual image
    target: 'book',
    semanticFoils: ['magazine', 'paper', 'notebook'],
    phonologicalFoils: ['cook', 'hook', 'look'],
    category: 'objects',
    features: {
      frequency_rank: 600,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'dense',
      first_phoneme: '/b/',
      semantic_category: 'reading_material',
      typicality_rating: 1,
      part_of_speech: 'noun'
    },
    computed_difficulty: 1,
    minLevel: 1,
    maxLevel: 3
  },
  
  // MEDIUM PROBES (Difficulty 3-4)
  {
    id: 'probe_shoe',
    imageUrl: '/placeholder-shoe.jpg', // TODO: Add actual image
    target: 'shoe',
    semanticFoils: ['boot', 'sandal', 'slipper', 'sneaker'],
    phonologicalFoils: ['chew', 'shoo', 'sue'],
    category: 'clothing',
    features: {
      frequency_rank: 2500,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 1,
      phoneme_count: 2,
      phonological_complexity: 1,
      neighborhood_density: 'moderate',
      first_phoneme: '/ʃ/',
      semantic_category: 'footwear',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 3,
    minLevel: 3,
    maxLevel: 5
  },
  {
    id: 'probe_watch',
    imageUrl: '/placeholder-watch.jpg', // TODO: Add actual image
    target: 'watch',
    semanticFoils: ['clock', 'timer', 'bracelet', 'band'],
    phonologicalFoils: ['wash', 'match', 'catch'],
    category: 'accessories',
    features: {
      frequency_rank: 1800,
      imageability: 6,
      concreteness: 7,
      age_of_acquisition: 4,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 1,
      neighborhood_density: 'moderate',
      first_phoneme: '/w/',
      semantic_category: 'timepiece',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 3,
    minLevel: 3,
    maxLevel: 5
  },
  {
    id: 'probe_flower',
    imageUrl: '/placeholder-flower.jpg', // TODO: Add actual image
    target: 'flower',
    semanticFoils: ['rose', 'plant', 'daisy', 'tulip'],
    phonologicalFoils: ['flour', 'power', 'tower'],
    category: 'nature',
    features: {
      frequency_rank: 3200,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 2,
      phoneme_count: 5,
      phonological_complexity: 1,
      neighborhood_density: 'moderate',
      first_phoneme: '/f/',
      semantic_category: 'plant',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 3,
    minLevel: 3,
    maxLevel: 5
  },
  
  // HARD PROBES (Difficulty 4-5)
  {
    id: 'probe_spoon',
    imageUrl: '/placeholder-spoon.jpg', // TODO: Add actual image
    target: 'spoon',
    semanticFoils: ['fork', 'knife', 'utensil', 'ladle'],
    phonologicalFoils: ['soon', 'moon', 'boon'],
    category: 'kitchenware',
    features: {
      frequency_rank: 4500,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 1,
      phoneme_count: 4,
      phonological_complexity: 1,
      neighborhood_density: 'moderate',
      first_phoneme: '/s/',
      semantic_category: 'utensil',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 4,
    minLevel: 4,
    maxLevel: 6
  },
  {
    id: 'probe_key',
    imageUrl: '/placeholder-key.jpg', // TODO: Add actual image
    target: 'key',
    semanticFoils: ['lock', 'card', 'keychain', 'remote'],
    phonologicalFoils: ['knee', 'pea', 'tea'],
    category: 'objects',
    features: {
      frequency_rank: 1200,
      imageability: 6,
      concreteness: 7,
      age_of_acquisition: 4,
      syllable_count: 1,
      phoneme_count: 2,
      phonological_complexity: 0,
      neighborhood_density: 'dense',
      first_phoneme: '/k/',
      semantic_category: 'tool',
      typicality_rating: 3,
      part_of_speech: 'noun'
    },
    computed_difficulty: 4,
    minLevel: 4,
    maxLevel: 6
  },
  {
    id: 'probe_nose',
    imageUrl: '/placeholder-nose.jpg', // TODO: Add actual image
    target: 'nose',
    semanticFoils: ['mouth', 'face', 'chin', 'cheek'],
    phonologicalFoils: ['hose', 'rose', 'pose'],
    category: 'body',
    features: {
      frequency_rank: 2800,
      imageability: 6,
      concreteness: 7,
      age_of_acquisition: 3,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'dense',
      first_phoneme: '/n/',
      semantic_category: 'body_part',
      typicality_rating: 2,
      part_of_speech: 'noun'
    },
    computed_difficulty: 4,
    minLevel: 4,
    maxLevel: 6
  },
  {
    id: 'probe_ball',
    imageUrl: '/placeholder-ball.jpg', // TODO: Add actual image
    target: 'ball',
    semanticFoils: ['sphere', 'toy', 'marble', 'globe'],
    phonologicalFoils: ['call', 'hall', 'wall'],
    category: 'toys',
    features: {
      frequency_rank: 1500,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 2,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'dense',
      first_phoneme: '/b/',
      semantic_category: 'toy',
      typicality_rating: 1,
      part_of_speech: 'noun'
    },
    computed_difficulty: 2,
    minLevel: 2,
    maxLevel: 4
  },
  {
    id: 'probe_door',
    imageUrl: '/placeholder-door.jpg', // TODO: Add actual image
    target: 'door',
    semanticFoils: ['gate', 'window', 'entrance', 'opening'],
    phonologicalFoils: ['floor', 'more', 'pour'],
    category: 'building_parts',
    features: {
      frequency_rank: 900,
      imageability: 7,
      concreteness: 7,
      age_of_acquisition: 2,
      syllable_count: 1,
      phoneme_count: 3,
      phonological_complexity: 0,
      neighborhood_density: 'moderate',
      first_phoneme: '/d/',
      semantic_category: 'building_part',
      typicality_rating: 1,
      part_of_speech: 'noun'
    },
    computed_difficulty: 2,
    minLevel: 2,
    maxLevel: 4
  }
];

export { PROBE_WORDS };

/**
 * Determine if it's time to run a generalization probe
 * 
 * @param sessionCount - Total number of sessions completed
 * @param lastProbeSession - Session number when probe was last run (null if never)
 * @returns Whether to run a probe now
 */
export const shouldRunProbe = (
  sessionCount: number,
  lastProbeSession: number | null
): boolean => {
  // Always run probe at session 1 (baseline)
  if (sessionCount === 1) return true;
  
  // Don't run if no sessions yet
  if (!sessionCount || sessionCount === 0) return false;
  
  // If never run before (but not session 1), run it
  if (lastProbeSession === null && sessionCount > 1) return true;
  
  // Run probe every 5-7 sessions
  const sessionsSinceLastProbe = sessionCount - (lastProbeSession || 0);
  return sessionsSinceLastProbe >= 5;
};

/**
 * Get probe trials appropriate for current difficulty level
 * 
 * @param difficultyLevel - Current game difficulty (1-10)
 * @param count - Number of probe trials to return (default: 5)
 * @returns Array of probe trials
 */
export const getProbeTrials = (
  difficultyLevel: number,
  count: number = 5
): PhotoTrial[] => {
  // Map game difficulty (1-10) to linguistic difficulty (1-5)
  const linguisticDifficulty = Math.ceil(difficultyLevel / 2);
  
  // Filter probes by difficulty (±1 tolerance)
  const appropriateProbes = PROBE_WORDS.filter(probe => 
    Math.abs(probe.computed_difficulty - linguisticDifficulty) <= 1
  );
  
  // If not enough matches, use all probes
  const probes = appropriateProbes.length >= count 
    ? appropriateProbes 
    : PROBE_WORDS;
  
  // Shuffle and return requested count
  const shuffled = [...probes].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

/**
 * Check if a word is a probe word (to ensure it never appears in training)
 */
export const isProbeWord = (targetWord: string): boolean => {
  return PROBE_WORDS.some(probe => 
    probe.target.toLowerCase() === targetWord.toLowerCase()
  );
};
