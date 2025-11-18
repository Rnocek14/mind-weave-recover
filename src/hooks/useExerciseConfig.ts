import { useMemo } from 'react';
import { useExerciseGating } from './useExerciseGating';
import { getExerciseConfig } from '@/lib/clinicalProfileMapper';
import type { ExerciseConfig } from '@/lib/clinicalProfileMapper';

/**
 * Hook to get fully merged exercise configuration
 * Combines clinical profile recommendations + capability-based adaptations
 */
export const useExerciseConfig = (
  exerciseId: string,
  userId: string | undefined,
  clinicalProfile: any | null
) => {
  const { getAdaptations, capabilityScores } = useExerciseGating(userId);

  const mergedConfig: ExerciseConfig = useMemo(() => {
    // Start with clinical profile config
    const clinicalConfig = getExerciseConfig(exerciseId, clinicalProfile);
    
    // Get capability-based adaptations
    const capabilityAdaptations = getAdaptations(exerciseId);
    
    if (!capabilityAdaptations) {
      return clinicalConfig;
    }

    // Merge configs with capability adaptations taking precedence for safety features
    return {
      ...clinicalConfig,
      ...capabilityAdaptations.adaptations,
      
      // For numeric values, take the more conservative (easier) option
      startDifficulty: Math.min(
        clinicalConfig.startDifficulty || 2,
        capabilityAdaptations.adaptations.startDifficulty || 2
      ),
      
      cueLevel: Math.max(
        clinicalConfig.cueLevel || 1,
        capabilityAdaptations.adaptations.cueLevel || 1
      ),
      
      timeout: Math.max(
        clinicalConfig.timeout || 3000,
        capabilityAdaptations.adaptations.timeout || 3000
      ),
      
      maxChoices: Math.min(
        clinicalConfig.maxChoices || 4,
        capabilityAdaptations.adaptations.maxChoices || 4
      ),
      
      startSize: Math.max(
        clinicalConfig.startSize || 80,
        capabilityAdaptations.adaptations.startSize || 80
      ),
      
      // Boolean flags: OR them (enable if either source suggests it)
      enableVoice: clinicalConfig.enableVoice || capabilityAdaptations.adaptations.enableVoice || false,
      visualCues: clinicalConfig.visualCues || capabilityAdaptations.adaptations.visualCues || false,
      simplifyUI: clinicalConfig.simplifyUI || capabilityAdaptations.adaptations.simplifiedUI || false,
      textInstructions: clinicalConfig.textInstructions && 
        !capabilityAdaptations.adaptations.eliminateText,
      errorlessMode: clinicalConfig.errorlessMode || capabilityAdaptations.adaptations.errorlessMode || false,
    };
  }, [exerciseId, clinicalProfile, getAdaptations]);

  const adaptations = getAdaptations(exerciseId);

  return {
    config: mergedConfig,
    capabilityScores,
    hasCapabilityAdaptations: !!adaptations,
  };
};
