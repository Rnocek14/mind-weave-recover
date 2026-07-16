/**
 * Voice Session Controller
 * 
 * Manages the flow of a voice-only practice session using CONVERSATION ARCS:
 * 
 * Arc Phases:
 * 1. OPEN    — general, easy questions to warm up (category, yes/no)
 * 2. EXPAND  — deepen the topic (sentence expansion, describe, why)
 * 3. CHALLENGE — push retrieval/speed (synonyms, opposites, describe)
 * 4. CONSOLIDATE — tie it together (retell, expansion, reflection)
 * 
 * To the user it feels like ONE evolving conversation about a topic.
 * To the system it's structured therapy with measurable progression.
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
  SESSION_TOPICS,
  ARC_PHASE_CONFIGS,
  type SessionTopic,
  type SessionTopicDef,
  type ArcPhase,
} from '@/data/voiceGames';
import { shuffleArray } from '@/lib/shuffle';

export interface VoiceGameRound {
  gameType: VoiceGameType;
  label: string;
  intro: string;
  prompt: string;
  expectedAnswers: string[];
  meta?: Record<string, any>;
  followUp?: string;
  arcPhase: ArcPhase;
}

export interface VoiceSessionPlan {
  rounds: VoiceGameRound[];
  totalRounds: number;
  topic: SessionTopicDef;
}

// ─── Arc-aware Transitions ───

const TRANSITIONS_WITHIN_PHASE = [
  "Nice. Here's another one along the same lines.",
  "Good. Let's keep going with this.",
  "Mm-hmm. One more thing about this.",
  "Love it. Here's something related.",
];

// ─── Memory Callback Templates ───
const MEMORY_CALLBACKS_EXPAND = [
  "Earlier you mentioned {snippet} — let's build on that.",
  "Going back to when you talked about {snippet} — tell me more about that.",
  "You said something about {snippet} before. Can you add to it?",
];

const MEMORY_CALLBACKS_CHALLENGE = [
  "Remember when you mentioned {snippet}? Let's try something harder with that.",
  "You brought up {snippet} earlier — can you describe that without saying the word?",
  "Think back to {snippet}. Can you say it a different way?",
];

const MEMORY_CALLBACKS_CONSOLIDATE = [
  "Let's go back to everything we talked about. You mentioned {snippet} — tell me the whole thing again.",
  "We started with {snippet}. Can you retell what you remember from today?",
  "You've talked about a lot today, including {snippet}. Let's bring it all together.",
];

/** Extract a short, meaningful snippet from a transcript for memory callbacks */
export function extractMemorySnippet(transcript: string): string | null {
  if (!transcript || transcript.trim().length < 5) return null;
  const words = transcript.trim().split(/\s+/).filter(w => w.length > 1);
  if (words.length < 2) return null;
  // Take 2-5 meaningful words from the middle of the response
  const start = Math.max(0, Math.floor(words.length * 0.2));
  const end = Math.min(words.length, start + 5);
  return words.slice(start, end).join(' ');
}

/** Get a memory callback line for a given arc phase, inserting the snippet */
export function getMemoryCallback(
  phase: ArcPhase,
  snippets: string[],
): string | null {
  if (snippets.length === 0) return null;
  const snippet = pickRandom(snippets);
  
  let templates: string[];
  switch (phase) {
    case 'expand': templates = MEMORY_CALLBACKS_EXPAND; break;
    case 'challenge': templates = MEMORY_CALLBACKS_CHALLENGE; break;
    case 'consolidate': templates = MEMORY_CALLBACKS_CONSOLIDATE; break;
    default: return null; // 'open' phase doesn't reference earlier content
  }
  
  return pickRandom(templates).replace('{snippet}', snippet);
}

// ─── Purpose Anchors (every ~3 rounds) ───
const PURPOSE_ANCHORS = [
  "This is great practice for everyday conversations.",
  "This kind of practice helps you find words faster in real life.",
  "The more you do this, the easier real conversations get.",
  "This is exactly what helps when words feel stuck.",
  "Every time you practice this, it gets a little smoother.",
];

// ─── Progress Feedback ───
const PROGRESS_SPEED = [
  "You found that word faster that time.",
  "That came out quicker — nice.",
  "You didn't hesitate there. Good.",
];

const PROGRESS_INDEPENDENCE = [
  "You didn't need any help there — nice.",
  "You got that on your own.",
  "No hints needed. That's progress.",
];

const PROGRESS_EXPANSION = [
  "That was a longer, more complete answer.",
  "You added more detail that time.",
  "Nice — that was a fuller response.",
];

const PROGRESS_GENERIC = [
  "That sounded smoother.",
  "You're getting the hang of this.",
  "That was well said.",
];

