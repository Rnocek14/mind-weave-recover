/**
 * Advanced Error Classification System for Aphasia Rehabilitation
 * Classifies speech errors into clinical categories based on phonological and semantic similarity
 * 
 * Research basis:
 * - Semantic paraphasia: >0.55 semantic similarity (e.g., "cat" for "dog")
 * - Phonemic paraphasia: >50% phoneme overlap (e.g., "dok" for "dog")
 * - Neologism: Non-word with partial phonological overlap
 */

import type { LinguisticFeatures } from '@/data/photoBank';
import { getPhonemeAccuracy } from '@/lib/phonemeUtils';

export interface ErrorClassificationResult {
  errorType: 'correct' | 'semantic_paraphasia' | 'phonemic_paraphasia' | 
             'neologism' | 'unrelated' | 'no_response' | 'self_corrected' |
             'attempted' | 'circumlocution';
  confidence: number;              // 0-1
  reasoning: string;               // For logging/debugging
  needs_review: boolean;           // Flag uncertain cases
  phonological_similarity?: number; // 0-1
  phonemeAccuracy?: number;        // 0-1, pseudo-phoneme sequence accuracy
  semantic_similarity?: number;     // 0-1
  // Enhanced analysis fields
  fluencyMetrics?: {
    speechRateWpm?: number;
    pauseCount?: number;
    avgPauseDuration?: number;
    effortfulSpeech?: boolean;
  };
  circumlocutionDetected?: boolean;
  meaningAccuracy?: number;        // 0-1 overall meaning conveyed
}

export interface ErrorContext {
  trialNumber: number;
  previousErrors: string[];
  category: string;
  features?: LinguisticFeatures;
}

/**
 * Classify speech error based on ASR output and target
 * Implements research-backed thresholds (semantic >0.55, phonemic >50% overlap)
 */
