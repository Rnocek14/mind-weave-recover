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
  DESCRIBE_GUESS: 'describe_guess',
  
  // Receptive/discrimination exercises (listening - no speech required)
  MINIMAL_PAIRS: 'minimal_pairs',
  SEMANTIC_FEATURES: 'semantic_features',
  
  // Self-monitoring exercises
  FIX_SENTENCE: 'fix_sentence',
  DETECTIVE_MIND: 'detective_mind',
  MEANING_MATCH: 'meaning_match',
  
  // Motor/attention exercises
  REACH_TAP: 'reach_tap',
  LEFT_SIDE_HUNT: 'left_side_hunt',
  PATTERN_MATCH: 'pattern_match',
  
  // Mixed language exercises
  PHONOLOGICAL: 'phonological_awareness',
  SENTENCE_CONSTRUCTION: 'sentence_construction',
  CATEGORY_FLUENCY: 'category_fluency',
  SYNONYM_GENERATOR: 'synonym_generator',

  // Discourse / generative
  NARRATIVE_RETELL: 'narrative_retell',
  THOUGHT_CONTINUATION: 'thought_continuation',
  CONVERSATION_COACH: 'conversation_coach',
  CONVERSATION_PARTNER: 'conversation_partner',

  // Executive function games
  ABSTRACT_COMPARE: 'abstract_compare',
  MULTI_STEP_PLANNING: 'multi_step_planning',
  DUAL_LOAD_NAMING: 'dual_load_naming',
} as const;

// Exercise modality types
export type ExerciseModality = 'speaking' | 'listening' | 'motor' | 'mixed';

/**
 * Normalize any exercise slug to canonical format.
 * Converts route aliases to canonical exercise slugs first, then normalizes format.
 */
const EXERCISE_SLUG_ALIASES: Record<string, string> = {
  'word-practice': CANONICAL_SLUGS.PHRASE_PRACTICE,
  'word_practice': CANONICAL_SLUGS.PHRASE_PRACTICE,
  'phrase-practice': CANONICAL_SLUGS.PHRASE_PRACTICE,
  'phrase_practice': CANONICAL_SLUGS.PHRASE_PRACTICE,
  // EF game route slugs map to canonical analytics slugs
  'multi-step-plan': CANONICAL_SLUGS.MULTI_STEP_PLANNING,
  'multi_step_plan': CANONICAL_SLUGS.MULTI_STEP_PLANNING,
  'multi-step-planning': CANONICAL_SLUGS.MULTI_STEP_PLANNING,
  'dual-load-naming': CANONICAL_SLUGS.DUAL_LOAD_NAMING,
  'abstract-compare': CANONICAL_SLUGS.ABSTRACT_COMPARE,
};

// Track warned non-canonical slugs once per session to avoid log spam.
const _warnedSlugs = new Set<string>();

export const normalizeExerciseSlug = (rawSlug: string): string => {
  if (!rawSlug || typeof rawSlug !== 'string') return rawSlug as unknown as string;
  const lower = rawSlug.toLowerCase();
  const underscored = lower.replace(/-/g, '_');
  const canonical = EXERCISE_SLUG_ALIASES[lower] ?? EXERCISE_SLUG_ALIASES[underscored] ?? underscored;

  // Dev-only warning when caller passed a non-canonical form.
  if (
    typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.DEV &&
    rawSlug !== canonical &&
    !_warnedSlugs.has(rawSlug)
  ) {
    _warnedSlugs.add(rawSlug);
    // eslint-disable-next-line no-console
    console.warn(
      `[slug] Non-canonical exercise slug "${rawSlug}" was normalized to "${canonical}". ` +
      `Update the call site to use the canonical underscore form (or CANONICAL_SLUGS).`
    );
  }
  return canonical;
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
    CANONICAL_SLUGS.DESCRIBE_GUESS,
    CANONICAL_SLUGS.FIX_SENTENCE,
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
    CANONICAL_SLUGS.MEANING_MATCH,
    CANONICAL_SLUGS.DETECTIVE_MIND,
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
