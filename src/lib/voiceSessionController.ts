/**
 * Voice Session Controller
 * 
 * Manages the flow of a voice-only practice session:
 * - Picks games based on difficulty/variety
 * - Manages transitions between games
 * - Tracks session progress
 * - Provides Maya's verbal transitions
 */

import {
  VoiceGameType,
  VOICE_GAMES,
  CATEGORY_PROMPTS,
  SENTENCE_EXPANSION_PROMPTS,
  SYNONYM_PROMPTS,
  OPPOSITE_PROMPTS,
  FILL_BLANK_PROMPTS,
  DESCRIBE_PROMPTS,
  YES_NO_PROMPTS,
  VOICE_STORIES,
} from '@/data/voiceGames';
import { shuffleArray } from '@/lib/shuffle';

export interface VoiceGameRound {
  gameType: VoiceGameType;
  label: string;
  intro: string;
  prompt: string;
  /** For scoring — acceptable answers or key details */
  expectedAnswers: string[];
  /** Extra data for the game */
  meta?: Record<string, any>;
}

export interface VoiceSessionPlan {
  rounds: VoiceGameRound[];
  totalRounds: number;
}

const TRANSITIONS = [
  "Nice work! Let's try something different.",
  "Great job. Here's another one.",
  "You're doing well! Let's keep going.",
  "Okay, switching it up a bit.",
  "Love it. Ready for the next one?",
  "That was good! Here's something new.",
];

function pickTransition(): string {
  return TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)];
}

function filterByDifficulty<T extends { difficulty: number }>(items: T[], maxDifficulty: number): T[] {
  return items.filter(i => i.difficulty <= maxDifficulty);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Build a voice session plan with a mix of game types.
 * @param roundCount Number of micro-games to include
 * @param difficulty 1-3 difficulty cap
 * @param preferredGames Optional subset of game types to prefer
 */
export function buildVoiceSessionPlan(
  roundCount: number = 6,
  difficulty: number = 1,
  preferredGames?: VoiceGameType[]
): VoiceSessionPlan {
  // Pick game types — ensure variety
  const availableTypes = preferredGames?.length 
    ? VOICE_GAMES.filter(g => preferredGames.includes(g.type))
    : VOICE_GAMES;
  
  const shuffledTypes = shuffleArray([...availableTypes]);
  const rounds: VoiceGameRound[] = [];

  for (let i = 0; i < roundCount; i++) {
    const gameDef = shuffledTypes[i % shuffledTypes.length];
    const round = generateRound(gameDef.type, difficulty);
    if (round) rounds.push(round);
  }

  return { rounds, totalRounds: rounds.length };
}

function generateRound(type: VoiceGameType, maxDiff: number): VoiceGameRound | null {
  const gameDef = VOICE_GAMES.find(g => g.type === type)!;

  switch (type) {
    case 'story_retell': {
      const stories = filterByDifficulty(VOICE_STORIES, maxDiff);
      if (!stories.length) return null;
      const story = pickRandom(stories);
      return {
        gameType: type,
        label: gameDef.label,
        intro: gameDef.intro,
        prompt: story.text,
        expectedAnswers: story.keyDetails,
        meta: { storyId: story.id },
      };
    }
    case 'category_fluency': {
      const cats = filterByDifficulty(CATEGORY_PROMPTS, maxDiff);
      if (!cats.length) return null;
      const cat = pickRandom(cats);
      return {
        gameType: type,
        label: gameDef.label,
        intro: gameDef.intro,
        prompt: `Name as many ${cat.category} as you can.`,
        expectedAnswers: cat.examples,
        meta: { category: cat.category },
      };
    }
    case 'sentence_expansion': {
      const prompts = filterByDifficulty(SENTENCE_EXPANSION_PROMPTS, maxDiff);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type,
        label: gameDef.label,
        intro: gameDef.intro,
        prompt: `Say: "${p.starter}"`,
        expectedAnswers: p.expansionHints,
        meta: { starter: p.starter, hints: p.expansionHints },
      };
    }
    case 'synonym_swap': {
      const prompts = filterByDifficulty(SYNONYM_PROMPTS, maxDiff);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type,
        label: gameDef.label,
        intro: gameDef.intro,
        prompt: `What's another word for "${p.word}"?`,
        expectedAnswers: p.synonyms,
      };
    }
    case 'opposites': {
      const prompts = filterByDifficulty(OPPOSITE_PROMPTS, maxDiff);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type,
        label: gameDef.label,
        intro: gameDef.intro,
        prompt: `What's the opposite of "${p.word}"?`,
        expectedAnswers: [p.opposite],
      };
    }
    case 'fill_blank': {
      const prompts = filterByDifficulty(FILL_BLANK_PROMPTS, maxDiff);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type,
        label: gameDef.label,
        intro: gameDef.intro,
        prompt: p.sentence,
        expectedAnswers: p.answer,
      };
    }
    case 'describe_without_naming': {
      const prompts = filterByDifficulty(DESCRIBE_PROMPTS, maxDiff);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type,
        label: gameDef.label,
        intro: gameDef.intro,
        prompt: `Describe a "${p.word}" without saying the word.`,
        expectedAnswers: p.hints,
        meta: { targetWord: p.word },
      };
    }
    case 'yes_no_why': {
      const prompts = filterByDifficulty(YES_NO_PROMPTS, maxDiff);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type,
        label: gameDef.label,
        intro: gameDef.intro,
        prompt: p.question,
        expectedAnswers: [],  // open-ended
      };
    }
  }
  return null;
}

