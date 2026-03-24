/**
 * Exercise Gating & Adaptation System
 * 
 * Determines which exercises are accessible based on capability scores
 * and automatically injects appropriate adaptations.
 */

import type { CapabilityScores } from './capabilityAssessor';
import type { ExerciseConfig } from './clinicalProfileMapper';

export interface ExerciseGatingRule {
  exerciseId: string;
  minRequirements: {
    vision?: number;
    motor?: number;
    attention?: number;
  };
  reason: string;
  alternativeSuggestion?: string;
}

export interface ExerciseAdaptation {
  exerciseId: string;
  adaptations: ExerciseConfig & {
    // Additional adaptation flags
    useAudioCues?: boolean;
    eliminateText?: boolean;
    simplifiedUI?: boolean;
    extendedTimeouts?: boolean;
    largeTargets?: boolean;
    highContrast?: boolean;
    autoAdvance?: boolean;
    errorlessMode?: boolean;
    breakFrequency?: 'low' | 'medium' | 'high';
  };
  reason: string;
}

/**
 * Exercise gating rules - concrete requirements per exercise
 */
export const EXERCISE_GATING_RULES: ExerciseGatingRule[] = [
  // === MOTOR EXERCISES ===
  {
    exerciseId: 'reach-tap',
    minRequirements: { vision: 3, motor: 2, attention: 2 },
    reason: 'Requires basic visual orientation and ability to tap targets',
  },
  {
    exerciseId: 'left-side-hunt',
    minRequirements: { vision: 5, motor: 4, attention: 5 },
    reason: 'Requires sustained attention and spatial awareness',
    alternativeSuggestion: 'reach-tap',
  },
  {
    exerciseId: 'pattern-match',
    minRequirements: { vision: 5, motor: 3, attention: 5 },
    reason: 'Requires visual memory and pattern recognition',
    alternativeSuggestion: 'reach-tap',
  },

  // === SPEECH/LANGUAGE EXERCISES ===
  {
    exerciseId: 'photo-naming',
    minRequirements: { vision: 5, motor: 3, attention: 4 },
    reason: 'Requires visual object recognition and sustained attention',
    alternativeSuggestion: 'reach-tap',
  },
  {
    exerciseId: 'word-practice',
    minRequirements: { vision: 6, motor: 3, attention: 5 },
    reason: 'Requires reading comprehension and attention to phrases',
    alternativeSuggestion: 'photo-naming',
  },
  {
    exerciseId: 'phonological-awareness',
    minRequirements: { vision: 6, motor: 3, attention: 6 },
    reason: 'Requires auditory processing and phonological manipulation',
    alternativeSuggestion: 'photo-naming',
  },
  {
    exerciseId: 'semantic-features',
    minRequirements: { vision: 6, motor: 3, attention: 6 },
    reason: 'Requires semantic knowledge and sustained cognitive effort',
    alternativeSuggestion: 'photo-naming',
  },
  {
    exerciseId: 'sentence-construction',
    minRequirements: { vision: 7, motor: 4, attention: 7 },
    reason: 'Requires complex language processing and working memory',
    alternativeSuggestion: 'word-practice',
  },
];

/**
 * Check if an exercise is accessible based on capability scores
 */
export function isExerciseAccessible(
  exerciseId: string,
  scores: CapabilityScores | null
): { accessible: boolean; reason?: string; alternative?: string } {
  // If no capability assessment yet, allow all exercises (fallback to clinical gating)
  if (!scores) {
    return { accessible: true };
  }

  const rule = EXERCISE_GATING_RULES.find(r => r.exerciseId === exerciseId);
  
  // If no gating rule exists, allow by default
  if (!rule) {
    return { accessible: true };
  }

  const { minRequirements } = rule;
  
  // Check each requirement
  if (minRequirements.vision && scores.vision < minRequirements.vision) {
    return {
      accessible: false,
      reason: `Requires vision score of ${minRequirements.vision}/10 (current: ${scores.vision}/10)`,
      alternative: rule.alternativeSuggestion,
    };
  }
  
  if (minRequirements.motor && scores.motor < minRequirements.motor) {
    return {
      accessible: false,
      reason: `Requires motor score of ${minRequirements.motor}/10 (current: ${scores.motor}/10)`,
      alternative: rule.alternativeSuggestion,
    };
  }
  
  if (minRequirements.attention && scores.attention < minRequirements.attention) {
    return {
      accessible: false,
      reason: `Requires attention score of ${minRequirements.attention}/10 (current: ${scores.attention}/10)`,
      alternative: rule.alternativeSuggestion,
    };
  }

  return { accessible: true };
}

