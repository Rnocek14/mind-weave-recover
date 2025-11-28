/**
 * Personalized cue selection using UserSpeechProfile
 * Adapts cue type based on individual user's cue efficacy patterns
 */

import type { UserSpeechProfile } from '@/hooks/useUserSpeechProfile';

export type ErrorType =
  | 'correct'
  | 'semantic_paraphasia'
  | 'phonemic_paraphasia'
  | 'circumlocution'
  | 'neologism'
  | 'no_response'
  | 'attempted'
  | 'other';

export type CueType = 'semantic' | 'phonemic' | 'full_word' | 'none';

export interface CueRecommendation {
  cueType: CueType;
  reasoning: string;
  confidence: number;
}

/**
 * Select optimal cue type based on error type and user's personalized profile
 */
export function selectOptimalCue(
  errorType: ErrorType,
  profile: UserSpeechProfile | null
): CueRecommendation {
  // 1. Default mapping based on error type (research-backed)
  let defaultCue: CueType = mapErrorTypeToCue(errorType);
  
  // If no profile, return default with medium confidence
  if (!profile || !profile.cue_efficacy_by_type) {
    return {
      cueType: defaultCue,
      reasoning: `Default mapping: ${defaultCue} cue for ${errorType}`,
      confidence: 0.5
    };
  }

  const efficacy = profile.cue_efficacy_by_type;
  const defaultRate = efficacy[defaultCue]?.successRate ?? 0;

  // 2. Check if any cue type is significantly better (15%+ higher success rate)
  let bestCue: CueType = defaultCue;
  let bestRate = defaultRate;
  const threshold = 0.15; // 15 percentage points better

  (['semantic', 'phonemic', 'full_word'] as CueType[]).forEach((cueType) => {
    const stats = efficacy[cueType];
    if (stats && stats.total >= 3) { // Require minimum 3 trials for reliability
      const rate = stats.successRate;
      if (rate > bestRate + threshold) {
        bestCue = cueType;
        bestRate = rate;
      }
    }
  });

  // 3. Build reasoning message
  const personalized = bestCue !== defaultCue;
  const reasoning = personalized
    ? `Personalized: ${bestCue} cues work better for you (${Math.round(bestRate * 100)}% vs ${Math.round(defaultRate * 100)}% success)`
    : `Default mapping: ${defaultCue} cue for ${errorType}`;

  return {
    cueType: bestCue,
    reasoning,
    confidence: bestRate
  };
}

/**
 * Default error-to-cue mapping based on aphasia research
 */
function mapErrorTypeToCue(errorType: ErrorType): CueType {
  switch (errorType) {
    case 'semantic_paraphasia':
    case 'circumlocution':
      return 'semantic';
    
    case 'phonemic_paraphasia':
    case 'attempted':
      return 'phonemic';
    
    case 'neologism':
    case 'no_response':
      return 'full_word';
    
    case 'correct':
      return 'none';
    
    default:
      return 'semantic'; // Default to semantic as safe starting point
  }
}
