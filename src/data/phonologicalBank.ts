/**
 * Phonological Awareness Trials
 * 
 * Minimal pairs, onset matching, and phoneme discrimination for phonological route training
 */

export type PhonemeRelationType = 
  | 'minimal_pair_onset'      // cat/bat - differ by first sound
  | 'minimal_pair_coda'       // cat/can - differ by final sound  
  | 'minimal_pair_vowel'      // cat/cut - differ by vowel
  | 'same_onset'              // cat/cup - same first sound
  | 'same_coda'               // cat/hat - same final sound
  | 'rhyme'                   // cat/hat - rhyme
  | 'unrelated';              // cat/dog - no phonological relationship

export interface PhonemeFeature {
  phoneme: string;
  position: 'onset' | 'nucleus' | 'coda';
  voicing?: 'voiced' | 'voiceless';
  manner?: 'stop' | 'fricative' | 'nasal' | 'liquid' | 'glide';
  place?: 'bilabial' | 'alveolar' | 'velar' | 'palatal';
}

export interface PhonologicalTrial {
  id: string;
  word1: string;
  word2: string;
  relationType: PhonemeRelationType;
  areSame: boolean; // For discrimination tasks: do they sound the same?
  difficulty: number; // 1-5
  phonemeDifferences: Array<{
    position: number;
    from: string;
    to: string;
    featureDiff: number; // 1 = one feature different, 3 = maximally different
  }>;
  // Linguistic metadata
  syllableCount1: number;
  syllableCount2: number;
  isNonword: boolean; // For advanced levels
}

