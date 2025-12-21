/**
 * Audio Trial Bank
 * 
 * Words for audio-only trials (no photos required).
 * These are used to supplement photo trials when targeting specific phonemes.
 * TTS will generate audio for these words at runtime.
 */

import { WORD_PHONEME_MAP } from '@/lib/phonemeWordMap';

export interface AudioTrial {
  id: string;
  word: string;
  phonemes: string[];
  category: string;
  difficulty: number; // 1-5 scale
  semanticFoils: string[]; // For choice mode
}

// Words that have photos in PHOTO_BANK (should NOT be in audio-only trials)
const PHOTO_WORDS = new Set([
  'house', 'cup', 'dog', 'apple', 'ball', 'book', 'tree', 'chair', 'phone',
  'bird', 'bread', 'car', 'shoe', 'door', 'key', 'flower', 'spoon', 'watch',
  'hand', 'eye', 'cat', 'bike', 'nose',
  // New AI-generated photos
  'cake', 'star', 'rain', 'lamp', 'ship', 'thumb', 'cheese', 'jar', 'fish',
  'moon', 'nail', 'leaf', 'ring'
]);

// Semantic categories for foil generation
const SEMANTIC_CATEGORIES: Record<string, string[]> = {
  food: ['cake', 'bread', 'soup', 'cheese', 'meat', 'rice', 'pie', 'lunch', 'salt', 'corn', 'grape', 'nut'],
  animals: ['dog', 'cat', 'bird', 'fish', 'cow', 'pig', 'duck', 'sheep', 'lion', 'frog', 'goat', 'worm', 'mouse', 'chicken'],
  body: ['hand', 'eye', 'nose', 'face', 'leg', 'lip', 'chin', 'neck', 'foot', 'thumb', 'mouth', 'tooth'],
  nature: ['tree', 'flower', 'sun', 'star', 'rain', 'leaf', 'sea', 'sand', 'grass', 'wood', 'rose', 'moon'],
  clothing: ['shoe', 'coat', 'shirt', 'dress', 'sock', 'jacket', 'ring'],
  objects: ['cup', 'ball', 'book', 'key', 'spoon', 'lamp', 'box', 'bowl', 'bell', 'clock', 'rope', 'net', 'flag', 'sign', 'map', 'pen', 'rug', 'jar', 'plate', 'fork', 'soap', 'shell', 'gift', 'wheel', 'web', 'wing', 'tent', 'gate'],
  transportation: ['car', 'bike', 'bus', 'boat', 'ship', 'train', 'truck', 'cart', 'road'],
  places: ['house', 'door', 'room', 'shop', 'church', 'park', 'pool', 'town', 'wall', 'window'],
  people: ['boy', 'girl', 'man', 'nurse', 'king'],
};

// Assign category to words
function getCategoryForWord(word: string): string {
  for (const [category, words] of Object.entries(SEMANTIC_CATEGORIES)) {
    if (words.includes(word)) return category;
  }
  return 'objects'; // default
}

// Generate semantic foils for a word
function generateFoils(word: string, count: number = 3): string[] {
  const category = getCategoryForWord(word);
  const categoryWords = SEMANTIC_CATEGORIES[category] || [];
  
  // Get words from same category (excluding target)
  const sameCategoryFoils = categoryWords
    .filter(w => w !== word && !PHOTO_WORDS.has(w))
    .slice(0, count);
  
  // If not enough, add from other categories
  if (sameCategoryFoils.length < count) {
    const otherWords = Object.values(SEMANTIC_CATEGORIES)
      .flat()
      .filter(w => w !== word && !sameCategoryFoils.includes(w) && !PHOTO_WORDS.has(w));
    sameCategoryFoils.push(...otherWords.slice(0, count - sameCategoryFoils.length));
  }
  
  return sameCategoryFoils.slice(0, count);
}

// Calculate difficulty based on phonological complexity
function calculateDifficulty(phonemes: string[]): number {
  const length = phonemes.length;
  const hasCluster = phonemes.some((p, i) => 
    i > 0 && !p.match(/[aeiouɑæɛɪɔʊʌəɜaɪaʊeɪoʊɔɪ]/) && !phonemes[i-1].match(/[aeiouɑæɛɪɔʊʌəɜaɪaʊeɪoʊɔɪ]/)
  );
  const hasDifficultSound = phonemes.some(p => 
    ['/θ/', '/ð/', '/ʃ/', '/ʒ/', '/tʃ/', '/dʒ/', '/r/'].includes(p)
  );
  
  let difficulty = 1;
  if (length >= 4) difficulty++;
  if (length >= 5) difficulty++;
  if (hasCluster) difficulty++;
  if (hasDifficultSound) difficulty++;
  
  return Math.min(difficulty, 5);
}

// Build audio trials from words that are NOT in PHOTO_BANK
export const AUDIO_TRIAL_BANK: AudioTrial[] = Object.entries(WORD_PHONEME_MAP)
  .filter(([word]) => !PHOTO_WORDS.has(word))
  .map(([word, phonemes]) => ({
    id: `audio_${word}`,
    word,
    phonemes,
    category: getCategoryForWord(word),
    difficulty: calculateDifficulty(phonemes),
    semanticFoils: generateFoils(word),
  }));

/**
 * Get audio trials containing specific phonemes
 * Prioritizes words with more matching phonemes
 */
export function getAudioTrialsForPhonemes(
  targetPhonemes: string[], 
  limit: number = 10,
  excludeWords: string[] = []
): AudioTrial[] {
  const excludeSet = new Set(excludeWords.map(w => w.toLowerCase()));
  
  // Score each trial by phoneme overlap
  const scored = AUDIO_TRIAL_BANK
    .filter(trial => !excludeSet.has(trial.word))
    .map(trial => {
      const matchCount = trial.phonemes.filter(p => 
        targetPhonemes.some(tp => normalizePhoneme(tp) === normalizePhoneme(p))
      ).length;
      return { trial, matchCount };
    })
    .filter(({ matchCount }) => matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount);
  
  return scored.slice(0, limit).map(({ trial }) => trial);
}

/**
 * Get audio trials for a specific phoneme (initial or any position)
 */
export function getAudioTrialsForPhoneme(
  phoneme: string,
  position: 'initial' | 'any' = 'any',
  limit: number = 10
): AudioTrial[] {
  const normalizedTarget = normalizePhoneme(phoneme);
  
  return AUDIO_TRIAL_BANK
    .filter(trial => {
      if (position === 'initial') {
        return normalizePhoneme(trial.phonemes[0]) === normalizedTarget;
      }
      return trial.phonemes.some(p => normalizePhoneme(p) === normalizedTarget);
    })
    .slice(0, limit);
}

// Helper to normalize phoneme notation
function normalizePhoneme(phoneme: string): string {
  return phoneme.replace(/\//g, '').toLowerCase();
}

// Export stats for debugging
export function getAudioTrialStats() {
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<number, number> = {};
  const byInitialPhoneme: Record<string, number> = {};
  
  for (const trial of AUDIO_TRIAL_BANK) {
    byCategory[trial.category] = (byCategory[trial.category] || 0) + 1;
    byDifficulty[trial.difficulty] = (byDifficulty[trial.difficulty] || 0) + 1;
    const initial = trial.phonemes[0];
    byInitialPhoneme[initial] = (byInitialPhoneme[initial] || 0) + 1;
  }
  
  return {
    total: AUDIO_TRIAL_BANK.length,
    byCategory,
    byDifficulty,
    byInitialPhoneme,
  };
}
