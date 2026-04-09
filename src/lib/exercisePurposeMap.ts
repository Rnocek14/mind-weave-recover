/**
 * Exercise Purpose Map
 * 
 * Maps exercise slugs to short, one-line purpose descriptions.
 * Used by SessionPreviewCard in light/full coaching modes.
 */

const EXERCISE_PURPOSE: Record<string, string> = {
  'photo-naming': 'Speed up word retrieval for everyday objects.',
  'semantic-features': 'This helps you find words by thinking about their features — like what they do, where they are, and what they look like.',
  'sentence-construction': 'Practice building complete sentences.',
  'phonological-awareness': 'Strengthen sound discrimination and awareness.',
  'minimal-pairs': 'Sharpen ability to distinguish similar sounds.',
  'category-fluency': 'Improve speed of retrieving words by category.',
  'synonym-generator': 'Expand word networks with alternative words.',
  'describe-guess': 'Practice describing when the word won\'t come.',
  'narrative-retell': 'Build sequencing for retelling events.',
  'meaning-match': 'This helps you understand what sentences really mean — a skill you use in every conversation.',
  'conversation-partner': 'Practice real conversational exchange.',
  'conversation-coach': 'Guided conversation with coaching support.',
  'two-clues': 'Use context clues to find the right word.',
  'fix-sentence': 'Spot and correct sentence errors.',
  'detective-mind': 'Practice logical reasoning with language.',
  'abstract-compare': 'Compare ideas to strengthen flexible thinking.',
  'multi-step-plan': 'Practice sequencing multi-step instructions.',
  'dual-load-naming': 'Name under cognitive load for real-world readiness.',
  'thought-continuation': 'Complete ideas to practice sentence flow.',
  'phrase-practice': 'Practice common phrases for daily use.',
  'pattern-match': 'Strengthen visual pattern recognition.',
  'reach-tap': 'Build motor-cognitive coordination.',
  'left-side-hunt': 'Practice visual scanning and attention.',
};

export function getExercisePurpose(slug: string): string | null {
  return EXERCISE_PURPOSE[slug] || null;
}
