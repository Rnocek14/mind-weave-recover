/**
 * Smart Coach — Game Trigger Engine
 * 
 * Maps detected patterns to specific micro-game interventions.
 * Games only appear when clinically triggered, never randomly.
 * 
 * Lifecycle: Detect → Explain → Offer → Execute → Return
 */

import type { CoachState, GameTriggerEvent } from './types';

// ─── Game Definitions ────────────────────────────────────────

export interface GameDefinition {
  id: string;
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
}

const GAME_CATALOG: Record<string, GameDefinition> = {
  rapid_naming: {
    id: 'rapid_naming',
    label: 'Quick Naming',
    description: 'Name as many items as you can in the category',
    rationale: 'This strengthens fast word retrieval — the same skill you need in conversation.',
    durationSec: 30,
    skillTarget: 'word_retrieval_speed',
    icon: '⚡',
  },
  sentence_completion: {
    id: 'sentence_completion',
    label: 'Finish the Sentence',
    description: 'Complete sentences with the missing word',
    rationale: 'This practices finding words in context — how you actually use them.',
    durationSec: 45,
    skillTarget: 'contextual_retrieval',
    icon: '✏️',
  },
  yes_no_check: {
    id: 'yes_no_check',
    label: 'Quick Check',
    description: 'Answer yes or no to simple questions',
    rationale: 'This checks understanding quickly and builds confidence.',
    durationSec: 20,
    skillTarget: 'comprehension_verification',
    icon: '✅',
  },
  semantic_match: {
    id: 'semantic_match',
    label: 'Word Match',
    description: 'Match words that go together',
    rationale: 'This strengthens the connections between related words in your memory.',
    durationSec: 30,
    skillTarget: 'semantic_network',
    icon: '🔗',
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
  hesitation_cluster: 'rapid_naming',
  semantic_error_cluster: 'semantic_match',
  comprehension_breakdown: 'yes_no_check',
  success_plateau: 'sentence_completion',
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
    rationale: game.rationale,
    action: `Let's try a quick ${game.label.toLowerCase()} — about ${game.durationSec} seconds.`,
    offerText: `Want to try it, or keep talking?`,
  };
}

/** Build the return-to-conversation text after a game */
export function buildGameReturnText(game: GameDefinition, success: boolean, topic: string): string {
  if (success) {
    const returns = [
      `That came easier! The same ${game.skillTarget.replace(/_/g, ' ')} helps when we talk about ${topic}.`,
      `Nice — you found those quickly. Let's use that momentum back in our conversation about ${topic}.`,
      `See? That retrieval speed is there. Back to ${topic} — where were we?`,
    ];
    return returns[Math.floor(Math.random() * returns.length)];
  }
  
  const returns = [
    `That's good practice either way. Let's go back to ${topic} — no pressure.`,
    `Totally fine. That drill loosens up the pathways. Back to ${topic}?`,
    `All good — that exercise helps even when it's tough. Let's continue with ${topic}.`,
  ];
  return returns[Math.floor(Math.random() * returns.length)];
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
    recommendedGame: game.id,
    accepted,
    resultSummary,
  };
}

export { GAME_CATALOG };
export type { GameDefinition as GameDef };
