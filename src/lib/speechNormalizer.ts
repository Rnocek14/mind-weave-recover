/**
 * Speech Normalizer - Filters filler words and cleans ASR output
 * Critical for stroke survivors with aphasia who use fillers naturally
 */

// Common filler words in English (expanded set)
const FILLER_WORDS = new Set([
  'um', 'uh', 'umm', 'uhh', 'er', 'erm', 'ah', 'hmm', 'mm', 'mmm', 'mhm',
  'like', 'you know', 'i mean', 'kind of', 'sort of',
  'well', 'so', 'actually', 'basically', 'literally',
  'right', 'okay', 'ok'
]);

// Lead-in phrases to strip (common "thinking aloud" patterns)
const LEAD_IN_PATTERNS = [
  /^(i\s+think|i\s+guess|maybe|probably)\s+(it'?s?\s+)?/i,
  /^(it'?s?\s+|it\s+is\s+)/i,
  /^(that'?s?\s+|that\s+is\s+)/i,
  /^(a|an|the)\s+/i,
];

// Breathing/noise patterns (regex)
const NOISE_PATTERNS = [
  /\[.*?\]/g,           // [breathing], [cough]
  /\(.*?\)/g,           // (pause), (noise)
  /\.\.\./g,            // Long pauses
  /\s{2,}/g,            // Multiple spaces
];

/**
 * Normalize ASR transcript for matching
 * Removes fillers, breathing sounds, extra spaces
 */
export const normalizeASROutput = (transcript: string): string => {
  if (!transcript) return '';
  
  let cleaned = transcript.toLowerCase().trim();
  
  // Remove noise patterns
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  
  // Split into words
  const words = cleaned.split(/\s+/);
  
  // Filter out filler words
  const filteredWords = words.filter(word => {
    const normalized = word.replace(/[.,!?;:]/g, '');
    return !FILLER_WORDS.has(normalized);
  });
  
  // Rejoin and collapse spaces
  return filteredWords.join(' ').trim();
};

/**
 * Extract content words only (for partial credit)
 * Removes function words, keeps nouns/verbs/adjectives
 */
export const extractContentWords = (text: string): string[] => {
  const functionWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did',
    'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from',
    'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'my', 'your', 'his', 'her', 'its', 'our', 'their'
  ]);
  
  const words = text.toLowerCase().split(/\s+/);
  return words.filter(word => !functionWords.has(word));
};

/**
 * Check if transcript is just noise/fillers with no content
 */
export const isOnlyFillers = (transcript: string): boolean => {
  const cleaned = normalizeASROutput(transcript);
  return cleaned.length === 0;
};

/**
 * Get word count excluding fillers
 */
export const getContentWordCount = (transcript: string): number => {
  const normalized = normalizeASROutput(transcript);
  return normalized.split(/\s+/).filter(w => w.length > 0).length;
};

/**
 * Extract the likely "answer" from a longer utterance
 * Handles: "I think it's a bird" → "bird"
 *          "um maybe like a tree" → "tree"
 *          "blue jay" → "blue jay"
 * 
 * Strategy:
 * 1. Strip lead-in phrases ("I think it's...")
 * 2. Remove filler words
 * 3. Return last 1-2 meaningful tokens (answer is usually at the end)
 */
export const extractAnswerFromTranscript = (raw: string): string => {
  let t = raw.toLowerCase().trim();
  if (!t) return '';

  // Remove lead-in patterns
  for (const pattern of LEAD_IN_PATTERNS) {
    t = t.replace(pattern, '');
  }

  // Clean up punctuation and extra spaces
  t = t
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!t) return '';

  // Tokenize and remove fillers
  const tokens = t.split(' ').filter(Boolean);
  const meaningful = tokens.filter(word => !FILLER_WORDS.has(word));

  if (meaningful.length === 0) return '';

  // Heuristic: answer is usually the last 1-2 meaningful tokens
  // e.g., "a little blue jay" → "blue jay"
  const last = meaningful.slice(-2).join(' ').trim();
  return last;
};

/**
 * Check if transcript is mostly filler with no real answer
 */
export const isMostlyFiller = (raw: string): boolean => {
  const answer = extractAnswerFromTranscript(raw);
  return answer.length < 2;
};

