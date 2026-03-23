import { useMemo } from 'react';
import { useExerciseGating } from './useExerciseGating';
import { useRuntimeConfig } from './useRuntimeConfig';
import { getExerciseConfig } from '@/lib/clinicalProfileMapper';
import type { ExerciseConfig } from '@/lib/clinicalProfileMapper';
import { getCapabilityDifficultyBounds, clampToBounds } from '@/lib/difficultyBounds';

/**
 * Hook to get fully merged exercise configuration.
 * 
 * Reads from THREE layers (in priority order):
 * 1. runtime_config (clinician overrides / mutable plan knobs)
 * 2. capability-based adaptations (safety bounds)
 * 3. clinical_profile (static clinical truth)
 * 
 * This is the CANONICAL config read path for all games/sessions.
 */
export const useExerciseConfig = (
  exerciseId: string,
  userId: string | undefined,
  profileId: string | undefined,
  clinicalProfile: any | null,
  lessonBlock?: { startDifficulty?: number } | null
) => {
  const { getAdaptations, capabilityScores } = useExerciseGating(userId, profileId);
  const { getDifficulty, getCueLevel } = useRuntimeConfig();

  // Calculate capability-based difficulty bounds
  const bounds = useMemo(
    () => getCapabilityDifficultyBounds(exerciseId, capabilityScores),
    [exerciseId, capabilityScores]
  );

  const mergedConfig: ExerciseConfig = useMemo(() => {
    // Start with clinical profile config
    const clinicalConfig = getExerciseConfig(exerciseId, clinicalProfile);
    
    // Get runtime config overrides (clinician-driven)
    const runtimeDifficultyOffset = getDifficulty(exerciseId);
    const runtimeCueLevel = getCueLevel();
    
    // Get capability-based adaptations
    const capabilityAdaptations = getAdaptations(exerciseId);
    
    if (!capabilityAdaptations) {
      const baseStart =
        lessonBlock?.startDifficulty ??
        clinicalConfig.startDifficulty ??
        bounds.suggestedStart;

      return {
        ...clinicalConfig,
        startDifficulty: clampToBounds(baseStart + runtimeDifficultyOffset, bounds),
        // Apply runtime cue level if set by clinician
        ...(runtimeCueLevel !== null ? { cueLevel: runtimeCueLevel } : {}),
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
      
      // Apply runtime difficulty offset, then clamp to bounds
      startDifficulty: clampToBounds(
        Math.min(
          clinicalConfig.startDifficulty ?? rawStart,
          adapted.startDifficulty ?? rawStart
        ) + runtimeDifficultyOffset,
        bounds
      ),
      
      // Runtime cue level > capability > clinical (highest wins for safety)
      cueLevel: runtimeCueLevel !== null
        ? runtimeCueLevel
        : Math.max(
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
  }, [exerciseId, clinicalProfile, lessonBlock, getAdaptations, bounds, getDifficulty, getCueLevel]);

  const adaptations = getAdaptations(exerciseId);

  return {
    config: mergedConfig,
    capabilityScores,
    hasCapabilityAdaptations: !!adaptations,
    bounds,
  };
};
