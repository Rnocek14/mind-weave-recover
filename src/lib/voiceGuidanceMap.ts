/**
 * Voice Guidance Registry — per-exercise voice scripts for Full Coaching mode.
 * 
 * Each exercise defines what Maya says at key moments.
 * Only used when CoachingMode === 'full'.
 * 
 * Intro pattern: WHAT you'll do + HOW to respond + EXPECTATION (short, concrete).
 * Task pattern: One-line action prompt.
 * Reminder pattern: Gentle redirect with a strategy hint.
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
    voiceIntro: "I'll read you a short story. Listen carefully for the important details. Then I'll ask you a question about it.",
    voiceTask: "Choose the answer that fits the story best.",
    voiceReminder: "Take your time. Think about what happened in the story. You can look back at it.",
    autoReadStimulus: true,
  },
  'narrative-retell': {
    voiceIntro: (ctx) => {
      const title = ctx?.storyTitle;
      return title
        ? `I'm going to tell you a story called "${title}". Listen carefully. When I'm done, tell it back to me in your own words — what happened first, then what happened next.`
        : "I'm going to tell you a short story. Listen carefully. When I'm done, tell it back in your own words — start with what happened first.";
    },
    voiceTask: "Now tell it back in your own words. Start with what happened first.",
    voiceReminder: "Who was in the story? What happened at the beginning?",
    autoReadStimulus: true,
  },
  'category-fluency': {
    voiceIntro: (ctx) => {
      const category = ctx?.category;
      return category
        ? `Name as many ${category} as you can before the timer runs out. Just say them one at a time.`
        : "I'll give you a category. Name as many words in that group as you can. Just say them one at a time.";
    },
    voiceTask: "Go ahead — say words out loud.",
    voiceReminder: "Try thinking of a different type within the group.",
    autoReadStimulus: false,
  },
  'synonym-generator': {
    voiceIntro: (ctx) => {
      const word = ctx?.word;
      return word
        ? `Tell me words that mean the same as "${word}." For example, if I said "big," you might say "large" or "huge."`
        : "I'll give you a word. Tell me other words that mean the same thing.";
    },
    voiceTask: "Say a word that means the same thing.",
    voiceReminder: "Think about how you might use a different word in the same sentence.",
    autoReadStimulus: false,
  },
  'meaning-match': {
    voiceIntro: "You'll see a sentence with a word highlighted. Pick the answer that means the same thing as that word. Read the sentence carefully — it will help you figure it out.",
    voiceTask: "Tap the answer that matches.",
    voiceReminder: "Read the sentence again. Which answer could replace the highlighted word?",
    autoReadStimulus: true,
  },
  'minimal-pairs': {
    voiceIntro: "You'll hear a word. Then you'll see two choices that sound very similar. Pick the word you heard. Listen carefully — the difference is small.",
    voiceTask: "Which word did you hear?",
    voiceReminder: "Listen one more time. Focus on the beginning or ending sound.",
    autoReadStimulus: true,
  },
  'phrase-practice': {
    voiceIntro: "I'll say a phrase. Listen carefully, then say it back to me as clearly as you can. Take your time.",
    voiceTask: "Say it back now.",
    voiceReminder: "Take your time. Try saying it one word at a time.",
    autoReadStimulus: true,
  },
  'semantic-feature-analysis': {
    voiceIntro: "You'll see a word. Tell me what you know about it — what group does it belong to? What does it look like? What do you do with it?",
    voiceTask: "Select the features that match this word.",
    voiceReminder: "Think about what group it belongs to, or what it looks like.",
    autoReadStimulus: false,
  },
  'sentence-construction': {
    voiceIntro: "You'll see some words mixed up. Put them in the right order to make a sentence. Tap the words one at a time.",
    voiceTask: "Tap the words in the right order.",
    voiceReminder: "Which word comes first in the sentence?",
    autoReadStimulus: false,
  },
  'photo-naming': {
    voiceIntro: "You'll see a picture. Say the name of what you see out loud. If you're not sure, describe what it looks like.",
    voiceTask: "Say what you see.",
    voiceReminder: "Take your time. What does it look like? What would you use it for?",
    autoReadStimulus: false,
  },
  'two-clues': {
    voiceIntro: "I'll give you two clues about a word. Put them together to figure out the answer. For example: 'It's an animal' and 'It barks' — the answer is 'dog.'",
    voiceTask: "What word am I describing?",
    voiceReminder: "Think about both clues together. What fits both of them?",
    autoReadStimulus: false,
  },
  'describe-guess': {
    voiceIntro: "You'll see a picture. Describe what you see without saying its name — tell me what it looks like, what you use it for, or where you find it.",
    voiceTask: "Describe it for me.",
    voiceReminder: "What does it look like? What color is it? Where would you find it?",
    autoReadStimulus: false,
  },
  'thought-continuation': {
    voiceIntro: "I'll start a sentence, and you finish it. There's no wrong answer — just say whatever comes to mind naturally.",
    voiceTask: "Finish the thought.",
    voiceReminder: "Just say whatever comes to mind. There's no wrong answer.",
    autoReadStimulus: false,
  },
  'abstract-compare': {
    voiceIntro: (ctx) => {
      const wordA = ctx?.wordA;
      const wordB = ctx?.wordB;
      return wordA && wordB
        ? `How are "${wordA}" and "${wordB}" similar? Tell me what they have in common. For example, a dog and a cat are both animals.`
        : "I'll give you two words. Tell me how they're alike — what do they have in common?";
    },
    voiceTask: "Tell me what they have in common.",
    voiceReminder: "Think about what group they both belong to, or what you can do with both of them.",
    autoReadStimulus: false,
  },
  'fix-sentence': {
    voiceIntro: "You'll hear a sentence with one wrong word in it. Find the word that doesn't fit and say the correct word. For example, if you hear 'She drink coffee,' you'd say 'drinks.'",
    voiceTask: "What word should go there instead?",
    voiceReminder: "Listen to the sentence again. Which word sounds wrong? What should it be?",
    autoReadStimulus: true,
  },
};

/** Fallback for exercises not yet wired for Full Coaching */
const defaultGuidance: VoiceGuidance = {
  voiceIntro: "Let's start the next exercise. Follow the instructions on screen.",
  voiceTask: "Follow the instructions on screen.",
  voiceReminder: "Take your time.",
  autoReadStimulus: false,
};

export function getVoiceGuidance(exerciseSlug: string): VoiceGuidance {
  return guidanceMap[exerciseSlug] || defaultGuidance;
}
