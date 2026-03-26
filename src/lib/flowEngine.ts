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
// DEDUP GUARD for bridges and returns
const _lastBridges: string[] = [];
const _lastReturns: string[] = [];

function pickUnique(pool: string[], history: string[], maxHistory = 3): string {
  const available = pool.filter(l => !history.includes(l));
  const usePool = available.length > 0 ? available : pool;
  const picked = usePool[Math.floor(Math.random() * usePool.length)];
  history.push(picked);
  if (history.length > maxHistory) history.shift();
  return picked;
}

export function generateContextBridge(
  flowState: FlowState,
  stuckType: StuckType,
  cardType: string,
  topic: string | null,
): string {
  const lastWords = flowState.lastUserTranscript?.trim() || '';
  
  // Extract a key word from user's last message for anchoring
  const fillers = new Set(['the','a','an','i','my','me','you','we','it','is','was','and','but','or','so','to','um','uh','like','just','yeah','yes','no','ok','okay']);
  const keyWords = lastWords.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !fillers.has(w));
  const anchor = keyWords.length > 0 ? keyWords[keyWords.length - 1] : null;

  // === Bridge from topic + anchor ===
  if (topic && anchor) {
    const anchoredBridges = [
      `You mentioned ${anchor} — let me show you a quick one.`,
      `Since you brought up ${anchor} — how about this?`,
      `Oh, ${anchor}! That reminds me — try this one.`,
      `Hmm, ${anchor}. Let's do a quick one related to that.`,
    ];
    return pickUnique(anchoredBridges, _lastBridges);
  }

  // === Bridge from topic (no anchor) ===
  if (topic) {
    const topicBridges: Record<string, string[]> = {
      food: [
        "Since we're on food — want to try a quick one?",
        "That reminds me — let me show you something food-related.",
        "Oh nice, speaking of eating — how about this?",
      ],
      family: [
        "Since we're talking about people — try this one.",
        "That reminds me — quick one about people.",
        "Oh, speaking of family — how about this?",
      ],
      activities: [
        "Since we're talking about what you did — try this.",
        "That reminds me of something — have a look.",
        "Oh, related to that — how about this one?",
      ],
    };
    if (topicBridges[topic]) {
      return pickUnique(topicBridges[topic], _lastBridges);
    }
  }

  // === Bridge from struggle (warm, not clinical) ===
  if (stuckType === 'word_search_stall' || stuckType === 'thought_abandonment') {
    const struggleBridges = [
      "I think I know what you mean — let me show you something.",
      "No rush. How about we try it this way?",
      "That's okay — let me give you a hand with this.",
      "Hmm, let me try something that might help.",
      "All good. Want to try a different angle on that?",
    ];
    return pickUnique(struggleBridges, _lastBridges);
  }

  // === Bridge from success ===
  if (stuckType === 'strong_flow') {
    const successBridges = [
      "You're doing really well — want to try a quick one?",
      "That was smooth! Let's stretch it a little.",
      "Nice! How about a quick challenge?",
      "You're on a roll — let me show you one more thing.",
    ];
    return pickUnique(successBridges, _lastBridges);
  }

  // === Generic but warm ===
  const genericBridges = [
    "Oh hey — let me show you something quick.",
    "That reminds me — try this one.",
    "Want to try a quick one? Just for fun.",
    "Here — have a look at this.",
  ];
  return pickUnique(genericBridges, _lastBridges);
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
          `That came out really clearly! So, back to ${topic} — what else?`,
          `Oh, that was smoother! You were telling me about ${topic}...`,
          `Nice one! Okay, so — more about ${topic}?`,
          `Ha, you got that quick! So where were we with ${topic}?`,
          `See? That came easier. Anyway — ${topic}, what else happened?`,
        ]
      : [
          "That came out nice! So, what were you saying?",
          "See? Smoother that time. Anyway — where were we?",
          "Ha, nice! Okay, let's keep going.",
          "Got it! So, you were telling me about...",
          "That was quick! Okay — back to our chat.",
        ];
    return pickUnique(successReturns, _lastReturns);
  }

  const struggleReturns = [
    "That's totally fine. Anyway — what were you telling me?",
    "No worries at all. So, what else is going on?",
    "All good! Let's go back to what we were chatting about.",
    "Hey, that's okay. So, you were saying...",
    "Don't even worry about it. What else?",
  ];
  return pickUnique(struggleReturns, _lastReturns);
}
