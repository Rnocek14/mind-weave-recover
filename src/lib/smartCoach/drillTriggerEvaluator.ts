/**
 * Smart Coach — Drill Trigger Evaluator (v2: Position-Based)
 * 
 * Replaced reactive-only triggers with structured position-based slots:
 * 
 * Slot 1 (turns 3-5): Conditional — fires when clear breakdown detected
 * Slot 2 (turn 7+): Mandatory — reinforcement/progression
 * 
 * The old signal-based triggers (support/challenge/repair) are now SECONDARY.
 * They only fire as fallback if position slots haven't triggered.
 * 
 * Design: "Conversation identifies the need. Practice targets the need."
 */

import type { CoachState, CoachUtteranceAnalysis } from './types';
import { evaluateDrillSlot, type ArcState, type GapSignals, type DrillSlotDecision } from './sessionArc';

// ─── Types ───────────────────────────────────────────────────

export type DrillTriggerReason = 'support' | 'challenge' | 'repair' | 'position_slot';

export interface DrillTriggerDecision {
  kind: 'micro_drill' | 'targeted_practice' | null;
  reason: DrillTriggerReason | null;
  confidence: number;
  observation: string;
  /** Signals that led to the decision */
  signals: string[];
  /** Which slot this is for (1 or 2) */
  slotNumber?: 1 | 2;
}

export interface DrillTriggerContext {
  state: CoachState;
  analysis: CoachUtteranceAnalysis;
  /** Analysis from the previous turn, if available */
  prevAnalysis?: CoachUtteranceAnalysis;
  /** Current objective ID from playbook */
  currentObjectiveId?: string;
  /** Whether the current objective was met this turn */
  objectiveAdvanced?: boolean;
  /** Turn number when last drill was completed */
  lastDrillCompletedAtTurn?: number;
  /** Max turns for this session */
  maxTurns: number;
  /** Session arc state for position-based triggers */
  arcState?: ArcState;
}

// ─── Constants ───────────────────────────────────────────────

/** Cooldown turns after a drill before another can trigger */
const DRILL_COOLDOWN_TURNS = 2;

// ─── Main Evaluator ─────────────────────────────────────────

export function evaluateDrillTrigger(ctx: DrillTriggerContext): DrillTriggerDecision {
  const { state, analysis, maxTurns } = ctx;
  const turn = state.turnCount;

  // Never trigger during warmup or wrapup
  if (state.mode === 'warmup' || state.mode === 'wrapup') {
    return NO_TRIGGER;
  }

  // Cooldown check
  if (ctx.lastDrillCompletedAtTurn != null && 
      (turn - ctx.lastDrillCompletedAtTurn) < DRILL_COOLDOWN_TURNS) {
    return NO_TRIGGER;
  }

  // ── PRIMARY: Position-based slot evaluation ──
  if (ctx.arcState) {
    const gapSignals: GapSignals = {
      hesitationDetected: analysis.hesitationDetected,
      circumlocution: analysis.circumlocution,
      wordCount: analysis.wordCount,
      semanticMatch: analysis.semanticMatch,
      pauseDetected: analysis.pauseDetected,
      supportLevel: state.supportLevel,
      consecutiveHesitations: state.consecutiveHesitations,
    };

    const slotDecision: DrillSlotDecision = evaluateDrillSlot(turn, ctx.arcState, gapSignals);

    if (slotDecision.shouldDrill && slotDecision.slotNumber) {
      const kind = slotDecision.slotNumber === 1 ? 'micro_drill' : 'targeted_practice';
      return {
        kind,
        reason: 'position_slot',
        confidence: 0.9,
        observation: slotDecision.slotNumber === 1
          ? "I noticed some words are hard to grab — let's practice that directly."
          : "Let's strengthen what you've been working on with one more round.",
        signals: [slotDecision.reason, `turn_${turn}`, `slot_${slotDecision.slotNumber}`],
        slotNumber: slotDecision.slotNumber,
      };
    }
  }

  // ── FALLBACK: Signal-based triggers (only if arc slots haven't fired) ──
  // These preserve the old behavior for edge cases
  
  // Max 2 drills per session
  if ((state.interventionCount || 0) >= 2) {
    return NO_TRIGGER;
  }

  // Support trigger (2+ signals of struggle)
  const supportResult = evaluateSupportTrigger(ctx);
  if (supportResult) return supportResult;

  // Repair trigger (off-topic or severe disengagement)
  const repairResult = evaluateRepairTrigger(ctx);
  if (repairResult) return repairResult;

  return NO_TRIGGER;
}

// ─── Support Trigger (fallback) ─────────────────────────────

function evaluateSupportTrigger(ctx: DrillTriggerContext): DrillTriggerDecision | null {
  const { state, analysis, prevAnalysis } = ctx;
  const signals: string[] = [];

  const recentHes = (state.recentHesitations || []).slice(-3);
  const hesCount = recentHes.filter(Boolean).length;
  if (hesCount >= 2) signals.push('hesitation_cluster');
  if (analysis.circumlocution) signals.push('circumlocution');
  if (analysis.wordCount <= 1 && !analysis.onTopic) signals.push('low_content_response');
  if ((state.consecutiveDisengagements || 0) >= 2) signals.push('disengagement_cluster');
  if (analysis.disengagementDetected && analysis.semanticMatch < 0.3) signals.push('low_engagement');
  if (prevAnalysis?.hesitationDetected && analysis.hesitationDetected) signals.push('consecutive_hesitation');
  if (state.supportLevel >= 2 && !ctx.objectiveAdvanced) signals.push('elevated_support_objective_unmet');

  if (signals.length >= 2) {
    return {
      kind: 'micro_drill',
      reason: 'support',
      confidence: Math.min(1, 0.5 + signals.length * 0.15),
      observation: "Let's practice that skill directly — a quick focused round.",
      signals,
    };
  }
  return null;
}

// ─── Repair Trigger (fallback) ──────────────────────────────

function evaluateRepairTrigger(ctx: DrillTriggerContext): DrillTriggerDecision | null {
  const { state } = ctx;
  const signals: string[] = [];

  if ((state.subtopicDepth || 0) >= 3) signals.push('deep_tangent');
  if (ctx.analysis.onTopic === false && ctx.prevAnalysis?.onTopic === false) signals.push('consecutive_off_topic');
  if ((state.consecutiveDisengagements || 0) >= 3) signals.push('severe_disengagement');

  if (signals.length >= 1) {
    return {
      kind: 'micro_drill',
      reason: 'repair',
      confidence: 0.6,
      observation: "Let's reset with a focused exercise to get back on track.",
      signals,
    };
  }
  return null;
}

// ─── Sentinel ───────────────────────────────────────────────

const NO_TRIGGER: DrillTriggerDecision = {
  kind: null,
  reason: null,
  confidence: 0,
  observation: '',
  signals: [],
};
