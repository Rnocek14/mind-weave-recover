/**
 * Exercise-to-domain mapping for mid-session pivot integration.
 * Maps exercise slugs to their primary cognitive domain for pivot evaluation.
 */

export const EXERCISE_DOMAIN_MAP: Record<string, string> = {
  'photo-naming': 'lexical_retrieval',
  'two-clues': 'lexical_retrieval',
  'describe-guess': 'lexical_retrieval',
  'semantic-features': 'semantic_depth',
  'meaning-match': 'semantic_depth',
  'detective-mind': 'executive_function',
  'pattern-match': 'executive_function',
  'sentence-construction': 'syntax',
  'fix-sentence': 'syntax',
  'phonological-awareness': 'phonology',
  'phonological': 'phonology',
  'minimal-pairs': 'phonology',
  'narrative-retell': 'discourse',
  'conversation-coach': 'discourse',
  'conversation-partner': 'discourse',
  'conversation-turn': 'discourse',
  'abstract-compare': 'semantic_depth',
  'multi-step-plan': 'executive_function',
  'dual-load-naming': 'executive_function',
  'thought-continuation': 'discourse',
  'reach-tap': 'motor',
  'left-side-hunt': 'visual_spatial',
  'category-fluency': 'lexical_retrieval',
  'synonym-generator': 'semantic_depth',
};

/** Normalize various slug formats to hyphenated */
export function getExerciseDomain(slug: string): string {
  const normalized = slug.replace(/_/g, '-');
  return EXERCISE_DOMAIN_MAP[normalized] || 'general';
}
