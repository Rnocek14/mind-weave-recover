/**
 * Conversation Coach Orchestrator
 * 
 * Rule-based decision engine that maps stuck types to appropriate interventions.
 * Decides when to continue conversation vs insert a mini-exercise card.
 * 
 * Key principles:
 * - Max 1 card per 2 AI turns (frequency limiter)
 * - Only insert cards after genuine stall events
 * - Never interrupt if user is flowing
 */

import { StuckType } from './stuckTypeClassifier';
import { FollowupType } from './conversationFollowups';

// Card types that can be inserted inline
export type CardType = 'photo_naming' | 'semantic_features' | 'thought_prompt' | 'phrase_starter' | 'yes_no' | 'recall_prompt';

// Configuration for each card type
export interface CardConfig {
  difficulty: 'easy' | 'medium';
  itemId?: string;
}

// Possible actions the orchestrator can take
export type NextAction =
  | { type: 'chat_followup'; followupType: FollowupType }
  | { type: 'insert_card'; cardType: CardType; config: CardConfig }
  | { type: 'wrap_up' };

// Session state for making decisions
export interface OrchestratorState {
  turnNumber: number;
  maxTurns: number;
  lastStuckType: StuckType | null;
  turnsSinceLastCard: number;
  cardsInsertedThisSession: number;
  recentStuckTypes: StuckType[];
  successStreak: number;
  lastCardType: CardType | null;
  yesNoSucceeded: boolean; // Track if yes/no card was successful (for escalation)
}

// Thresholds and limits
const LIMITS = {
  MIN_TURNS_BETWEEN_CARDS: 2,
  MAX_CARDS_PER_SESSION: 3,
  SUCCESS_STREAK_TO_AVOID_CARDS: 2,
};

/**
 * Main orchestrator function - decides what to do next
 */
export function getNextAction(
  stuckType: StuckType,
  state: OrchestratorState
): NextAction {
  const {
    turnNumber,
    maxTurns,
    turnsSinceLastCard,
    cardsInsertedThisSession,
    successStreak,
  } = state;

  // 1. Check if we should wrap up
  if (turnNumber >= maxTurns - 1) {
    return { type: 'wrap_up' };
  }

  // 2. If user is flowing well, just continue conversation
  if (stuckType === 'strong_flow') {
    return {
      type: 'chat_followup',
      followupType: selectFollowupForFlow(turnNumber),
    };
  }

  // 3. Check if we can insert a card (frequency limiter)
  const canInsertCard = 
    turnsSinceLastCard >= LIMITS.MIN_TURNS_BETWEEN_CARDS &&
    cardsInsertedThisSession < LIMITS.MAX_CARDS_PER_SESSION &&
    successStreak < LIMITS.SUCCESS_STREAK_TO_AVOID_CARDS;

  // 4. Decide based on stuck type
  if (canInsertCard) {
    const cardDecision = selectCardForStuckType(stuckType, state);
    if (cardDecision) {
      return cardDecision;
    }
  }

  // 5. Fallback to conversation follow-up
  return {
    type: 'chat_followup',
    followupType: selectFollowupForStuckType(stuckType, turnNumber),
  };
}

/**
 * Select the right card type based on stuck type and session history
 */
function selectCardForStuckType(stuckType: StuckType, state: OrchestratorState): NextAction | null {
  switch (stuckType) {
    case 'no_speech':
      // If they haven't done yes_no yet, start there (easiest)
      if (!state.yesNoSucceeded) {
        return {
          type: 'insert_card',
          cardType: 'yes_no',
          config: { difficulty: 'easy' },
        };
      }
      // After yes_no success, try photo naming
      return {
        type: 'insert_card',
        cardType: 'photo_naming',
        config: { difficulty: 'easy' },
      };

    case 'word_search_stall':
      // First try open recall (gentler than semantic features)
      if (state.lastCardType !== 'recall_prompt') {
        return {
          type: 'insert_card',
          cardType: 'recall_prompt',
          config: { difficulty: 'easy' },
        };
      }
      // If recall didn't help, try semantic features (circumlocution)
      return {
        type: 'insert_card',
        cardType: 'semantic_features',
        config: { difficulty: 'easy' },
      };

    case 'prompt_overload':
      // Too broad - offer starter phrases
      return {
        type: 'insert_card',
        cardType: 'phrase_starter',
        config: { difficulty: 'easy' },
      };

    case 'thought_abandonment':
      // Trailed off - try a narrowed thought prompt
      return {
        type: 'insert_card',
        cardType: 'thought_prompt',
        config: { difficulty: 'easy' },
      };

    case 'strong_flow':
      // User is doing well - don't insert card
      return null;

    default:
      return null;
  }
}