// ─── Follow-up Prompts ───
const FOLLOW_UPS_MORE = [
  "Can you think of one more?",
  "Any others come to mind?",
  "What else?",
  "One more?",
];

const FOLLOW_UPS_EXPAND = [
  "Can you add a bit more to that?",
  "Tell me one more detail.",
  "Say that again, a bit longer this time.",
  "Nice — now add why.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function filterByDifficulty<T extends { difficulty: number }>(items: T[], maxDifficulty: number): T[] {
  return items.filter(i => i.difficulty <= maxDifficulty);
}

function filterByTopic<T extends { topics: SessionTopic[] }>(items: T[], topic: SessionTopic): T[] {
  const topicMatches = items.filter(i => i.topics.includes(topic));
  return topicMatches.length > 0 ? topicMatches : items;
}

/** Pick a transition that fits the arc context */
export function pickTransition(
  prevPhase: ArcPhase | undefined,
  nextPhase: ArcPhase,
  topicDef?: SessionTopicDef,
): string {
  // Phase change → use arc phase transition
  if (prevPhase !== nextPhase) {
    const phaseConfig = ARC_PHASE_CONFIGS.find(c => c.phase === nextPhase);
    if (phaseConfig && phaseConfig.transitions.length > 0) {
      // Consolidate gets a continuity bridge prefix
      if (nextPhase === 'consolidate' && topicDef?.continuityBridges?.length) {
        return pickRandom(topicDef.continuityBridges) + pickRandom(phaseConfig.transitions).toLowerCase();
      }
      return pickRandom(phaseConfig.transitions);
    }
  }
  // Same phase → within-phase transition
  return pickRandom(TRANSITIONS_WITHIN_PHASE);
}

/** Get a purpose anchor */
export function getPurposeAnchor(): string {
  return pickRandom(PURPOSE_ANCHORS);
}

/** Get specific progress feedback */
export function getProgressFeedback(
  score: number,
  wordCount: number,
  gameType: VoiceGameType,
  previousScores: number[],
): string | null {
  if (score < 0.4) return null;
  const recentAvg = previousScores.length > 0
    ? previousScores.slice(-3).reduce((a, b) => a + b, 0) / Math.min(previousScores.length, 3)
    : 0;
  if (score > recentAvg + 0.1 && previousScores.length > 0) return pickRandom(PROGRESS_SPEED);
  if (score >= 0.7 && gameType !== 'story_retell') return pickRandom(PROGRESS_INDEPENDENCE);
  if (wordCount >= 8 && (gameType === 'sentence_expansion' || gameType === 'yes_no_why')) return pickRandom(PROGRESS_EXPANSION);
  if (score >= 0.6) return pickRandom(PROGRESS_GENERIC);
  return null;
}

/** Get a follow-up prompt */
export function getFollowUp(gameType: VoiceGameType): string {
  if (gameType === 'category_fluency') return pickRandom(FOLLOW_UPS_MORE);
  if (gameType === 'sentence_expansion' || gameType === 'yes_no_why' || gameType === 'story_retell') return pickRandom(FOLLOW_UPS_EXPAND);
  return pickRandom(FOLLOW_UPS_MORE);
}

// ─── Arc-based Session Planning ───

/** Assign arc phases to round indices */
function getArcPhaseForIndex(index: number, total: number): ArcPhase {
  const ratio = index / total;
  if (ratio < 0.25) return 'open';
  if (ratio < 0.5) return 'expand';
  if (ratio < 0.75) return 'challenge';
  return 'consolidate';
}

/**
 * Build a voice session plan with conversation arcs.
 */
export function buildVoiceSessionPlan(
  roundCount: number = 6,
  difficulty: number = 1,
  preferredGames?: VoiceGameType[],
  forceTopic?: SessionTopic,
): VoiceSessionPlan {
  const topicDef = forceTopic
    ? SESSION_TOPICS.find(t => t.topic === forceTopic) || pickRandom(SESSION_TOPICS)
    : pickRandom(SESSION_TOPICS);

  const rounds: VoiceGameRound[] = [];

  for (let i = 0; i < roundCount; i++) {
    const arcPhase = getArcPhaseForIndex(i, roundCount);
    const phaseConfig = ARC_PHASE_CONFIGS.find(c => c.phase === arcPhase)!;

    // Combine phase-preferred + topic-preferred games, weighted
    const phaseGames = phaseConfig.preferredGames;
    const topicGames = topicDef.preferredGames;
    
    // Games that match BOTH phase and topic get triple weight
    const candidates = preferredGames?.length
      ? VOICE_GAMES.filter(g => preferredGames.includes(g.type))
      : VOICE_GAMES;

    const weighted: VoiceGameType[] = [];
    for (const game of candidates) {
      const inPhase = phaseGames.includes(game.type);
      const inTopic = topicGames.includes(game.type);
      if (inPhase && inTopic) {
        weighted.push(game.type, game.type, game.type); // triple
      } else if (inPhase) {
        weighted.push(game.type, game.type); // double
      } else if (inTopic) {
        weighted.push(game.type);
      }
    }

    // Fallback if nothing matched
    if (weighted.length === 0) {
      for (const g of phaseGames) weighted.push(g);
    }

    // Avoid same game as previous round
    let chosen = pickRandom(weighted);
    if (rounds.length > 0 && rounds[rounds.length - 1].gameType === chosen) {
      const alt = weighted.find(t => t !== chosen);
      if (alt) chosen = alt;
    }

    const round = generateRound(chosen, difficulty, topicDef.topic, arcPhase);
    if (round) rounds.push(round);
  }

  return { rounds, totalRounds: rounds.length, topic: topicDef };
}