/**
 * Complete list of all known exercise slugs.
 * This is the canonical "universe" of exercises the lesson engine can select from.
 * Must stay in sync with exerciseMetadata in dailyLessonEngine.ts and EXERCISE_DOMAIN_MAP.
 */
const ALL_EXERCISE_SLUGS: string[] = [
  'reach-tap',
  'left-side-hunt',
  'pattern-match',
  'photo-naming',
  'phonological-awareness',
  'semantic-features',
  'phrase-practice',
  'sentence-construction',
  'minimal-pairs',
  'two-clues',
  'fix-sentence',
  'describe-guess',
  'conversation-partner',
  'conversation-coach',
  'detective-mind',
  'meaning-match',
  'narrative-retell',
  'abstract-compare',
  'multi-step-plan',
  'dual-load-naming',
  'thought-continuation',
  'thought-organization',
  'word-finding',
  'sentence-game',
];

/**
 * Get all accessible exercises for a given capability profile.
 * 
 * Exercises WITHOUT gating rules are allowed by default.
 * Only exercises WITH explicit gating rules that FAIL are excluded.
 */
export function getAccessibleExercises(scores: CapabilityScores | null): string[] {
  if (!scores) {
    // No assessment yet - return ALL exercises (not just gated ones)
    return [...ALL_EXERCISE_SLUGS];
  }

  // Return all exercises, filtering out only those with gating rules that fail
  return ALL_EXERCISE_SLUGS.filter(slug => 
    isExerciseAccessible(slug, scores).accessible
  );
}

/**
 * Generate exercise-specific adaptations based on capability scores
 */
