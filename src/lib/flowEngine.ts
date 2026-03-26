/**
 * Maya Flow Engine
 * 
 * Decides WHEN Maya should talk vs intervene.
 * Clinical reason drives task CHOICE.
 * Conversation context drives task TIMING and BRIDGING.
 * 
 * Core principle: Conversation IS therapy. Games are strategic interventions.
 */

import type { SpeechAnalysisForOrchestrator } from './coachOrchestrator';
import type { StuckType } from './stuckTypeClassifier';
import type { FatigueState } from './probeSelector';

// What the flow engine decides Maya should do next
export type FlowAction =
  | 'conversation'      // Keep talking — this IS therapy
  | 'light_probe'       // Ask a focused question inside chat (no card)
  | 'structured_task'   // Insert a card/modal exercise
  | 'support'           // Repair/simplify — user is struggling
  | 'topic_shift'       // Move to new area naturally
  | 'wrap';             // Summarize and close

// Refined session phases
export type FlowPhase =
  | 'warmup'    // First 2-3 turns: comfort + natural speech sample, NO cards
  | 'explore'   // Conversation + light probing, mostly conversational
  | 'probe'     // Enough evidence to test something intentionally
  | 'train'     // Reinforcing a weakness with 1-2 structured tasks
  | 'wrap';     // No new tasks, summarize + confidence

export interface FlowState {
  phase: FlowPhase;
  turnCount: number;
  turnsSinceLastProbe: number;
  turnsOnCurrentTopic: number;
  consecutiveStruggles: number;
  consecutiveFlowTurns: number;
  fatigueLevel: FatigueState;
  lastActionType: FlowAction;
  probeCountThisSession: number;
  conversationTurnsBeforeFirstProbe: number;
  currentTopic: string | null;
  lastUserTranscript: string;
}

export function createInitialFlowState(): FlowState {
  return {
    phase: 'warmup',
    turnCount: 0,
    turnsSinceLastProbe: 99,
    turnsOnCurrentTopic: 0,
    consecutiveStruggles: 0,
    consecutiveFlowTurns: 0,
    fatigueLevel: 'fresh',
    lastActionType: 'conversation',
    probeCountThisSession: 0,
    conversationTurnsBeforeFirstProbe: 0,
    currentTopic: null,
    lastUserTranscript: '',
  };
}

// Tunable thresholds
const FLOW_LIMITS = {
  WARMUP_MIN_TURNS: 3,           // No cards for first 3 turns
  MIN_TURNS_BETWEEN_PROBES: 4,   // Default spacing
  MIN_TURNS_BETWEEN_PROBES_STRUGGLE: 2, // Tighter when struggling
  MAX_TURNS_WITHOUT_PROBE: 8,    // Don't go too long without measuring
  MAX_TURNS_ON_TOPIC: 6,         // Topic fatigue
  CONSECUTIVE_STRUGGLES_FOR_TASK: 2, // Escalate after 2 struggles
  FLUENCY_THRESHOLD_FLOW: 60,    // Above this = flowing well
  MAX_PROBES_PER_SESSION: 6,     // Don't over-test
};

export interface FlowDecisionInput {
  flowState: FlowState;
  stuckType: StuckType;
  speechAnalysis: SpeechAnalysisForOrchestrator | null;
  engagementFrustration: string; // 'none' | 'low' | 'medium' | 'high'
  engagementFatigue: string;
}

/**
 * The brain: decides what Maya should do next.
 * Returns a FlowAction that the orchestrator converts into a concrete NextAction.
 */
