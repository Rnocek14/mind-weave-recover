/**
 * Phoneme-to-Word Mapping for Targeted Practice
 * 
 * Maps each word in the photo bank to its constituent phonemes,
 * enabling phoneme-targeted word selection for personalized therapy.
 */

// IPA phoneme sequences for each target word
// Using simplified phonemic representation matching Azure output
// EXPANDED: 80+ words for phoneme-based audio trials
export const WORD_PHONEME_MAP: Record<string, string[]> = {
  // ====================
  // PHOTO BANK WORDS (have images)
  // ====================
  'house': ['/h/', '/aʊ/', '/s/'],
  'cup': ['/k/', '/ʌ/', '/p/'],
  'dog': ['/d/', '/ɔ/', '/g/'],
  'apple': ['/æ/', '/p/', '/l/'],
  'ball': ['/b/', '/ɔ/', '/l/'],
  'book': ['/b/', '/ʊ/', '/k/'],
  'tree': ['/t/', '/r/', '/i/'],
  'chair': ['/tʃ/', '/ɛ/', '/r/'],
  'phone': ['/f/', '/oʊ/', '/n/'],
  'bird': ['/b/', '/ɜ/', '/r/', '/d/'],
  'bread': ['/b/', '/r/', '/ɛ/', '/d/'],
  'car': ['/k/', '/ɑ/', '/r/'],
  'shoe': ['/ʃ/', '/u/'],
  'door': ['/d/', '/ɔ/', '/r/'],
  'key': ['/k/', '/i/'],
  'flower': ['/f/', '/l/', '/aʊ/', '/ɚ/'],
  'spoon': ['/s/', '/p/', '/u/', '/n/'],
  'watch': ['/w/', '/ɑ/', '/tʃ/'],
  'hand': ['/h/', '/æ/', '/n/', '/d/'],
  'eye': ['/aɪ/'],
  'cat': ['/k/', '/æ/', '/t/'],
  'bike': ['/b/', '/aɪ/', '/k/'],
  'nose': ['/n/', '/oʊ/', '/z/'],
  
  // ====================
  // AUDIO-ONLY WORDS (no images - organized by initial phoneme)
  // ====================
  
  // /k/ - velar plosive (common struggle sound)
  'cake': ['/k/', '/eɪ/', '/k/'],
  'cart': ['/k/', '/ɑ/', '/r/', '/t/'],
  'coat': ['/k/', '/oʊ/', '/t/'],
  'coin': ['/k/', '/ɔɪ/', '/n/'],
  'cook': ['/k/', '/ʊ/', '/k/'],
  'corn': ['/k/', '/ɔ/', '/r/', '/n/'],
  'cow': ['/k/', '/aʊ/'],
  'king': ['/k/', '/ɪ/', '/ŋ/'],
  'kite': ['/k/', '/aɪ/', '/t/'],
  
  // /k/ final position
  'back': ['/b/', '/æ/', '/k/'],
  'duck': ['/d/', '/ʌ/', '/k/'],
  'rock': ['/r/', '/ɑ/', '/k/'],
  'sock': ['/s/', '/ɑ/', '/k/'],
  'milk': ['/m/', '/ɪ/', '/l/', '/k/'],
  'lock': ['/l/', '/ɑ/', '/k/'],
  'neck': ['/n/', '/ɛ/', '/k/'],
  'clock': ['/k/', '/l/', '/ɑ/', '/k/'],
  
  // /s/ - alveolar fricative  
  'sun': ['/s/', '/ʌ/', '/n/'],
  'star': ['/s/', '/t/', '/ɑ/', '/r/'],
  'soup': ['/s/', '/u/', '/p/'],
  'salt': ['/s/', '/ɔ/', '/l/', '/t/'],
  'sand': ['/s/', '/æ/', '/n/', '/d/'],
  'sea': ['/s/', '/i/'],
  'seat': ['/s/', '/i/', '/t/'],
  'sign': ['/s/', '/aɪ/', '/n/'],
  'soap': ['/s/', '/oʊ/', '/p/'],
  
  // /s/ final position
  'bus': ['/b/', '/ʌ/', '/s/'],
  'dress': ['/d/', '/r/', '/ɛ/', '/s/'],
  'glass': ['/g/', '/l/', '/æ/', '/s/'],
  'grass': ['/g/', '/r/', '/æ/', '/s/'],
  'rice': ['/r/', '/aɪ/', '/s/'],
  'ice': ['/aɪ/', '/s/'],
  
  // /r/ - alveolar approximant (very common struggle)
  'rain': ['/r/', '/eɪ/', '/n/'],
  'red': ['/r/', '/ɛ/', '/d/'],
  'ring': ['/r/', '/ɪ/', '/ŋ/'],
  'road': ['/r/', '/oʊ/', '/d/'],
  'room': ['/r/', '/u/', '/m/'],
  'rope': ['/r/', '/oʊ/', '/p/'],
  'rose': ['/r/', '/oʊ/', '/z/'],
  'rug': ['/r/', '/ʌ/', '/g/'],
  'run': ['/r/', '/ʌ/', '/n/'],
  
  // /l/ - lateral approximant
  'lamp': ['/l/', '/æ/', '/m/', '/p/'],
  'leaf': ['/l/', '/i/', '/f/'],
  'leg': ['/l/', '/ɛ/', '/g/'],
  'light': ['/l/', '/aɪ/', '/t/'],
  'lion': ['/l/', '/aɪ/', '/ə/', '/n/'],
  'lip': ['/l/', '/ɪ/', '/p/'],
  'love': ['/l/', '/ʌ/', '/v/'],
  'lunch': ['/l/', '/ʌ/', '/n/', '/tʃ/'],
  
  // /ʃ/ - postalveolar fricative (sh sound)
  'ship': ['/ʃ/', '/ɪ/', '/p/'],
  'shop': ['/ʃ/', '/ɑ/', '/p/'],
  'shirt': ['/ʃ/', '/ɜ/', '/r/', '/t/'],
  'sheep': ['/ʃ/', '/i/', '/p/'],
  'shell': ['/ʃ/', '/ɛ/', '/l/'],
  'shine': ['/ʃ/', '/aɪ/', '/n/'],
  'shower': ['/ʃ/', '/aʊ/', '/ɚ/'],
  
  // /tʃ/ - postalveolar affricate (ch sound)
  'cheese': ['/tʃ/', '/i/', '/z/'],
  'check': ['/tʃ/', '/ɛ/', '/k/'],
  'chest': ['/tʃ/', '/ɛ/', '/s/', '/t/'],
  'chin': ['/tʃ/', '/ɪ/', '/n/'],
  'chip': ['/tʃ/', '/ɪ/', '/p/'],
  'church': ['/tʃ/', '/ɜ/', '/r/', '/tʃ/'],
  'chicken': ['/tʃ/', '/ɪ/', '/k/', '/ə/', '/n/'],
  
  // /dʒ/ - voiced postalveolar affricate (j sound)
  'jar': ['/dʒ/', '/ɑ/', '/r/'],
  'juice': ['/dʒ/', '/u/', '/s/'],
  'jump': ['/dʒ/', '/ʌ/', '/m/', '/p/'],
  'jacket': ['/dʒ/', '/æ/', '/k/', '/ɪ/', '/t/'],
  'jug': ['/dʒ/', '/ʌ/', '/g/'],
  'jet': ['/dʒ/', '/ɛ/', '/t/'],
  
  // /ʒ/ - voiced postalveolar fricative (zh sound as in "measure")
  'measure': ['/m/', '/ɛ/', '/ʒ/', '/ɚ/'],
  'treasure': ['/t/', '/r/', '/ɛ/', '/ʒ/', '/ɚ/'],
  'beige': ['/b/', '/eɪ/', '/ʒ/'],
  'garage': ['/g/', '/ə/', '/r/', '/ɑ/', '/ʒ/'],
  'vision': ['/v/', '/ɪ/', '/ʒ/', '/ə/', '/n/'],
  'television': ['/t/', '/ɛ/', '/l/', '/ə/', '/v/', '/ɪ/', '/ʒ/', '/ə/', '/n/'],
  'pleasure': ['/p/', '/l/', '/ɛ/', '/ʒ/', '/ɚ/'],
  
  // /j/ - palatal approximant (y sound as in "yes")
  'yellow': ['/j/', '/ɛ/', '/l/', '/oʊ/'],
  'yes': ['/j/', '/ɛ/', '/s/'],
  'yard': ['/j/', '/ɑ/', '/r/', '/d/'],
  'year': ['/j/', '/ɪ/', '/r/'],
  'you': ['/j/', '/u/'],
  'young': ['/j/', '/ʌ/', '/ŋ/'],
  'yawn': ['/j/', '/ɔ/', '/n/'],
  'yell': ['/j/', '/ɛ/', '/l/'],
  
  // /θ/ - voiceless dental fricative (th as in "think")
  'thank': ['/θ/', '/æ/', '/ŋ/', '/k/'],
  'thin': ['/θ/', '/ɪ/', '/n/'],
  'think': ['/θ/', '/ɪ/', '/ŋ/', '/k/'],
  'three': ['/θ/', '/r/', '/i/'],
  'thumb': ['/θ/', '/ʌ/', '/m/'],
  'tooth': ['/t/', '/u/', '/θ/'],
  
  // /b/ - bilabial plosive
  'bed': ['/b/', '/ɛ/', '/d/'],
  'bell': ['/b/', '/ɛ/', '/l/'],
  'boat': ['/b/', '/oʊ/', '/t/'],
  'bone': ['/b/', '/oʊ/', '/n/'],
  'bowl': ['/b/', '/oʊ/', '/l/'],
  'box': ['/b/', '/ɑ/', '/k/', '/s/'],
  'boy': ['/b/', '/ɔɪ/'],
  'bug': ['/b/', '/ʌ/', '/g/'],
  
  // /f/ - labiodental fricative
  'face': ['/f/', '/eɪ/', '/s/'],
  'fan': ['/f/', '/æ/', '/n/'],
  'fish': ['/f/', '/ɪ/', '/ʃ/'],
  'flag': ['/f/', '/l/', '/æ/', '/g/'],
  'food': ['/f/', '/u/', '/d/'],
  'foot': ['/f/', '/ʊ/', '/t/'],
  'fork': ['/f/', '/ɔ/', '/r/', '/k/'],
  'frog': ['/f/', '/r/', '/ɑ/', '/g/'],
  
  // /g/ - velar plosive
  'game': ['/g/', '/eɪ/', '/m/'],
  'gate': ['/g/', '/eɪ/', '/t/'],
  'gift': ['/g/', '/ɪ/', '/f/', '/t/'],
  'girl': ['/g/', '/ɜ/', '/r/', '/l/'],
  'goat': ['/g/', '/oʊ/', '/t/'],
  'gold': ['/g/', '/oʊ/', '/l/', '/d/'],
  'grape': ['/g/', '/r/', '/eɪ/', '/p/'],
  'green': ['/g/', '/r/', '/i/', '/n/'],
  
  // /m/ - bilabial nasal
  'man': ['/m/', '/æ/', '/n/'],
  'map': ['/m/', '/æ/', '/p/'],
  'meat': ['/m/', '/i/', '/t/'],
  'moon': ['/m/', '/u/', '/n/'],
  'mouse': ['/m/', '/aʊ/', '/s/'],
  'mouth': ['/m/', '/aʊ/', '/θ/'],
  
  // /n/ - alveolar nasal
  'name': ['/n/', '/eɪ/', '/m/'],
  'net': ['/n/', '/ɛ/', '/t/'],
  'night': ['/n/', '/aɪ/', '/t/'],
  'nurse': ['/n/', '/ɜ/', '/r/', '/s/'],
  'nut': ['/n/', '/ʌ/', '/t/'],
  
  // /p/ - bilabial plosive
  'pan': ['/p/', '/æ/', '/n/'],
  'park': ['/p/', '/ɑ/', '/r/', '/k/'],
  'pen': ['/p/', '/ɛ/', '/n/'],
  'pig': ['/p/', '/ɪ/', '/g/'],
  'pie': ['/p/', '/aɪ/'],
  'plant': ['/p/', '/l/', '/æ/', '/n/', '/t/'],
  'plate': ['/p/', '/l/', '/eɪ/', '/t/'],
  'pool': ['/p/', '/u/', '/l/'],
  
  // /t/ - alveolar plosive
  'table': ['/t/', '/eɪ/', '/b/', '/l/'],
  'tail': ['/t/', '/eɪ/', '/l/'],
  'tea': ['/t/', '/i/'],
  'tent': ['/t/', '/ɛ/', '/n/', '/t/'],
  'top': ['/t/', '/ɑ/', '/p/'],
  'town': ['/t/', '/aʊ/', '/n/'],
  'train': ['/t/', '/r/', '/eɪ/', '/n/'],
  'truck': ['/t/', '/r/', '/ʌ/', '/k/'],
  
  // /w/ - labial-velar approximant
  'wall': ['/w/', '/ɔ/', '/l/'],
  'water': ['/w/', '/ɔ/', '/t/', '/ɚ/'],
  'wave': ['/w/', '/eɪ/', '/v/'],
  'web': ['/w/', '/ɛ/', '/b/'],
  'wheel': ['/w/', '/i/', '/l/'],
  'wind': ['/w/', '/ɪ/', '/n/', '/d/'],
  'window': ['/w/', '/ɪ/', '/n/', '/d/', '/oʊ/'],
  'wing': ['/w/', '/ɪ/', '/ŋ/'],
  'wood': ['/w/', '/ʊ/', '/d/'],
  'worm': ['/w/', '/ɜ/', '/r/', '/m/'],
};

