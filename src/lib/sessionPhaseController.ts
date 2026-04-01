/**
 * Session Phase Controller — Manages the ideal 5-minute therapy session flow
 * 
 * Phases:
 * 1. WARM_OPEN (30-45s) — Low pressure, get user talking
 * 2. DISCOVERY (60-90s) — Detect fluency, establish baseline
 * 3. GUIDED (90-120s) — Build momentum, encourage longer responses
 * 4. INTERVENTION (30-60s) — Game trigger window (if needed)
 * 5. REINTEGRATION (60-90s) — Transfer gains back to conversation
 * 6. CLOSE (30-45s) — Reflect progress, reinforce confidence
 * 
 * Each phase biases TRL behavior and game trigger timing.
 */

export type TherapySessionPhase = 
  | 'warm_open'
  | 'discovery'
  | 'guided'
  | 'intervention'
  | 'reintegration'
  | 'close';

export interface SessionPhaseState {
  currentPhase: TherapySessionPhase;
  phaseStartTime: number;
  sessionStartTime: number;
  turnCount: number;
  turnsInPhase: number;
  gameTriggeredThisSession: boolean;
  postGameTurns: number;
  baselineFluency: number | null;     // Captured during discovery
  currentFluency: number | null;
  phaseHistory: TherapySessionPhase[];
}

export interface PhaseTransitionResult {
  newPhase: TherapySessionPhase;
  transitioned: boolean;
  reason: string;
}

export interface PhaseBiases {
  /** TRL level adjustment: negative = less scaffolding, positive = more */
  trlBias: number;
  /** Whether game triggers should be allowed right now */
  allowGameTrigger: boolean;
  /** Whether to prioritize open questions vs structured */
  preferOpenQuestions: boolean;
  /** Max response complexity from Maya */
  maxMayaWords: number;
  /** Whether to show micro-feedback */
  showProgressFeedback: boolean;
}

// Phase duration targets (in turns, not seconds — more reliable)
const PHASE_TURN_TARGETS: Record<TherapySessionPhase, { min: number; max: number }> = {
  warm_open:      { min: 2, max: 4 },
  discovery:      { min: 3, max: 5 },
  guided:         { min: 4, max: 8 },
  intervention:   { min: 1, max: 3 },
  reintegration:  { min: 3, max: 5 },
  close:          { min: 2, max: 3 },
};

export function createSessionPhaseState(): SessionPhaseState {
  const now = Date.now();
  return {
    currentPhase: 'warm_open',
    phaseStartTime: now,
    sessionStartTime: now,
    turnCount: 0,
    turnsInPhase: 0,
    gameTriggeredThisSession: false,
    postGameTurns: 0,
    baselineFluency: null,
    currentFluency: null,
    phaseHistory: ['warm_open'],
  };
}

/**
 * Evaluate whether the session should transition to the next phase
 */
export function evaluatePhaseTransition(
  state: SessionPhaseState,
  signals: {
    fluencyScore: number;
    effortfulSpeech: boolean;
    wordCount: number;
    consecutiveSuccesses: number;
    consecutiveStruggles: number;
    gameTriggerFired: boolean;
    gameJustCompleted: boolean;
  }
): PhaseTransitionResult {
  const { currentPhase, turnsInPhase } = state;
  const target = PHASE_TURN_TARGETS[currentPhase];

  switch (currentPhase) {
    case 'warm_open': {
      // Move to discovery after min turns OR if user is producing good speech
      if (turnsInPhase >= target.max) {
        return { newPhase: 'discovery', transitioned: true, reason: 'warmup_max_turns' };
      }
      if (turnsInPhase >= target.min && signals.wordCount >= 5) {
        return { newPhase: 'discovery', transitioned: true, reason: 'user_engaging_well' };
      }
      break;
    }

    case 'discovery': {
      // Move to guided once we have a baseline read
      if (turnsInPhase >= target.max) {
        return { newPhase: 'guided', transitioned: true, reason: 'discovery_complete' };
      }
      if (turnsInPhase >= target.min && !signals.effortfulSpeech && signals.wordCount >= 3) {
        return { newPhase: 'guided', transitioned: true, reason: 'baseline_established' };
      }
      break;
    }

    case 'guided': {
      // Move to intervention if game fires, or to close after max
      if (signals.gameTriggerFired) {
        return { newPhase: 'intervention', transitioned: true, reason: 'game_triggered' };
      }
      if (turnsInPhase >= target.max) {
        // Skip intervention if no game needed
        return { newPhase: 'close', transitioned: true, reason: 'guided_max_turns' };
      }
      break;
    }

    case 'intervention': {
      // Move to reintegration after game completes
      if (signals.gameJustCompleted) {
        return { newPhase: 'reintegration', transitioned: true, reason: 'game_completed' };
      }
      if (turnsInPhase >= target.max) {
        return { newPhase: 'reintegration', transitioned: true, reason: 'intervention_timeout' };
      }
      break;
    }

    case 'reintegration': {
      // Move to close after transferring gains
      if (turnsInPhase >= target.max) {
        return { newPhase: 'close', transitioned: true, reason: 'reintegration_complete' };
      }
      if (turnsInPhase >= target.min && signals.consecutiveSuccesses >= 2) {
        return { newPhase: 'close', transitioned: true, reason: 'gains_transferred' };
      }
      break;
    }

    case 'close': {
      // Stay in close — session ends via user action
      break;
    }
  }

  return { newPhase: currentPhase, transitioned: false, reason: 'no_transition' };
}