/**
 * Select follow-up type when user is flowing well
 */
function selectFollowupForFlow(turnNumber: number): FollowupType {
  // Vary the follow-ups to keep conversation natural
  const flowFollowups: FollowupType[] = ['what_next', 'how_felt', 'tell_more'];
  return flowFollowups[turnNumber % flowFollowups.length];
}

/**
 * Select follow-up type based on stuck type (when not inserting a card)
 */
function selectFollowupForStuckType(stuckType: StuckType, turnNumber: number): FollowupType {
  switch (stuckType) {
    case 'no_speech':
    case 'prompt_overload':
      // Narrow down
      return 'clarify_small';

    case 'word_search_stall':
      // Just acknowledge and let them try again
      return turnNumber === 0 ? 'tell_more' : 'acknowledge';

    case 'thought_abandonment':
      // Help them continue
      return 'what_next';

    case 'strong_flow':
      return 'tell_more';

    default:
      return 'acknowledge';
  }
}

/**
 * Create initial orchestrator state
 */
export function createInitialState(maxTurns: number = 5): OrchestratorState {
  return {
    turnNumber: 0,
    maxTurns,
    lastStuckType: null,
    turnsSinceLastCard: LIMITS.MIN_TURNS_BETWEEN_CARDS, // Allow card on first stall
    cardsInsertedThisSession: 0,
    recentStuckTypes: [],
    successStreak: 0,
    lastCardType: null,
    yesNoSucceeded: false,
  };
}

/**
 * Update state after a turn
 */
export function updateState(
  state: OrchestratorState,
  stuckType: StuckType,
  cardInserted: boolean,
  cardType?: CardType,
  cardSuccess?: boolean
): OrchestratorState {
  const newSuccessStreak = stuckType === 'strong_flow' 
    ? state.successStreak + 1 
    : 0;

  // Track if yes_no card succeeded (for escalation logic)
  const yesNoSucceeded = state.yesNoSucceeded || 
    (cardType === 'yes_no' && cardSuccess === true);

  return {
    ...state,
    turnNumber: state.turnNumber + 1,
    lastStuckType: stuckType,
    turnsSinceLastCard: cardInserted ? 0 : state.turnsSinceLastCard + 1,
    cardsInsertedThisSession: cardInserted 
      ? state.cardsInsertedThisSession + 1 
      : state.cardsInsertedThisSession,
    recentStuckTypes: [...state.recentStuckTypes.slice(-4), stuckType],
    successStreak: newSuccessStreak,
    lastCardType: cardInserted && cardType ? cardType : state.lastCardType,
    yesNoSucceeded,
  };
}

/**
 * Conversational wrappers for card insertions
 */
export const CARD_INTRO_LINES: Record<CardType, string[]> = {
  photo_naming: [
    "Let's try a quick warm-up.",
    "Here's something quick.",
    "Let's do an easy one.",
  ],
  semantic_features: [
    "Let me help—describe this for me.",
    "Try telling me about this.",
    "Describe what you see here.",
  ],
  thought_prompt: [
    "Try finishing this thought.",
    "Here's an easier one.",
    "Start with this.",
  ],
  phrase_starter: [
    "Pick one of these to start.",
    "Try one of these phrases.",
    "Use one of these to begin.",
  ],
  yes_no: [
    "Let me ask you something simple.",
    "Quick question for you.",
    "Just a yes or no.",
  ],
  recall_prompt: [
    "Think of any word.",
    "Name anything that comes to mind.",
    "Just one word is fine.",
  ],
};

export const CARD_OUTRO_LINES: string[] = [
  "Nice. Back to what you were saying.",
  "Good. Now, where were we?",
  "Got it. Let's continue.",
  "Great. Back to our chat.",
];

/**
 * Get a random intro line for a card type
 */
export function getCardIntro(cardType: CardType): string {
  const lines = CARD_INTRO_LINES[cardType];
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * Get a random outro line after completing a card
 */
export function getCardOutro(): string {
  return CARD_OUTRO_LINES[Math.floor(Math.random() * CARD_OUTRO_LINES.length)];
}