// Normalize Azure phoneme output to match our map
// Azure uses ARPABET-style phonemes, we convert to IPA-like
export const AZURE_TO_IPA: Record<string, string> = {
  'aa': '/ɑ/',
  'ae': '/æ/',
  'ah': '/ʌ/',
  'ao': '/ɔ/',
  'aw': '/aʊ/',
  'ax': '/ə/', // reduced vowel (schwa)
  'ay': '/aɪ/',
  'b': '/b/',
  'ch': '/tʃ/',
  'd': '/d/',
  'dh': '/ð/',
  'eh': '/ɛ/',
  'er': '/ɜ/',
  'ey': '/eɪ/',
  'f': '/f/',
  'g': '/g/',
  'hh': '/h/',
  'ih': '/ɪ/',
  'iy': '/i/',
  'jh': '/dʒ/',
  'k': '/k/',
  'l': '/l/',
  'm': '/m/',
  'n': '/n/',
  'ng': '/ŋ/',
  'ow': '/oʊ/',
  'oy': '/ɔɪ/',
  'p': '/p/',
  'r': '/r/',
  's': '/s/',
  'sh': '/ʃ/',
  't': '/t/',
  'th': '/θ/',
  'uh': '/ʊ/',
  'uw': '/u/',
  'v': '/v/',
  'w': '/w/',
  'y': '/j/',
  'z': '/z/',
  'zh': '/ʒ/',
  // Variations with stress markers (Azure sometimes includes these)
  'ix': '/ɪ/',
};

