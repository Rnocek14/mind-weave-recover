import { useMemo } from 'react';
import { useExerciseGating } from './useExerciseGating';
import { getExerciseConfig } from '@/lib/clinicalProfileMapper';
import type { ExerciseConfig } from '@/lib/clinicalProfileMapper';
import { getCapabilityDifficultyBounds, clampToBounds } from '@/lib/difficultyBounds';

/**
 * Hook to get fully merged exercise configuration
 * Combines clinical profile recommendations + capability-based adaptations
 * with difficulty bounds based on capability scores
 */
export const useExerciseConfig = (
  exerciseId: string,
  userId: string | undefined,
  clinicalProfile: any | null,
  lessonBlock?: { startDifficulty?: number } | null
) => {
  const { getAdaptations, capabilityScores } = useExerciseGating(userId);

  // Calculate capability-based difficulty bounds
  const bounds = useMemo(
    () => getCapabilityDifficultyBounds(exerciseId, capabilityScores),
    [exerciseId, capabilityScores]
  );

  const mergedConfig: ExerciseConfig = useMemo(() => {
    // Start with clinical profile config
    const clinicalConfig = getExerciseConfig(exerciseId, clinicalProfile);
    
    // Get capability-based adaptations
    const capabilityAdaptations = getAdaptations(exerciseId);
    
    if (!capabilityAdaptations) {
      // No capability adaptations, but still clamp to bounds
      const baseStart =
        lessonBlock?.startDifficulty ??
        clinicalConfig.startDifficulty ??
        bounds.suggestedStart;

      return {
        ...clinicalConfig,
        startDifficulty: clampToBounds(baseStart, bounds),
      };
    }

    const adapted = capabilityAdaptations.adaptations;

    // Choose starting difficulty from all sources, then clamp to capability bounds
    const rawStart =
      lessonBlock?.startDifficulty ??
      adapted.startDifficulty ??
      clinicalConfig.startDifficulty ??
      bounds.suggestedStart;

    // Merge configs with capability adaptations taking precedence for safety features
    return {
      ...clinicalConfig,
      ...adapted,
      
      // For numeric values, take the more conservative option, then clamp to bounds
      startDifficulty: clampToBounds(
        Math.min(
          clinicalConfig.startDifficulty ?? rawStart,
          adapted.startDifficulty ?? rawStart
        ),
        bounds
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
      enableVoice: clinicalConfig.enableVoice || adapted.enableVoice || false,
      visualCues: clinicalConfig.visualCues || adapted.visualCues || false,
      simplifyUI: clinicalConfig.simplifyUI || adapted.simplifiedUI || false,
      textInstructions: clinicalConfig.textInstructions && !adapted.eliminateText,
      errorlessMode: clinicalConfig.errorlessMode || adapted.errorlessMode || false,
    };
  }, [exerciseId, clinicalProfile, lessonBlock, getAdaptations, bounds]);

  const adaptations = getAdaptations(exerciseId);

  return {
    config: mergedConfig,
    capabilityScores,
    hasCapabilityAdaptations: !!adaptations,
    bounds,
  };
};
