/**
 * Exercise Micro-Guidance — short, aphasia-friendly instructions
 * 
 * Used in Guided/Full coaching modes to help users understand
 * what's coming next. One line max. Plain language.
 * 
 * Rules:
 * - Max ~10 words
 * - No jargon
 * - Action-oriented ("Name...", "Say...", "Pick...")
 * - Never shown in Games Only mode
 * - Shown ~80% of the time (not every single transition)
 */

// One-line instruction per exercise slug
const EXERCISE_INSTRUCTIONS: Record<string, string> = {
  'photo-naming': 'Say the name of what you see.',
  'category-fluency': 'Name as many as you can.',
  'synonym-generator': 'Say a word that means the same.',
  'phonological-awareness': 'Listen and pick the matching sound.',
  'phonological': 'Listen and pick the matching sound.',
  'semantic-features': 'Pick the words that describe it.',
  'sentence-construction': 'Build a sentence with the word.',
  'phrase-practice': 'Practice saying the phrase.',
  'reach-tap': 'Tap the target when it appears.',
  'pattern-match': 'Find the matching pattern.',
  'minimal-pairs': 'Pick the word you hear.',
  'conversation-partner': 'Have a short conversation.',
  'conversation-coach': 'Talk with Maya about a topic.',
  'two-clues': 'Guess the word from two clues.',
  'fix-sentence': 'Find and fix the mistake.',
  'describe-guess': 'Describe without saying the word.',
  'detective-mind': 'Figure out the answer from clues.',
  'meaning-match': 'Match words to their meanings.',
  'narrative-retell': 'Listen, then retell the story.',
  'abstract-compare': 'Say how they are different.',
  'multi-step-plan': 'Put the steps in order.',
  'dual-load-naming': 'Name it while doing a second task.',
  'left-side-hunt': 'Find items on the left side.',
  'thought-continuation': 'Finish the thought.',
  'sentence-game': 'Make a sentence with the words.',
};

// Struggle-specific nudges (shown if last score was low)
const STRUGGLE_NUDGES = [
  'Just try one word.',
  'Take your time.',
  'A simple answer is fine.',
  'You can say it simply.',
];

/**
 * Get a micro-guidance line for the next exercise.
 * Returns null if:
 * - exercise not recognized
 * - randomly gated (~20% skip for natural feel)
 */
export function getExerciseMicroGuidance(
  exerciseSlug: string,
  lastScore?: number | null,
): string | null {
  // Skip ~20% for organic feel
  if (Math.random() > 0.8) return null;
  
  // If struggling, occasionally show a nudge instead
  if (lastScore != null && lastScore < 35 && Math.random() > 0.5) {
    return STRUGGLE_NUDGES[Math.floor(Math.random() * STRUGGLE_NUDGES.length)];
  }
  
  return EXERCISE_INSTRUCTIONS[exerciseSlug] || null;
}
