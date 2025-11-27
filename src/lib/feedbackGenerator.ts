/**
 * Gentle Feedback Generator for Aphasia Rehabilitation
 * 
 * Generates clinically-appropriate, encouraging feedback messages based on error classification
 * Implements errorless learning principles and Western Aphasia Battery-inspired scoring
 * 
 * Research basis:
 * - Errorless learning maximizes motivation and reduces frustration
 * - Partial credit recognizes communication intent and effort
 * - Gentle, positive feedback supports confidence building
 */

import type { ExtendedErrorType, EncouragementLevel } from '@/types/utteranceAnalysis';

// Re-export for backwards compatibility
export type { ExtendedErrorType, EncouragementLevel };

/**
 * Generate gentle, encouraging feedback message based on error type
 */
export const generateGentleFeedback = (
  errorType: ExtendedErrorType,
  targetWord: string,
  spokenWord?: string
): string => {
  switch (errorType) {
    case 'correct':
      return `That's it! Great job saying "${targetWord}"!`;
    
    case 'self_corrected':
      return `Great self-correction! You got it!`;
    
    case 'attempted':
      return `Good effort! That sounded close. The word is "${targetWord}".`;
    
    case 'circumlocution':
      return `You described it perfectly! The word for it is "${targetWord}".`;
    
    case 'phonemic_paraphasia':
      return `So close! You were going for "${targetWord}". Let's try again.`;
    
    case 'semantic_paraphasia':
      return `I can see you knew it was related! The word is "${targetWord}".`;
    
    case 'neologism':
      return `I could tell you were working hard on that one. It's "${targetWord}".`;
    
    case 'unrelated':
      return `Let's try this one: "${targetWord}".`;
    
    case 'no_response':
      return `That's okay, take your time. It's "${targetWord}".`;
    
    case 'timeout':
      return `No rush! The word is "${targetWord}".`;
    
    default:
      return `The word is "${targetWord}".`;
  }
};

/**
 * Calculate encouragement score using WAB-inspired partial credit
 * 
 * Scoring philosophy:
 * - Correct/self-corrected: Full credit (demonstrates word retrieval)
 * - Circumlocution: High credit (demonstrates semantic knowledge)
 * - Attempted: Good credit (demonstrates effort and phonological approximation)
 * - Phonemic paraphasia: Moderate credit (recognizable attempt)
 * - Semantic paraphasia: Partial credit (related concept)
 * - Neologism: Minimal credit (some effort)
 * - No response/timeout/unrelated: No credit
 */
export const calculateEncouragementScore = (errorType: ExtendedErrorType): number => {
  switch (errorType) {
    case 'correct':
      return 100;  // Full success
    
    case 'self_corrected':
      return 90;   // Eventual success with self-monitoring
    
    case 'circumlocution':
      return 80;   // Demonstrates semantic knowledge and communication intent
    
    case 'attempted':
      return 70;   // Clear phonological effort, encourage retry
    
    case 'phonemic_paraphasia':
      return 66;   // WAB 2/3 credit - recognizable phonological approximation
    
    case 'semantic_paraphasia':
      return 50;   // Related concept, shows category knowledge
    
    case 'neologism':
      return 30;   // Some effort, non-word
    
    case 'unrelated':
      return 10;   // Minimal connection
    
    case 'no_response':
    case 'timeout':
      return 0;    // No output
    
    default:
      return 0;
  }
};

/**
 * Get encouragement level for UI display
 */
export const getEncouragementLevel = (score: number): {
  level: EncouragementLevel;
  color: string;
  icon: string;
} => {
  if (score >= 90) {
    return { level: 'excellent', color: 'text-green-600', icon: '🎉' };
  } else if (score >= 60) {
    return { level: 'good', color: 'text-blue-600', icon: '👍' };
  } else if (score >= 30) {
    return { level: 'fair', color: 'text-amber-600', icon: '💪' };
  } else {
    return { level: 'keep-trying', color: 'text-gray-600', icon: '🌟' };
  }
};
