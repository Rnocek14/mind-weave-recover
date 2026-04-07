/**
 * Smart Coach — Session Arc Controller
 * 
 * The SOLE authority for session timing, phase transitions, and drill slots.
 * 
 * 14-turn arc with 3 phases:
 * 
 * Phase 1: ORIENT + ASSESS (turns 0-3)
 *   - Maya states goal, probes for gaps
 *   - Turn 3: conditional drill slot (fires IF breakdown detected, else delays to 4-5)
 * 
 * Phase 2: PRACTICE + BRIDGE (turns 4-7)  
 *   - Transfer bridge: use drill words in conversation
 *   - Turn 7: mandatory second drill slot
 * 
 * Phase 3: GENERALIZE + CLOSE (turns 8-13)
 *   - Functional simulation, spontaneous use checks
 *   - Wrapup with specific word reflection
 * 
 * Design: "Conversation identifies the need. Practice targets the need. Conversation proves the gain."
 */

// ─── Arc Phases ─────────────────────────────────────────────

export type ArcPhase = 'orient_assess' | 'practice_bridge' | 'generalize_close';

export interface ArcState {
  phase: ArcPhase;
  /** Whether drill slot 1 has been used */
  drill1Fired: boolean;
  /** Whether drill slot 2 has been used */
  drill2Fired: boolean;
  /** Turn when a clear gap was first detected (for conditional slot 1) */
  firstGapDetectedAtTurn: number | null;
  /** Words/phrases identified as gaps during assessment */
  identifiedGaps: string[];
  /** Words practiced in drills (for transfer verification) */
  drilledWords: string[];
  /** Whether transfer bridge has been attempted post-drill-1 */
  transferBridgeAttempted: boolean;
  /** Whether we're currently in post-drill transfer mode */
  inTransferMode: boolean;
  /** Turn when transfer mode was entered */
  transferModeEnteredAtTurn: number | null;
  /** Remaining turns in transfer mode before forced exit */
  transferTurnsRemaining: number;
}

// ─── Factory ────────────────────────────────────────────────

export function createArcState(): ArcState {
  return {
    phase: 'orient_assess',
    drill1Fired: false,
    drill2Fired: false,
    firstGapDetectedAtTurn: null,
    identifiedGaps: [],
    drilledWords: [],
    transferBridgeAttempted: false,
    inTransferMode: false,
    transferModeEnteredAtTurn: null,
    transferTurnsRemaining: 0,
  };
}

// ─── Phase Computation (MUST be called every turn) ──────────

export function computeArcPhase(turn: number, arc: ArcState): ArcPhase {
  if (turn <= 3 && !arc.drill1Fired) return 'orient_assess';
  if (turn <= 7 && !arc.drill2Fired) return 'practice_bridge';
  return 'generalize_close';
}

/** Update arc state with current phase — call this every turn */
export function advanceArc(arc: ArcState, turn: number): ArcState {
  const newPhase = computeArcPhase(turn, arc);
  if (newPhase === arc.phase) return arc;
  return { ...arc, phase: newPhase };
}

// ─── Gap Detection ──────────────────────────────────────────

export interface GapSignals {
  hesitationDetected: boolean;
  circumlocution: boolean;
  wordCount: number;
  semanticMatch: number;
  pauseDetected: boolean;
  supportLevel: number;
  consecutiveHesitations: number;
}

/**
 * Returns true if there's a clear clinical breakdown warranting a drill.
 * This is the gate for conditional drill slot 1.
 */
export function hasClearBreakdown(signals: GapSignals): boolean {
  let breakdownSignals = 0;

  if (signals.hesitationDetected) breakdownSignals++;
  if (signals.circumlocution) breakdownSignals++;
  if (signals.pauseDetected && signals.wordCount <= 1) breakdownSignals++;
  if (signals.supportLevel >= 2) breakdownSignals++;
  if (signals.consecutiveHesitations >= 2) breakdownSignals++;
  if (signals.semanticMatch < 0.2 && signals.wordCount > 0) breakdownSignals++;

  // Need 2+ signals for a "clear" breakdown (not just one shaky turn)
  return breakdownSignals >= 2;
}

// ─── Drill Slot Evaluation ──────────────────────────────────

export interface DrillSlotDecision {
  shouldDrill: boolean;
  slotNumber: 1 | 2 | null;
  reason: string;
}