// Phonological trial bank organized by difficulty
export const PHONO_TRIALS: PhonologicalTrial[] = [
  // Level 1: Easy minimal pairs - single onset changes, high imageability
  {
    id: 'mp_onset_1',
    word1: 'cat',
    word2: 'bat',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [{ position: 0, from: 'k', to: 'b', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_onset_2',
    word1: 'dog',
    word2: 'fog',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [{ position: 0, from: 'd', to: 'f', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_onset_3',
    word1: 'car',
    word2: 'bar',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [{ position: 0, from: 'k', to: 'b', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_onset_4',
    word1: 'sun',
    word2: 'fun',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [{ position: 0, from: 's', to: 'f', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_onset_5',
    word1: 'man',
    word2: 'pan',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [{ position: 0, from: 'm', to: 'p', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_onset_6',
    word1: 'door',
    word2: 'four',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [{ position: 0, from: 'd', to: 'f', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_onset_7',
    word1: 'hen',
    word2: 'pen',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [{ position: 0, from: 'h', to: 'p', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_onset_8',
    word1: 'ball',
    word2: 'wall',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [{ position: 0, from: 'b', to: 'w', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_onset_9',
    word1: 'hat',
    word2: 'mat',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [{ position: 0, from: 'h', to: 'm', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_onset_10',
    word1: 'key',
    word2: 'bee',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [{ position: 0, from: 'k', to: 'b', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'same_onset_1',
    word1: 'cup',
    word2: 'key',
    relationType: 'same_onset',
    areSame: true,
    difficulty: 1,
    phonemeDifferences: [],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'same_onset_2',
    word1: 'book',
    word2: 'ball',
    relationType: 'same_onset',
    areSame: true,
    difficulty: 1,
    phonemeDifferences: [],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'same_onset_3',
    word1: 'dog',
    word2: 'door',
    relationType: 'same_onset',
    areSame: true,
    difficulty: 1,
    phonemeDifferences: [],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'same_onset_4',
    word1: 'fish',
    word2: 'fan',
    relationType: 'same_onset',
    areSame: true,
    difficulty: 1,
    phonemeDifferences: [],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'unrelated_1',
    word1: 'cat',
    word2: 'dog',
    relationType: 'unrelated',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [
      { position: 0, from: 'k', to: 'd', featureDiff: 3 },
      { position: 1, from: 'æ', to: 'ɑ', featureDiff: 2 },
      { position: 2, from: 't', to: 'g', featureDiff: 3 }
    ],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'unrelated_2',
    word1: 'cup',
    word2: 'shoe',
    relationType: 'unrelated',
    areSame: false,
    difficulty: 1,
    phonemeDifferences: [{ position: 0, from: 'k', to: 'ʃ', featureDiff: 3 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },

  // Level 2: Coda differences and rhymes
  {
    id: 'mp_coda_1',
    word1: 'cat',
    word2: 'can',
    relationType: 'minimal_pair_coda',
    areSame: false,
    difficulty: 2,
    phonemeDifferences: [{ position: 2, from: 't', to: 'n', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_coda_2',
    word1: 'dog',
    word2: 'dot',
    relationType: 'minimal_pair_coda',
    areSame: false,
    difficulty: 2,
    phonemeDifferences: [{ position: 2, from: 'g', to: 't', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_coda_3',
    word1: 'cap',
    word2: 'cat',
    relationType: 'minimal_pair_coda',
    areSame: false,
    difficulty: 2,
    phonemeDifferences: [{ position: 2, from: 'p', to: 't', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_coda_4',
    word1: 'bed',
    word2: 'bell',
    relationType: 'minimal_pair_coda',
    areSame: false,
    difficulty: 2,
    phonemeDifferences: [{ position: 2, from: 'd', to: 'l', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_coda_5',
    word1: 'pin',
    word2: 'pig',
    relationType: 'minimal_pair_coda',
    areSame: false,
    difficulty: 2,
    phonemeDifferences: [{ position: 2, from: 'n', to: 'g', featureDiff: 2 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'rhyme_1',
    word1: 'cat',
    word2: 'hat',
    relationType: 'rhyme',
    areSame: true,
    difficulty: 2,
    phonemeDifferences: [],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'rhyme_2',
    word1: 'dog',
    word2: 'frog',
    relationType: 'rhyme',
    areSame: true,
    difficulty: 2,
    phonemeDifferences: [],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'rhyme_3',
    word1: 'tree',
    word2: 'key',
    relationType: 'rhyme',
    areSame: true,
    difficulty: 2,
    phonemeDifferences: [],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'rhyme_4',
    word1: 'day',
    word2: 'way',
    relationType: 'rhyme',
    areSame: true,
    difficulty: 2,
    phonemeDifferences: [],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'rhyme_5',
    word1: 'cake',
    word2: 'lake',
    relationType: 'rhyme',
    areSame: true,
    difficulty: 2,
    phonemeDifferences: [],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'rhyme_6',
    word1: 'ring',
    word2: 'king',
    relationType: 'rhyme',
    areSame: true,
    difficulty: 2,
    phonemeDifferences: [],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'rhyme_7',
    word1: 'moon',
    word2: 'spoon',
    relationType: 'rhyme',
    areSame: true,
    difficulty: 2,
    phonemeDifferences: [],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },

  // Level 3: Vowel differences (harder to perceive)
  {
    id: 'mp_vowel_1',
    word1: 'cat',
    word2: 'cut',
    relationType: 'minimal_pair_vowel',
    areSame: false,
    difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'æ', to: 'ʌ', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_vowel_2',
    word1: 'bed',
    word2: 'bad',
    relationType: 'minimal_pair_vowel',
    areSame: false,
    difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'ɛ', to: 'æ', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_vowel_3',
    word1: 'pin',
    word2: 'pen',
    relationType: 'minimal_pair_vowel',
    areSame: false,
    difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'ɪ', to: 'ɛ', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_vowel_4',
    word1: 'ship',
    word2: 'sheep',
    relationType: 'minimal_pair_vowel',
    areSame: false,
    difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'ɪ', to: 'i:', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_vowel_5',
    word1: 'hat',
    word2: 'hit',
    relationType: 'minimal_pair_vowel',
    areSame: false,
    difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'æ', to: 'ɪ', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_vowel_6',
    word1: 'look',
    word2: 'lock',
    relationType: 'minimal_pair_vowel',
    areSame: false,
    difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'ʊ', to: 'ɑ', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_vowel_7',
    word1: 'full',
    word2: 'fool',
    relationType: 'minimal_pair_vowel',
    areSame: false,
    difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'ʊ', to: 'u:', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_vowel_8',
    word1: 'pot',
    word2: 'pat',
    relationType: 'minimal_pair_vowel',
    areSame: false,
    difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'ɑ', to: 'æ', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_vowel_9',
    word1: 'cup',
    word2: 'cop',
    relationType: 'minimal_pair_vowel',
    areSame: false,
    difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'ʌ', to: 'ɑ', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'mp_vowel_10',
    word1: 'bit',
    word2: 'beat',
    relationType: 'minimal_pair_vowel',
    areSame: false,
    difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'ɪ', to: 'i:', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: false,
  },

  // Level 4: Multi-syllable words and subtle differences
  {
    id: 'mp_onset_multisyllable_1',
    word1: 'table',
    word2: 'cable',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 4,
    phonemeDifferences: [{ position: 0, from: 't', to: 'k', featureDiff: 2 }],
    syllableCount1: 2,
    syllableCount2: 2,
    isNonword: false,
  },
  {
    id: 'mp_onset_multisyllable_2',
    word1: 'butter',
    word2: 'putter',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 4,
    phonemeDifferences: [{ position: 0, from: 'b', to: 'p', featureDiff: 1 }],
    syllableCount1: 2,
    syllableCount2: 2,
    isNonword: false,
  },
  {
    id: 'mp_onset_multisyllable_3',
    word1: 'flower',
    word2: 'tower',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 4,
    phonemeDifferences: [{ position: 0, from: 'fl', to: 't', featureDiff: 2 }],
    syllableCount1: 2,
    syllableCount2: 2,
    isNonword: false,
  },
  {
    id: 'mp_onset_multisyllable_4',
    word1: 'weather',
    word2: 'feather',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 4,
    phonemeDifferences: [{ position: 0, from: 'w', to: 'f', featureDiff: 2 }],
    syllableCount1: 2,
    syllableCount2: 2,
    isNonword: false,
  },
  {
    id: 'mp_onset_multisyllable_5',
    word1: 'measure',
    word2: 'treasure',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 4,
    phonemeDifferences: [{ position: 0, from: 'm', to: 'tr', featureDiff: 2 }],
    syllableCount1: 2,
    syllableCount2: 2,
    isNonword: false,
  },
  {
    id: 'same_onset_multisyllable_1',
    word1: 'table',
    word2: 'tiger',
    relationType: 'same_onset',
    areSame: true,
    difficulty: 4,
    phonemeDifferences: [],
    syllableCount1: 2,
    syllableCount2: 2,
    isNonword: false,
  },
  {
    id: 'same_onset_multisyllable_2',
    word1: 'mother',
    word2: 'moon',
    relationType: 'same_onset',
    areSame: true,
    difficulty: 4,
    phonemeDifferences: [],
    syllableCount1: 2,
    syllableCount2: 1,
    isNonword: false,
  },
  {
    id: 'rhyme_multisyllable_1',
    word1: 'weather',
    word2: 'feather',
    relationType: 'rhyme',
    areSame: true,
    difficulty: 4,
    phonemeDifferences: [],
    syllableCount1: 2,
    syllableCount2: 2,
    isNonword: false,
  },

  // Level 5: Nonwords and minimal voicing contrasts
  {
    id: 'mp_nonword_1',
    word1: 'blig',
    word2: 'plig',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'b', to: 'p', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: true,
  },
  {
    id: 'mp_nonword_2',
    word1: 'dake',
    word2: 'take',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'd', to: 't', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: true,
  },
  {
    id: 'mp_nonword_3',
    word1: 'goff',
    word2: 'koff',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'g', to: 'k', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: true,
  },
  {
    id: 'mp_nonword_4',
    word1: 'vell',
    word2: 'fell',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'v', to: 'f', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: true,
  },
  {
    id: 'mp_nonword_5',
    word1: 'zat',
    word2: 'sat',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'z', to: 's', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: true,
  },
  {
    id: 'mp_nonword_6',
    word1: 'thib',
    word2: 'dib',
    relationType: 'minimal_pair_onset',
    areSame: false,
    difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'θ', to: 'd', featureDiff: 1 }],
    syllableCount1: 1,
    syllableCount2: 1,
    isNonword: true,
  },

  // ============================================================
  // Path 2 fill — bring per-bank-difficulty d2/d3/d4/d5 to ≥20.
  // No engine, hook, or bridge changes. d6–d10 NOT filled
  // (degraded-signal/triplet RT mode not built; L8 clamp stays).
  // ============================================================

  // --- d2 (+8): coda contrasts + onset same-discrimination ---
  { id: 'mp_coda_6', word1: 'pen', word2: 'pet', relationType: 'minimal_pair_coda', areSame: false, difficulty: 2,
    phonemeDifferences: [{ position: 2, from: 'n', to: 't', featureDiff: 2 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_coda_7', word1: 'big', word2: 'bid', relationType: 'minimal_pair_coda', areSame: false, difficulty: 2,
    phonemeDifferences: [{ position: 2, from: 'g', to: 'd', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_coda_8', word1: 'bus', word2: 'bun', relationType: 'minimal_pair_coda', areSame: false, difficulty: 2,
    phonemeDifferences: [{ position: 2, from: 's', to: 'n', featureDiff: 2 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_coda_9', word1: 'rope', word2: 'rose', relationType: 'minimal_pair_coda', areSame: false, difficulty: 2,
    phonemeDifferences: [{ position: 2, from: 'p', to: 'z', featureDiff: 2 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_coda_10', word1: 'leaf', word2: 'leap', relationType: 'minimal_pair_coda', areSame: false, difficulty: 2,
    phonemeDifferences: [{ position: 2, from: 'f', to: 'p', featureDiff: 2 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'same_onset_5', word1: 'soap', word2: 'sock', relationType: 'same_onset', areSame: true, difficulty: 2,
    phonemeDifferences: [], syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'same_onset_6', word1: 'milk', word2: 'moon', relationType: 'same_onset', areSame: true, difficulty: 2,
    phonemeDifferences: [], syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'same_onset_7', word1: 'pen', word2: 'pig', relationType: 'same_onset', areSame: true, difficulty: 2,
    phonemeDifferences: [], syllableCount1: 1, syllableCount2: 1, isNonword: false },

  // --- d3 (+10): vowel contrasts + same_coda + multisyllable onset ---
  { id: 'mp_vowel_11', word1: 'pet', word2: 'pit', relationType: 'minimal_pair_vowel', areSame: false, difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'ɛ', to: 'ɪ', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_vowel_12', word1: 'bat', word2: 'but', relationType: 'minimal_pair_vowel', areSame: false, difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'æ', to: 'ʌ', featureDiff: 2 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_vowel_13', word1: 'hat', word2: 'hot', relationType: 'minimal_pair_vowel', areSame: false, difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'æ', to: 'ɑ', featureDiff: 2 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_vowel_14', word1: 'cap', word2: 'cup', relationType: 'minimal_pair_vowel', areSame: false, difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'æ', to: 'ʌ', featureDiff: 2 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_vowel_15', word1: 'seat', word2: 'sit', relationType: 'minimal_pair_vowel', areSame: false, difficulty: 3,
    phonemeDifferences: [{ position: 1, from: 'i', to: 'ɪ', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'same_coda_1', word1: 'cat', word2: 'hat', relationType: 'same_coda', areSame: true, difficulty: 3,
    phonemeDifferences: [], syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'same_coda_2', word1: 'pin', word2: 'fan', relationType: 'same_coda', areSame: true, difficulty: 3,
    phonemeDifferences: [], syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'same_coda_3', word1: 'dog', word2: 'log', relationType: 'same_coda', areSame: true, difficulty: 3,
    phonemeDifferences: [], syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_onset_multisyllable_6', word1: 'butter', word2: 'gutter', relationType: 'minimal_pair_onset', areSame: false, difficulty: 3,
    phonemeDifferences: [{ position: 0, from: 'b', to: 'g', featureDiff: 2 }],
    syllableCount1: 2, syllableCount2: 2, isNonword: false },
  { id: 'mp_onset_multisyllable_7', word1: 'candle', word2: 'handle', relationType: 'minimal_pair_onset', areSame: false, difficulty: 3,
    phonemeDifferences: [{ position: 0, from: 'k', to: 'h', featureDiff: 3 }],
    syllableCount1: 2, syllableCount2: 2, isNonword: false },

  // --- d4 (+12): vowel/multisyllable + rhyme judgments + harder contrasts ---
  { id: 'mp_vowel_16', word1: 'bait', word2: 'bet', relationType: 'minimal_pair_vowel', areSame: false, difficulty: 4,
    phonemeDifferences: [{ position: 1, from: 'eɪ', to: 'ɛ', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_vowel_17', word1: 'pool', word2: 'pull', relationType: 'minimal_pair_vowel', areSame: false, difficulty: 4,
    phonemeDifferences: [{ position: 1, from: 'u', to: 'ʊ', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_vowel_18', word1: 'caught', word2: 'cot', relationType: 'minimal_pair_vowel', areSame: false, difficulty: 4,
    phonemeDifferences: [{ position: 1, from: 'ɔ', to: 'ɑ', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'mp_onset_multisyllable_8', word1: 'rabbit', word2: 'rapid', relationType: 'minimal_pair_coda', areSame: false, difficulty: 4,
    phonemeDifferences: [{ position: 5, from: 't', to: 'd', featureDiff: 1 }],
    syllableCount1: 2, syllableCount2: 2, isNonword: false },
  { id: 'mp_onset_multisyllable_9', word1: 'palace', word2: 'malice', relationType: 'minimal_pair_onset', areSame: false, difficulty: 4,
    phonemeDifferences: [{ position: 0, from: 'p', to: 'm', featureDiff: 2 }],
    syllableCount1: 2, syllableCount2: 2, isNonword: false },
  { id: 'mp_onset_multisyllable_10', word1: 'finger', word2: 'singer', relationType: 'minimal_pair_onset', areSame: false, difficulty: 4,
    phonemeDifferences: [{ position: 0, from: 'f', to: 's', featureDiff: 2 }],
    syllableCount1: 2, syllableCount2: 2, isNonword: false },
  { id: 'rhyme_9', word1: 'plate', word2: 'gate', relationType: 'rhyme', areSame: true, difficulty: 4,
    phonemeDifferences: [], syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'rhyme_10', word1: 'frost', word2: 'lost', relationType: 'rhyme', areSame: true, difficulty: 4,
    phonemeDifferences: [], syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'rhyme_11', word1: 'spring', word2: 'string', relationType: 'rhyme', areSame: true, difficulty: 4,
    phonemeDifferences: [], syllableCount1: 1, syllableCount2: 1, isNonword: false },
  { id: 'rhyme_multisyllable_2', word1: 'butter', word2: 'matter', relationType: 'rhyme', areSame: true, difficulty: 4,
    phonemeDifferences: [], syllableCount1: 2, syllableCount2: 2, isNonword: false },
  { id: 'rhyme_multisyllable_3', word1: 'mountain', word2: 'fountain', relationType: 'rhyme', areSame: true, difficulty: 4,
    phonemeDifferences: [], syllableCount1: 2, syllableCount2: 2, isNonword: false },
  { id: 'unrelated_3', word1: 'truck', word2: 'leaf', relationType: 'unrelated', areSame: false, difficulty: 4,
    phonemeDifferences: [], syllableCount1: 1, syllableCount2: 1, isNonword: false },

  // --- d5 (+14): nonwords + minimal voicing/place contrasts ---
  { id: 'mp_nonword_7', word1: 'shup', word2: 'chup', relationType: 'minimal_pair_onset', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'ʃ', to: 'tʃ', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_8', word1: 'mip', word2: 'nip', relationType: 'minimal_pair_onset', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'm', to: 'n', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_9', word1: 'wek', word2: 'wet', relationType: 'minimal_pair_coda', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 2, from: 'k', to: 't', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_10', word1: 'tib', word2: 'tip', relationType: 'minimal_pair_coda', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 2, from: 'b', to: 'p', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_11', word1: 'fave', word2: 'thave', relationType: 'minimal_pair_onset', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'f', to: 'θ', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_12', word1: 'glim', word2: 'klim', relationType: 'minimal_pair_onset', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'g', to: 'k', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_13', word1: 'snib', word2: 'snid', relationType: 'minimal_pair_coda', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 3, from: 'b', to: 'd', featureDiff: 2 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_14', word1: 'broz', word2: 'pros', relationType: 'minimal_pair_onset', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'b', to: 'p', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_15', word1: 'zath', word2: 'sath', relationType: 'minimal_pair_onset', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'z', to: 's', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_16', word1: 'jode', word2: 'chode', relationType: 'minimal_pair_onset', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'dʒ', to: 'tʃ', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_17', word1: 'prog', word2: 'prok', relationType: 'minimal_pair_coda', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 3, from: 'g', to: 'k', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_18', word1: 'lub', word2: 'lubs', relationType: 'minimal_pair_coda', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 3, from: '', to: 's', featureDiff: 2 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_19', word1: 'spom', word2: 'spon', relationType: 'minimal_pair_coda', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 3, from: 'm', to: 'n', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
  { id: 'mp_nonword_20', word1: 'flick', word2: 'thlick', relationType: 'minimal_pair_onset', areSame: false, difficulty: 5,
    phonemeDifferences: [{ position: 0, from: 'f', to: 'θ', featureDiff: 1 }],
    syllableCount1: 1, syllableCount2: 1, isNonword: true },
];

/**
 * Get trials for a given difficulty level
 */
export function getTrialsForDifficulty(level: number, count: number = 10): PhonologicalTrial[] {
  const pool = PHONO_TRIALS.filter(t => t.difficulty === level);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get mixed trials from current and adjacent levels
 */
export function getMixedTrials(
  targetLevel: number,
  totalTrials: number,
  options?: { focusPhonemes?: string[] }
): PhonologicalTrial[] {
  const currentLevel = PHONO_TRIALS.filter(t => t.difficulty === targetLevel);
  const easierLevel = targetLevel > 1 
    ? PHONO_TRIALS.filter(t => t.difficulty === targetLevel - 1)
    : [];
  const harderLevel = targetLevel < 5
    ? PHONO_TRIALS.filter(t => t.difficulty === targetLevel + 1)
    : [];
  
  let pool = [...currentLevel, ...easierLevel, ...harderLevel];
  
  // Phoneme-targeted sorting: prioritize trials containing focus phonemes
  const focusPhonemes = options?.focusPhonemes;
  if (focusPhonemes && focusPhonemes.length > 0) {
    const normalizedFocus = new Set(focusPhonemes.map(p => p.replace(/\//g, '').toLowerCase()));
    
    pool.sort((a, b) => {
      const aScore = countPhonemeOverlap(a, normalizedFocus);
      const bScore = countPhonemeOverlap(b, normalizedFocus);
      if (aScore !== bScore) return bScore - aScore; // Higher overlap first
      return Math.random() - 0.5; // Random among equal
    });
  } else {
    pool = pool.sort(() => Math.random() - 0.5);
  }
  
  return pool.slice(0, Math.min(totalTrials, pool.length));
}

/**
 * Count how many focus phonemes appear in a trial's phoneme differences
 */
function countPhonemeOverlap(
  trial: PhonologicalTrial,
  normalizedFocus: Set<string>
): number {
  let count = 0;
  for (const diff of trial.phonemeDifferences) {
    const from = diff.from.replace(/\//g, '').toLowerCase();
    const to = diff.to.replace(/\//g, '').toLowerCase();
    if (normalizedFocus.has(from) || normalizedFocus.has(to)) count++;
  }
  return count;
}

/**
 * Get trials filtered by target words (for targeted practice)
 */
export function getTrialsByTargetWords(targetWords: string[], count: number = 10): PhonologicalTrial[] {
  const lowerTargets = targetWords.map(w => w.toLowerCase());
  const matchingTrials = PHONO_TRIALS.filter(t => 
    lowerTargets.includes(t.word1.toLowerCase()) || 
    lowerTargets.includes(t.word2.toLowerCase())
  );
  
  if (matchingTrials.length === 0) {
    // Fallback to level 1 trials if no matches
    return getMixedTrials(1, count);
  }
  
  // Repeat trials if needed to fill count
  const repeated: PhonologicalTrial[] = [];
  while (repeated.length < count && repeated.length < matchingTrials.length * 3) {
    repeated.push(...[...matchingTrials].sort(() => Math.random() - 0.5));
  }
  return repeated.slice(0, count);
}

/**
 * Analyze phoneme-level error patterns
 */
export function analyzePhonemeErrors(
  incorrectTrials: PhonologicalTrial[]
): {
  weakestPosition: 'onset' | 'nucleus' | 'coda' | null;
  confusableContrasts: Array<{ from: string; to: string; count: number }>;
  weakestRelationType: PhonemeRelationType | null;
} {
  if (incorrectTrials.length === 0) {
    return {
      weakestPosition: null,
      confusableContrasts: [],
      weakestRelationType: null,
    };
  }

  // Track errors by position
  const positionErrors: Record<string, number> = {};
  const contrastErrors: Map<string, number> = new Map();
  const relationTypeErrors: Map<PhonemeRelationType, number> = new Map();

  for (const trial of incorrectTrials) {
    // Count relation type errors
    const currentCount = relationTypeErrors.get(trial.relationType) || 0;
    relationTypeErrors.set(trial.relationType, currentCount + 1);

    // Analyze phoneme differences
    for (const diff of trial.phonemeDifferences) {
      // Position tracking (approximate)
      const pos = diff.position === 0 ? 'onset' 
        : diff.position === trial.word1.length - 1 ? 'coda' 
        : 'nucleus';
      
      positionErrors[pos] = (positionErrors[pos] || 0) + 1;

      // Track confusable contrasts
      const key = `${diff.from}->${diff.to}`;
      contrastErrors.set(key, (contrastErrors.get(key) || 0) + 1);
    }
  }

  // Find weakest position
  const weakestPosition = Object.entries(positionErrors).reduce(
    (max, [pos, count]) => count > max.count ? { pos, count } : max,
    { pos: null, count: 0 }
  ).pos as 'onset' | 'nucleus' | 'coda' | null;

  // Find most confusable contrasts
  const confusableContrasts = Array.from(contrastErrors.entries())
    .map(([key, count]) => {
      const [from, to] = key.split('->');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Find weakest relation type
  const weakestRelationType = Array.from(relationTypeErrors.entries())
    .reduce(
      (max, [type, count]) => count > max.count ? { type, count } : max,
      { type: null as PhonemeRelationType | null, count: 0 }
    ).type;

  return {
    weakestPosition,
    confusableContrasts,
    weakestRelationType,
  };
}
