/**
 * Smart Coach — Game Trigger Engine
 * 
 * Maps detected patterns to REAL adaptive exercise components.
 * Games only appear when clinically triggered, never randomly.
 * 
 * Lifecycle: Detect → Explain → Offer → Launch Real Exercise → Summarize → Return
 */

import type { CoachState, GameTriggerEvent } from './types';

// ─── Game Definitions ────────────────────────────────────────

export interface GameDefinition {
  id: string;
  /** Canonical exercise slug (hyphenated, matches ExerciseModalHost) */
  exerciseSlug: string;
  label: string;
  description: string;
  /** What the user sees as the reason */
  rationale: string;
  /** Duration estimate */
  durationSec: number;
  /** Skill this targets */
  skillTarget: string;
  /** Icon identifier */
  icon: string;
  /** Default config for ExerciseModalHost */
  defaultConfig: {
    totalTrials?: number;
    difficultyTier?: number;
    cueLevel?: number;
  };
}

const GAME_CATALOG: Record<string, GameDefinition> = {
  category_fluency: {
    id: 'category_fluency',
    exerciseSlug: 'category-fluency',
    label: 'Quick Naming',
    description: 'Name as many items as you can in the category',
    rationale: 'This strengthens fast word retrieval — the same skill you need in conversation.',
    durationSec: 30,
    skillTarget: 'word_retrieval_speed',
    icon: '⚡',
    defaultConfig: { totalTrials: 1 },
  },
  photo_naming: {
    id: 'photo_naming',
    exerciseSlug: 'photo-naming',
    label: 'Name That Photo',
    description: 'Name the object in each picture',
    rationale: 'This practices direct word retrieval — finding the exact word you mean.',
    durationSec: 60,
    skillTarget: 'lexical_retrieval',
    icon: '📸',
    defaultConfig: { totalTrials: 5, difficultyTier: 1, cueLevel: 2 },
  },
  yes_no_comprehension: {
    id: 'yes_no_comprehension',
    exerciseSlug: 'yes-no-comprehension',
    label: 'Quick Check',
    description: 'Answer yes or no to simple questions',
    rationale: 'This checks understanding quickly and builds confidence.',
    durationSec: 30,
    skillTarget: 'comprehension_verification',
    icon: '✅',
    defaultConfig: { totalTrials: 5 },
  },
  meaning_match: {
    id: 'meaning_match',
    exerciseSlug: 'meaning-match',
    label: 'Meaning Match',
    description: 'Match words with their meanings',
    rationale: 'This strengthens the connections between related words in your memory.',
    durationSec: 45,
    skillTarget: 'semantic_network',
    icon: '🔗',
    defaultConfig: { totalTrials: 5, difficultyTier: 1 },
  },
  sentence_construction: {
    id: 'sentence_construction',
    exerciseSlug: 'sentence-construction',
    label: 'Build a Sentence',
    description: 'Arrange words into a correct sentence',
    rationale: 'This challenges sentence building — a step up from single words.',
    durationSec: 60,
    skillTarget: 'sentence_production',
    icon: '✏️',
    defaultConfig: { totalTrials: 3, difficultyTier: 2 },
  },
  semantic_features: {
    id: 'semantic_features',
    exerciseSlug: 'semantic-features',
    label: 'Word Features',
    description: 'Identify features of a target word',
    rationale: 'This builds the semantic network that makes retrieval easier.',
    durationSec: 60,
    skillTarget: 'semantic_depth',
    icon: '🧠',
    defaultConfig: { totalTrials: 3, difficultyTier: 1, cueLevel: 2 },
  },
  describe_guess: {
    id: 'describe_guess',
    exerciseSlug: 'describe-guess',
    label: 'Describe & Guess',
    description: 'Describe an object for someone to guess',
    rationale: 'This practices describing things clearly — a key real-world communication skill.',
    durationSec: 60,
    skillTarget: 'expressive_description',
    icon: '💬',
    defaultConfig: { totalTrials: 4, difficultyTier: 1 },
  },
  narrative_retell: {
    id: 'narrative_retell',
    exerciseSlug: 'narrative-retell',
    label: 'Story Retell',
    description: 'Listen to a short story and retell it',
    rationale: 'This strengthens connected speech — putting ideas together in order.',
    durationSec: 90,
    skillTarget: 'discourse_production',
    icon: '📖',
    defaultConfig: { totalTrials: 2, difficultyTier: 1 },
  },
  synonym_generator: {
    id: 'synonym_generator',
    exerciseSlug: 'synonym-generator',
    label: 'Word Alternatives',
    description: 'Think of different words that mean the same thing',
    rationale: 'This builds flexible word access — more ways to say what you mean.',
    durationSec: 45,
    skillTarget: 'lexical_flexibility',
    icon: '🔄',
    defaultConfig: { totalTrials: 4, difficultyTier: 1 },
  },
  minimal_pairs: {
    id: 'minimal_pairs',
    exerciseSlug: 'minimal-pairs',
    label: 'Sound Pairs',
    description: 'Tell apart similar-sounding words',
    rationale: 'This sharpens sound discrimination — hearing the difference matters for speaking.',
    durationSec: 45,
    skillTarget: 'phonological_discrimination',
    icon: '👂',
    defaultConfig: { totalTrials: 5, difficultyTier: 1 },
  },
};

// ─── Trigger Detection ──────────────────────────────────────

export type TriggerPattern =
  | 'hesitation_cluster'
  | 'semantic_error_cluster'
  | 'comprehension_breakdown'
  | 'success_plateau';

