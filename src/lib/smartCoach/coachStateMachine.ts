/**
 * Smart Coach — State Machine
 * 
 * Determines the next coaching mode based on utterance analysis.
 * Transitions are intentional, not random.
 */

import type { CoachState, CoachUtteranceAnalysis } from './types';

/** Transition coach state based on what the user just said */
export function transitionCoachState(
  state: CoachState,
  analysis: CoachUtteranceAnalysis
): CoachState {
  const next = { ...state };

  // ── No response / silence → support
  if (analysis.wordCount === 0 && analysis.pauseDetected) {
    next.mode = 'support';
    next.isStuck = true;
    next.supportLevel = Math.min(3, state.supportLevel + 1) as 0 | 1 | 2 | 3;
    next.frustrationRisk = state.supportLevel >= 2 ? 'high' : 'medium';
    return next;
  }

  // ── Circumlocution → scaffold with semantic focus (check before hesitation)
  if (analysis.circumlocution) {
    next.mode = 'scaffold';
    next.isStuck = true;
    next.targetSkill = 'word_finding';
    // Don't escalate support if they're trying
    return next;
  }

  // ── Incomplete thought → scaffold (check before generic hesitation)
  if (analysis.incompleteThought) {
    next.mode = 'scaffold';
    next.isStuck = true;
    next.supportLevel = Math.min(3, state.supportLevel + 1) as 0 | 1 | 2 | 3;
    next.frustrationRisk = state.frustrationRisk === 'high' ? 'high' : 'medium';
    return next;
  }

  // ── Hesitation (without incomplete thought) → scaffold or support
  if (analysis.hesitationDetected) {
    // Check consecutive hesitations from state for escalation
    const consecutiveHesitations = (state.consecutiveHesitations || 0) + 1;
    next.consecutiveHesitations = consecutiveHesitations;
    
    if (consecutiveHesitations >= 2) {
      // 2+ consecutive hesitations → support mode (real help)
      next.mode = 'support';
      next.isStuck = true;
      next.supportLevel = Math.min(3, state.supportLevel + 1) as 0 | 1 | 2 | 3;
      next.frustrationRisk = 'medium';
    } else {
      // First hesitation → scaffold
      next.mode = 'scaffold';
      next.isStuck = true;
      next.supportLevel = Math.min(3, state.supportLevel + 1) as 0 | 1 | 2 | 3;
      next.frustrationRisk = state.frustrationRisk === 'high' ? 'high' : 'medium';
    }
    return next;
  }

  // ── Strong on-topic response → expand (reset hesitation counter)
  if (analysis.onTopic && analysis.wordCount >= 2 && analysis.confidence >= 0.5) {
    next.mode = 'expand';
    next.isStuck = false;
    next.consecutiveHesitations = 0;
    next.supportLevel = Math.max(0, state.supportLevel - 1) as 0 | 1 | 2 | 3;
    next.frustrationRisk = 'low';
    // Advance expand dimension to vary question types
    next.expandDimension = (state.expandDimension || 0) + 1;
    return next;
  }

  // ── Short but on-topic → gentle expand
  if (analysis.onTopic && analysis.wordCount >= 1) {
    next.mode = state.mode === 'warmup' ? 'warmup' : 'expand';
    next.isStuck = false;
    return next;
  }

  // ── Off-topic → re-anchor via scaffold
  if (!analysis.onTopic) {
    next.mode = 'scaffold';
    next.isStuck = false;
    return next;
  }

  // ── Default: stay in current mode
  return next;
}

/** Check if session should transition to wrapup */
export function shouldWrapUp(state: CoachState, maxTurns: number): boolean {
  return state.turnCount >= maxTurns;
}

/** Check if frustration requires immediate mode change */
export function isEmergencySupport(state: CoachState): boolean {
  return state.supportLevel >= 3 && state.frustrationRisk === 'high';
}