/**
 * Position-based drill slot evaluation.
 * 
 * CORE RULE: Drills ONLY fire when a clear breakdown is detected.
 * If the user is responding well, NO drill fires — even at slot boundaries.
 * 
 * Slot 1 (turns 3-5): Conditional — requires 2+ breakdown signals
 * Slot 2 (turn 7+): Conditional — requires at least 1 breakdown signal
 *   (was mandatory, now gated: user doing fine = no drill)
 * 
 * A session with ZERO drills is a valid, good session.
 */
export function evaluateDrillSlot(
  turn: number,
  arc: ArcState,
  gapSignals: GapSignals,
): DrillSlotDecision {
  const hasGap = hasClearBreakdown(gapSignals);

  // ── Slot 1: turns 3-5, ONLY on clear breakdown ──
  if (!arc.drill1Fired && turn >= 3 && turn <= 5) {
    if (hasGap) {
      return { shouldDrill: true, slotNumber: 1, reason: `breakdown_detected_turn_${turn}` };
    }
    // Turn 5 with no breakdown — permanently skip slot 1
    if (turn === 5) {
      return { shouldDrill: false, slotNumber: null, reason: 'slot_1_skipped_no_breakdown' };
    }
  }

  // ── Slot 2: turn 7+, ONLY if breakdown evidence exists ──
  // A user who is flowing well should NOT be interrupted for "reinforcement"
  if (!arc.drill2Fired && turn >= 7) {
    if (hasGap || arc.identifiedGaps.length > 0) {
      return { shouldDrill: true, slotNumber: 2, reason: 'reinforcement_with_evidence' };
    }
    // Turn 9+: final check — skip slot 2 entirely if still no evidence
    if (turn >= 9) {
      return { shouldDrill: false, slotNumber: null, reason: 'slot_2_skipped_no_evidence' };
    }
  }

  return { shouldDrill: false, slotNumber: null, reason: 'no_slot' };
}

// ─── Gap Tracking ───────────────────────────────────────────

/**
 * Extract gap words from analysis context.
 * Called during orient_assess phase to build the gap list.
 */
export function extractGapWords(
  userUtterance: string,
  topicKeywords: string[],
  analysis: { circumlocution: boolean; hesitationDetected: boolean; wordCount: number },
): string[] {
  const gaps: string[] = [];
  const lowerUtterance = userUtterance.toLowerCase();

  // If circumlocution detected, the topic keywords they DIDN'T use are gaps
  if (analysis.circumlocution || analysis.hesitationDetected) {
    for (const kw of topicKeywords) {
      if (!lowerUtterance.includes(kw.toLowerCase())) {
        gaps.push(kw);
      }
    }
  }

  return gaps.slice(0, 5); // Cap at 5 gap words
}

// ─── Deterministic Narration Templates ──────────────────────

/**
 * Pre-drill narration: Observation → Rationale → Action
 * 
 * Sounds like a therapist explaining why practice is needed.
 * Short, warm, specific. Never robotic.
 */
export function getPreDrillNarration(
  slotNumber: 1 | 2,
  gaps: string[],
  reason: string,
): string {
  if (slotNumber === 1) {
    if (gaps.length === 1) {
      return `I want to strengthen how quickly "${gaps[0]}" comes out. Let's do a short practice round.`;
    }
    if (gaps.length > 1) {
      const gapList = gaps.slice(0, 2).map(g => `"${g}"`).join(' and ');
      return `I noticed ${gapList} took extra effort. Let's practice those directly for a minute.`;
    }
    // No specific gaps identified but breakdown detected
    return "Some of those words took a bit longer to find. Let's do a focused round to speed that up.";
  }

  // Slot 2: reinforcement — reference progress
  if (gaps.length > 0) {
    return `You're doing better with those words now. One more focused round to lock it in.`;
  }
  return "Good progress. Let's strengthen that with one more quick round.";
}

/**
 * Post-drill review: Short, specific, warm therapy language.
 * Sounds like a therapist commenting on what just happened.
 */
export function getPostDrillReview(
  score: number,
  drilledWords: string[],
  slotNumber: 1 | 2,
): string {
  const word = drilledWords.length > 0 ? drilledWords[0] : '';

  if (score >= 0.8) {
    if (word) return `That was good — you used "${word}" smoothly there.`;
    return 'That was good. The words came out easier that time.';
  }
  if (score >= 0.5) {
    if (word) return `Better — "${word}" is coming along. We'll keep building on that.`;
    return 'Better. Recall is still tricky, but you\'re getting closer.';
  }
  if (word) return `That was hard, but now you've practiced "${word}." It\'ll come faster next time.`;
  return 'That was tough, but that\'s exactly why we practiced. It\'ll get easier.';
}

