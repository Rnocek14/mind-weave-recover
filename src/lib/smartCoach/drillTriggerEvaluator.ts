/**
 * Smart Coach — Drill Trigger Evaluator
 * 
 * Determines WHEN to inject a micro-drill or targeted practice block
 * during a Smart Coach session. Three trigger types:
 * 
 * 1. Support — user is struggling, needs structured help
 * 2. Challenge — user is doing well, increase intensity  
 * 3. Repair — conversation lost focus, reset with structure
 * 
 * Design rules:
 * - Micro-drills only in turns 3–6 (one max per conversation block)
 * - Targeted practice after turn 8 or transfer_check
 * - Never trigger during warmup or wrapup
 * - Never trigger if user just completed a drill (2-turn cooldown)
 * - Never trigger if user is correcting Maya
 */

import type { CoachState, CoachUtteranceAnalysis } from './types';

// ─── Types ───────────────────────────────────────────────────

export type DrillTriggerReason = 'support' | 'challenge' | 'repair';

export interface DrillTriggerDecision {
  kind: 'micro_drill' | 'targeted_practice' | null;
  reason: DrillTriggerReason | null;
  confidence: number;
  observation: string;
  /** Signals that led to the decision */
  signals: string[];
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
}

// ─── Constants ───────────────────────────────────────────────

/** Earliest turn for a micro-drill */
const MICRO_DRILL_EARLIEST = 3;
/** Latest turn for a micro-drill */
const MICRO_DRILL_LATEST = 6;
/** Cooldown turns after a drill before another can trigger */
const DRILL_COOLDOWN_TURNS = 2;
/** Minimum turn for targeted practice */
const TARGETED_PRACTICE_MIN_TURN = 8;

// ─── Main Evaluator ─────────────────────────────────────────

export function evaluateDrillTrigger(ctx: DrillTriggerContext): DrillTriggerDecision {
  const { state, analysis, maxTurns } = ctx;
  const turn = state.turnCount;

  // Never trigger during warmup or wrapup
  if (state.mode === 'warmup' || state.mode === 'wrapup') {
    return NO_TRIGGER;
  }

  // Cooldown check — don't trigger if just did a drill
  if (ctx.lastDrillCompletedAtTurn != null && 
      (turn - ctx.lastDrillCompletedAtTurn) < DRILL_COOLDOWN_TURNS) {
    return NO_TRIGGER;
  }

  // ── Check for targeted practice (end-of-session) ──
  if (turn >= TARGETED_PRACTICE_MIN_TURN || ctx.currentObjectiveId === 'transfer_check') {
    return {
      kind: 'targeted_practice',
      reason: 'support',
      confidence: 0.9,
      observation: "Let's lock in what you practiced today.",
      signals: ['session_late_phase', `turn_${turn}_of_${maxTurns}`],
    };
  }

  // ── Micro-drill window check ──
  if (turn < MICRO_DRILL_EARLIEST || turn > MICRO_DRILL_LATEST) {
    return NO_TRIGGER;
  }

  // Already had a micro-drill this session? One max.
  if ((state.interventionCount || 0) >= 1) {
    return NO_TRIGGER;
  }

  // ── Evaluate support trigger ──
  const supportResult = evaluateSupportTrigger(ctx);
  if (supportResult) return supportResult;

  // ── Evaluate challenge trigger ──
  const challengeResult = evaluateChallengeTrigger(ctx);
  if (challengeResult) return challengeResult;

  // ── Evaluate repair trigger ──
  const repairResult = evaluateRepairTrigger(ctx);
  if (repairResult) return repairResult;

  return NO_TRIGGER;
}

// ─── Support Trigger ────────────────────────────────────────

function evaluateSupportTrigger(ctx: DrillTriggerContext): DrillTriggerDecision | null {
  const { state, analysis, prevAnalysis } = ctx;
  const signals: string[] = [];

  // Count recent hesitations (last 3 turns)
  const recentHes = (state.recentHesitations || []).slice(-3);
  const hesCount = recentHes.filter(Boolean).length;
  if (hesCount >= 2) signals.push('hesitation_cluster');

  // Circumlocution detected
  if (analysis.circumlocution) signals.push('circumlocution');

  // Low-content response — decouple from onTopic so disengagement triggers this
  if (analysis.wordCount <= 1 && !analysis.onTopic) {
    signals.push('low_content_response');
  }

  // Disengagement cluster — consecutive polite fillers with no content
  if ((state.consecutiveDisengagements || 0) >= 2) {
    signals.push('disengagement_cluster');
  }

  // Single disengagement + low semantic match = weak participation
  if (analysis.disengagementDetected && analysis.semanticMatch < 0.3) {
    signals.push('low_engagement');
  }

  // Previous turn also had issues
  if (prevAnalysis?.hesitationDetected && analysis.hesitationDetected) {
    signals.push('consecutive_hesitation');
  }

  // Support level already elevated and objective still unmet
  if (state.supportLevel >= 2 && !ctx.objectiveAdvanced) {
    signals.push('elevated_support_objective_unmet');
  }

  // Need 2+ signals for support trigger
  if (signals.length >= 2) {
    return {
      kind: 'micro_drill',
      reason: 'support',
      confidence: Math.min(1, 0.5 + signals.length * 0.15),
      observation: "Let's practice that quickly.",
      signals,
    };
  }

  return null;
}

// ─── Challenge Trigger ──────────────────────────────────────

function evaluateChallengeTrigger(ctx: DrillTriggerContext): DrillTriggerDecision | null {
  const { state, analysis } = ctx;
  const signals: string[] = [];

  // Recent objective advanced
  if (ctx.objectiveAdvanced) signals.push('objective_advanced');

  // No hesitation in last 2 turns
  const recentHes = (state.recentHesitations || []).slice(-2);
  if (recentHes.every(h => !h)) signals.push('no_recent_hesitation');

  // Multi-word independent response
  if (analysis.wordCount >= 3 && !analysis.hesitationDetected) {
    signals.push('strong_independent_response');
  }

  // Low support level
  if (state.supportLevel <= 1) signals.push('low_support_level');

  // Good semantic match
  if (analysis.semanticMatch > 0.5) signals.push('good_semantic_match');

  // Need ALL core signals: advanced + no hesitation + strong response + low support
  if (signals.includes('objective_advanced') &&
      signals.includes('no_recent_hesitation') &&
      signals.includes('strong_independent_response') &&
      signals.includes('low_support_level')) {
    return {
      kind: 'micro_drill',
      reason: 'challenge',
      confidence: 0.8,
      observation: "You're doing well — let's push a bit further.",
      signals,
    };
  }

  return null;
}

// ─── Repair Trigger ─────────────────────────────────────────

function evaluateRepairTrigger(ctx: DrillTriggerContext): DrillTriggerDecision | null {
  const { state } = ctx;
  const signals: string[] = [];

  // Tangent depth exceeded
  if ((state.subtopicDepth || 0) >= 3) signals.push('deep_tangent');

  // Off-topic for multiple turns (conversation lost focus)
  if (ctx.analysis.onTopic === false && ctx.prevAnalysis?.onTopic === false) {
    signals.push('consecutive_off_topic');
  }

  // Disengagement cluster — session needs a reset
  if ((state.consecutiveDisengagements || 0) >= 3) {
    signals.push('severe_disengagement');
  }

  if (signals.length >= 1) {
    return {
      kind: 'micro_drill',
      reason: 'repair',
      confidence: 0.6,
      observation: "Let's reset with a quick round.",
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
