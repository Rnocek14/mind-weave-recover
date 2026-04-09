/**
 * Exercise Purpose Map
 * 
 * Maps exercise slugs to short, one-line purpose descriptions.
 * Used by SessionPreviewCard in light/full coaching modes.
 */

const EXERCISE_PURPOSE: Record<string, string> = {
  'photo-naming': 'This helps you practice finding the right word quickly — the same skill you use when talking about things around you.',
  'semantic-features': 'This helps you find words by thinking about their features — like what they do, where they are, and what they look like.',
  'sentence-construction': 'This helps you build clear sentences in the right order — the same skill you use every time you explain something.',
  'phonological-awareness': 'This helps you hear and tell apart similar sounds — a key skill for understanding speech clearly.',
  'minimal-pairs': 'This helps you hear the difference between similar sounds — like "bat" and "pat" — so you can understand speech more clearly.',
  'category-fluency': 'Improve speed of retrieving words by category.',
  'synonym-generator': 'This helps you practice finding different words with similar meanings — a key skill for flexible conversation.',
  'describe-guess': 'This helps you practice describing things when the word won\'t come — a real strategy you can use every day.',
  'narrative-retell': 'Build sequencing for retelling events.',
  'meaning-match': 'This helps you understand what sentences really mean — a skill you use in every conversation.',
  'conversation-partner': 'Practice real conversational exchange.',
  'conversation-coach': 'Guided conversation with coaching support.',
  'two-clues': 'This helps you use context clues to figure out the right word — like piecing together a puzzle from hints.',
  'fix-sentence': 'Spot and correct sentence errors.',
  'detective-mind': 'Practice logical reasoning with language.',
  'abstract-compare': 'Compare ideas to strengthen flexible thinking.',
  'multi-step-plan': 'Practice sequencing multi-step instructions.',
  'dual-load-naming': 'Name under cognitive load for real-world readiness.',
  'thought-continuation': 'This helps you practice finishing thoughts — the same skill you use every time you explain an idea.',
  'phrase-practice': 'This helps you practice common everyday phrases until they come naturally — like greetings, requests, and responses.',
  'pattern-match': 'Strengthen visual pattern recognition.',
  'reach-tap': 'Build motor-cognitive coordination.',
  'left-side-hunt': 'Practice visual scanning and attention.',
};

export function getExercisePurpose(slug: string): string | null {
  return EXERCISE_PURPOSE[slug] || null;
}