export function decideFlowAction(input: FlowDecisionInput): FlowAction {
  const { flowState, stuckType, speechAnalysis, engagementFrustration, engagementFatigue } = input;
  const { phase, turnCount, turnsSinceLastProbe, consecutiveStruggles, consecutiveFlowTurns } = flowState;

  // === Rule 1: Warmup protection — NO interventions ===
  if (phase === 'warmup' && turnCount < FLOW_LIMITS.WARMUP_MIN_TURNS) {
    // Even if struggling, stay conversational during warmup
    if (stuckType === 'no_speech' || stuckType === 'prompt_overload') {
      return 'support'; // Gentle support, but NOT a card
    }
    return 'conversation';
  }

  // === Rule 2: Fatigue/frustration protection ===
  if (engagementFatigue === 'high' || engagementFrustration === 'high') {
    if (turnCount > 8) return 'wrap';
    return 'conversation'; // Back off, let them breathe
  }

  // === Rule 3: Don't interrupt good flow ===
  if (stuckType === 'strong_flow' && speechAnalysis) {
    if (speechAnalysis.fluencyScore > FLOW_LIMITS.FLUENCY_THRESHOLD_FLOW && consecutiveFlowTurns < 6) {
      // User is flowing — let them talk, this IS therapy
      // Only probe if it's been too long since measurement
      if (turnsSinceLastProbe >= FLOW_LIMITS.MAX_TURNS_WITHOUT_PROBE) {
        return 'light_probe'; // Gentle, not a card
      }
      return 'conversation';
    }
  }

  // === Rule 4: Topic fatigue ===
  if (flowState.turnsOnCurrentTopic >= FLOW_LIMITS.MAX_TURNS_ON_TOPIC) {
    return 'topic_shift';
  }

  // === Rule 5: Spacing guard — don't over-probe ===
  if (turnsSinceLastProbe < FLOW_LIMITS.MIN_TURNS_BETWEEN_PROBES && consecutiveStruggles < FLOW_LIMITS.CONSECUTIVE_STRUGGLES_FOR_TASK) {
    // Too soon for another probe unless struggling hard
    if (stuckType !== 'strong_flow' && consecutiveStruggles >= 1) {
      return 'support'; // Help conversationally, not with a card
    }
    return 'conversation';
  }

  // === Rule 6: Session probe cap ===
  if (flowState.probeCountThisSession >= FLOW_LIMITS.MAX_PROBES_PER_SESSION) {
    return stuckType === 'strong_flow' ? 'conversation' : 'support';
  }

  // === Rule 7: Escalate after repeated struggle ===
  if (consecutiveStruggles >= FLOW_LIMITS.CONSECUTIVE_STRUGGLES_FOR_TASK) {
    // Try light probe first, escalate to structured if we already tried
    if (flowState.lastActionType === 'light_probe' || flowState.lastActionType === 'support') {
      return 'structured_task';
    }
    return 'light_probe'; // Try conversational probe first
  }

  // === Rule 8: Mild struggle — support or light probe ===
  if (stuckType === 'word_search_stall' || stuckType === 'thought_abandonment') {
    if (speechAnalysis?.circumlocutionDetected) {
      return turnsSinceLastProbe >= FLOW_LIMITS.MIN_TURNS_BETWEEN_PROBES_STRUGGLE
        ? 'light_probe'
        : 'support';
    }
    return 'support';
  }

  // === Rule 9: Ready for a probe (enough conversation has happened) ===
  if (phase === 'explore' && turnsSinceLastProbe >= FLOW_LIMITS.MIN_TURNS_BETWEEN_PROBES) {
    return 'light_probe';
  }

  if (phase === 'probe' && turnsSinceLastProbe >= FLOW_LIMITS.MIN_TURNS_BETWEEN_PROBES) {
    return 'structured_task';
  }

  // === Default: conversation ===
  return 'conversation';
}

/**
 * Update flow state after each turn
 */
