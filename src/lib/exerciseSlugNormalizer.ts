/**
 * Normalize exercise slugs for consistent analytics.
 * 
 * Rule: use underscores, lowercase, no hyphens
 * This ensures all data for the same exercise is grouped together.
 */

// Canonical slugs for all exercises
export const CANONICAL_SLUGS = {
  // Speech exercises (expressive - require utterance logging)
  PHOTO_NAMING: 'photo_naming',
  PHRASE_PRACTICE: 'phrase_practice',
  TWO_CLUES: 'two_clues',
  
  // Receptive/discrimination exercises (listening - no speech required)
  MINIMAL_PAIRS: 'minimal_pairs',
  SEMANTIC_FEATURES: 'semantic_features',
  
  // Motor/attention exercises
  REACH_TAP: 'reach_tap',
  LEFT_SIDE_HUNT: 'left_side_hunt',
  PATTERN_MATCH: 'pattern_match',
  
  // Mixed language exercises
  PHONOLOGICAL: 'phonological_awareness',
  SENTENCE_CONSTRUCTION: 'sentence_construction',
} as const;

// Exercise modality types
export type ExerciseModality = 'speaking' | 'listening' | 'motor' | 'mixed';

/**
 * Normalize any exercise slug to canonical format.
 * Converts hyphens to underscores and lowercases.
 */
export const normalizeExerciseSlug = (rawSlug: string): string => {
  return rawSlug.replace(/-/g, '_').toLowerCase();
};

/**
 * Check if a slug represents a speech exercise (requires utterance logging)
 */
export const isSpeechExercise = (slug: string): boolean => {
  const normalized = normalizeExerciseSlug(slug);
  return [
    CANONICAL_SLUGS.PHOTO_NAMING,
    CANONICAL_SLUGS.PHRASE_PRACTICE,
    CANONICAL_SLUGS.TWO_CLUES,
  ].includes(normalized as any);
};

/**
 * Check if a slug represents a receptive/discrimination exercise (no speech required)
 */
export const isReceptiveExercise = (slug: string): boolean => {
  const normalized = normalizeExerciseSlug(slug);
  return [
    CANONICAL_SLUGS.MINIMAL_PAIRS,
    CANONICAL_SLUGS.SEMANTIC_FEATURES,
  ].includes(normalized as any);
};

/**
 * Get the modality for an exercise
 */
export const getExerciseModality = (slug: string): ExerciseModality => {
  const normalized = normalizeExerciseSlug(slug);
  
  if (isSpeechExercise(normalized)) return 'speaking';
  if (isReceptiveExercise(normalized)) return 'listening';
  
  if ([CANONICAL_SLUGS.REACH_TAP, CANONICAL_SLUGS.LEFT_SIDE_HUNT, CANONICAL_SLUGS.PATTERN_MATCH].includes(normalized as any)) {
    return 'motor';
  }
  
  return 'mixed';
};
