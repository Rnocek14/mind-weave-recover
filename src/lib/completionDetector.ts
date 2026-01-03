/**
 * Completion Detector
 * 
 * Detects whether an utterance reached a natural end.
 * This is structural analysis, not semantic - we're not judging
 * whether the "right" thing was said, just whether a thought finished.
 */

import type { MicroFluencyAnalysis } from './microFluencyAnalyzer';

// =============================================================================
// Types
// =============================================================================

export interface CompletionResult {
  isComplete: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

// =============================================================================
// Configuration
// =============================================================================

// Words/phrases that typically end thoughts
const ENDING_SIGNALS = [
  // Conclusive endings
  /\b(so|anyway|that's it|that's all|done|yeah|yep|right|okay)\s*[.!?]?\s*$/i,
  // Natural sentence endings (declarative)
  /[.!]\s*$/,
  // Question endings
  /[?]\s*$/,
];

// Words that suggest continuation was intended but didn't happen
const TRAILING_SIGNALS = [
  /\b(and|but|so|because|then|if|when|although|however)\s*\.{0,3}\s*$/i,
  /\.\.\.\s*$/,
  /\b(um|uh|er)\s*$/i,
];

// Minimum word count for a "complete" thought
const MIN_COMPLETE_WORDS = 3;

// Clause indicators (suggest structure)
const CLAUSE_MARKERS = [
  'because', 'so', 'but', 'and', 'then', 'when', 'if', 'although',
  'however', 'therefore', 'since', 'while', 'after', 'before'
];

// =============================================================================
// Main Detector
// =============================================================================

export function detectUtteranceComplete(
  transcript: string | null,
  fluencyMetrics?: MicroFluencyAnalysis | null
): CompletionResult {
  if (!transcript || transcript.trim().length === 0) {
    return {
      isComplete: false,
      confidence: 'high',
      reasons: ['No speech detected'],
    };
  }

  const text = transcript.trim();
  const words = text.split(/\s+/);
  const wordCount = words.length;
  const reasons: string[] = [];

  // ==========================================================================
  // Check for trailing off (incomplete)
  // ==========================================================================
  
  for (const pattern of TRAILING_SIGNALS) {
    if (pattern.test(text)) {
      reasons.push('Trailing off pattern detected');
      return {
        isComplete: false,
        confidence: 'high',
        reasons,
      };
    }
  }

  // ==========================================================================
  // Check for ending signals (complete)
  // ==========================================================================
  
  let hasEndingSignal = false;
  for (const pattern of ENDING_SIGNALS) {
    if (pattern.test(text)) {
      hasEndingSignal = true;
      reasons.push('Natural ending detected');
      break;
    }
  }

  // ==========================================================================
  // Word count check
  // ==========================================================================
  
  if (wordCount < MIN_COMPLETE_WORDS) {
    reasons.push(`Only ${wordCount} words (minimum: ${MIN_COMPLETE_WORDS})`);
    return {
      isComplete: false,
      confidence: 'medium',
      reasons,
    };
  }

  // ==========================================================================
  // Clause structure check (suggests complete thought)
  // ==========================================================================
  
  const hasClauseStructure = CLAUSE_MARKERS.some(marker => {
    const pattern = new RegExp(`\\b${marker}\\b`, 'i');
    return pattern.test(text);
  });
  
  if (hasClauseStructure) {
    reasons.push('Has clause structure');
  }

  // ==========================================================================
  // Fluency-based completion check
  // ==========================================================================
  
  if (fluencyMetrics) {
    // If there are phrase breaks but no trailing, likely complete
    if (fluencyMetrics.phraseBreaks.count > 0) {
      reasons.push('Has natural phrase breaks');
    }
    
    // Very long pause at end = trailing off
    if (fluencyMetrics.longestPauseMs > 4000) {
      // Check if this pause is at the end (trailing)
      // For now, assume long pauses near end are trailing
      reasons.push('Long pause detected (possible trailing)');
    }
  }

  // ==========================================================================
  // Final determination
  // ==========================================================================
  
  // Strong signals of completion
  if (hasEndingSignal && wordCount >= MIN_COMPLETE_WORDS) {
    return {
      isComplete: true,
      confidence: 'high',
      reasons,
    };
  }
  
  // Moderate signals
  if (hasClauseStructure && wordCount >= MIN_COMPLETE_WORDS) {
    return {
      isComplete: true,
      confidence: 'medium',
      reasons,
    };
  }
  
  // Enough words but no clear ending
  if (wordCount >= MIN_COMPLETE_WORDS * 2) {
    reasons.push('Sufficient length');
    return {
      isComplete: true,
      confidence: 'low',
      reasons,
    };
  }

  // Default: not enough evidence
  return {
    isComplete: false,
    confidence: 'low',
    reasons: reasons.length > 0 ? reasons : ['Insufficient completion signals'],
  };
}

// =============================================================================
// Utterance Length Categories
// =============================================================================

export type UtteranceLengthBand = 
  | 'single_word'
  | 'phrase'
  | 'simple_sentence'
  | 'compound_sentence'
  | 'multi_sentence';

export function categorizeUtteranceLength(transcript: string | null): UtteranceLengthBand {
  if (!transcript || transcript.trim().length === 0) {
    return 'single_word';
  }
  
  const text = transcript.trim();
  const words = text.split(/\s+/).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const hasClause = CLAUSE_MARKERS.some(m => text.toLowerCase().includes(m));
  
  if (words <= 2) return 'single_word';
  if (words <= 5) return 'phrase';
  if (sentences > 1) return 'multi_sentence';
  if (hasClause) return 'compound_sentence';
  return 'simple_sentence';
}

// =============================================================================
// Helper: Extract key content (for display/logging)
// =============================================================================

export function extractKeyContent(transcript: string | null, maxWords: number = 10): string {
  if (!transcript || transcript.trim().length === 0) {
    return '';
  }
  
  const words = transcript.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return transcript.trim();
  }
  
  return words.slice(0, maxWords).join(' ') + '...';
}