/**
 * Post-drill bridge: Short, natural continuation of the lesson.
 * NOT a long instruction — just a simple prompt that continues the conversation.
 */
export function getPostDrillBridge(
  slotNumber: 1 | 2,
  drilledWords: string[],
  topic: string,
): string {
  const word = drilledWords[0];

  // Short and conversational — like a therapist continuing the session
  if (word) {
    return `Now tell me more about your ${topic} — try using "${word}."`;
  }
  return `Okay, let's keep going. Tell me more about your ${topic}.`;
}

// ─── Arc State Updates ──────────────────────────────────────

export function markDrillFired(arc: ArcState, slotNumber: 1 | 2, drilledWords: string[]): ArcState {
  return {
    ...arc,
    drill1Fired: slotNumber === 1 ? true : arc.drill1Fired,
    drill2Fired: slotNumber === 2 ? true : arc.drill2Fired,
    drilledWords: [...arc.drilledWords, ...drilledWords],
    inTransferMode: true,
    transferModeEnteredAtTurn: null, // will be set on next turn
    transferTurnsRemaining: 3, // max 3 turns to verify transfer
  };
}

export function recordGap(arc: ArcState, gaps: string[], turn: number): ArcState {
  if (gaps.length === 0) return arc;
  return {
    ...arc,
    identifiedGaps: [...new Set([...arc.identifiedGaps, ...gaps])],
    firstGapDetectedAtTurn: arc.firstGapDetectedAtTurn ?? turn,
  };
}

export function markTransferBridgeAttempted(arc: ArcState): ArcState {
  return { ...arc, transferBridgeAttempted: true, inTransferMode: false };
}

/** 
 * Check if user used drilled words and decide whether to exit transfer mode.
 * Exits if: user used a drilled word OR transfer turns exhausted.
 */
export function checkTransferExit(arc: ArcState, userUtterance: string): ArcState {
  if (!arc.inTransferMode) return arc;
  
  const remaining = arc.transferTurnsRemaining - 1;
  const lowerUtterance = userUtterance.toLowerCase();
  const usedDrilledWord = arc.drilledWords.some(w => lowerUtterance.includes(w.toLowerCase()));
  
  // Exit if: word verified OR turns exhausted
  if (usedDrilledWord || remaining <= 0) {
    return { ...arc, inTransferMode: false, transferTurnsRemaining: 0 };
  }
  
  // Stay in transfer mode, decrement counter
  return { ...arc, transferTurnsRemaining: remaining };
}

/** Force exit transfer mode (legacy compat) */
export function exitTransferMode(arc: ArcState): ArcState {
  return { ...arc, inTransferMode: false, transferTurnsRemaining: 0 };
}

// ─── Arc-Aware Mode Override ────────────────────────────────

import type { CoachMode } from './types';

/**
 * Override the state machine's mode based on arc phase.
 * This ensures the session FEELS structured even though the state machine
 * is reactive to utterance signals.
 */
export function getArcModeOverride(
  arc: ArcState,
  turn: number,
  stateMachineMode: CoachMode,
): CoachMode {
  // Post-drill: force transfer_bridge until verified or exhausted
  if (arc.inTransferMode) {
    return 'transfer_bridge';
  }

  // Orient + Assess phase: force diagnostic modes
  // Turn 0 = warmup (easy opener), Turns 1-3 = expand (diagnostic probing)
  // Do NOT let the state machine escalate to scaffold/support during assessment
  // — we need to SEE the struggle, not fix it yet
  if (arc.phase === 'orient_assess') {
    if (turn === 0) return 'warmup';
    // Allow support only if user is truly silent/stuck (wordCount=0)
    if (stateMachineMode === 'support') return 'support';
    return 'expand'; // force expand for diagnostic probing
  }

  // Generalize phase: prefer expand (real conversation) unless user is struggling
  if (arc.phase === 'generalize_close') {
    if (stateMachineMode === 'support' || stateMachineMode === 'scaffold') {
      return stateMachineMode; // respect struggle signals
    }
    return 'expand';
  }

  // Default: let state machine decide
  return stateMachineMode;
}
