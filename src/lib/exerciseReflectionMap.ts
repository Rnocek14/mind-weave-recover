/**
 * Exercise Reflection Map
 * 
 * Maps exercise slugs to structured reflection templates for Maya.
 * Used by useMayaExerciseFrame to generate post-exercise reflections.
 * 
 * Part of the system foundation (Phase 1).
 */

export interface ExerciseReflectionTemplate {
  /** Generates a reflection based on accuracy (0-1) */
  getReflection: (accuracy: number) => string;
  /** Real-life connection line */
  realLifeLine: string;
  /** Generate a next-step suggestion based on accuracy */
  getNextStep: (accuracy: number) => string;
  /** Skill categories this exercise trains */
  skillCategories: string[];
}

const REFLECTION_MAP: Record<string, ExerciseReflectionTemplate> = {
  'meaning-match': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'You showed strong understanding of what sentences mean — even the tricky ones.';
      if (acc >= 0.5) return 'You understood many of the meanings well. The figurative ones take more practice.';
      return 'Understanding meaning takes time. Each attempt builds stronger connections.';
    },
    realLifeLine: 'This is the same skill you use when following conversations, reading texts, or understanding what someone means.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try more figurative sentences to push your understanding further.';
      if (acc >= 0.5) return 'Focus on sentences with hidden or indirect meaning next time.';
      return 'Start with literal sentences and build confidence before tackling figurative ones.';
    },
    skillCategories: ['comprehension', 'semantics'],
  },

  'detective-mind': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'You found the key clues and understood the stories well.';
      if (acc >= 0.5) return 'You caught some important details. Inference questions are the hardest.';
      return 'Finding clues in stories takes practice. Each story builds that skill.';
    },
    realLifeLine: 'This is the same skill you use when following a conversation and understanding what someone really means.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try harder inference and prediction questions next.';
      if (acc >= 0.5) return 'Focus on reading for cause-and-effect clues.';
      return 'Start with shorter, simpler stories to build confidence.';
    },
    skillCategories: ['comprehension', 'reasoning'],
  },

  'photo-naming': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'Strong word retrieval — you named most items confidently.';
      if (acc >= 0.5) return 'Good effort. Some words needed more time, which is normal.';
      return 'Word finding takes practice. Using cues is a smart strategy.';
    },
    realLifeLine: 'Naming practice helps you find words faster in everyday conversations.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try naming without cues to build independence.';
      return 'Keep using hints when needed — they help build pathways to the word.';
    },
    skillCategories: ['naming', 'word-retrieval'],
  },

  'category-fluency': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'You generated many words and grouped them well.';
      if (acc >= 0.5) return 'Good retrieval. Try switching between groups to find more words.';
      return 'Every word you find strengthens that category in your memory.';
    },
    realLifeLine: 'This helps when you need to think of options — like food to cook, things to pack, or topics to discuss.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try switching between subcategories to find even more words.';
      return 'Focus on one group at a time, then switch to a new group.';
    },
    skillCategories: ['fluency', 'semantics'],
  },

  'semantic-features': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'You identified features well and used them to retrieve the words — that is exactly how this strategy works in real life.';
      if (acc >= 0.5) return 'You found many features. With practice, using those features to retrieve the word gets faster and more automatic.';
      return 'Thinking about what something does, where it is, and what it looks like builds pathways to the word. Each trial strengthens those connections.';
    },
    realLifeLine: 'When a word is on the tip of your tongue, thinking about its features — what group it belongs to, what you do with it, where you find it — helps you reach it.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try harder items where the features are less obvious.';
      if (acc >= 0.5) return 'Focus on function and category features — those are the strongest retrieval cues.';
      return 'Start with familiar items and practice naming the category, use, and appearance.';
    },
    skillCategories: ['semantics', 'word-retrieval', 'naming'],
  },

  'sentence-construction': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'You built clear, well-ordered sentences.';
      if (acc >= 0.5) return 'Good structure. Focus on word order and small connecting words.';
      return 'Building sentences gets easier with practice. Start simple and add detail.';
    },
    realLifeLine: 'This is what you do every time you explain something or tell someone what happened.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try building longer, more complex sentences.';
      return 'Practice putting the subject first, then the action, then the detail.';
    },
    skillCategories: ['syntax', 'expression'],
  },

  'synonym-generator': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'You found strong alternative words — great semantic flexibility.';
      if (acc >= 0.5) return 'Good word variety. Think about words that mean almost the same thing.';
      return 'Finding different words for the same idea builds flexibility in conversation.';
    },
    realLifeLine: 'When one word won\'t come, having alternatives ready keeps conversation flowing.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try finding synonyms for more abstract words.';
      return 'Start with common, concrete words and think of what else you could say.';
    },
    skillCategories: ['semantics', 'flexibility'],
  },

  'describe-guess': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'Your descriptions were clear and specific.';
      if (acc >= 0.5) return 'Good descriptions. Try adding what the item does or where you find it.';
      return 'Describing is a key strategy when a word feels stuck.';
    },
    realLifeLine: 'This is exactly what you do when you can\'t find a word — you describe it instead.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try describing with fewer words for efficiency.';
      return 'Focus on category, function, and appearance.';
    },
    skillCategories: ['expression', 'circumlocution'],
  },

  'two-clues': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'You used context clues effectively to find the right words.';
      if (acc >= 0.5) return 'Good use of clues. Try combining both clues before guessing.';
      return 'Using clues to find words is a valuable strategy.';
    },
    realLifeLine: 'In conversation, you use context clues all the time to understand what someone means.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try harder word targets with more subtle clues.';
      return 'Read both clues carefully before choosing your answer.';
    },
    skillCategories: ['comprehension', 'word-retrieval'],
  },

  'thought-continuation': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'You completed thoughts clearly and logically.';
      if (acc >= 0.5) return 'Good sentence completion. Try to match the tone and direction of the prompt.';
      return 'Finishing thoughts is an important part of conversation flow.';
    },
    realLifeLine: 'This is what you do when you continue a thought or finish explaining an idea.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try completing more complex or abstract prompts.';
      return 'Start with simple, concrete prompts and build from there.';
    },
    skillCategories: ['expression', 'fluency'],
  },

  'narrative-retell': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'You captured the key story elements clearly.';
      if (acc >= 0.5) return 'You remembered important parts. The middle details often need more focus.';
      return 'Retelling stories builds sequencing — an important skill for daily communication.';
    },
    realLifeLine: 'This is the same skill you use when telling someone about your day or what happened.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try retelling with more detail about why things happened.';
      return 'Focus on beginning, middle, and end — in that order.';
    },
    skillCategories: ['expression', 'sequencing'],
  },

  'phrase-practice': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'You practiced common phrases confidently.';
      if (acc >= 0.5) return 'Good practice. Repetition makes these phrases more automatic.';
      return 'Practicing everyday phrases helps them come more naturally.';
    },
    realLifeLine: 'These are phrases you use every day — greetings, requests, responses.',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try using these phrases in different contexts.';
      return 'Repeat the phrases that feel hardest until they become automatic.';
    },
    skillCategories: ['expression', 'automaticity'],
  },

  'minimal-pairs': {
    getReflection: (acc) => {
      if (acc >= 0.8) return 'You distinguished similar sounds accurately — strong listening skills.';
      if (acc >= 0.5) return 'You caught many sound differences. The similar ones take more practice.';
      return 'Hearing sound differences improves with practice. Each trial sharpens your ear.';
    },
    realLifeLine: 'This is the same skill you use when telling apart similar words in conversation — like "coat" and "goat".',
    getNextStep: (acc) => {
      if (acc >= 0.8) return 'Try harder sound contrasts with less obvious differences.';
      if (acc >= 0.5) return 'Focus on listening to the first sound of each word carefully.';
      return 'Use the replay button to hear the word again before choosing.';
    },
    skillCategories: ['comprehension', 'phonology'],
  },
};

export function getExerciseReflection(slug: string): ExerciseReflectionTemplate | null {
  return REFLECTION_MAP[slug] || null;
}