export function getExerciseAdaptations(
  exerciseId: string,
  scores: CapabilityScores | null
): ExerciseAdaptation | null {
  if (!scores) return null;

  const baseAdaptations = getBaseAdaptations(scores);
  
  // Exercise-specific adaptation logic
  switch (exerciseId) {
    case 'reach-tap':
      return {
        exerciseId,
        adaptations: {
          ...baseAdaptations,
          startSize: scores.vision < 5 || scores.motor < 4 ? 120 : 80,
          timeout: scores.motor < 5 ? 5000 : scores.motor < 7 ? 3500 : 3000,
          consecutiveRequired: scores.attention < 5 ? 2 : 3,
          sessionLength: scores.attention < 5 ? 'short' : 'medium',
          breakFrequency: scores.attention < 4 ? 'high' : scores.attention < 6 ? 'medium' : 'low',
        },
        reason: 'Adapted for current motor and visual capabilities',
      };

    case 'photo-naming':
      return {
        exerciseId,
        adaptations: {
          ...baseAdaptations,
          maxChoices: scores.attention < 5 ? 2 : scores.attention < 7 ? 3 : 4,
          cueLevel: scores.attention < 5 ? 3 : scores.attention < 7 ? 2 : 1,
          timeout: scores.motor < 5 || scores.attention < 5 ? 15000 : 10000,
          enableVoice: true,
          textInstructions: scores.vision >= 6 && scores.attention >= 5,
          visualCues: scores.vision < 6,
          errorlessMode: scores.attention < 5,
          sessionLength: scores.attention < 6 ? 'short' : 'medium',
        },
        reason: 'Adapted for visual processing and attention capacity',
      };

    case 'word-practice':
      return {
        exerciseId,
        adaptations: {
          ...baseAdaptations,
          timeout: scores.motor < 5 || scores.attention < 6 ? 20000 : 15000,
          textInstructions: scores.vision >= 7 && scores.attention >= 6,
          visualCues: scores.vision < 7,
          cueLevel: scores.attention < 6 ? 3 : 2,
          sessionLength: scores.attention < 6 ? 'short' : 'medium',
          breakFrequency: scores.attention < 6 ? 'high' : 'medium',
        },
        reason: 'Adapted for language processing capacity',
      };

    case 'phonological-awareness':
      return {
        exerciseId,
        adaptations: {
          ...baseAdaptations,
          startDifficulty: scores.attention < 7 ? 1 : 2,
          cueLevel: scores.attention < 7 ? 3 : 2,
          timeout: scores.attention < 7 ? 12000 : 10000,
          textInstructions: scores.vision >= 7,
          sessionLength: scores.attention < 7 ? 'short' : 'medium',
          breakFrequency: scores.attention < 7 ? 'high' : 'medium',
        },
        reason: 'Adapted for phonological processing demands',
      };

    case 'semantic-features':
      return {
        exerciseId,
        adaptations: {
          ...baseAdaptations,
          startDifficulty: scores.attention < 7 ? 1 : 2,
          cueLevel: scores.attention < 7 ? 3 : 2,
          timeout: scores.attention < 7 ? 15000 : 12000,
          textInstructions: scores.vision >= 7,
          visualCues: scores.vision < 7,
          sessionLength: scores.attention < 7 ? 'short' : 'medium',
          breakFrequency: 'high', // Always high for semantic tasks
        },
        reason: 'Adapted for semantic processing complexity',
      };

    case 'sentence-construction':
      return {
        exerciseId,
        adaptations: {
          ...baseAdaptations,
          startDifficulty: 1, // Always start easy for sentence construction
          cueLevel: scores.attention < 8 ? 3 : 2,
          timeout: 20000, // Always extended for complex construction
          textInstructions: scores.vision >= 7,
          visualCues: true, // Always provide visual support
          sessionLength: 'short', // Always short for high cognitive load
          breakFrequency: 'high', // Frequent breaks needed
        },
        reason: 'Adapted for complex language construction demands',
      };

    case 'left-side-hunt':
      return {
        exerciseId,
        adaptations: {
          ...baseAdaptations,
          startSize: scores.vision < 6 ? 100 : 80,
          timeout: scores.motor < 6 || scores.attention < 6 ? 4000 : 3000,
          cueLevel: scores.attention < 6 ? 2 : 1,
          visualCues: scores.attention < 6,
          sessionLength: scores.attention < 6 ? 'short' : 'medium',
          breakFrequency: scores.attention < 6 ? 'high' : 'medium',
        },
        reason: 'Adapted for spatial attention and visual scanning',
      };

    case 'pattern-match':
      return {
        exerciseId,
        adaptations: {
          ...baseAdaptations,
          startDifficulty: scores.attention < 6 ? 2 : 3,
          timeout: scores.attention < 6 ? 8000 : 6000,
          cueLevel: scores.attention < 6 ? 2 : 1,
          visualCues: true,
          sessionLength: scores.attention < 6 ? 'short' : 'medium',
          breakFrequency: scores.attention < 6 ? 'high' : 'medium',
        },
        reason: 'Adapted for visual memory and attention demands',
      };

    default:
      return {
        exerciseId,
        adaptations: baseAdaptations,
        reason: 'Default capability-based adaptations applied',
      };
  }
}

/**
 * Get base adaptations that apply across all exercises
 */
function getBaseAdaptations(scores: CapabilityScores): {
  useAudioCues: boolean;
  eliminateText: boolean;
  simplifiedUI: boolean;
  extendedTimeouts: boolean;
  largeTargets: boolean;
  highContrast: boolean;
} {
  return {
    useAudioCues: scores.vision < 5,
    eliminateText: scores.vision < 6 || scores.attention < 5,
    simplifiedUI: scores.attention < 6,
    extendedTimeouts: scores.motor < 6 || scores.attention < 5,
    largeTargets: scores.vision < 6 || scores.motor < 5,
    highContrast: scores.vision < 7,
  };
}

/**
 * Get a human-readable summary of adaptations
 */
export function getAdaptationSummary(adaptations: ExerciseAdaptation): string[] {
  const summary: string[] = [];
  const { adaptations: config } = adaptations;

  if (config.largeTargets) {
    summary.push('Larger targets for easier selection');
  }
  if (config.extendedTimeouts) {
    summary.push('Extended time limits');
  }
  if (config.simplifiedUI) {
    summary.push('Simplified interface');
  }
  if (config.eliminateText) {
    summary.push('Visual-only instructions (no reading required)');
  }
  if (config.useAudioCues) {
    summary.push('Audio guidance enabled');
  }
  if (config.highContrast) {
    summary.push('High contrast display');
  }
  if (config.errorlessMode) {
    summary.push('Errorless learning mode (maximum support)');
  }
  if (config.breakFrequency === 'high') {
    summary.push('Frequent rest breaks');
  }
  if (config.sessionLength === 'short') {
    summary.push('Shortened session duration');
  }

  return summary;
}
