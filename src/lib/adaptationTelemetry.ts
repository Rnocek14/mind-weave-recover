/**
 * Shared Adaptation Telemetry Helper
 * 
 * Ensures every game logs consistent adaptation metadata to exercise_events.
 * Single source of truth for adaptation telemetry fields.
 */

import type { AdaptationContract } from '@/hooks/useSessionAdaptation';

export type AdaptationMode = 
  | 'phoneme_targeting' 
  | 'cue_personalization' 
  | 'difficulty_only' 
  | 'profile_aware'
  | 'none';

export interface AdaptationTelemetryPayload {
  focus_phonemes: string[] | null;
  adaptation_reasons: string[];
  profile_confidence: string;
  recommended_cue_type: string;
  difficulty_level: number;
  adaptation_applied: boolean;
  adaptation_mode: AdaptationMode;
}

/**
 * Classify how a game is using the adaptation contract.
 */
function classifyAdaptationMode(
  contract: AdaptationContract,
  gameUsesPhonemes: boolean,
  gameUsesCues: boolean,
): AdaptationMode {
  if (gameUsesPhonemes && contract.focusPhonemes.length > 0) {
    return 'phoneme_targeting';
  }
  if (gameUsesCues && contract.recommendedCueType !== 'none') {
    return 'cue_personalization';
  }
  if (contract.difficultyTier > 1 || contract.adaptationReasons.length > 0) {
    return 'difficulty_only';
  }
  if (contract.speechProfile) {
    return 'profile_aware';
  }
  return 'none';
}

/**
 * Build the standard adaptation telemetry payload for any exercise.
 * Merge this into taskParameters when logging trials.
 */
export function buildAdaptationTelemetry(
  contract: AdaptationContract,
  options: {
    /** Does this game use phoneme-targeted content selection? */
    phonemeSensitive?: boolean;
    /** Does this game use cue personalization? */
    cueSensitive?: boolean;
  } = {},
): AdaptationTelemetryPayload {
  const { phonemeSensitive = false, cueSensitive = false } = options;
  
  const mode = classifyAdaptationMode(contract, phonemeSensitive, cueSensitive);
  const applied = mode !== 'none';

  return {
    focus_phonemes: contract.focusPhonemes.length > 0 ? contract.focusPhonemes : null,
    adaptation_reasons: contract.adaptationReasons,
    profile_confidence: contract.profileConfidence,
    recommended_cue_type: contract.recommendedCueType,
    difficulty_level: contract.difficultyTier,
    adaptation_applied: applied,
    adaptation_mode: mode,
  };
}
