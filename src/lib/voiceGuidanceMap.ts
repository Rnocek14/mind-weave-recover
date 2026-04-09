/**
 * Voice Guidance Registry — per-exercise voice scripts for Full Coaching mode.
 * 
 * Each exercise defines what Maya says at key moments.
 * Only used when CoachingMode === 'full'.
 */

export interface VoiceGuidance {
  /** Spoken before exercise starts */
  voiceIntro: string | ((context?: Record<string, string>) => string);
  /** Spoken when the exercise task begins */
  voiceTask: string;
  /** Spoken if user stalls (~6-10s) */
  voiceReminder?: string;
  /** Whether Maya should auto-read story/question content */
  autoReadStimulus: boolean;
}

/** Resolve a voiceIntro that may be a function (dynamic) or static string */
export function resolveVoiceIntro(guidance: VoiceGuidance, context?: Record<string, string>): string {
  if (typeof guidance.voiceIntro === 'function') {
    return guidance.voiceIntro(context);
  }
  return guidance.voiceIntro;
}

const guidanceMap: Record<string, VoiceGuidance> = {
  'detective-mind': {
    voiceIntro: "Let's read a short story and find the important clues.",
    voiceTask: "Choose the best answer.",
    voiceReminder: "Take your time. You can look back at the story for the clue.",
    autoReadStimulus: true,
  },
  'narrative-retell': {
    voiceIntro: (ctx) => {
      const title = ctx?.storyTitle;
      return title
        ? `I'm going to tell you a story called "${title}". Listen carefully, then tell it back in your own words.`
        : "I'm going to tell you a short story. Listen carefully, then tell it back in your own words.";
    },
    voiceTask: "Now tell it back in your own words. Start with what happened first.",
    voiceReminder: "Who was in the story? What happened first?",
    autoReadStimulus: true,
  },
  'category-fluency': {
    voiceIntro: (ctx) => {
      const category = ctx?.category;
      return category
        ? `Name as many ${category} as you can.`
        : "Name as many words in this category as you can.";
    },
    voiceTask: "Go ahead.",
    voiceReminder: "Try thinking of a different group within the category.",
    autoReadStimulus: false,
  },
  'synonym-generator': {
    voiceIntro: (ctx) => {
      const word = ctx?.word;
      return word
        ? `Tell me words that mean the same as "${word}".`
        : "I'll give you a word. Tell me similar words.";
    },
    voiceTask: "Go ahead.",
    voiceReminder: "Think about words that could replace it in a sentence.",
    autoReadStimulus: false,
  },
  'meaning-match': {
    voiceIntro: "Read the sentence and pick the word that means the same thing.",
    voiceTask: "Choose the best match.",
    voiceReminder: "Look at the sentence again. Which word fits?",
    autoReadStimulus: true,
  },
  'minimal-pairs': {
    voiceIntro: "Listen carefully to two words. Tell me which one I said.",
    voiceTask: "Which word did you hear?",
    voiceReminder: "Listen one more time.",
    autoReadStimulus: true,
  },
  'phrase-practice': {
    voiceIntro: "I'll say a phrase. Try to say it back clearly.",
    voiceTask: "Say it back.",
    voiceReminder: "Take your time. Try saying it slowly.",
    autoReadStimulus: true,
  },
  'semantic-feature-analysis': {
    voiceIntro: "Look at the word. Tell me what you know about it — what group it's in, what it looks like, what you do with it.",
    voiceTask: "Select the features that match.",
    voiceReminder: "Think about what group it belongs to, or what it looks like.",
    autoReadStimulus: false,
  },
  'sentence-construction': {
    voiceIntro: "Listen to the sentence, then say it back or put the words in order.",
    voiceTask: "Arrange the words.",
    voiceReminder: "Which word comes first?",
    autoReadStimulus: false,
  },
  'photo-naming': {
    voiceIntro: "Look at each picture and say what you see.",
    voiceTask: "Say what you see.",
    voiceReminder: "Take your time. What does it look like?",
    autoReadStimulus: false,
  },
  'two-clues': {
    voiceIntro: "I'll give you two clues. Tell me what word they describe.",
    voiceTask: "What word am I describing?",
    voiceReminder: "Think about both clues together.",
    autoReadStimulus: false,
  },
  'describe-guess': {
    voiceIntro: "Look at the picture and describe it. I'll try to guess what it is.",
    voiceTask: "Tell me about it.",
    voiceReminder: "What does it look like? What do you use it for?",
    autoReadStimulus: false,
  },
  'thought-continuation': {
    voiceIntro: "I'll start a thought, and you finish it. There are no wrong answers.",
    voiceTask: "Finish the thought.",
    voiceReminder: "Just say whatever comes to mind.",
    autoReadStimulus: false,
  },
};

/** Fallback for exercises not yet wired for Full Coaching */
const defaultGuidance: VoiceGuidance = {
  voiceIntro: "Let's start the next exercise.",
  voiceTask: "Follow the instructions on screen.",
  voiceReminder: "Take your time.",
  autoReadStimulus: false,
};

export function getVoiceGuidance(exerciseSlug: string): VoiceGuidance {
  return guidanceMap[exerciseSlug] || defaultGuidance;
}
