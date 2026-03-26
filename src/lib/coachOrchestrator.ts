/**
 * Conversation Coach Orchestrator - ENHANCED
 * 
 * Rule-based decision engine with STRICT ANTI-LOOP CONSTRAINTS:
 * 1. Max 1 follow-up per micro-topic before forcing intervention
 * 2. Every AI turn has a therapy objective tag
 * 3. Low-content responses trigger tiles/frames (no open-ended prompts)
 * 4. Proactive reps every 2-3 turns
 * 
 * Session phases: warmup → build → conversation → wrapup
 */

import { StuckType } from './stuckTypeClassifier';
import { FollowupType } from './conversationFollowups';

// Card types that can be inserted inline
export type CardType = 'photo_naming' | 'semantic_features' | 'thought_prompt' | 'phrase_starter' | 'yes_no' | 'recall_prompt';

// Session phases
export type SessionPhase = 'warmup' | 'build' | 'conversation' | 'wrapup';

// Therapy objectives for each turn
export type TherapyObjective = 'word_retrieval' | 'sentence_building' | 'comprehension_check' | 'topic_exploration' | 'rep_practice' | 'carryover';

// Therapy intent — gives Maya a *reason* for each conversational turn
export type TherapyIntent =
  | 'expand_topic'          // Get user to elaborate on current topic
  | 'probe_word_finding'    // Elicit specific word retrieval
  | 'probe_sentence'        // Encourage longer utterance
  | 'confirm_understanding' // Verify comprehension
  | 'build_confidence'      // Supportive, low-pressure
  | 'gentle_repair'         // Help after breakdown
  | 'shift_topic'           // Move to new area
  | 'prepare_exercise'      // Transition to card/popup
  | 'reflect_progress';     // Acknowledge improvement

// Configuration for each card type
export interface CardConfig {
  difficulty: 'easy' | 'medium';
  itemId?: string;
}

// Popup exercise trigger reasons
export type PopupReason = 'repeated_struggle' | 'targeted_probe' | 'domain_boost' | 'fatigue_safe_switch';

// Possible actions the orchestrator can take
export type NextAction =
  | { type: 'chat_followup'; followupType: FollowupType; objective: TherapyObjective; therapyIntent: TherapyIntent; showTiles?: boolean; showFrames?: boolean }
  | { type: 'insert_card'; cardType: CardType; config: CardConfig; objective: TherapyObjective }
  | { type: 'popup_exercise'; slug: string; reason: PopupReason; targetDomain?: string; targetPhonemes?: string[]; difficultyHint?: 'easier' | 'same' | 'harder' }
  | { type: 'summary_verify'; summary: string }
  | { type: 'topic_shift' }
  | { type: 'wrap_up' };

// Session state for making decisions - ENHANCED
export interface OrchestratorState {
  // Phase tracking
  sessionPhase: SessionPhase;
  warmupCardsCompleted: number;
  buildComplete: boolean;
  
  // Turn tracking
  turnNumber: number;
  maxTurns: number;
  lastStuckType: StuckType | null;
  turnsSinceLastCard: number;
  cardsInsertedThisSession: number;
  
  // ANTI-LOOP: Follow-up depth tracking
  consecutiveFollowups: number;  // NEW: Count of follow-ups on same micro-topic
  lastMicroTopic: string | null;  // NEW: Track micro-topic (e.g., "eggs", "scrambled")
  lastObjective: TherapyObjective | null;  // NEW: Previous turn's objective
  
  // Vocabulary priming
  primedVocabulary: string[];  // NEW: Words from exercises to reuse
  usedVocabulary: string[];    // NEW: Words user has produced
  
  // Success tracking
  recentStuckTypes: StuckType[];
  successStreak: number;
  lastCardType: CardType | null;
  yesNoSucceeded: boolean;
  currentTopic: string | null;
  userRequestedCards: number;
  scaffoldingLevel: 'open' | 'guided' | 'choice';
  