export function updateFlowState(
  state: FlowState,
  stuckType: StuckType,
  actionTaken: FlowAction,
  topic: string | null,
  userTranscript: string,
): FlowState {
  const turnCount = state.turnCount + 1;
  const isStruggle = stuckType !== 'strong_flow' && stuckType !== 'thought_abandonment';
  const isProbe = actionTaken === 'structured_task' || actionTaken === 'light_probe';

  // Phase transitions
  let phase = state.phase;
  if (phase === 'warmup' && turnCount >= FLOW_LIMITS.WARMUP_MIN_TURNS) {
    phase = 'explore';
  }
  if (phase === 'explore' && state.probeCountThisSession >= 1) {
    phase = 'probe'; // After first probe, we're in active probing
  }
  if (phase === 'probe' && state.probeCountThisSession >= 3) {
    phase = 'train'; // After several probes, shift to reinforcement
  }

  const consecutiveStruggles = isStruggle
    ? state.consecutiveStruggles + 1
    : 0;

  const consecutiveFlowTurns = stuckType === 'strong_flow'
    ? state.consecutiveFlowTurns + 1
    : 0;

  const turnsOnCurrentTopic = (topic && topic === state.currentTopic)
    ? state.turnsOnCurrentTopic + 1
    : (topic ? 1 : state.turnsOnCurrentTopic + 1);

  return {
    phase,
    turnCount,
    turnsSinceLastProbe: isProbe ? 0 : state.turnsSinceLastProbe + 1,
    turnsOnCurrentTopic,
    consecutiveStruggles,
    consecutiveFlowTurns,
    fatigueLevel: state.fatigueLevel,
    lastActionType: actionTaken,
    probeCountThisSession: isProbe ? state.probeCountThisSession + 1 : state.probeCountThisSession,
    conversationTurnsBeforeFirstProbe: state.probeCountThisSession === 0 && !isProbe
      ? state.conversationTurnsBeforeFirstProbe + 1
      : state.conversationTurnsBeforeFirstProbe,
    currentTopic: topic || state.currentTopic,
    lastUserTranscript: userTranscript,
  };
}

/**
 * Generate a context-aware bridge for transitioning into a task.
 * This replaces canned intros like "Quick one! Name this."
 */
export function generateContextBridge(
  flowState: FlowState,
  stuckType: StuckType,
  cardType: string,
  topic: string | null,
): string {
  const lastWords = flowState.lastUserTranscript;

  // === Bridge from topic ===
  if (topic && lastWords) {
    const topicBridges: Record<string, string[]> = {
      food: [
        "You mentioned food — let's try a quick one.",
        "Since we're talking about eating — how about this?",
        "Speaking of food — name this for me.",
      ],
      family: [
        "You were talking about family — let's try something.",
        "Since we're on people — how about this one?",
      ],
      activities: [
        "Since we're talking about what you did — try this.",
        "Based on what you were saying — how about this?",
      ],
    };
    if (topicBridges[topic]) {
      const bridges = topicBridges[topic];
      return bridges[Math.floor(Math.random() * bridges.length)];
    }
  }

  // === Bridge from struggle ===
  if (stuckType === 'word_search_stall' || stuckType === 'thought_abandonment') {
    const struggleBridges = [
      "That word looked tricky — let me show you something.",
      "No worries. Let's try it a different way.",
      "Let me help with that — try this one.",
      "That's okay. How about we try this?",
    ];
    return struggleBridges[Math.floor(Math.random() * struggleBridges.length)];
  }

  // === Bridge from success ===
  if (stuckType === 'strong_flow') {
    const successBridges = [
      "You're doing well — let's stretch it a bit.",
      "Nice flow! Let's try a quick challenge.",
      "You're on a roll — how about this one?",
    ];
    return successBridges[Math.floor(Math.random() * successBridges.length)];
  }

  // === Generic but still natural ===
  const genericBridges = [
    "Let's try a quick one based on that.",
    "Here's something related — give it a try.",
    "Let me show you something quick.",
  ];
  return genericBridges[Math.floor(Math.random() * genericBridges.length)];
}

/**
 * Generate a natural return-to-conversation line after a task completes.
 */
export function generateTaskReturn(
  success: boolean,
  topic: string | null,
): string {
  if (success) {
    const successReturns = topic
      ? [
          `Nice! Let's go back to what you were saying about ${topic}.`,
          `Good one! So, you were telling me about ${topic}...`,
          `That came quick! Back to our chat — what else about ${topic}?`,
        ]
      : [
          "Nice — that came easier. So, what were you saying?",
          "Good one! Let's keep chatting.",
          "That was quick! So, where were we?",
        ];
    return successReturns[Math.floor(Math.random() * successReturns.length)];
  }

  const struggleReturns = [
    "That's okay — no rush. Let's keep talking.",
    "Don't worry about that one. So, what else?",
    "That's alright. Let's go back to chatting.",
  ];
  return struggleReturns[Math.floor(Math.random() * struggleReturns.length)];
}
