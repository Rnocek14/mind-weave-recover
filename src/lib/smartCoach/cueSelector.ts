/**
 * Smart Coach — Cue Selector
 * 
 * Chooses the right therapeutic cue based on state + utterance analysis.
 * Maps error types to clinically appropriate support.
 */

import type { CoachState, CoachUtteranceAnalysis, CueDecision, CueType } from './types';

export function selectCue(
  state: CoachState,
  analysis: CoachUtteranceAnalysis
): CueDecision {

  // ── Circumlocution → semantic hint (they know the concept, need the word)
  if (analysis.circumlocution) {
    return {
      cueType: 'semantic_hint',
      rationale: 'User knows concept but not exact word — provide semantic cue',
    };
  }

  // ── Phonological approximation → phonemic hint
  if (analysis.phonologicalApprox) {
    return {
      cueType: 'phonemic_hint',
      rationale: 'Close sound pattern detected — provide first-sound cue',
    };
  }

  // ── Incomplete thought → sentence starter
  if (analysis.incompleteThought) {
    return {
      cueType: 'sentence_starter',
      rationale: 'User needs structure to continue thought',
    };
  }

  // ── Hesitation / silence at high support → forced choice
  if ((analysis.hesitationDetected || analysis.pauseDetected) && state.supportLevel >= 2) {
    return {
      cueType: 'forced_choice',
      rationale: 'Extended hesitation at high support — narrow to binary choice',
    };
  }

  // ── Hesitation at lower support → reassurance first
  if (analysis.hesitationDetected || analysis.pauseDetected) {
    return {
      cueType: 'reassurance',
      rationale: 'Reduce pressure before prompting',
    };
  }

  // ── Good response → expansion prompt
  if (analysis.semanticMatch > 0.5 && analysis.wordCount >= 2) {
    return {
      cueType: 'expansion_prompt',
      rationale: 'User is ready to say more',
    };
  }

  // ── Default: expansion for warmup/expand, scaffold otherwise
  const defaultCue: CueType = state.mode === 'warmup' || state.mode === 'expand'
    ? 'expansion_prompt'
    : 'sentence_starter';

  return {
    cueType: defaultCue,
    rationale: `Default cue for ${state.mode} mode`,
  };
}