/** Score a voice game round response */
export function scoreVoiceRound(
  round: VoiceGameRound,
  transcript: string
): { score: number; matchedCount: number; totalExpected: number; feedback: string } {
  if (!transcript || transcript.trim().length < 2) {
    return { score: 0, matchedCount: 0, totalExpected: round.expectedAnswers.length, feedback: "I didn't catch that. Let's move on." };
  }

  const lower = transcript.toLowerCase();
  
  // For open-ended games (yes_no_why), score by word count
  if (round.gameType === 'yes_no_why') {
    const words = lower.split(/\s+/).filter(w => w.length > 1).length;
    const score = Math.min(1, words / 8); // 8+ words = full score
    const feedback = words >= 5 
      ? "Great answer! You explained that well."
      : words >= 2 
        ? "Good. Can you tell me a bit more next time?"
        : "Try to say more. Even a short reason helps!";
    return { score, matchedCount: words, totalExpected: 8, feedback };
  }

  // For sentence expansion, score by whether they expanded
  if (round.gameType === 'sentence_expansion') {
    const starterWords = (round.meta?.starter as string || '').split(/\s+/).length;
    const responseWords = lower.split(/\s+/).filter(w => w.length > 1).length;
    const expanded = responseWords > starterWords;
    const score = expanded ? Math.min(1, responseWords / (starterWords + 4)) : 0.3;
    const feedback = expanded 
      ? "Nice expansion! You added good detail."
      : "Try to add more to the sentence next time.";
    return { score, matchedCount: responseWords, totalExpected: starterWords + 4, feedback };
  }

  // For describe-without-naming, check they didn't say the word
  if (round.gameType === 'describe_without_naming') {
    const targetWord = (round.meta?.targetWord as string || '').toLowerCase();
    const saidTarget = lower.includes(targetWord);
    const words = lower.split(/\s+/).filter(w => w.length > 1).length;
    const score = saidTarget ? 0.3 : Math.min(1, words / 6);
    const feedback = saidTarget
      ? `Oops, you said "${targetWord}"! Try describing it differently.`
      : words >= 4
        ? "Great description! I could tell what you meant."
        : "Good start. Try adding more details.";
    return { score, matchedCount: words, totalExpected: 6, feedback };
  }

  // Standard matching: count how many expected answers appear in transcript
  let matched = 0;
  for (const answer of round.expectedAnswers) {
    if (lower.includes(answer.toLowerCase())) matched++;
  }

  const total = Math.max(1, round.expectedAnswers.length);
  const ratio = matched / total;
  
  let feedback: string;
  if (round.gameType === 'story_retell') {
    feedback = ratio >= 0.7 
      ? `Excellent! You remembered ${matched} out of ${total} details.`
      : ratio >= 0.4
        ? `Good effort! You got ${matched} details. Let's keep practicing.`
        : `You recalled ${matched} details. That's okay — it gets easier with practice.`;
  } else if (round.gameType === 'category_fluency') {
    feedback = matched >= 5
      ? `Great! You named ${matched}. That's strong.`
      : matched >= 3
        ? `Nice, you got ${matched}. Can you think of more next time?`
        : `You named ${matched}. Let's try to get a few more next time.`;
  } else {
    feedback = ratio >= 0.5
      ? "That's right! Well done."
      : matched > 0
        ? "Close! Good try."
        : "Not quite, but that's okay. Let's keep going.";
  }

  return { score: ratio, matchedCount: matched, totalExpected: total, feedback };
}

/** Get a warm session opening line */
export function getSessionOpening(): string {
  const openers = [
    "Hey! Let's do some quick voice practice. Just listen and respond — no screen needed.",
    "Ready for some voice exercises? I'll guide you through a few quick ones.",
    "Let's practice together. I'll talk, you respond. Nice and easy.",
    "Hi! Let's do a bit of talking practice. Just follow along with my voice.",
  ];
  return pickRandom(openers);
}

/** Get a session wrap-up line */
export function getSessionClosing(roundsCompleted: number, avgScore: number): string {
  if (avgScore >= 0.7) {
    return `Great session! You completed ${roundsCompleted} exercises and did really well. Keep it up!`;
  } else if (avgScore >= 0.4) {
    return `Good work! ${roundsCompleted} exercises done. You're making progress — every practice counts.`;
  }
  return `Nice effort! ${roundsCompleted} exercises completed. The more you practice, the easier it gets.`;
}

export { pickTransition };
