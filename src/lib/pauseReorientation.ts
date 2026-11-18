/**
 * Patient-facing orientation after a pause. This is navigation support, not a
 * scored cue or a change to any game's trial/difficulty state.
 */
const TASKS: Record<string, { name: string; instruction: string; example?: string }> = {
  'photo-naming': { name: 'Photo Naming', instruction: 'Look at the picture and say what you see.', example: 'If you see a cup, say cup.' },
  'phrase-practice': { name: 'Phrase Practice', instruction: 'Listen to the phrase, then say it aloud.' },
  'word-practice': { name: 'Phrase Practice', instruction: 'Listen to the phrase, then say it aloud.' },
  'two-clues': { name: 'Two Clues', instruction: 'Listen to both clues. Say the word that fits them.', example: 'If the clues are barks and leash, the word could be dog.' },
  'describe-guess': { name: 'Describe and Guess', instruction: 'Describe the object without saying its name. Tell me what it is used for, what it looks like, or what it is made of.', example: 'For a cup, you could say: you drink from it.' },
  'fix-sentence': { name: 'Fix the Sentence', instruction: 'Listen to the sentence. Say it again with the mistake fixed.' },
  'detective-mind': { name: 'Detective Mind', instruction: 'Listen to the story and clues. Choose or say the answer that makes sense.' },
  'meaning-match': { name: 'Meaning Match', instruction: 'Listen to the words or sentence. Pick the choice with the same meaning.' },
  'narrative-retell': { name: 'Story Retelling', instruction: 'Listen to the story. Tell it back in your own words.' },
  'category-fluency': { name: 'Category Fluency', instruction: 'Say as many words as you can from the category on the screen.' },
  'thought-continuation': { name: 'Thought Continuation', instruction: 'Listen to the beginning of the thought, then finish it in your own words.' },
  'abstract-compare': { name: 'Abstract Compare', instruction: 'Think about the two ideas. Tell me how they are alike or different.' },
  'multi-step-plan': { name: 'Multi-Step Planning', instruction: 'Put the steps in order to complete the task.' },
  'dual-load-naming': { name: 'Dual Load Naming', instruction: 'Name the item while following the extra instruction on the screen.' },
  'synonym-generator': { name: 'Synonym Generator', instruction: 'Say a different word that means the same thing.' },
  'minimal-pairs': { name: 'Minimal Pairs', instruction: 'Listen carefully to the sound and choose the word you heard.' },
  'pattern-match': { name: 'Pattern Match', instruction: 'Look at the pattern and choose what comes next.' },
  'semantic-features': { name: 'Semantic Features', instruction: 'Think about the object. Say what it looks like, what it does, or where you find it.' },
  'sentence-construction': { name: 'Sentence Construction', instruction: 'Put the words together to make a sentence.' },
  'conversation-partner': { name: 'Conversation Practice', instruction: 'Listen to your conversation partner and answer in your own words.' },
  'conversation-coach': { name: 'Conversation Coach', instruction: 'Listen to Maya and practice answering as you would in a real conversation.' },
};

export type PauseReorientation = {
  name: string;
  text: string;
  /** Long pauses benefit from an extra concrete example. */
  detail: 'brief' | 'instruction' | 'example';
};

export function getPauseReorientation(slug: string | null, pausedMs: number): PauseReorientation {
  const task = (slug && TASKS[slug]) || {
    name: 'Your game',
    instruction: 'Look at the question on the screen and follow the instructions for this turn.',
  };
  const detail = pausedMs < 10_000 ? 'brief' : pausedMs < 60_000 ? 'instruction' : 'example';
  const text = detail === 'brief'
    ? `Welcome back. We are still playing ${task.name}. ${task.instruction}`
    : detail === 'instruction'
      ? `Welcome back. This is ${task.name}. ${task.instruction} Take your time with the same question.`
      : `Welcome back. This is ${task.name}. ${task.instruction} ${'example' in task && task.example ? task.example + ' ' : ''}We are on the same question. Take your time.`;
  return { name: task.name, text, detail };
}