/**
 * Get all words that contain a specific phoneme
 */
export function getWordsContainingPhoneme(phoneme: string): string[] {
  const normalizedPhoneme = normalizePhoneme(phoneme);
  return Object.entries(WORD_PHONEME_MAP)
    .filter(([_, phonemes]) => 
      phonemes.some(p => normalizePhoneme(p) === normalizedPhoneme)
    )
    .map(([word]) => word);
}

/**
 * Get all words containing ANY of the specified phonemes
 */
export function getWordsContainingPhonemes(phonemes: string[]): string[] {
  const normalizedPhonemes = new Set(phonemes.map(normalizePhoneme));
  const wordSet = new Set<string>();
  
  for (const [word, wordPhonemes] of Object.entries(WORD_PHONEME_MAP)) {
    for (const phoneme of wordPhonemes) {
      if (normalizedPhonemes.has(normalizePhoneme(phoneme))) {
        wordSet.add(word);
        break;
      }
    }
  }
  
  return Array.from(wordSet);
}

/**
 * Get words prioritized by how many struggling phonemes they contain
 * Returns words sorted by number of struggling phonemes (descending)
 */
export function getWordsByPhonemeOverlap(
  strugglingPhonemes: string[],
  limit: number = 10
): { word: string; matchingPhonemes: string[]; matchCount: number }[] {
  const normalizedStruggling = new Set(strugglingPhonemes.map(normalizePhoneme));
  
  const results: { word: string; matchingPhonemes: string[]; matchCount: number }[] = [];
  
  for (const [word, wordPhonemes] of Object.entries(WORD_PHONEME_MAP)) {
    const matching = wordPhonemes.filter(p => 
      normalizedStruggling.has(normalizePhoneme(p))
    );
    
    if (matching.length > 0) {
      results.push({
        word,
        matchingPhonemes: matching,
        matchCount: matching.length,
      });
    }
  }
  
  // Sort by match count descending, then alphabetically
  results.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return a.word.localeCompare(b.word);
  });
  
  return results.slice(0, limit);
}