export const classifySpeechError = async (
  spokenWord: string,
  targetWord: string,
  asrConfidence: number,
  context: ErrorContext,
  acousticMetrics?: {
    speechRateWpm?: number;
    pauseCount?: number;
    avgPauseDuration?: number;
  }
): Promise<ErrorClassificationResult> => {
  
  // Step 0: Check for circumlocution (multi-word description)
  const circumlocutionCheck = await detectCircumlocution(
    spokenWord, 
    targetWord, 
    context.category
  );
  
  if (circumlocutionCheck.detected) {
    return {
      errorType: 'circumlocution',
      confidence: 0.8,
      reasoning: circumlocutionCheck.reasoning,
      needs_review: false,
      circumlocutionDetected: true,
      meaningAccuracy: 0.9,
      fluencyMetrics: acousticMetrics ? {
        ...acousticMetrics,
        effortfulSpeech: detectEffortfulSpeech(acousticMetrics)
      } : undefined
    };
  }
  
  // Step 1: Handle no response or very low confidence
  if (!spokenWord || spokenWord.trim() === '' || asrConfidence < 0.3) {
    return {
      errorType: 'no_response',
      confidence: 1.0,
      reasoning: 'No intelligible output or very low ASR confidence',
      needs_review: asrConfidence > 0 && asrConfidence < 0.3
    };
  }
  
  const normalized_spoken = spokenWord.toLowerCase().trim();
  const normalized_target = targetWord.toLowerCase().trim();
  
  // Step 2: Check for exact match (correct)
  if (normalized_spoken === normalized_target) {
    return {
      errorType: 'correct',
      confidence: asrConfidence,
      reasoning: 'Exact match to target',
      needs_review: false,
      phonemeAccuracy: 1.0,
      phonological_similarity: 1.0,
      meaningAccuracy: 1.0,
      fluencyMetrics: acousticMetrics ? {
        ...acousticMetrics,
        effortfulSpeech: detectEffortfulSpeech(acousticMetrics)
      } : undefined
    };
  }
  
  // Step 3: Check for self-correction pattern
  // (e.g., "dog... cat... no... dog" - contains target after errors)
  if (normalized_spoken.includes(normalized_target) && 
      normalized_spoken !== normalized_target) {
    return {
      errorType: 'self_corrected',
      confidence: Math.max(0.7, asrConfidence),
      reasoning: 'Target word present in multi-word utterance, likely self-correction',
      needs_review: false
    };
  }
  
  // Step 4: Calculate phonological similarity
  const phonological_sim = calculatePhonologicalSimilarity(
    normalized_spoken, 
    normalized_target
  );
  
  // Step 4b: Calculate phoneme-level accuracy (v1)
  const phonemeAccuracy = getPhonemeAccuracy(normalized_spoken, normalized_target);
  
  // Step 5: Calculate semantic similarity
  const semantic_sim = await calculateSemanticSimilarity(
    normalized_spoken,
    normalized_target,
    context.category
  );
  
  // Step 6: Classify based on similarities and thresholds (MORE FORGIVING for stroke survivors)
  
  // NEW: "Attempted" tier for close phonological approximations (0.35-0.60 range)
  // This recognizes genuine effort without labeling as "wrong"
  if (phonological_sim >= 0.35 && phonological_sim < 0.60) {
    return {
      errorType: 'attempted',
      confidence: Math.min(0.85, asrConfidence + 0.15),
      reasoning: `Close phonological approximation (phonological: ${phonological_sim.toFixed(2)}, phoneme: ${phonemeAccuracy.toFixed(2)}) - good effort`,
      needs_review: false,
      phonological_similarity: phonological_sim,
      phonemeAccuracy,
      meaningAccuracy: 0.7,
      fluencyMetrics: acousticMetrics ? {
        ...acousticMetrics,
        effortfulSpeech: detectEffortfulSpeech(acousticMetrics)
      } : undefined
    };
  }
  
  // Phonemic paraphasia: >=60% phoneme overlap, very close to target
  if (phonological_sim >= 0.60) {
    const isRealWord = await isValidWord(normalized_spoken);
    return {
      errorType: 'phonemic_paraphasia',
      confidence: Math.min(0.9, asrConfidence + 0.1),
      reasoning: `High phonological overlap (${phonological_sim.toFixed(2)}, phoneme: ${phonemeAccuracy.toFixed(2)}), ${isRealWord ? 'real word' : 'non-word'}`,
      needs_review: false,
      phonological_similarity: phonological_sim,
      phonemeAccuracy,
      semantic_similarity: semantic_sim,
      meaningAccuracy: 0.66,
      fluencyMetrics: acousticMetrics ? {
        ...acousticMetrics,
        effortfulSpeech: detectEffortfulSpeech(acousticMetrics)
      } : undefined
    };
  }
  
  // Semantic paraphasia: >0.45 similarity (was 0.55), low phonological overlap
  // Lower threshold to catch more semantic relationships
  if (semantic_sim > 0.45 && phonological_sim < 0.4) {
    return {
      errorType: 'semantic_paraphasia',
      confidence: Math.min(0.85, semantic_sim),
      reasoning: `Semantically related (${semantic_sim.toFixed(2)}), close attempt`,
      needs_review: semantic_sim > 0.4 && semantic_sim < 0.5,
      semantic_similarity: semantic_sim,
      phonemeAccuracy,
      meaningAccuracy: 0.6,
      fluencyMetrics: acousticMetrics ? {
        ...acousticMetrics,
        effortfulSpeech: detectEffortfulSpeech(acousticMetrics)
      } : undefined
    };
  }
  
  // Neologism: Low phonological match, not a real word
  if (phonological_sim < 0.5 && phonological_sim > 0.2) {
    const isRealWord = await isValidWord(normalized_spoken);
    if (!isRealWord) {
      return {
        errorType: 'neologism',
        confidence: 0.7,
        reasoning: `Non-word with partial phonological overlap (${phonological_sim.toFixed(2)}, phoneme: ${phonemeAccuracy.toFixed(2)})`,
        needs_review: true,
        phonological_similarity: phonological_sim,
        phonemeAccuracy
      };
    }
  }
  
  // Unrelated: Nothing matches
  return {
    errorType: 'unrelated',
    confidence: 0.6,
    reasoning: `Low phonological (${phonological_sim.toFixed(2)}) and semantic (${semantic_sim.toFixed(2)}) similarity`,
    needs_review: asrConfidence < 0.6,
    phonological_similarity: phonological_sim,
    semantic_similarity: semantic_sim,
    phonemeAccuracy
  };
};

/**
 * Calculate phonological similarity using Levenshtein distance at character level
 * Returns 0-1 (1 = identical)
 * 
 * Research note: This is a simplified MVP approach using character-level distance.
 * V2 should use actual phoneme transcription (IPA) for more accurate similarity.
 */
export const calculatePhonologicalSimilarity = (word1: string, word2: string): number => {
  const longer = word1.length > word2.length ? word1 : word2;
  const shorter = word1.length > word2.length ? word2 : word1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(word1, word2);
  return (longer.length - distance) / longer.length;
};

