/**
 * Smart Coach — State Machine
 * 
 * Determines the next coaching mode based on utterance analysis.
 * Tracks hesitation clusters for intervention triggers.
 */

import type { CoachState, CoachUtteranceAnalysis } from './types';

/** Transition coach state based on what the user just said */
export function transitionCoachState(
  state: CoachState,
  analysis: CoachUtteranceAnalysis
): CoachState {
  const next = { ...state };

  // Track hesitation in rolling window (last 5 turns)
  const recentHesitations = [...(state.recentHesitations || []), analysis.hesitationDetected].slice(-5);
  next.recentHesitations = recentHesitations;

  // Update session metrics
  next.sessionMetrics = { ...state.sessionMetrics };
  next.sessionMetrics.wordsProduced += analysis.wordCount;
  if (analysis.wordCount > next.sessionMetrics.longestResponse) {
    next.sessionMetrics.longestResponse = analysis.wordCount;
  }

  // ── No response / silence → support
  if (analysis.wordCount === 0 && analysis.pauseDetected) {
    next.mode = 'support';
    next.isStuck = true;
    next.supportLevel = Math.min(3, state.supportLevel + 1) as 0 | 1 | 2 | 3;
    next.frustrationRisk = state.supportLevel >= 2 ? 'high' : 'medium';
    next.sessionMetrics.hesitationCount++;
    return next;
  }

  // ── Circumlocution → scaffold with semantic focus
  if (analysis.circumlocution) {
    next.mode = 'scaffold';
    next.isStuck = true;
    next.targetSkill = 'word_finding';
    next.sessionMetrics.semanticErrorCount++;
    return next;
  }

  // ── Incomplete thought → scaffold
  if (analysis.incompleteThought) {
    next.mode = 'scaffold';
    next.isStuck = true;
    next.supportLevel = Math.min(3, state.supportLevel + 1) as 0 | 1 | 2 | 3;
    next.frustrationRisk = state.frustrationRisk === 'high' ? 'high' : 'medium';
    return next;
  }

  // ── Hesitation → scaffold or support
  if (analysis.hesitationDetected) {
    const consecutiveHesitations = (state.consecutiveHesitations || 0) + 1;
    next.consecutiveHesitations = consecutiveHesitations;
    next.sessionMetrics.hesitationCount++;
    
    if (consecutiveHesitations >= 2) {
      next.mode = 'support';
      next.isStuck = true;
      next.supportLevel = Math.min(3, state.supportLevel + 1) as 0 | 1 | 2 | 3;
      next.frustrationRisk = 'medium';
      next.sessionMetrics.cueAssistedCount++;
    } else {
      next.mode = 'scaffold';
      next.isStuck = true;
      next.supportLevel = Math.min(3, state.supportLevel + 1) as 0 | 1 | 2 | 3;
      next.frustrationRisk = state.frustrationRisk === 'high' ? 'high' : 'medium';
    }
    return next;
  }

  // ── Strong on-topic response → expand
  if (analysis.onTopic && analysis.wordCount >= 2 && analysis.confidence >= 0.5) {
    next.mode = 'expand';
    next.isStuck = false;
    next.consecutiveHesitations = 0;
    next.supportLevel = Math.max(0, state.supportLevel - 1) as 0 | 1 | 2 | 3;
    next.frustrationRisk = 'low';
    next.expandDimension = (state.expandDimension || 0) + 1;
    next.sessionMetrics.independentResponses++;
    return next;
  }

  // ── Short but on-topic → gentle expand
  if (analysis.onTopic && analysis.wordCount >= 1) {
    next.mode = state.mode === 'warmup' ? 'warmup' : 'expand';
    next.isStuck = false;
    next.consecutiveHesitations = 0;
    next.sessionMetrics.independentResponses++;
    return next;
  }

  // ── Off-topic → re-anchor via scaffold
  if (!analysis.onTopic) {
    next.mode = 'scaffold';
    next.isStuck = false;
    return next;
  }

  return next;
}

/** Check if session should transition to wrapup */
export function shouldWrapUp(state: CoachState, maxTurns: number): boolean {
  return state.turnCount >= maxTurns - 1;
}

/** Check if frustration requires immediate mode change */
export function isEmergencySupport(state: CoachState): boolean {
  return state.supportLevel >= 3 && state.frustrationRisk === 'high';
}

/** Check for hesitation cluster (3+ in last 5 turns) */
export function hasHesitationCluster(state: CoachState): boolean {
  const recent = state.recentHesitations || [];
  const count = recent.filter(Boolean).length;
  return count >= 3;
}