// Rhotic vowel equivalents - treat these as the same sound
const RHOTIC_EQUIVALENTS: Record<string, string> = {
  '/ɚ/': '/ɜ/',  // schwa-r → open-mid central
  '/ɝ/': '/ɜ/',  // stressed schwa-r → open-mid central
  '/ɹ/': '/r/',  // alveolar approximant → simple r
};

// Dev-only cache to prevent log spam for missing words
const missingWordLog = new Set<string>();

/**
 * Get phoneme coverage stats for dev monitoring
 * Returns % of target words that have phoneme mappings
 */
export function getPhonemeMapCoverage(targetWords: string[]): {
  coverage: number;
  mapped: number;
  total: number;
  unmapped: string[];
} {
  const mapped = targetWords.filter(w => WORD_PHONEME_MAP[w.toLowerCase()]);
  const unmapped = targetWords.filter(w => !WORD_PHONEME_MAP[w.toLowerCase()]);
  return {
    coverage: targetWords.length > 0 ? (mapped.length / targetWords.length) * 100 : 0,
    mapped: mapped.length,
    total: targetWords.length,
    unmapped,
  };
}

/**
 * Dev-only: Export unmapped targets as JSON for easy bulk completion
 * Call from console: window.__exportUnmappedPhonemes?.()
 */