  // Popup exercise tracking
  popupExercisesThisSession: number;
  turnsSinceLastPopup: number;
  repeatedStuckCount: number;  // consecutive same stuck type
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

// ANTI-LOOP LIMITS
const LIMITS = {
  MIN_TURNS_BETWEEN_CARDS: 2,
  MAX_CARDS_PER_SESSION: 8,
  SUCCESS_STREAK_TO_AVOID_CARDS: 3,
  MAX_CONSECUTIVE_FOLLOWUPS: 1,
  TURNS_BETWEEN_REPS: 3,
  WARMUP_CARDS_REQUIRED: 2,
  // Popup exercise limits
  MAX_POPUP_PER_SESSION: 3,
  MIN_TURNS_BETWEEN_POPUPS: 5,
  REPEATED_STUCK_THRESHOLD: 2,  // same stuck type N times → popup
};

/**
 * Main orchestrator function - decides what to do next
 * NOW WITH ANTI-LOOP CONSTRAINTS
 */
export function getNextAction(
  stuckType: StuckType,
  state: OrchestratorState,
  speechAnalysis?: SpeechAnalysisForOrchestrator
): NextAction {
  const {
    sessionPhase,
    warmupCardsCompleted,
    turnNumber,
    maxTurns,
    turnsSinceLastCard,
    cardsInsertedThisSession,
    consecutiveFollowups,
    successStreak,
  } = state;

  // FIX #4: Safety valve - prevent infinite warmup loops
  const MAX_WARMUP_ATTEMPTS = 5;
  if (sessionPhase === 'warmup' && cardsInsertedThisSession >= MAX_WARMUP_ATTEMPTS) {
    console.warn('[orchestrator] Forcing warmup exit after max attempts:', {
      cardsInsertedThisSession,
      warmupCardsCompleted,
    });
    return {
      type: 'chat_followup',
      followupType: 'what_next',
      objective: 'topic_exploration',
      therapyIntent: 'expand_topic',
      showTiles: true,
    };
  }

  // 1. PHASE-BASED LOGIC: Warmup phase forces cards first
  if (sessionPhase === 'warmup' && warmupCardsCompleted < LIMITS.WARMUP_CARDS_REQUIRED) {
    console.log('[orchestrator] Warmup phase - inserting card:', {
      warmupCardsCompleted,
      required: LIMITS.WARMUP_CARDS_REQUIRED,
      cardsInsertedThisSession,
    });
    return {
      type: 'insert_card',
      cardType: 'photo_naming',
      config: { difficulty: 'easy' },
      objective: 'word_retrieval',
    };
  }

  // 2. Build phase: Insert recall prompt for topic vocabulary
  if (sessionPhase === 'build' && !state.buildComplete) {
    return {
      type: 'insert_card',
      cardType: 'recall_prompt',
      config: { difficulty: 'easy' },
      objective: 'word_retrieval',
    };
  }

  // 3. Check if we should wrap up
  if (turnNumber >= maxTurns - 1) {
    return { type: 'wrap_up' };
  }

  // 4. ANTI-LOOP: Too many consecutive follow-ups → force intervention
  if (consecutiveFollowups >= LIMITS.MAX_CONSECUTIVE_FOLLOWUPS) {
    // Option A: Insert a micro-game rep
    if (turnsSinceLastCard >= 2 && cardsInsertedThisSession < LIMITS.MAX_CARDS_PER_SESSION) {
      return {
        type: 'insert_card',
        cardType: selectQuickRepCard(state),
        config: { difficulty: 'easy' },
        objective: 'rep_practice',
      };
    }
    
    // Option B: Summary + verify (break the loop)
    if (state.primedVocabulary.length > 0) {
      const summary = `So: ${state.usedVocabulary.slice(-2).join(', ')}. Right?`;
      return { type: 'summary_verify', summary };
    }
    
    // Option C: Topic shift
    return { type: 'topic_shift' };
  }

  // 4b. POPUP EXERCISE: Repeated struggle → launch full exercise
  const canPopup = 
    state.popupExercisesThisSession < LIMITS.MAX_POPUP_PER_SESSION &&
    state.turnsSinceLastPopup >= LIMITS.MIN_TURNS_BETWEEN_POPUPS &&
    sessionPhase === 'conversation'; // Only during conversation phase
  
  if (canPopup && state.repeatedStuckCount >= LIMITS.REPEATED_STUCK_THRESHOLD) {
    const popupDecision = selectPopupExercise(stuckType, speechAnalysis);
    if (popupDecision) {
      console.log('[orchestrator] Triggering popup exercise:', popupDecision);
      return popupDecision;
    }
  }

  // 5. ANTI-LOOP: Low-content response → MUST show tiles (no open-ended)
  if (speechAnalysis && (speechAnalysis.wordCount < 3 || speechAnalysis.pausePattern === 'very_slow')) {
    // Force scaffolded response, not open-ended prompt
    return {
      type: 'chat_followup',
      followupType: 'clarify_small',
      objective: 'word_retrieval',
      showTiles: true,
      showFrames: true,
    };
  }

  // 6. Proactive rep every 3 turns (even if flowing)
  if (turnsSinceLastCard >= LIMITS.TURNS_BETWEEN_REPS && 
      cardsInsertedThisSession < LIMITS.MAX_CARDS_PER_SESSION &&
      stuckType !== 'strong_flow') {
    return {
      type: 'insert_card',
      cardType: selectQuickRepCard(state),
      config: { difficulty: 'easy' },
      objective: 'rep_practice',
    };
  }

  // 7. User flowing well - continue but track follow-up depth
  if (stuckType === 'strong_flow') {
    return {
      type: 'chat_followup',
      followupType: selectFollowupForFlow(turnNumber),
      objective: 'topic_exploration',
      showTiles: false,
    };
  }

  // 8. Check if we can insert a card (frequency limiter)
  const canInsertCard = 
    turnsSinceLastCard >= LIMITS.MIN_TURNS_BETWEEN_CARDS &&
    cardsInsertedThisSession < LIMITS.MAX_CARDS_PER_SESSION &&
    successStreak < LIMITS.SUCCESS_STREAK_TO_AVOID_CARDS;

  // 9. Use speech analysis for card selection
  if (canInsertCard && speechAnalysis) {
    const cardDecision = selectCardBasedOnSpeechAnalysis(speechAnalysis, state);
    if (cardDecision) {
      return {
        type: 'insert_card',
        cardType: cardDecision.cardType,
        config: cardDecision.config,
        objective: 'word_retrieval' as TherapyObjective,
      };
    }
  }

  // 10. Fall back to stuck-type based card selection
  if (canInsertCard) {
    const cardDecision = selectCardForStuckType(stuckType, state);
    if (cardDecision) {
      return {
        type: 'insert_card',
        cardType: cardDecision.cardType,
        config: cardDecision.config,
        objective: 'word_retrieval' as TherapyObjective,
      };
    }
  }

  // 11. Fallback to conversation follow-up with scaffolding
  return {
    type: 'chat_followup',
    followupType: selectFollowupForStuckType(stuckType, turnNumber),
    objective: 'sentence_building' as TherapyObjective,
    showTiles: state.scaffoldingLevel === 'choice',
    showFrames: state.scaffoldingLevel === 'choice',
  };
}

/**
 * Select a quick rep card that uses primed vocabulary
 */
function selectQuickRepCard(state: OrchestratorState): CardType {
  // Vary card types for engagement
  const options: CardType[] = ['photo_naming', 'recall_prompt', 'semantic_features'];
  const lastUsed = state.lastCardType;
  const available = options.filter(c => c !== lastUsed);
  return available[Math.floor(Math.random() * available.length)];
}

// Helper type for card decisions
interface CardDecision {
  cardType: CardType;
  config: CardConfig;
}

/**
 * Select card based on speech analysis data
 */
function selectCardBasedOnSpeechAnalysis(
  speechAnalysis: SpeechAnalysisForOrchestrator, 
  state: OrchestratorState
): CardDecision | null {
  const { effortfulSpeech, circumlocutionDetected, pausePattern, wordCount, filledPauseCount } = speechAnalysis;
  
  if (effortfulSpeech && pausePattern === 'very_slow' && !state.yesNoSucceeded) {
    return { cardType: 'yes_no', config: { difficulty: 'easy' } };
  }
  
  if (circumlocutionDetected) {
    return { cardType: 'photo_naming', config: { difficulty: 'easy' } };
  }
  
  if (filledPauseCount >= 3) {
    return { cardType: 'phrase_starter', config: { difficulty: 'easy' } };
  }
  
  if (effortfulSpeech && wordCount > 2) {
    return { cardType: 'recall_prompt', config: { difficulty: 'easy' } };
  }
  
  return null;
}

/**
 * Select the right card type based on stuck type
 */
function selectCardForStuckType(stuckType: StuckType, state: OrchestratorState): CardDecision | null {
  switch (stuckType) {
    case 'no_speech':
      if (!state.yesNoSucceeded) {
        return { cardType: 'yes_no', config: { difficulty: 'easy' } };
      }
      return { cardType: 'photo_naming', config: { difficulty: 'easy' } };

    case 'word_search_stall':
      return { cardType: 'recall_prompt', config: { difficulty: 'easy' } };

    case 'prompt_overload':
      return { cardType: 'phrase_starter', config: { difficulty: 'easy' } };

    case 'thought_abandonment':
      return { cardType: 'thought_prompt', config: { difficulty: 'easy' } };

    case 'strong_flow':
      return null;

    default:
      return null;
  }
}

/**
 * Select a popup exercise based on stuck type and speech analysis
 */
function selectPopupExercise(
  stuckType: StuckType,
  speechAnalysis?: SpeechAnalysisForOrchestrator
): NextAction | null {
  // Map stuck types to appropriate full exercises
  switch (stuckType) {
    case 'word_search_stall':
      return {
        type: 'popup_exercise',
        slug: 'photo-naming',
        reason: 'repeated_struggle',
        targetDomain: 'expressive_language',
        difficultyHint: 'easier',
      };
    case 'no_speech':
      // Receptive task is safer when user can't produce speech
      return {
        type: 'popup_exercise',
        slug: 'minimal-pairs',
        reason: 'fatigue_safe_switch',
        targetDomain: 'phonology',
        difficultyHint: 'easier',
      };
    case 'prompt_overload':
      // Comprehension-based, no production pressure
      return {
        type: 'popup_exercise',
        slug: 'meaning-match',
        reason: 'targeted_probe',
        targetDomain: 'comprehension',
        difficultyHint: 'easier',
      };
    case 'thought_abandonment':
      if (speechAnalysis?.circumlocutionDetected) {
        return {
          type: 'popup_exercise',
          slug: 'photo-naming',
          reason: 'targeted_probe',
          targetDomain: 'expressive_language',
          difficultyHint: 'same',
        };
      }
      return null;
    default:
      return null;
  }
}


function selectFollowupForFlow(turnNumber: number): FollowupType {
  const flowFollowups: FollowupType[] = ['what_next', 'how_felt', 'tell_more', 'what_did'];
  return flowFollowups[turnNumber % flowFollowups.length];
}

function selectFollowupForStuckType(stuckType: StuckType, turnNumber: number): FollowupType {
  switch (stuckType) {
    case 'no_speech':
    case 'prompt_overload':
      return 'clarify_small';
    case 'word_search_stall':
      return turnNumber === 0 ? 'tell_more' : 'what_next';
    case 'thought_abandonment':
      return 'what_next';
    case 'strong_flow':
      return turnNumber % 2 === 0 ? 'what_next' : 'tell_more';
    default:
      return 'tell_more';
  }
}

/**
 * Create initial orchestrator state - ENHANCED
 */
export function createInitialState(maxTurns: number = 999): OrchestratorState {
  return {
    sessionPhase: 'warmup',
    warmupCardsCompleted: 0,
    buildComplete: false,
    turnNumber: 0,
    maxTurns,
    lastStuckType: null,
    turnsSinceLastCard: 0,
    cardsInsertedThisSession: 0,
    consecutiveFollowups: 0,
    lastMicroTopic: null,
    lastObjective: null,
    primedVocabulary: [],
    usedVocabulary: [],
    recentStuckTypes: [],
    successStreak: 0,
    lastCardType: null,
    yesNoSucceeded: false,
    currentTopic: null,
    userRequestedCards: 0,
    scaffoldingLevel: 'guided',
    popupExercisesThisSession: 0,
    turnsSinceLastPopup: 99,
    repeatedStuckCount: 0,
  };
}

/**
 * Update state after a turn - ENHANCED with anti-loop tracking
 */
export function updateState(
  state: OrchestratorState,
  stuckType: StuckType,
  cardInserted: boolean,
  cardType?: CardType,
  cardSuccess?: boolean,
  topic?: string,
  userWords?: string[],
  microTopic?: string
): OrchestratorState {
  const newSuccessStreak = stuckType === 'strong_flow' ? state.successStreak + 1 : 0;
  const yesNoSucceeded = state.yesNoSucceeded || (cardType === 'yes_no' && cardSuccess === true);

  // Phase transitions
  let newPhase = state.sessionPhase;
  let warmupCardsCompleted = state.warmupCardsCompleted;
  let buildComplete = state.buildComplete;
  let primedVocabulary = [...state.primedVocabulary];
  
  if (cardInserted && cardSuccess) {
    if (state.sessionPhase === 'warmup') {
      warmupCardsCompleted++;
      if (userWords) primedVocabulary.push(...userWords);
      if (warmupCardsCompleted >= LIMITS.WARMUP_CARDS_REQUIRED) {
        newPhase = 'build';
      }
    } else if (state.sessionPhase === 'build') {
      if (userWords) primedVocabulary.push(...userWords);
      buildComplete = true;
      newPhase = 'conversation';
    }
  }

  // Track consecutive follow-ups (anti-loop)
  let consecutiveFollowups = state.consecutiveFollowups;
  if (!cardInserted) {
    if (microTopic === state.lastMicroTopic) {
      consecutiveFollowups++;
    } else {
      consecutiveFollowups = 0;
    }
  } else {
    consecutiveFollowups = 0;
  }

  // Update used vocabulary
  const usedVocabulary = userWords 
    ? [...state.usedVocabulary, ...userWords]
    : state.usedVocabulary;

  const newScaffoldingLevel = calculateScaffoldingLevel(
    [...state.recentStuckTypes.slice(-4), stuckType],
    newSuccessStreak
  );

  // Track repeated stuck types for popup trigger
  const repeatedStuckCount = (stuckType !== 'strong_flow' && stuckType === state.lastStuckType)
    ? state.repeatedStuckCount + 1
    : 0;

  return {
    ...state,
    sessionPhase: newPhase,
    warmupCardsCompleted,
    buildComplete,
    turnNumber: state.turnNumber + 1,
    lastStuckType: stuckType,
    turnsSinceLastCard: cardInserted ? 0 : state.turnsSinceLastCard + 1,
    cardsInsertedThisSession: cardInserted ? state.cardsInsertedThisSession + 1 : state.cardsInsertedThisSession,
    consecutiveFollowups,
    lastMicroTopic: microTopic || state.lastMicroTopic,
    primedVocabulary,
    usedVocabulary,
    recentStuckTypes: [...state.recentStuckTypes.slice(-4), stuckType],
    successStreak: newSuccessStreak,
    lastCardType: cardInserted && cardType ? cardType : state.lastCardType,
    yesNoSucceeded,
    currentTopic: topic || state.currentTopic,
    scaffoldingLevel: newScaffoldingLevel,
    popupExercisesThisSession: state.popupExercisesThisSession,
    turnsSinceLastPopup: state.turnsSinceLastPopup + 1,
    repeatedStuckCount,
  };
}

/**
 * Update state after a popup exercise completes
 */
export function updateStateAfterPopup(
  state: OrchestratorState,
  success: boolean,
  userWords?: string[]
): OrchestratorState {
  const primedVocabulary = userWords
    ? [...new Set([...state.primedVocabulary, ...userWords])].slice(0, 15)
    : state.primedVocabulary;

  return {
    ...state,
    popupExercisesThisSession: state.popupExercisesThisSession + 1,
    turnsSinceLastPopup: 0,
    repeatedStuckCount: 0,
    successStreak: success ? state.successStreak + 1 : 0,
    primedVocabulary,
    consecutiveFollowups: 0,
  };
}

function calculateScaffoldingLevel(
  recentStuckTypes: StuckType[],
  successStreak: number
): 'open' | 'guided' | 'choice' {
  if (successStreak >= 2) return 'open';
  const recentStruggles = recentStuckTypes.filter(
    t => t === 'no_speech' || t === 'word_search_stall' || t === 'prompt_overload'
  ).length;
  if (recentStruggles >= 2) return 'choice';
  return 'guided';
}

// Card intro/outro lines
export const CARD_INTRO_LINES: Record<CardType, string[]> = {
  photo_naming: ["Quick one! Name this.", "What's this?", "Easy warm-up."],
  semantic_features: ["Describe this for me.", "Tell me about this."],
  thought_prompt: ["Finish this thought.", "Complete this."],
  phrase_starter: ["Pick one to start.", "Use any of these."],
  yes_no: ["Quick yes or no.", "Simple question."],
  recall_prompt: ["Name anything that fits.", "What comes to mind?"],
};

export const TOPIC_CARD_INTROS: Record<string, Record<CardType, string[]>> = {
  food: {
    photo_naming: ["Speaking of food, name this."],
    semantic_features: ["Describe this food."],
    thought_prompt: ["Finish this about food..."],
    phrase_starter: ["Try one of these..."],
    yes_no: ["Quick food question."],
    recall_prompt: ["Name any foods you like."],
  },
  family: {
    photo_naming: ["Quick one."],
    semantic_features: ["Tell me about them."],
    thought_prompt: ["Finish this thought..."],
    phrase_starter: ["Start with one of these."],
    yes_no: ["Quick question."],
    recall_prompt: ["Name anyone who comes to mind."],
  },
  activities: {
    photo_naming: ["What's this?"],
    semantic_features: ["Describe this."],
    thought_prompt: ["Complete this..."],
    phrase_starter: ["Pick one."],
    yes_no: ["Yes or no?"],
    recall_prompt: ["Name any activities."],
  },
};

export const CARD_OUTRO_LINES: string[] = [
  "Nice! Back to chatting.",
  "Good one! So...",
  "Great! Tell me more.",
  "Perfect! What else?",
];

export const CARD_OUTRO_WITH_TOPIC: Record<string, string[]> = {
  food: ["Nice! What else about food?", "Good! Tell me more about eating."],
  family: ["Great! More about your family?", "Nice! Who else?"],
  morning: ["Good! What else this morning?"],
  activities: ["Great! What else did you do?"],
};

export function getCardIntro(cardType: CardType, topic?: string | null): string {
  if (topic && TOPIC_CARD_INTROS[topic]?.[cardType]) {
    const lines = TOPIC_CARD_INTROS[topic][cardType];
    return lines[Math.floor(Math.random() * lines.length)];
  }
  const lines = CARD_INTRO_LINES[cardType];
  return lines[Math.floor(Math.random() * lines.length)];
}

export function getCardOutro(topic?: string): string {
  if (topic && CARD_OUTRO_WITH_TOPIC[topic]) {
    const lines = CARD_OUTRO_WITH_TOPIC[topic];
    return lines[Math.floor(Math.random() * lines.length)];
  }
  return CARD_OUTRO_LINES[Math.floor(Math.random() * CARD_OUTRO_LINES.length)];
}

export function extractTopicFromMessages(messages: { role: string; text: string }[]): string | null {
  const recentText = messages.slice(-4).map(m => m.text.toLowerCase()).join(' ');
  if (/\b(breakfast|lunch|dinner|eat|food|meal|cook)\b/.test(recentText)) return 'food';
  if (/\b(family|mom|dad|mother|father|son|daughter|wife|husband)\b/.test(recentText)) return 'family';
  if (/\b(morning|today|yesterday|weekend|did|went)\b/.test(recentText)) return 'activities';
  return null;
}

export function getUserRequestedCardConfig(cardType: CardType, topic?: string | null): {
  intro: string;
  config: { difficulty: 'easy' | 'medium' };
} {
  return {
    intro: getCardIntro(cardType, topic),
    config: { difficulty: 'easy' },
  };
}
