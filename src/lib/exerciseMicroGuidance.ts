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

/** Get the instruction line for an exercise (always returns, no skip) */
export function getExerciseInstruction(exerciseSlug: string): string | null {
  return EXERCISE_INSTRUCTIONS[exerciseSlug] || null;
}

/**
 * Progressive hint ladder per exercise.
 * Level 0 = simpler restatement of task
 * Level 1 = gentle cue
 * Level 2 = stronger hint or example
 */
const EXERCISE_HINTS: Record<string, string[]> = {
  'photo-naming': [
    'Look at the picture. What is it?',
    'Think about where you might use it.',
    'It starts with the sound…',
  ],
  'category-fluency': [
    'Think of one you see often.',
    'Try ones from your kitchen or garden.',
    'For example: apple, dog, chair…',
  ],
  'synonym-generator': [
    'What is another way to say it?',
    'Think of a word that is close.',
    'Happy → glad, big → large…',
  ],
  'phonological-awareness': [
    'Listen again carefully.',
    'Focus on the first sound.',
    'Which word starts the same way?',
  ],
  'phonological': [
    'Listen again carefully.',
    'Focus on the first sound.',
    'Which word starts the same way?',
  ],
  'semantic-features': [
    'Think about what it looks like.',
    'Where do you find it? What does it do?',
    'Pick words that describe it.',
  ],
  'sentence-construction': [
    'Start with who or what.',
    'Add what they do.',
    'Example: The dog runs fast.',
  ],
  'minimal-pairs': [
    'Listen to both words again.',
    'The sounds are very close.',
    'One small sound is different.',
  ],
  'conversation-partner': [
    'Say what comes to mind.',
    'Short answers are fine.',
    'Try one sentence at a time.',
  ],
  'conversation-coach': [
    'Say what you think.',
    'A few words is enough.',
    'Maya will help you keep going.',
  ],
  'two-clues': [
    'Read both clues again.',
    'What fits both descriptions?',
    'Think of common everyday things.',
  ],
  'fix-sentence': [
    'Read it out loud slowly.',
    'One word does not belong.',
    'Try changing that word.',
  ],
  'describe-guess': [
    'Think about what it looks like.',
    'Say where you find it or what it does.',
    'Give two or three details.',
  ],
  'detective-mind': [
    'Read the clues one more time.',
    'What do the clues have in common?',
    'Think step by step.',
  ],
  'meaning-match': [
    'Read the word carefully.',
    'Which meaning fits best?',
    'Try saying it in a sentence.',
  ],
  'narrative-retell': [
    'What happened first?',
    'Then what happened next?',
    'Tell the ending.',
  ],
  'abstract-compare': [
    'Think about how they are used.',
    'What makes them different?',
    'One is… but the other is…',
  ],
  'multi-step-plan': [
    'What would you do first?',
    'Think about the order.',
    'What comes before the last step?',
  ],
  'dual-load-naming': [
    'Focus on the picture first.',
    'Say the name, then do the task.',
    'Take it one step at a time.',
  ],
  'thought-continuation': [
    'Read the start of the sentence.',
    'What makes sense next?',
    'Finish the idea simply.',
  ],
};

const GENERIC_HINTS = [
  'Take your time.',
  'Try your best guess.',
  'A simple answer is fine.',
];

/**
 * Get a progressive hint for an exercise.
 * hintLevel 0-2. Returns null if no hints available.
 */
export function getExerciseHint(exerciseSlug: string, hintLevel: number): string {
  const hints = EXERCISE_HINTS[exerciseSlug];
  if (hints && hints.length > 0) {
    const idx = Math.min(hintLevel, hints.length - 1);
    return hints[idx];
  }
  return GENERIC_HINTS[Math.min(hintLevel, GENERIC_HINTS.length - 1)];
}
