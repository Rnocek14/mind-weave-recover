/**
 * Smart Coach — Session Arc Controller
 * 
 * Replaces the old reactive trigger model with a structured 3-phase arc:
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
  };
}

// ─── Phase Computation ──────────────────────────────────────

export function computeArcPhase(turn: number, arc: ArcState): ArcPhase {
  if (turn <= 3 && !arc.drill1Fired) return 'orient_assess';
  if (turn <= 7 && !arc.drill2Fired) return 'practice_bridge';
  return 'generalize_close';
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
 * Slot 1 (turns 3-5): Conditional — fires when breakdown detected
 * Slot 2 (turn 7): Mandatory — always fires for reinforcement
 */
export function evaluateDrillSlot(
  turn: number,
  arc: ArcState,
  gapSignals: GapSignals,
): DrillSlotDecision {
  // ── Slot 1: turns 3-5, conditional on breakdown ──
  if (!arc.drill1Fired && turn >= 3 && turn <= 5) {
    const hasGap = hasClearBreakdown(gapSignals);
    
    if (turn === 3 && hasGap) {
      return { shouldDrill: true, slotNumber: 1, reason: 'breakdown_detected_turn_3' };
    }
    if (turn === 4 && hasGap) {
      return { shouldDrill: true, slotNumber: 1, reason: 'breakdown_detected_turn_4' };
    }
    if (turn === 5) {
      // Turn 5 is the last chance — fire even with weaker signal
      return { shouldDrill: true, slotNumber: 1, reason: 'slot_1_deadline' };
    }
  }

  // ── Slot 2: turn 7, mandatory ──
  if (!arc.drill2Fired && turn >= 7 && arc.drill1Fired) {
    return { shouldDrill: true, slotNumber: 2, reason: 'mandatory_reinforcement' };
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
 */
export function getPreDrillNarration(
  slotNumber: 1 | 2,
  gaps: string[],
  reason: string,
): string {
  if (slotNumber === 1) {
    if (gaps.length > 0) {
      const gapList = gaps.slice(0, 2).join(' and ');
      return `I noticed ${gapList} was hard to grab — let's practice that directly so it's easier next time.`;
    }
    return "I can see some words are sticking — let's do a quick focused round to loosen them up.";
  }

  // Slot 2: reinforcement
  return "You've been using those words well — let's strengthen that with one more focused round.";
}

/**
 * Post-drill bridge: Results → Transfer prompt
 * Forces the user to USE the drilled words in a real scenario.
 */
export function getPostDrillBridge(
  slotNumber: 1 | 2,
  drilledWords: string[],
  transferTarget: string,
): string {
  const wordList = drilledWords.slice(0, 3).join(', ');

  if (slotNumber === 1) {
    if (wordList) {
      return `Good — you got ${wordList}. Now use ${drilledWords[0] || 'that'} in a sentence, like you would ${transferTarget}.`;
    }
    return `Nice work on that. Now let's put those words to use — ${transferTarget}.`;
  }

  // Slot 2: generalization bridge
  if (wordList) {
    return `You're getting faster with ${wordList}. Let's see — if you were ${transferTarget}, how would you say it?`;
  }
  return `That's solid. Now — if you were ${transferTarget}, what would you say?`;
}

// ─── Arc State Updates ──────────────────────────────────────

export function markDrillFired(arc: ArcState, slotNumber: 1 | 2, drilledWords: string[]): ArcState {
  return {
    ...arc,
    drill1Fired: slotNumber === 1 ? true : arc.drill1Fired,
    drill2Fired: slotNumber === 2 ? true : arc.drill2Fired,
    drilledWords: [...arc.drilledWords, ...drilledWords],
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
  return { ...arc, transferBridgeAttempted: true };
}
