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
  
  // /ʒ/ contrasts (zh sound as in "measure")
  {
    id: 'measure_treasure',
    word1: 'measure',
    word2: 'treasure',
    contrastType: 'medial',
    phoneme1: '/ʒ/',
    phoneme2: '/ʒ/',
    contrastDescription: 'Both contain voiced postalveolar fricative (/ʒ/)',
    difficulty: 2,
    category: 'zh_sound',
  },
  
  // /j/ contrasts (y sound)
  {
    id: 'yawn_yell',
    word1: 'yawn',
    word2: 'yell',
    contrastType: 'initial',
    phoneme1: '/j/',
    phoneme2: '/j/',
    contrastDescription: 'Both begin with palatal approximant (/j/) - different vowels',
    difficulty: 1,
    category: 'y_sound',
  },
  
  // New minimal pairs using expanded photo bank
  {
    id: 'gate_Kate',
    word1: 'gate',
    word2: 'Kate',
    contrastType: 'initial',
    phoneme1: '/g/',
    phoneme2: '/k/',
    contrastDescription: 'Voiced vs. voiceless velar stop',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'rose_nose',
    word1: 'rose',
    word2: 'nose',
    contrastType: 'initial',
    phoneme1: '/r/',
    phoneme2: '/n/',
    contrastDescription: 'Alveolar approximant vs. nasal',
    difficulty: 2,
    category: 'manner',
  },
  {
    id: 'net_nut',
    word1: 'net',
    word2: 'nut',
    contrastType: 'medial',
    phoneme1: '/ɛ/',
    phoneme2: '/ʌ/',
    contrastDescription: 'Open-mid front vs. open-mid central vowel',
    difficulty: 2,
    category: 'vowel',
  },
  {
    id: 'pie_tie',
    word1: 'pie',
    word2: 'tie',
    contrastType: 'initial',
    phoneme1: '/p/',
    phoneme2: '/t/',
    contrastDescription: 'Bilabial vs. alveolar voiceless stop',
    difficulty: 1,
    category: 'place',
  },
  {
    id: 'rope_robe',
    word1: 'rope',
    word2: 'robe',
    contrastType: 'final',
    phoneme1: '/p/',
    phoneme2: '/b/',
    contrastDescription: 'Voiceless vs. voiced bilabial stop (final)',
    difficulty: 3,
    category: 'final_voicing',
  },
  {
    id: 'duck_dock',
    word1: 'duck',
    word2: 'dock',
    contrastType: 'medial',
    phoneme1: '/ʌ/',
    phoneme2: '/ɑ/',
    contrastDescription: 'Open-mid central vs. open back vowel',
    difficulty: 2,
    category: 'vowel',
  },
  {
    id: 'zip_sip',
    word1: 'zip',
    word2: 'sip',
    contrastType: 'initial',
    phoneme1: '/z/',
    phoneme2: '/s/',
    contrastDescription: 'Voiced vs. voiceless alveolar fricative',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'lion_lime',
    word1: 'lion',
    word2: 'lime',
    contrastType: 'final',
    phoneme1: '/n/',
    phoneme2: '/m/',
    contrastDescription: 'Alveolar vs. bilabial nasal',
    difficulty: 2,
    category: 'nasal',
  },
  
  // Batch 2 minimal pairs - medial/final position contrasts
  {
    id: 'bag_bat',
    word1: 'bag',
    word2: 'bat',
    contrastType: 'final',
    phoneme1: '/g/',
    phoneme2: '/t/',
    contrastDescription: 'Velar vs. alveolar stop (final)',
    difficulty: 2,
    category: 'place',
  },
  {
    id: 'pig_pin',
    word1: 'pig',
    word2: 'pin',
    contrastType: 'final',
    phoneme1: '/g/',
    phoneme2: '/n/',
    contrastDescription: 'Velar stop vs. alveolar nasal (final)',
    difficulty: 2,
    category: 'manner',
  },
  {
    id: 'bell_ball',
    word1: 'bell',
    word2: 'ball',
    contrastType: 'medial',
    phoneme1: '/ɛ/',
    phoneme2: '/ɔ/',
    contrastDescription: 'Open-mid front vs. open-mid back vowel',
    difficulty: 2,
    category: 'vowel',
  },
  {
    id: 'carrot_parrot',
    word1: 'carrot',
    word2: 'parrot',
    contrastType: 'initial',
    phoneme1: '/k/',
    phoneme2: '/p/',
    contrastDescription: 'Velar vs. bilabial voiceless stop',
    difficulty: 2,
    category: 'place',
  },
  {
    id: 'frog_flag',
    word1: 'frog',
    word2: 'flag',
    contrastType: 'medial',
    phoneme1: '/r/',
    phoneme2: '/l/',
    contrastDescription: 'Alveolar approximant vs. lateral (/r/ vs /l/)',
    difficulty: 3,
    category: 'liquid',
  },
  {
    id: 'puzzle_puddle',
    word1: 'puzzle',
    word2: 'puddle',
    contrastType: 'medial',
    phoneme1: '/z/',
    phoneme2: '/d/',
    contrastDescription: 'Alveolar fricative vs. alveolar stop',
    difficulty: 2,
    category: 'manner',
  },
  {
    id: 'tiger_liger',
    word1: 'tiger',
    word2: 'liger',
    contrastType: 'initial',
    phoneme1: '/t/',
    phoneme2: '/l/',
    contrastDescription: 'Alveolar stop vs. lateral approximant',
    difficulty: 2,
    category: 'manner',
  },
  {
    id: 'towel_vowel',
    word1: 'towel',
    word2: 'vowel',
    contrastType: 'initial',
    phoneme1: '/t/',
    phoneme2: '/v/',
    contrastDescription: 'Alveolar stop vs. labiodental fricative',
    difficulty: 3,
    category: 'manner',
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