/**
 * Calculate semantic similarity using rule-based category matching
 * Returns 0-1 (1 = very similar meaning)
 * 
 * MVP: Rule-based semantic similarity using predefined category groups
 * V2: Use word embedding API (OpenAI embeddings, etc.) for true semantic similarity
 */
export const calculateSemanticSimilarity = async (
  word1: string,
  word2: string,
  category: string
): Promise<number> => {
  // Semantic groups with related words
  const semanticGroups: Record<string, string[]> = {
    'animals': ['dog', 'cat', 'bird', 'fish', 'pet', 'animal', 'puppy', 'kitten', 
                'wolf', 'fox', 'eagle', 'robin', 'sparrow', 'crow', 'feline', 'tiger', 'lion'],
    'food': ['apple', 'bread', 'banana', 'fruit', 'vegetable', 'snack', 'orange', 
             'pear', 'toast', 'roll', 'bagel', 'bun'],
    'furniture': ['chair', 'table', 'desk', 'sofa', 'bed', 'stool', 'bench', 'couch'],
    'transportation': ['car', 'bike', 'bus', 'train', 'vehicle', 'truck', 'van', 
                      'suv', 'sedan', 'cycle', 'scooter', 'moped', 'trike'],
    'body': ['hand', 'eye', 'arm', 'leg', 'foot', 'head', 'wrist', 'finger', 
             'palm', 'nose', 'face', 'brow', 'lid'],
    'buildings': ['house', 'building', 'home', 'structure'],
    'kitchenware': ['cup', 'mug', 'glass', 'bowl', 'plate', 'dish'],
    'electronics': ['phone', 'tablet', 'computer', 'watch', 'remote', 'device']
  };
  
  // Sub-category to parent category mapping
  const categoryMapping: Record<string, string> = {
    'domestic_animal': 'animals',
    'flying_animal': 'animals',
    'fruit': 'food',
    'baked_good': 'food',
    'seating': 'furniture',
    'vehicle': 'transportation',
    'body_part': 'body',
    'dwelling': 'buildings',
    'drinking_vessel': 'kitchenware',
    'communication_device': 'electronics'
  };
  
  // Map fine-grained category to broad category
  const broadCategory = categoryMapping[category] || category;
  const groupForCategory = semanticGroups[broadCategory] || [];
  
  const word1InGroup = groupForCategory.includes(word1);
  const word2InGroup = groupForCategory.includes(word2);
  
  // Both words in same semantic group = high similarity
  if (word1InGroup && word2InGroup) {
    return 0.7;
  }
  
  // One word is the category name (superordinate error)
  if (word1 === broadCategory || word2 === broadCategory || 
      word1 === category || word2 === category) {
    return 0.6;
  }
  
  // Check for coordinate relationships (both animals, both furniture, etc.)
  for (const [cat, words] of Object.entries(semanticGroups)) {
    if (words.includes(word1) && words.includes(word2) && cat !== broadCategory) {
      return 0.5; // Related but different category
    }
  }
  
  // No semantic relationship detected
  return 0.1;
};

/**
 * Levenshtein distance algorithm
 * Measures the minimum number of single-character edits needed to change one word into another
 */
export const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

/**
 * Check if word exists in English dictionary
 * MVP: Simple word list check
 * V2: Use a comprehensive dictionary API
 */
export const isValidWord = async (word: string): Promise<boolean> => {
  // Expanded common word list for MVP
  const commonWords = new Set([
    // Animals
    'dog', 'cat', 'bird', 'fish', 'horse', 'cow', 'pig', 'sheep', 'chicken',
    'mouse', 'rat', 'lion', 'tiger', 'bear', 'wolf', 'fox', 'deer', 'rabbit',
    'puppy', 'kitten', 'eagle', 'robin', 'sparrow', 'crow', 'duck',
    
    // Food
    'apple', 'bread', 'banana', 'orange', 'pear', 'grape', 'milk', 'cheese',
    'meat', 'beef', 'chicken', 'fish', 'egg', 'rice', 'pasta', 'pizza',
    'cake', 'cookie', 'toast', 'roll', 'bagel', 'bun',
    
    // Objects
    'house', 'car', 'phone', 'book', 'table', 'chair', 'door', 'window',
    'cup', 'glass', 'plate', 'bowl', 'knife', 'fork', 'spoon', 'pen',
    'pencil', 'paper', 'desk', 'bed', 'lamp', 'clock', 'computer', 'bike',
    
    // Body parts
    'hand', 'eye', 'foot', 'leg', 'arm', 'head', 'face', 'nose', 'mouth',
    'ear', 'finger', 'toe', 'knee', 'elbow', 'shoulder', 'chest', 'back',
    
    // Common words
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
    'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
    'its', 'let', 'put', 'say', 'she', 'too', 'use'
  ]);
  
  return commonWords.has(word.toLowerCase());
};

