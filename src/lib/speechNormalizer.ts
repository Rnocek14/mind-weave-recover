/**
 * Speech Normalizer - Filters filler words and cleans ASR output
 * Critical for stroke survivors with aphasia who use fillers naturally
 */

// Common filler words in English
const FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'ah', 'hmm', 'mm', 'mhm',
  'like', 'you know', 'i mean', 'well', 'so',
  'actually', 'basically', 'literally',
  'right', 'okay', 'ok'
]);

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