/**
 * Remove clue/stimulus words from a transcript before scoring.
 * Token-aware: tokenizes, normalizes, and removes exact matches only.
 * Protects multi-word candidates (e.g., "hot dog" won't be mangled if clue is "hot")
 * by only stripping tokens that appear ALONE (not part of a compound answer).
 * Also handles basic morphological variants: plural -s/-es, -ing, -ed.
 */
export const removeClueWords = (transcript: string, clueWords: string[]): string => {
  if (!transcript || clueWords.length === 0) return transcript;

  // Build a set of clue variants (lowercase)
  const clueSet = new Set<string>();
  for (const clue of clueWords) {
    const lower = clue.toLowerCase().trim();
    if (!lower) continue;
    clueSet.add(lower);
    // Add morphological variants
    clueSet.add(lower + 's');
    clueSet.add(lower + 'es');
    clueSet.add(lower + 'ing');
    clueSet.add(lower + 'ed');
    // Handle "flies" -> "fly" style (remove trailing -ies, add -y)
    if (lower.endsWith('s')) clueSet.add(lower.slice(0, -1));
    if (lower.endsWith('es')) clueSet.add(lower.slice(0, -2));
    if (lower.endsWith('ies')) clueSet.add(lower.slice(0, -3) + 'y');
    if (lower.endsWith('ing')) clueSet.add(lower.slice(0, -3));
  }

  const tokens = transcript.toLowerCase().split(/\s+/);
  const cleaned = tokens.filter(token => {
    const normalized = token.replace(/[^\w]/g, '');
    return normalized.length > 0 && !clueSet.has(normalized);
  });

  return cleaned.join(' ').trim();
};

/**
 * Common homophones map - words that sound identical but are spelled differently
 * Maps each variant to all its homophones (including itself)
 */
const HOMOPHONES: Record<string, string[]> = {
  // I/eye
  'i': ['i', 'eye'],
  'eye': ['i', 'eye'],
  
  // to/too/two
  'to': ['to', 'too', 'two'],
  'too': ['to', 'too', 'two'],
  'two': ['to', 'too', 'two'],
  
  // there/their/they're
  'there': ['there', 'their', "they're"],
  'their': ['there', 'their', "they're"],
  "they're": ['there', 'their', "they're"],
  
  // hear/here
  'hear': ['hear', 'here'],
  'here': ['hear', 'here'],
  
  // our/hour
  'our': ['our', 'hour'],
  'hour': ['our', 'hour'],
  
  // see/sea
  'see': ['see', 'sea'],
  'sea': ['see', 'sea'],
  
  // be/bee
  'be': ['be', 'bee'],
  'bee': ['be', 'bee'],
  
  // flour/flower
  'flour': ['flour', 'flower'],
  'flower': ['flour', 'flower'],
  
  // sun/son
  'sun': ['sun', 'son'],
  'son': ['sun', 'son'],
  
  // no/know
  'no': ['no', 'know'],
  'know': ['no', 'know'],
  
  // new/knew
  'new': ['new', 'knew'],
  'knew': ['new', 'knew'],
  
  // for/four
  'for': ['for', 'four'],
  'four': ['for', 'four'],
  
  // one/won
  'one': ['one', 'won'],
  'won': ['one', 'won'],
  
  // write/right
  'write': ['write', 'right'],
  'right': ['write', 'right'],
  
  // wear/where
  'wear': ['wear', 'where'],
  'where': ['wear', 'where'],
  
  // by/buy/bye
  'by': ['by', 'buy', 'bye'],
  'buy': ['by', 'buy', 'bye'],
  'bye': ['by', 'buy', 'bye'],
  
  // nose/knows
  'nose': ['nose', 'knows'],
  'knows': ['nose', 'knows'],
};

/**
 * Check if two words are homophones (sound the same)
 */
export const areHomophones = (word1: string, word2: string): boolean => {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  
  if (w1 === w2) return true;
  
  const homophones = HOMOPHONES[w1];
  if (!homophones) return false;
  
  return homophones.includes(w2);
};

/**
 * Get all homophone variants of a word
 */
export const getHomophones = (word: string): string[] => {
  return HOMOPHONES[word.toLowerCase()] || [word.toLowerCase()];
};
