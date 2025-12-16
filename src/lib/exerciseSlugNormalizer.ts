/**
 * Normalize exercise slugs for consistent analytics.
 * 
 * Rule: use underscores, lowercase, no hyphens
 * This ensures all data for the same exercise is grouped together.
 */

// Canonical slugs for all exercises
export const CANONICAL_SLUGS = {
  // Speech exercises
  PHOTO_NAMING: 'photo_naming',
  PHRASE_PRACTICE: 'phrase_practice',
  
  // Motor/attention exercises
  REACH_TAP: 'reach_tap',
  LEFT_SIDE_HUNT: 'left_side_hunt',
  PATTERN_MATCH: 'pattern_match',
  
  // Language exercises
  PHONOLOGICAL: 'phonological_awareness',
  SEMANTIC_FEATURES: 'semantic_features',
  SENTENCE_CONSTRUCTION: 'sentence_construction',
} as const;

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
  ].includes(normalized as any);
};