function generateRound(type: VoiceGameType, maxDiff: number, topic: SessionTopic, arcPhase: ArcPhase): VoiceGameRound | null {
  const gameDef = VOICE_GAMES.find(g => g.type === type)!;

  switch (type) {
    case 'story_retell': {
      const stories = filterByTopic(filterByDifficulty(VOICE_STORIES, maxDiff), topic);
      if (!stories.length) return null;
      const story = pickRandom(stories);
      const retellCues = [
        "Now tell it back to me — in your own words.",
        "Okay, now you retell that story. Include as many details as you can.",
        "Your turn — tell me what happened in the story.",
        "Now retell that back to me, like you're telling a friend.",
      ];
      const promptWithCue = story.text + ' ... ' + pickRandom(retellCues);
      return {
        gameType: type, label: gameDef.label, intro: gameDef.intro,
        prompt: promptWithCue, expectedAnswers: story.keyDetails,
        meta: { storyId: story.id }, followUp: "What part stood out to you the most?",
        arcPhase,
      };
    }
    case 'category_fluency': {
      const cats = filterByTopic(filterByDifficulty(CATEGORY_PROMPTS, maxDiff), topic);
      if (!cats.length) return null;
      const cat = pickRandom(cats);
      return {
        gameType: type, label: gameDef.label, intro: gameDef.intro,
        prompt: cat.conversationalPrompt, expectedAnswers: cat.examples,
        meta: { category: cat.category }, followUp: pickRandom(FOLLOW_UPS_MORE),
        arcPhase,
      };
    }
    case 'sentence_expansion': {
      const prompts = filterByTopic(filterByDifficulty(SENTENCE_EXPANSION_PROMPTS, maxDiff), topic);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type, label: gameDef.label, intro: gameDef.intro,
        prompt: `Say: "${p.starter}"`, expectedAnswers: p.expansionHints,
        meta: { starter: p.starter, hints: p.expansionHints, expansionCue: p.expansionCue },
        followUp: p.expansionCue,
        arcPhase,
      };
    }
    case 'synonym_swap': {
      const prompts = filterByDifficulty(SYNONYM_PROMPTS, maxDiff);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type, label: gameDef.label, intro: gameDef.intro,
        prompt: p.conversationalPrompt, expectedAnswers: p.synonyms,
        arcPhase,
      };
    }
    case 'opposites': {
      const prompts = filterByDifficulty(OPPOSITE_PROMPTS, maxDiff);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type, label: gameDef.label, intro: gameDef.intro,
        prompt: p.conversationalPrompt, expectedAnswers: [p.opposite],
        arcPhase,
      };
    }
    case 'fill_blank': {
      const prompts = filterByTopic(filterByDifficulty(FILL_BLANK_PROMPTS, maxDiff), topic);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type, label: gameDef.label, intro: gameDef.intro,
        prompt: p.sentence, expectedAnswers: p.answer,
        arcPhase,
      };
    }
    case 'describe_without_naming': {
      const prompts = filterByTopic(filterByDifficulty(DESCRIBE_PROMPTS, maxDiff), topic);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type, label: gameDef.label, intro: gameDef.intro,
        prompt: `Describe a "${p.word}" without saying the word — like you're giving someone a clue.`,
        expectedAnswers: p.hints, meta: { targetWord: p.word },
        arcPhase,
      };
    }
    case 'yes_no_why': {
      const prompts = filterByTopic(filterByDifficulty(YES_NO_PROMPTS, maxDiff), topic);
      if (!prompts.length) return null;
      const p = pickRandom(prompts);
      return {
        gameType: type, label: gameDef.label, intro: gameDef.intro,
        prompt: p.question, expectedAnswers: [],
        followUp: "Why do you think that?",
        arcPhase,
      };
    }
  }
  return null;
}