/**
 * Apply a phase transition and return the updated state
 */
export function applyPhaseTransition(
  state: SessionPhaseState,
  transition: PhaseTransitionResult,
  fluencyScore?: number,
): SessionPhaseState {
  if (!transition.transitioned) {
    return {
      ...state,
      turnsInPhase: state.turnsInPhase + 1,
      turnCount: state.turnCount + 1,
      currentFluency: fluencyScore ?? state.currentFluency,
    };
  }

  const newState: SessionPhaseState = {
    ...state,
    currentPhase: transition.newPhase,
    phaseStartTime: Date.now(),
    turnsInPhase: 0,
    turnCount: state.turnCount + 1,
    phaseHistory: [...state.phaseHistory, transition.newPhase],
    currentFluency: fluencyScore ?? state.currentFluency,
  };

  // Capture baseline fluency during discovery→guided transition
  if (state.currentPhase === 'discovery' && transition.newPhase === 'guided') {
    newState.baselineFluency = fluencyScore ?? state.currentFluency;
  }

  if (transition.newPhase === 'intervention') {
    newState.gameTriggeredThisSession = true;
  }

  if (transition.newPhase === 'reintegration') {
    newState.postGameTurns = 0;
  }

  return newState;
}

/**
 * Get biases for the current session phase
 * These influence TRL behavior, game triggers, and response style
 */
export function getPhaseBiases(state: SessionPhaseState): PhaseBiases {
  switch (state.currentPhase) {
    case 'warm_open':
      return {
        trlBias: -1,              // Push toward less scaffolding
        allowGameTrigger: false,   // No games during warmup
        preferOpenQuestions: true,
        maxMayaWords: 25,
        showProgressFeedback: false,
      };

    case 'discovery':
      return {
        trlBias: 0,               // Let TRL behave naturally
        allowGameTrigger: false,   // Still too early
        preferOpenQuestions: true,
        maxMayaWords: 30,
        showProgressFeedback: false,
      };

    case 'guided':
      return {
        trlBias: 0,
        allowGameTrigger: true,    // Games allowed
        preferOpenQuestions: false,
        maxMayaWords: 30,
        showProgressFeedback: true,
      };

    case 'intervention':
      return {
        trlBias: 0,
        allowGameTrigger: false,   // Already in game
        preferOpenQuestions: false,
        maxMayaWords: 20,
        showProgressFeedback: false,
      };

    case 'reintegration':
      return {
        trlBias: -1,              // Ease off scaffolding post-game
        allowGameTrigger: false,   // No more games
        preferOpenQuestions: true,
        maxMayaWords: 25,
        showProgressFeedback: true, // Show improvement
      };

    case 'close':
      return {
        trlBias: -1,
        allowGameTrigger: false,
        preferOpenQuestions: true,
        maxMayaWords: 35,
        showProgressFeedback: true,
      };
  }
}

/**
 * Generate the phase-appropriate closing message context
 */
export function getCloseSessionInsight(state: SessionPhaseState): string | null {
  if (state.currentPhase !== 'close') return null;

  const { baselineFluency, currentFluency } = state;
  if (baselineFluency != null && currentFluency != null) {
    const delta = currentFluency - baselineFluency;
    if (delta > 10) {
      return 'improvement_detected';
    } else if (delta > 0) {
      return 'slight_improvement';
    }
  }

  if (state.gameTriggeredThisSession) {
    return 'game_helped';
  }

  return 'general_encouragement';
}
