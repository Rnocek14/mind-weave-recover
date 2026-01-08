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

// Speech analysis data for smarter card selection
export interface SpeechAnalysisForOrchestrator {
  effortfulSpeech: boolean;
  circumlocutionDetected: boolean;
  fluencyScore: number;
  pausePattern: 'fluent' | 'hesitant' | 'very_slow';
  wordCount: number;
  filledPauseCount: number;
}

// Thresholds and limits
const LIMITS = {
  MIN_TURNS_BETWEEN_CARDS: 3,
  MAX_CARDS_PER_SESSION: 3,
  SUCCESS_STREAK_TO_AVOID_CARDS: 3,
};

/**
 * Main orchestrator function - decides what to do next
 * Now accepts optional speech analysis for smarter decisions
 */
export function getNextAction(
  stuckType: StuckType,
  state: OrchestratorState,
  speechAnalysis?: SpeechAnalysisForOrchestrator
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

  // 2. If user is flowing well AND speech analysis confirms good fluency, continue
  if (stuckType === 'strong_flow') {
    // Double-check with speech analysis if available
    if (speechAnalysis && speechAnalysis.effortfulSpeech) {
      // User seems stuck but got words out - might need support
      // Don't insert card, but use gentler followup
      return {
        type: 'chat_followup',
        followupType: 'acknowledge',
      };
    }
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

  // 4. Use speech analysis for smarter card selection
  if (canInsertCard && speechAnalysis) {
    const cardDecision = selectCardBasedOnSpeechAnalysis(speechAnalysis, state);
    if (cardDecision) {
      return cardDecision;
    }
  }

  // 5. Fall back to stuck-type based card selection
  if (canInsertCard) {
    const cardDecision = selectCardForStuckType(stuckType, state);
    if (cardDecision) {
      return cardDecision;
    }
  }

  // 6. Fallback to conversation follow-up
  return {
    type: 'chat_followup',
    followupType: selectFollowupForStuckType(stuckType, turnNumber),
  };
}

/**
 * Select card based on speech analysis data (smarter than stuck type alone)
 */
function selectCardBasedOnSpeechAnalysis(
  speechAnalysis: SpeechAnalysisForOrchestrator, 
  state: OrchestratorState
): NextAction | null {
  const { effortfulSpeech, circumlocutionDetected, pausePattern, wordCount, filledPauseCount } = speechAnalysis;
  
  // Very effortful + very slow = reduce cognitive load with simple yes/no
  if (effortfulSpeech && pausePattern === 'very_slow' && !state.yesNoSucceeded) {
    return {
      type: 'insert_card',
      cardType: 'yes_no',
      config: { difficulty: 'easy' },
    };
  }
  
  // Circumlocution detected = practice direct naming
  if (circumlocutionDetected) {
    return {
      type: 'insert_card',
      cardType: 'photo_naming',
      config: { difficulty: 'easy' },
    };
  }
  
  // High filled pause count = needs structure
  if (filledPauseCount >= 3) {
    return {
      type: 'insert_card',
      cardType: 'phrase_starter',
      config: { difficulty: 'easy' },
    };
  }
  
  // Effortful but got some words = recall prompt to reduce load
  if (effortfulSpeech && wordCount > 2) {
    return {
      type: 'insert_card',
      cardType: 'recall_prompt',
      config: { difficulty: 'easy' },
    };
  }
  
  // No clear pattern from analysis - let stuck type decide
  return null;
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
      // Use recall prompt - gentler and stays in conversation context
      return {
        type: 'insert_card',
        cardType: 'recall_prompt',
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
  const flowFollowups: FollowupType[] = ['what_next', 'how_felt', 'tell_more', 'what_did'];
  return flowFollowups[turnNumber % flowFollowups.length];
}

/**
 * Select follow-up type based on stuck type (when not inserting a card)
 * CRITICAL: NEVER return pure 'acknowledge' - always continue conversation
 */
function selectFollowupForStuckType(stuckType: StuckType, turnNumber: number): FollowupType {
  switch (stuckType) {
    case 'no_speech':
    case 'prompt_overload':
      // Narrow down
      return 'clarify_small';

    case 'word_search_stall':
      // Don't just acknowledge - always continue!
      // Use 'tell_more' or 'what_next' instead of 'acknowledge'
      return turnNumber === 0 ? 'tell_more' : 'what_next';

    case 'thought_abandonment':
      // Help them continue
      return 'what_next';

    case 'strong_flow':
      return turnNumber % 2 === 0 ? 'what_next' : 'tell_more';

    default:
      // NEVER default to pure acknowledge - always invite continuation
      return 'tell_more';
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
    turnsSinceLastCard: 0, // Require MIN_TURNS_BETWEEN_CARDS before first card
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
 * Updated to feel more natural and connected to conversation
 */
export const CARD_INTRO_LINES: Record<CardType, string[]> = {
  photo_naming: [
    "While we chat, here's a quick one.",
    "Oh, here's something fun to try.",
    "Let me show you something easy.",
    "Quick brain warm-up for you.",
  ],
  semantic_features: [
    "Let me help with this one.",
    "Try describing this for me.",
    "Here's something to think about.",
  ],
  thought_prompt: [
    "Here's an easy one to finish.",
    "Try this quick thought.",
    "Just complete this for me.",
  ],
  phrase_starter: [
    "Pick whichever feels right.",
    "Here are some ways to start.",
    "Use any of these to begin.",
  ],
  yes_no: [
    "Quick one for you.",
    "Simple question first.",
    "Easy yes or no.",
  ],
  recall_prompt: [
    "Any word that comes to mind.",
    "Just name one thing.",
    "Think of anything at all.",
  ],
};

// Context-aware outros that reference what we were talking about
export const CARD_OUTRO_LINES: string[] = [
  "Nice! Now, back to chatting.",
  "Good one. Where were we?",
  "Great! So, what else?",
  "Perfect. Let's keep talking.",
  "Awesome! Now tell me more.",
];

// Topic-connected outros (used when we know the topic)
export const CARD_OUTRO_WITH_TOPIC: Record<string, string[]> = {
  food: [
    "Nice! So, back to food — what else do you like?",
    "Good! Now, you were telling me about eating...",
  ],
  family: [
    "Great! You were telling me about your family...",
    "Nice! Back to your family — who else?",
  ],
  morning: [
    "Good! So what else happened this morning?",
    "Nice! Back to your morning...",
  ],
  activities: [
    "Great! So what else did you do?",
    "Nice! Tell me more about that.",
  ],
};

/**
 * Get a random intro line for a card type
 */
export function getCardIntro(cardType: CardType): string {
  const lines = CARD_INTRO_LINES[cardType];
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * Get a random outro line after completing a card
 * Optionally pass a topic for more connected response
 */
export function getCardOutro(topic?: string): string {
  // Try to use topic-connected outro if we know the topic
  if (topic && CARD_OUTRO_WITH_TOPIC[topic]) {
    const topicLines = CARD_OUTRO_WITH_TOPIC[topic];
    return topicLines[Math.floor(Math.random() * topicLines.length)];
  }
  return CARD_OUTRO_LINES[Math.floor(Math.random() * CARD_OUTRO_LINES.length)];
}