interface TriggerResult {
  triggered: boolean;
  pattern: TriggerPattern | null;
  confidence: number;
  observation: string;
}

/** Analyze state for game trigger conditions */
export function detectGameTrigger(state: CoachState): TriggerResult {
  const recent = state.recentHesitations || [];
  const hesCount = recent.filter(Boolean).length;
  const metrics = state.sessionMetrics;

  // Hesitation cluster: 3+ in last 5 turns
  if (hesCount >= 3) {
    return {
      triggered: true,
      pattern: 'hesitation_cluster',
      confidence: Math.min(1, hesCount / 5),
      observation: 'You paused several times searching for words.',
    };
  }

  // Semantic error cluster: 2+ semantic errors in session
  if (metrics.semanticErrorCount >= 2 && state.turnCount >= 3) {
    return {
      triggered: true,
      pattern: 'semantic_error_cluster',
      confidence: 0.7,
      observation: 'You had the idea but the exact word was hard to find.',
    };
  }

  // Comprehension breakdown: 2+ breaks
  if (metrics.comprehensionBreaks >= 2) {
    return {
      triggered: true,
      pattern: 'comprehension_breakdown',
      confidence: 0.6,
      observation: 'Some of the questions seemed unclear.',
    };
  }

  // Success plateau: 4+ independent, no hesitations — challenge up
  if (metrics.independentResponses >= 4 && hesCount === 0 && state.turnCount >= 4) {
    return {
      triggered: true,
      pattern: 'success_plateau',
      confidence: 0.8,
      observation: 'You\'re finding words quickly and easily.',
    };
  }

  return { triggered: false, pattern: null, confidence: 0, observation: '' };
}

// ─── Game Selection ─────────────────────────────────────────

const PATTERN_TO_GAME: Record<TriggerPattern, string> = {
  hesitation_cluster: 'category_fluency',
  semantic_error_cluster: 'photo_naming',
  comprehension_breakdown: 'yes_no_comprehension',
  success_plateau: 'sentence_construction',
};

/** Select the right game for a trigger pattern */
export function selectGame(pattern: TriggerPattern): GameDefinition {
  const gameId = PATTERN_TO_GAME[pattern];
  return GAME_CATALOG[gameId];
}

// ─── Intervention Framing ───────────────────────────────────

/** Build the observation → rationale → action frame for a game trigger */
export function buildInterventionFrame(trigger: TriggerResult, game: GameDefinition): {
  observation: string;
  rationale: string;
  action: string;
  offerText: string;
} {
  return {
    observation: trigger.observation,
    rationale: `A quick ${game.label.toLowerCase()} will help — ${game.defaultConfig.totalTrials || 5} items, then we'll use those words in conversation.`,
    action: `${game.rationale}`,
    offerText: `Let's do it.`,
  };
}

/** Games that produce speech output (vs receptive-only) */
const SPEECH_PRODUCING_GAMES = new Set([
  'photo_naming', 'category_fluency', 'sentence_construction', 'semantic_features',
  'describe_guess', 'narrative_retell', 'synonym_generator',
]);

/** Build the return-to-conversation text after a game using normalized results */
export function buildGameReturnText(
  game: GameDefinition,
  result: { score: number; summary: string; targetWords?: string[] },
  topic: string,
  interruptionContext?: { lastSubtopic: string; lastUserStruggle: string; lastPhraseAttempt: string },
): string {
  const producesSpeech = SPEECH_PRODUCING_GAMES.has(game.id);

  // Extract a concrete target word from result (no raw metrics)
  const targetWord = result.targetWords?.[0]
    || result.summary?.match(/"([^"]+)"/)?.[1]
    || null;

  // ── Receptive games (yes/no, meaning match) ──
  // Don't reference "words you practiced" — acknowledge understanding, restore confidence
  if (!producesSpeech) {
    if (interruptionContext) {
      return `Good — you understood that well. You were talking about ${interruptionContext.lastSubtopic}. What were you saying about it?`;
    }
    if (result.score >= 0.7) {
      return `You followed that well. Let's use that confidence — tell me something about your ${topic}.`;
    }
    return `Good practice. Now back to talking — what comes to mind about your ${topic}?`;
  }

  // ── Speech-producing games ──
  // Formula: acknowledge target → connect to real life → ask transfer question

  if (interruptionContext) {
    const struggled = interruptionContext.lastPhraseAttempt;
    if (result.score >= 0.7) {
      return `You got "${struggled}." Now use it — how would you say that to someone?`;
    }
    return `Good practice with that. Let's try "${struggled}" again — how would you describe it?`;
  }

  if (targetWord) {
    if (result.score >= 0.7) {
      return `Nice — you got "${targetWord}." Now use it: how would you tell someone about your ${topic}?`;
    }
    return `Good practice with "${targetWord}." Let's bring it back — what would you say about your ${topic}?`;
  }

  // Fallback — no specific target available
  if (result.score >= 0.7) {
    return `Good work on that. Now let's use those words — tell me about your ${topic}.`;
  }
  return `Good practice. Let's bring it back — what would you say about your ${topic}?`;
}

/** Build a GameTriggerEvent from trigger + game */
export function createGameTriggerEvent(
  trigger: TriggerResult,
  game: GameDefinition,
  accepted: boolean,
  resultSummary?: string
): GameTriggerEvent {
  return {
    triggerType: trigger.pattern as GameTriggerEvent['triggerType'],
    confidence: trigger.confidence,
    observedPattern: trigger.observation,
    recommendedGame: game.exerciseSlug,
    accepted,
    resultSummary,
  };
}

export { GAME_CATALOG };
export type { GameDefinition as GameDef };
