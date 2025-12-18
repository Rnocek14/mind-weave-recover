/**
 * Phoneme-to-Word Mapping for Targeted Practice
 * 
 * Maps each word in the photo bank to its constituent phonemes,
 * enabling phoneme-targeted word selection for personalized therapy.
 */

// IPA phoneme sequences for each target word in PHOTO_BANK
// Using simplified phonemic representation matching Azure output
export const WORD_PHONEME_MAP: Record<string, string[]> = {
  // Easy words
  'house': ['/h/', '/aʊ/', '/s/'],
  'cup': ['/k/', '/ʌ/', '/p/'],
  'dog': ['/d/', '/ɔ/', '/g/'],
  'apple': ['/æ/', '/p/', '/l/'],
  'ball': ['/b/', '/ɔ/', '/l/'],
  'book': ['/b/', '/ʊ/', '/k/'],
  'tree': ['/t/', '/r/', '/i/'],
  
  // Medium words
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
  
  // Hard words
  'hand': ['/h/', '/æ/', '/n/', '/d/'],
  'eye': ['/aɪ/'],
  'cat': ['/k/', '/æ/', '/t/'],
  'bike': ['/b/', '/aɪ/', '/k/'],
  'nose': ['/n/', '/oʊ/', '/z/'],
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
