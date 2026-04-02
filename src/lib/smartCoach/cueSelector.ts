/**
 * Smart Coach — Cue Selector
 * 
 * Chooses the right therapeutic cue based on state + utterance analysis.
 * Severity-aware: adjusts defaults by profile.
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

  // ── Severity-aware hesitation handling
  if (analysis.hesitationDetected || analysis.pauseDetected) {
    // Severe: always forced choice for minimum friction
    if (state.severityProfile === 'severe') {
      return {
        cueType: 'forced_choice',
        rationale: 'Severe profile — default to binary choice for accessibility',
      };
    }
    
    // High support → forced choice
    if (state.supportLevel >= 2) {
      return {
        cueType: 'forced_choice',
        rationale: 'Extended hesitation at high support — narrow to binary choice',
      };
    }
    
    // Lower support → reassurance first
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

  // ── Deficit-aware defaults
  if (state.primaryDeficit === 'receptive') {
    // Receptive: prioritize comprehension checks and simpler structures
    if (analysis.wordCount <= 1) {
      return {
        cueType: 'forced_choice',
        rationale: 'Receptive deficit — simplify to verify understanding',
      };
    }
  }

  if (state.primaryDeficit === 'expressive' && state.mode === 'scaffold') {
    // Expressive: prioritize word-finding support
    return {
      cueType: 'phonemic_hint',
      rationale: 'Expressive deficit — phonemic cue to aid retrieval',
    };
  }

  // ── Default: severity-aware
  if (state.severityProfile === 'severe') {
    return {
      cueType: 'forced_choice',
      rationale: 'Severe profile — default to structured choice',
    };
  }

  const defaultCue: CueType = state.mode === 'warmup' || state.mode === 'expand'
    ? 'expansion_prompt'
    : 'sentence_starter';

  return {
    cueType: defaultCue,
    rationale: `Default cue for ${state.mode} mode`,
  };
}
