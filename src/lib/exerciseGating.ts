/**
 * Exercise Gating & Adaptation System
 * 
 * Determines which exercises are accessible based on capability scores
 * and automatically injects appropriate adaptations.
 * 
 * Exercise universe is derived from the canonical registry.
 */

import type { CapabilityScores } from './capabilityAssessor';
import type { ExerciseConfig } from './clinicalProfileMapper';
import { CANONICAL_EXERCISES, ALL_EXERCISE_SLUGS } from '@/data/canonicalExerciseRegistry';

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
 * Exercise gating rules — derived from canonical registry.
 * Only exercises with gatingRequirements defined are included.
 */
export const EXERCISE_GATING_RULES: ExerciseGatingRule[] = CANONICAL_EXERCISES
  .filter(e => e.gatingRequirements)
  .map(e => ({
    exerciseId: e.slug,
    minRequirements: e.gatingRequirements!,
    reason: e.gatingReason || 'Requires minimum capability scores',
    alternativeSuggestion: e.gatingAlternative,
  }));

/**
 * Exercises usable without spoken production or sentence-level reading —
 * the subset a severe/global aphasia profile is routed to for daily
 * auto-selection. Photo Naming qualifies because its choice chips give a
 * tap-only recognition path; Minimal Pairs is audio-delivered two-photo
 * tap (the strongest severe-aphasia activity in the catalog). Manual
 * choice in the Practice picker is deliberately NOT restricted.
 */
export const SEVERE_APHASIA_FRIENDLY_EXERCISES: readonly string[] = [
  'photo-naming',
  'minimal-pairs',
  'pattern-match',
  'reach-tap',
  'left-side-hunt',
  // Command Scenes: every command is a large tap target that models the
  // word via TTS — the gentlest speech onramp in the catalog
  // (docs/functional-command-scenes-spec.md).
  'functional-scenes',
];

/**
 * True when the active clinical profile carries the severe-aphasia flag.
 * Set by the onboarding screener (broad impairment + high fatigue) or by
 * a clinician-authored profile; stored in extraction_metadata.
 */
export function isSevereAphasiaProfile(
  clinicalProfile: { extraction_metadata?: Record<string, unknown> | null } | null | undefined
): boolean {
  return clinicalProfile?.extraction_metadata?.severe_aphasia_mode === true;
}

/**
 * Restrict auto-selection candidates for severe-aphasia profiles.
 * Safety valve: never filters to an empty list — if nothing in the
 * friendly set is accessible, the original list is returned unchanged.
 */
export function filterForSeverity(
  slugs: string[],
  clinicalProfile: { extraction_metadata?: Record<string, unknown> | null } | null | undefined
): string[] {
  if (!isSevereAphasiaProfile(clinicalProfile)) return slugs;
  const filtered = slugs.filter(s => SEVERE_APHASIA_FRIENDLY_EXERCISES.includes(s));
  return filtered.length > 0 ? filtered : slugs;
}

/**
 * Check if an exercise is accessible based on capability scores
 */
export function isExerciseAccessible(
  exerciseId: string,
  scores: CapabilityScores | null
): { accessible: boolean; reason?: string; alternative?: string } {
  if (!scores) {
    return { accessible: true };
  }

  const rule = EXERCISE_GATING_RULES.find(r => r.exerciseId === exerciseId);
  
  if (!rule) {
    return { accessible: true };
  }

  const { minRequirements } = rule;
  
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
 * Get all accessible exercises for a given capability profile.
 * Uses canonical registry as universe — no exercises can be accidentally omitted.
 */
export function getAccessibleExercises(scores: CapabilityScores | null): string[] {
  if (!scores) {
    return [...ALL_EXERCISE_SLUGS];
  }

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
          breakFrequency: 'high',
        },
        reason: 'Adapted for semantic processing complexity',
      };

    case 'sentence-construction':
      return {
        exerciseId,
        adaptations: {
          ...baseAdaptations,
          startDifficulty: 1,
          cueLevel: scores.attention < 8 ? 3 : 2,
          timeout: 20000,
          textInstructions: scores.vision >= 7,
          visualCues: true,
          sessionLength: 'short',
          breakFrequency: 'high',
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

  if (config.largeTargets) summary.push('Larger targets for easier selection');
  if (config.extendedTimeouts) summary.push('Extended time limits');
  if (config.simplifiedUI) summary.push('Simplified interface');
  if (config.eliminateText) summary.push('Visual-only instructions (no reading required)');
  if (config.useAudioCues) summary.push('Audio guidance enabled');
  if (config.highContrast) summary.push('High contrast display');
  if (config.errorlessMode) summary.push('Errorless learning mode (maximum support)');
  if (config.breakFrequency === 'high') summary.push('Frequent rest breaks');
  if (config.sessionLength === 'short') summary.push('Shortened session duration');

  return summary;
}
