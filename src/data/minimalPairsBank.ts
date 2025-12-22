/**
 * Minimal Pairs Bank
 * 
 * Curated minimal pairs for phoneme discrimination practice.
 * Each pair differs by a single phoneme, targeting specific contrasts.
 */

import { PHOTO_BANK, PhotoTrial } from './photoBank';

export interface MinimalPair {
  id: string;
  word1: string;
  word2: string;
  contrastType: 'initial' | 'medial' | 'final';
  phoneme1: string;
  phoneme2: string;
  contrastDescription: string;
  difficulty: number; // 1-3 (easy, medium, hard)
  category: string;
}

// Define our minimal pairs with their phonemic contrasts
export const MINIMAL_PAIRS: MinimalPair[] = [
  // Initial consonant contrasts
  {
    id: 'cat_hat',
    word1: 'cat',
    word2: 'hat',
    contrastType: 'initial',
    phoneme1: '/k/',
    phoneme2: '/h/',
    contrastDescription: 'Voiceless velar stop vs. voiceless glottal fricative',
    difficulty: 1,
    category: 'stop_fricative',
  },
  {
    id: 'ship_chip',
    word1: 'ship',
    word2: 'chip',
    contrastType: 'initial',
    phoneme1: '/ʃ/',
    phoneme2: '/tʃ/',
    contrastDescription: 'Voiceless palato-alveolar fricative vs. affricate',
    difficulty: 2,
    category: 'fricative_affricate',
  },
  {
    id: 'fan_van',
    word1: 'fan',
    word2: 'van',
    contrastType: 'initial',
    phoneme1: '/f/',
    phoneme2: '/v/',
    contrastDescription: 'Voiceless vs. voiced labiodental fricative',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'three_tree',
    word1: 'three',
    word2: 'tree',
    contrastType: 'initial',
    phoneme1: '/θ/',
    phoneme2: '/t/',
    contrastDescription: 'Voiceless dental fricative vs. alveolar stop',
    difficulty: 3,
    category: 'fricative_stop',
  },
  {
    id: 'goat_coat',
    word1: 'goat',
    word2: 'coat',
    contrastType: 'initial',
    phoneme1: '/ɡ/',
    phoneme2: '/k/',
    contrastDescription: 'Voiced vs. voiceless velar stop',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'pen_hen',
    word1: 'pen',
    word2: 'hen',
    contrastType: 'initial',
    phoneme1: '/p/',
    phoneme2: '/h/',
    contrastDescription: 'Voiceless bilabial stop vs. glottal fricative',
    difficulty: 1,
    category: 'stop_fricative',
  },
  
  // Vowel contrasts
  {
    id: 'bed_red',
    word1: 'bed',
    word2: 'red',
    contrastType: 'initial',
    phoneme1: '/b/',
    phoneme2: '/r/',
    contrastDescription: 'Voiced bilabial stop vs. alveolar approximant',
    difficulty: 1,
    category: 'stop_approximant',
  },
  
  // Voicing contrasts (initial)
  {
    id: 'pin_bin',
    word1: 'pin',
    word2: 'bin',
    contrastType: 'initial',
    phoneme1: '/p/',
    phoneme2: '/b/',
    contrastDescription: 'Voiceless vs. voiced bilabial stop',
    difficulty: 2,
    category: 'voicing',
  },
  
  // Final voicing contrasts
  {
    id: 'cap_cab',
    word1: 'cap',
    word2: 'cab',
    contrastType: 'final',
    phoneme1: '/p/',
    phoneme2: '/b/',
    contrastDescription: 'Voiceless vs. voiced bilabial stop (final position)',
    difficulty: 3,
    category: 'final_voicing',
  },
  
  // Fricative contrasts (θ vs ð)
  {
    id: 'teeth_teethe',
    word1: 'teeth',
    word2: 'teethe',
    contrastType: 'final',
    phoneme1: '/θ/',
    phoneme2: '/ð/',
    contrastDescription: 'Voiceless vs. voiced dental fricative',
    difficulty: 3,
    category: 'th_contrast',
  },
];

export interface MinimalPairTrial {
  pair: MinimalPair;
  trial1: PhotoTrial;
  trial2: PhotoTrial;
  targetIndex: 0 | 1; // Which word is the target (0 or 1)
  targetWord: string;
}

/**
 * Get photo trials for minimal pairs that have photos available
 */
export function getMinimalPairTrials(): MinimalPairTrial[] {
  const photoMap = new Map<string, PhotoTrial>();
  
  // Build lookup map of photos by target word
  for (const trial of PHOTO_BANK) {
    photoMap.set(trial.target.toLowerCase(), trial);
  }
  
  const validPairs: MinimalPairTrial[] = [];
  
  for (const pair of MINIMAL_PAIRS) {
    const trial1 = photoMap.get(pair.word1.toLowerCase());
    const trial2 = photoMap.get(pair.word2.toLowerCase());
    
    // Only include pairs where both words have photos
    if (trial1 && trial2) {
      // Randomly select which word is the target
      const targetIndex = Math.random() < 0.5 ? 0 : 1;
      validPairs.push({
        pair,
        trial1,
        trial2,
        targetIndex: targetIndex as 0 | 1,
        targetWord: targetIndex === 0 ? pair.word1 : pair.word2,
      });
    }
  }
  
  return validPairs;
}

/**
 * Get minimal pair trials filtered by difficulty
 */
export function getMinimalPairTrialsForLevel(
  level: number,
  count: number = 10
): MinimalPairTrial[] {
  const allTrials = getMinimalPairTrials();
  
  // Map game level (1-10) to pair difficulty (1-3)
  const targetDifficulty = Math.min(3, Math.ceil(level / 3));
  
  // Filter by difficulty with tolerance
  let filtered = allTrials.filter(
    t => Math.abs(t.pair.difficulty - targetDifficulty) <= 1
  );
  
  // If not enough, use all
  if (filtered.length < count) {
    filtered = allTrials;
  }
  
  // Shuffle and return
  return [...filtered]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

/**
 * Get pairs for a specific contrast category
 */
export function getMinimalPairsByCategory(category: string): MinimalPairTrial[] {
  const allTrials = getMinimalPairTrials();
  return allTrials.filter(t => t.pair.category === category);
}

/**
 * Get stats about available minimal pairs
 */
export function getMinimalPairStats() {
  const allTrials = getMinimalPairTrials();
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<number, number> = {};
  
  for (const trial of allTrials) {
    byCategory[trial.pair.category] = (byCategory[trial.pair.category] || 0) + 1;
    byDifficulty[trial.pair.difficulty] = (byDifficulty[trial.pair.difficulty] || 0) + 1;
  }
  
  return {
    total: allTrials.length,
    definedPairs: MINIMAL_PAIRS.length,
    byCategory,
    byDifficulty,
    missingPhotos: MINIMAL_PAIRS.filter(p => {
      const trials = getMinimalPairTrials();
      return !trials.some(t => t.pair.id === p.id);
    }).map(p => [p.word1, p.word2]),
  };
}