export function exportUnmappedPhonemes(targetWords: string[]): void {
  const { coverage, unmapped } = getPhonemeMapCoverage(targetWords);
  
  // Generate skeleton map for easy paste-and-fill (empty arrays to avoid accidental shipping of placeholders)
  const skeleton = Object.fromEntries(
    unmapped.map(w => [w.toLowerCase(), [] as string[]])
  );
  
  const payload = {
    generatedAt: new Date().toISOString(),
    coveragePercent: coverage.toFixed(1),
    unmappedCount: unmapped.length,
    unmapped,
    skeletonMap: skeleton,
    note: "Fill arrays with IPA like ['/k/', '/æ/', '/t/']",
  };
  
  console.log('[PhonemeMap] Unmapped targets export:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('[PhonemeMap] Skeleton map (copy & fill):');
  console.log(JSON.stringify(skeleton, null, 2));
}

// Expose to window in dev for console access
if (import.meta.env.DEV) {
  (window as any).__exportUnmappedPhonemes = () => {
    // Dynamic import to avoid circular dependency
    import('@/data/photoBank').then(({ PHOTO_BANK }) => {
      exportUnmappedPhonemes(PHOTO_BANK.map(p => p.target));
    });
  };
}

// Note: PHOTO_BANK coverage logging happens in photoBank.ts to avoid circular imports

/**
 * Normalize phoneme notation for comparison
 * Handles Azure ARPABET vs IPA differences
 * Azure uses stress digits (AH0, AE1) that need to be stripped
 */
export function normalizePhoneme(phoneme: string): string {
  // Step 1: Remove slashes, lowercase, strip digits AND non-letters
  const clean = phoneme
    .replace(/\//g, '')
    .toLowerCase()
    .replace(/[0-9]/g, '')
    .replace(/[^a-zæɑɔʌəɛɪʊɜɚɝʃʒθðŋɹ]/g, ''); // Keep IPA chars
  
  // Step 2: Handle empty result (malformed input) - return safe fallback
  if (!clean) {
    return phoneme.startsWith('/') ? phoneme.toLowerCase() : `/${phoneme.toLowerCase()}/`;
  }
  
  // Step 3: Map ARPABET to IPA (must happen AFTER stripping)
  let result: string;
  if (AZURE_TO_IPA[clean]) {
    result = AZURE_TO_IPA[clean];
  } else if (phoneme.startsWith('/')) {
    // Already in IPA format
    result = phoneme.toLowerCase();
  } else {
    // Wrap in slashes for IPA format
    result = `/${clean}/`;
  }
  
  // Step 3: Normalize rhotic variants to single bucket
  return RHOTIC_EQUIVALENTS[result] || result;
}

/**
 * Check if a word contains a specific phoneme
 * Returns false (not error) for unmapped words to avoid breaking selection
 */
export function wordContainsPhoneme(word: string, phoneme: string): boolean {
  const wordLower = word.toLowerCase();
  const phonemes = WORD_PHONEME_MAP[wordLower];
  if (!phonemes) {
    // Dev-only logging with spam prevention
    if (import.meta.env.DEV && !missingWordLog.has(wordLower)) {
      missingWordLog.add(wordLower);
      console.debug(`[PhonemeMap] Word "${word}" not in WORD_PHONEME_MAP - consider adding`);
    }
    return false;
  }
  
  const normalizedPhoneme = normalizePhoneme(phoneme);
  return phonemes.some(p => normalizePhoneme(p) === normalizedPhoneme);
}

/**
 * Count how many unique focus phonemes a word contains
 * Used for weighted sorting (more matches = higher priority)
 */
export function countPhonemeMatches(word: string, focusPhonemes: string[]): number {
  const wordLower = word.toLowerCase();
  const phonemes = WORD_PHONEME_MAP[wordLower];
  if (!phonemes || focusPhonemes.length === 0) return 0;
  
  // Use Sets to count unique matches only (no duplicates)
  const normalizedFocus = new Set(focusPhonemes.map(normalizePhoneme));
  const wordNorm = new Set(phonemes.map(normalizePhoneme));
  
  let count = 0;
  for (const p of normalizedFocus) {
    if (wordNorm.has(p)) count++;
  }
  return count;
}