/**
 * Score a voice game round response.
 *
 * ⚠️ QUARANTINED (docs/voice-engine-v2-spec.md §11): this is a word-count /
 * keyword-substring heuristic, not clinical measurement — it is gameable by
 * fillers and length. Its output may drive Maya's conversational feedback ONLY.
 * It must never feed accuracy, progression, or adaptation: the telemetry write
 * marks these rounds counts_toward_score:false and sessionAccuracySummary
 * excludes the voice_practice slug. Do not tune this heuristic — sentence-level
 * scoring is rebuilt on CIU concept coverage (spec §7) in V2.2.
 */
export function scoreVoiceRound(
  round: VoiceGameRound,
  transcript: string
): { score: number; matchedCount: number; totalExpected: number; feedback: string; wordCount: number } {
  const wordCount = transcript ? transcript.trim().split(/\s+/).filter(w => w.length > 1).length : 0;

  if (!transcript || transcript.trim().length < 2) {
    return { score: 0, matchedCount: 0, totalExpected: round.expectedAnswers.length, feedback: "That's okay. Let's try the next one.", wordCount: 0 };
  }

  const lower = transcript.toLowerCase();

  if (round.gameType === 'yes_no_why') {
    const score = Math.min(1, wordCount / 8);
    const feedback = wordCount >= 5
      ? "Good answer. You explained that well."
      : wordCount >= 2
        ? "Good start. Try adding a bit more about why."
        : "Even a short reason helps. Try telling me why next time.";
    return { score, matchedCount: wordCount, totalExpected: 8, feedback, wordCount };
  }

  if (round.gameType === 'sentence_expansion') {
    const starterWords = (round.meta?.starter as string || '').split(/\s+/).length;
    const expanded = wordCount > starterWords;
    const score = expanded ? Math.min(1, wordCount / (starterWords + 4)) : 0.3;
    const feedback = expanded
      ? "Nice — you added good detail to that."
      : "Try adding something more next time — where, when, or why.";
    return { score, matchedCount: wordCount, totalExpected: starterWords + 4, feedback, wordCount };
  }

  if (round.gameType === 'describe_without_naming') {
    const targetWord = (round.meta?.targetWord as string || '').toLowerCase();
    const saidTarget = lower.includes(targetWord);
    const score = saidTarget ? 0.3 : Math.min(1, wordCount / 6);
    const feedback = saidTarget
      ? `Oops, you said "${targetWord}"! Try describing it without the word next time.`
      : wordCount >= 4
        ? "Good description! I could picture what you meant."
        : "Good start. Try adding one more detail next time.";
    return { score, matchedCount: wordCount, totalExpected: 6, feedback, wordCount };
  }

  // Standard matching
  let matched = 0;
  for (const answer of round.expectedAnswers) {
    if (lower.includes(answer.toLowerCase())) matched++;
  }

  const total = Math.max(1, round.expectedAnswers.length);
  const ratio = matched / total;

  let feedback: string;
  if (round.gameType === 'story_retell') {
    feedback = ratio >= 0.7
      ? `You remembered most of that — ${matched} details. That's strong.`
      : ratio >= 0.4
        ? `Good — you got ${matched} details. Try adding one more next time.`
        : `You recalled ${matched} details. That's a start — it gets easier with practice.`;
  } else if (round.gameType === 'category_fluency') {
    feedback = matched >= 5
      ? `Nice! You came up with ${matched}. That's really good.`
      : matched >= 3
        ? `Good, you got ${matched}. Can you think of any more?`
        : `You named ${matched}. Let's see if more come to mind next time.`;
  } else {
    feedback = ratio >= 0.5
      ? "That's it. Well done."
      : matched > 0
        ? "Close! You're on the right track."
        : "Not quite — but that's okay. Let's keep going.";
  }

  return { score: ratio, matchedCount: matched, totalExpected: total, feedback, wordCount };
}

/** Get a warm session opening line */
export function getSessionOpening(topicDef: SessionTopicDef): string {
  return pickRandom(topicDef.openers);
}

/** Get a session wrap-up line */
export function getSessionClosing(roundsCompleted: number, avgScore: number): string {
  const purposeClose = "Every practice like this makes real conversations easier.";
  if (avgScore >= 0.7) {
    return `That was a good one! You completed ${roundsCompleted} exercises and did really well. ${purposeClose}`;
  } else if (avgScore >= 0.4) {
    return `Nice work! ${roundsCompleted} exercises done. You're building up. ${purposeClose}`;
  }
  return `Good effort! ${roundsCompleted} done. The more you practice, the smoother it gets. ${purposeClose}`;
}