/**
 * Helper function to extract error patterns from history
 * Used for adaptive cueing decisions
 */
export const analyzeErrorPatterns = (
  errorHistory: ErrorClassificationResult[]
): {
  semanticErrorCount: number;
  phonemicErrorCount: number;
  neologismCount: number;
  predominantPattern: 'semantic' | 'phonemic' | 'mixed' | 'unknown';
} => {
  const recentErrors = errorHistory.slice(-5); // Last 5 trials
  
  const semanticErrorCount = recentErrors.filter(e => 
    e.errorType === 'semantic_paraphasia'
  ).length;
  
  const phonemicErrorCount = recentErrors.filter(e => 
    e.errorType === 'phonemic_paraphasia'
  ).length;
  
  const neologismCount = recentErrors.filter(e => 
    e.errorType === 'neologism'
  ).length;
  
  let predominantPattern: 'semantic' | 'phonemic' | 'mixed' | 'unknown';
  
  if (semanticErrorCount >= 2 && semanticErrorCount > phonemicErrorCount) {
    predominantPattern = 'semantic';
  } else if ((phonemicErrorCount + neologismCount) >= 2 && 
             (phonemicErrorCount + neologismCount) > semanticErrorCount) {
    predominantPattern = 'phonemic';
  } else if (semanticErrorCount > 0 && phonemicErrorCount > 0) {
    predominantPattern = 'mixed';
  } else {
    predominantPattern = 'unknown';
  }
  
  return {
    semanticErrorCount,
    phonemicErrorCount,
    neologismCount,
    predominantPattern
  };
};

/**
 * Detect circumlocution (multi-word description of target)
 * Examples: "the thing you drink from" for "cup", "you use it to talk" for "phone"
 */
const detectCircumlocution = async (
  spokenWord: string,
  targetWord: string,
  category: string
): Promise<{ detected: boolean; reasoning: string }> => {
  const normalized = spokenWord.toLowerCase().trim();
  
  // Must be multi-word
  const words = normalized.split(/\s+/);
  if (words.length < 2) {
    return { detected: false, reasoning: 'Single word response' };
  }
  
  // Check for circumlocution phrases
  const circumlocutionPhrases = [
    'use it to', 'you use', 'something that', 'it has', 'kind of',
    'thing you', 'thing for', 'used for', 'helps you', 'lets you'
  ];
  
  const hasCircumlocutionPhrase = circumlocutionPhrases.some(phrase => 
    normalized.includes(phrase)
  );
  
  if (hasCircumlocutionPhrase) {
    return { 
      detected: true, 
      reasoning: 'Multi-word description with circumlocution phrase' 
    };
  }
  
  // Check if response contains words from same semantic category
  const semanticSim = await calculateSemanticSimilarity(
    normalized,
    targetWord,
    category
  );
  
  // If multi-word AND semantically related, likely circumlocution
  if (words.length >= 3 && semanticSim > 0.4) {
    return { 
      detected: true, 
      reasoning: 'Multi-word semantically-related description' 
    };
  }
  
  return { detected: false, reasoning: 'Not circumlocution' };
};

/**
 * Detect effortful speech based on fluency metrics
 * Indicators: slow speech rate, excessive pauses, long pause duration
 */
const detectEffortfulSpeech = (metrics: {
  speechRateWpm?: number;
  pauseCount?: number;
  avgPauseDurationMs?: number;
}): boolean => {
  const { speechRateWpm, pauseCount, avgPauseDurationMs } = metrics;
  
  // Typical conversational speech: 150-160 WPM
  // Aphasic speech often <100 WPM, severely impaired <30 WPM
  const isSlow = speechRateWpm !== undefined && speechRateWpm < 30;
  
  // Excessive pauses indicate word-finding difficulty
  const hasExcessivePauses = pauseCount !== undefined && pauseCount > 3;
  
  // Long pauses (>2 seconds) indicate effortful retrieval
  const hasLongPauses = avgPauseDurationMs !== undefined && avgPauseDurationMs > 2000;
  
  return isSlow || hasExcessivePauses || hasLongPauses;
};
