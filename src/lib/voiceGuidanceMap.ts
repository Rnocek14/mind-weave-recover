/**
 * Voice Guidance Registry — per-exercise voice scripts for Full Coaching mode.
 * 
 * Each exercise defines what Maya says at key moments.
 * Only used when CoachingMode === 'full'.
 */

export interface VoiceGuidance {
  /** Spoken before exercise starts */
  voiceIntro: string;
  /** Spoken when the exercise task begins */
  voiceTask: string;
  /** Spoken if user stalls (~6-10s) */
  voiceReminder?: string;
  /** Whether Maya should auto-read story/question content */
  autoReadStimulus: boolean;
}

const guidanceMap: Record<string, VoiceGuidance> = {
  'detective-mind': {
    voiceIntro: "We're going to read a short story and look for the important clues.",
    voiceTask: "Choose the best answer.",
    voiceReminder: "Take your time. You can look back at the story for the clue.",
    autoReadStimulus: true,
  },
  'narrative-retell': {
    voiceIntro: "I'm going to read you a short story.",
    voiceTask: "Now tell it back in your own words. Start with what happened first.",
    voiceReminder: "Who was in the story? What happened first?",
    autoReadStimulus: true,
  },
  'category-fluency': {
    voiceIntro: '', // Dynamic — set per-round with actual category name
    voiceTask: "Go ahead.",
    voiceReminder: "Try thinking of a different group within the category.",
    autoReadStimulus: false,
  },
  'meaning-match': {
    voiceIntro: "I'll show you a sentence. Pick the word that means the same thing.",
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
  'synonym-generator': {
    voiceIntro: "I'll give you a word. Tell me similar words.",
    voiceTask: "What words mean something similar?",
    voiceReminder: "Think about words that could replace it in a sentence.",
    autoReadStimulus: false,
  },
  'semantic-feature-analysis': {
    voiceIntro: "We're going to describe a word by its features.",
    voiceTask: "Tell me what you know about this word.",
    voiceReminder: "Think about what group it belongs to, or what it looks like.",
    autoReadStimulus: false,
  },
  'sentence-construction': {
    voiceIntro: "Put these words in order to make a sentence.",
    voiceTask: "Arrange the words.",
    voiceReminder: "Which word comes first?",
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
