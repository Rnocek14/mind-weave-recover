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
import { selectNextProbe, type ProbeSelectionInput, type FatigueState } from './probeSelector';
import type { ClinicalProfile } from './clinicalProfileMapper';
import type { MayaState } from './buildMayaState';
import type { NormalizedExerciseResult } from './normalizedExerciseResult';

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
  consecutiveFollowups: number;
  lastMicroTopic: string | null;
  lastObjective: TherapyObjective | null;
  
  // Vocabulary priming
  primedVocabulary: string[];
  usedVocabulary: string[];
  
  // Success tracking
  recentStuckTypes: StuckType[];
  successStreak: number;
  lastCardType: CardType | null;
  yesNoSucceeded: boolean;
  currentTopic: string | null;
  turnsOnCurrentTopic: number; // NEW: Track how long we've been on same topic
  userRequestedCards: number;
  scaffoldingLevel: 'open' | 'guided' | 'choice';
  
  // Popup exercise tracking
  popupExercisesThisSession: number;
  turnsSinceLastPopup: number;
  repeatedStuckCount: number;

  // Profile-driven probe context
  clinicalProfile: ClinicalProfile | null;
  mayaState: MayaState | null;
  recentExerciseResults: NormalizedExerciseResult[];
  recentPopupSlugs: string[];
  fatigueState: FatigueState;
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
  MAX_CONSECUTIVE_FOLLOWUPS: 3,
  TURNS_BETWEEN_REPS: 5,        // FLOW ENGINE: was 3, now 5 — let conversation breathe
  WARMUP_CARDS_REQUIRED: 0,     // FLOW ENGINE: warmup is now conversation-only (no forced cards)
  MAX_TURNS_ON_TOPIC: 6,
  // Popup exercise limits
  MAX_POPUP_PER_SESSION: 3,
  MIN_TURNS_BETWEEN_POPUPS: 5,
  REPEATED_STUCK_THRESHOLD: 2,
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

  // 1. FLOW ENGINE: Warmup phase is now conversation-only — NO cards
  // Maya listens, builds comfort, and samples natural speech first
  if (sessionPhase === 'warmup' && state.turnNumber < 3) {
    console.log('[orchestrator] Warmup phase - conversation only, turn:', state.turnNumber);
    // Even during warmup, if user is silent, offer gentle support (not a card)
    if (stuckType === 'no_speech' || stuckType === 'prompt_overload') {
      return {
        type: 'chat_followup',
        followupType: 'clarify_small',
        objective: 'topic_exploration',
        therapyIntent: 'build_confidence',
        showTiles: true,
      };
    }
    return {
      type: 'chat_followup',
      followupType: selectFollowupForFlow(state.turnNumber),
      objective: 'topic_exploration',
      therapyIntent: 'expand_topic',
      showTiles: false,
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
  // FLOW ENGINE: Higher threshold for flowing users — conversation IS therapy
  const effectiveFollowupCap = stuckType === 'strong_flow' 
    ? LIMITS.MAX_CONSECUTIVE_FOLLOWUPS * 3  // 9 turns of conversation is fine when flowing
    : LIMITS.MAX_CONSECUTIVE_FOLLOWUPS;
  if (consecutiveFollowups >= effectiveFollowupCap) {
    // If user is flowing well, just shift topic instead of inserting a card
    if (stuckType === 'strong_flow') {
      return { type: 'topic_shift' };
    }
    
    // Option A: Insert a micro-game rep (only when not flowing)
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

  // 4a. TOPIC ESCAPE: Same topic too long → force shift
  if (state.turnsOnCurrentTopic >= LIMITS.MAX_TURNS_ON_TOPIC && state.currentTopic) {
    console.log('[orchestrator] Topic escape triggered after', state.turnsOnCurrentTopic, 'turns on', state.currentTopic);
    return { type: 'topic_shift' };
  }

  // 4b. POPUP EXERCISE: Repeated struggle → launch full exercise
  const canPopup = 
    state.popupExercisesThisSession < LIMITS.MAX_POPUP_PER_SESSION &&
    state.turnsSinceLastPopup >= LIMITS.MIN_TURNS_BETWEEN_POPUPS &&
    sessionPhase === 'conversation'; // Only during conversation phase
  
  if (canPopup && state.repeatedStuckCount >= LIMITS.REPEATED_STUCK_THRESHOLD) {
    // Use profile-driven probe selection
    const probeInput: ProbeSelectionInput = {
      profile: state.clinicalProfile,
      mayaState: state.mayaState,
      recentResults: state.recentExerciseResults,
      speechAnalysis: speechAnalysis || null,
      sessionPhase: state.sessionPhase,
      fatigueState: state.fatigueState,
      popupCount: state.popupExercisesThisSession,
      recentPopupSlugs: state.recentPopupSlugs,
      turnNumber: state.turnNumber,
    };
    const probeDecision = selectNextProbe(probeInput);
    
    if (probeDecision.action === 'launch_exercise') {
      console.log('[orchestrator] Profile-driven popup:', probeDecision);
      return {
        type: 'popup_exercise',
        slug: probeDecision.slug,
        reason: probeDecision.reason,
        targetDomain: probeDecision.targetDomain,
        difficultyHint: probeDecision.difficultyHint,
      };
    }
    
    // Fallback to old heuristic if probe selector says stay conversational
    const popupDecision = selectPopupExercise(stuckType, speechAnalysis);
    if (popupDecision) {
      console.log('[orchestrator] Fallback popup exercise:', popupDecision);
      return popupDecision;
    }
  }

  // 5. ANTI-LOOP: Low-content response handling
  // CRITICAL FIX: After 2+ consecutive clarify_small, escalate to card/popup instead of looping
  if (speechAnalysis && (speechAnalysis.wordCount < 3 || speechAnalysis.pausePattern === 'very_slow')) {
    const recentClarifyCount = state.recentStuckTypes.slice(-3).filter(
      t => t === 'no_speech' || t === 'prompt_overload' || t === 'word_search_stall'
    ).length;
    
    // After 3+ low-content turns in a row, force a card/popup to break the loop
    if (recentClarifyCount >= 3 && cardsInsertedThisSession < LIMITS.MAX_CARDS_PER_SESSION) {
      // Choose an easy, receptive task (no production pressure)
      const escapeCard: CardType = !state.yesNoSucceeded ? 'yes_no' : 'phrase_starter';
      return {
        type: 'insert_card',
        cardType: escapeCard,
        config: { difficulty: 'easy' },
        objective: 'comprehension_check',
      };
    }
    
    // Vary the followup type to avoid clarify_small monotony
    const lowContentFollowups: FollowupType[] = ['clarify_small', 'tell_more', 'acknowledge'];
    const followupType = lowContentFollowups[state.turnNumber % lowContentFollowups.length];
    
    return {
      type: 'chat_followup',
      followupType,
      objective: 'word_retrieval',
      therapyIntent: selectTherapyIntent(stuckType, state, speechAnalysis),
      showTiles: true,
      showFrames: true,
    };
  }

  // 6. FLOW ENGINE: Proactive rep — but ONLY if conversation has had enough space
  // Don't interrupt flow. Let user talk. Conversation IS therapy.
  if (turnsSinceLastCard >= LIMITS.TURNS_BETWEEN_REPS && 
      cardsInsertedThisSession < LIMITS.MAX_CARDS_PER_SESSION &&
      stuckType !== 'strong_flow') {
    // Additional flow check: skip if user is engaged and fluent
    const isFlowing = speechAnalysis && speechAnalysis.fluencyScore > 60 && speechAnalysis.wordCount >= 5;
    if (!isFlowing) {
      return {
        type: 'insert_card',
        cardType: selectQuickRepCard(state),
        config: { difficulty: 'easy' },
        objective: 'rep_practice',
      };
    }
    // User is flowing — let them continue, don't force a card
    console.log('[orchestrator] Skipping proactive rep — user is flowing well');
  }

  // 7. User flowing well - continue conversation (this IS therapy)
  if (stuckType === 'strong_flow') {
    return {
      type: 'chat_followup',
      followupType: selectFollowupForFlow(turnNumber),
      objective: 'topic_exploration',
      therapyIntent: selectTherapyIntent(stuckType, state, speechAnalysis),
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
    therapyIntent: selectTherapyIntent(stuckType, state, speechAnalysis),
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
 * Select therapy intent based on stuck type, session phase, and speech analysis.
 * Gives Maya a *reason* for each turn instead of just a response type.
 */
function selectTherapyIntent(
  stuckType: StuckType,
  state: OrchestratorState,
  speechAnalysis?: SpeechAnalysisForOrchestrator
): TherapyIntent {
  // After silence → build confidence with easy question
  if (stuckType === 'no_speech') return 'build_confidence';

  // Prompt overload → simplify, build confidence
  if (stuckType === 'prompt_overload') return 'build_confidence';

  // Word search stall → probe word finding or repair
  if (stuckType === 'word_search_stall') {
    return speechAnalysis?.circumlocutionDetected ? 'probe_word_finding' : 'gentle_repair';
  }

  // Thought abandonment → repair
  if (stuckType === 'thought_abandonment') return 'gentle_repair';

  // Strong flow → vary intent based on context
  if (stuckType === 'strong_flow') {
    if (speechAnalysis && speechAnalysis.wordCount < 5) return 'probe_sentence';
    if (state.turnNumber > 8 && state.successStreak >= 3) return 'reflect_progress';
    if (state.turnNumber % 4 === 0) return 'confirm_understanding';
    return 'expand_topic';
  }

  return 'expand_topic';
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
    turnsOnCurrentTopic: 0,
    userRequestedCards: 0,
    scaffoldingLevel: 'guided',
    popupExercisesThisSession: 0,
    turnsSinceLastPopup: 99,
    repeatedStuckCount: 0,
    clinicalProfile: null,
    mayaState: null,
    recentExerciseResults: [],
    recentPopupSlugs: [],
    fatigueState: 'fresh',
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

  // Phase transitions — FLOW ENGINE: conversation-first warmup
  let newPhase = state.sessionPhase;
  let warmupCardsCompleted = state.warmupCardsCompleted;
  let buildComplete = state.buildComplete;
  let primedVocabulary = [...state.primedVocabulary];
  
  // Warmup ends after enough conversation turns (not card completions)
  if (state.sessionPhase === 'warmup' && state.turnNumber >= 2) {
    newPhase = 'conversation'; // Skip 'build' — go straight to conversation
    buildComplete = true;
  }
  
  if (cardInserted && cardSuccess) {
    warmupCardsCompleted++;
    if (userWords) primedVocabulary.push(...userWords);
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
    turnsOnCurrentTopic: (topic && topic !== state.currentTopic) ? 1 : state.turnsOnCurrentTopic + 1,
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
  userWords?: string[],
  exerciseSlug?: string,
  normalizedResult?: NormalizedExerciseResult
): OrchestratorState {
  const primedVocabulary = userWords
    ? [...new Set([...state.primedVocabulary, ...userWords])].slice(0, 15)
    : state.primedVocabulary;

  const recentPopupSlugs = exerciseSlug
    ? [...state.recentPopupSlugs, exerciseSlug].slice(-5)
    : state.recentPopupSlugs;

  const recentExerciseResults = normalizedResult
    ? [...state.recentExerciseResults, normalizedResult].slice(-5)
    : state.recentExerciseResults;

  // Infer fatigue from accumulated popup results
  let fatigueState = state.fatigueState;
  if (recentExerciseResults.length >= 3) {
    const lastThree = recentExerciseResults.slice(-3);
    const avgScore = lastThree.reduce((s, r) => s + r.score, 0) / 3;
    if (avgScore < 0.4) fatigueState = 'high';
    else if (avgScore < 0.6) fatigueState = 'mild';
  }

  return {
    ...state,
    popupExercisesThisSession: state.popupExercisesThisSession + 1,
    turnsSinceLastPopup: 0,
    repeatedStuckCount: 0,
    successStreak: success ? state.successStreak + 1 : 0,
    primedVocabulary,
    consecutiveFollowups: 0,
    recentPopupSlugs,
    recentExerciseResults,
    fatigueState,
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

// Card intro/outro lines - warm and human, never clinical
export const CARD_INTRO_LINES: Record<CardType, string[]> = {
  photo_naming: ["Oh — what's this one?", "Hey, take a look.", "How about this — know what it is?", "Quick one — what do you see?", "Here, have a look."],
  semantic_features: ["Tell me what you know about this.", "How would you describe this one?", "What comes to mind when you see this?"],
  thought_prompt: ["Hmm — how would you finish this?", "Try this one.", "What do you think comes next?"],
  phrase_starter: ["Pick whichever feels right.", "Any of these work — try one.", "Which one sounds good to you?"],
  yes_no: ["Quick one — yes or no?", "What do you think?", "Simple one for you."],
  recall_prompt: ["What comes to mind?", "Name any that you can think of.", "Just say whatever pops up."],
};

export const TOPIC_CARD_INTROS: Record<string, Record<CardType, string[]>> = {
  food: {
    photo_naming: ["Oh, since we're on food — what's this?", "Here's a food one — take a look."],
    semantic_features: ["Hmm, tell me about this food.", "What do you know about this one?"],
    thought_prompt: ["Finish this one for me.", "How would you end this?"],
    phrase_starter: ["Pick whichever feels right.", "Try any of these."],
    yes_no: ["Quick one — yes or no?", "What do you think?"],
    recall_prompt: ["What foods come to mind?", "Name any you can think of."],
  },
  family: {
    photo_naming: ["Take a look — who's this?", "Here's one — know who this is?"],
    semantic_features: ["Tell me about this person.", "What can you say about them?"],
    thought_prompt: ["How would you finish this?", "Try this one."],
    phrase_starter: ["Pick one that sounds right.", "Try any of these."],
    yes_no: ["Quick one — yes or no?", "What do you think?"],
    recall_prompt: ["Who comes to mind?", "Name anyone you can think of."],
  },
  activities: {
    photo_naming: ["Oh, related to that — what's this?", "Take a look — what do you see?"],
    semantic_features: ["Tell me about this.", "What do you know about this one?"],
    thought_prompt: ["How would you finish this?", "Try this one."],
    phrase_starter: ["Pick one.", "Try whichever sounds right."],
    yes_no: ["Quick one — yes or no?", "What do you think?"],
    recall_prompt: ["What comes to mind?", "Name any you can think of."],
  },
};

export const CARD_OUTRO_LINES: string[] = [
  "Ha, nice! Okay — where were we?",
  "See? That came out well. So...",
  "Got it! Okay, back to chatting.",
  "That was good! So, you were saying...",
  "Nice one! Anyway — what else?",
];

export const CARD_OUTRO_WITH_TOPIC: Record<string, string[]> = {
  food: ["That was good! So — more about what you were eating?", "Nice! Okay, back to food — what else?"],
  family: ["Got it! So, tell me more about your family.", "Nice one! You were saying about your family..."],
  morning: ["Good! So, what else happened this morning?", "Ha, nice. Anyway — your morning, what else?"],
  activities: ["That came out well! So — what else did you do?", "Nice! Okay, back to what you were up to."],
};

// DEDUP GUARD: Track last used card intros
const _lastCardIntros: string[] = [];

export function getCardIntro(cardType: CardType, topic?: string | null): string {
  const lines = (topic && TOPIC_CARD_INTROS[topic]?.[cardType])
    ? TOPIC_CARD_INTROS[topic][cardType]
    : CARD_INTRO_LINES[cardType];
  const available = lines.filter(l => !_lastCardIntros.includes(l));
  const pool = available.length > 0 ? available : lines;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  _lastCardIntros.push(picked);
  if (_lastCardIntros.length > 4) _lastCardIntros.shift();
  return picked;
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
