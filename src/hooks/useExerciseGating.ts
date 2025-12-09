import { useMemo } from 'react';
import { useAssessmentContext } from '@/contexts/AssessmentContext';
import { 
  isExerciseAccessible, 
  getAccessibleExercises, 
  getExerciseAdaptations,
  type ExerciseAdaptation 
} from '@/lib/exerciseGating';
import type { CapabilityScores } from '@/lib/capabilityAssessor';

export const useExerciseGating = (_userId?: string, _profileId?: string) => {
  const { currentAssessment, previousAssessment } = useAssessmentContext();

  // Use current assessment if complete, otherwise fall back to previous completed assessment
  const capabilityScores: CapabilityScores | null = useMemo(() => {
    // First try current assessment
    if (currentAssessment?.completed) {
      return {
        vision: currentAssessment.vision_score || 0,
        motor: currentAssessment.motor_score || 0,
        attention: currentAssessment.attention_score || 0,
        confidence: currentAssessment.confidence_score || 0,
      };
    }
    
    // Fall back to previous completed assessment
    if (previousAssessment?.completed) {
      console.log('[useExerciseGating] Using previous completed assessment for scores');
      return {
        vision: previousAssessment.vision_score || 0,
        motor: previousAssessment.motor_score || 0,
        attention: previousAssessment.attention_score || 0,
        confidence: previousAssessment.confidence_score || 0,
      };
    }
    
    return null;
  }, [currentAssessment, previousAssessment]);

  const accessibleExercises = useMemo(() => {
    if (!capabilityScores) {
      return getAccessibleExercises(null);
    }

    const baseAccessible = getAccessibleExercises(capabilityScores);
    
    // Safety valve: if fewer than 2 exercises are accessible, soften thresholds
    if (baseAccessible.length >= 2) {
      return baseAccessible;
    }

    // Temporarily increase all scores by 1 to unlock more exercises
    const softenedScores = {
      ...capabilityScores,
      vision: Math.min(10, capabilityScores.vision + 1),
      motor: Math.min(10, capabilityScores.motor + 1),
      attention: Math.min(10, capabilityScores.attention + 1),
    };

    const softenedAccessible = getAccessibleExercises(softenedScores);
    
    console.log('[Exercise Gating] Soft override active:', {
      originalCount: baseAccessible.length,
      softenedCount: softenedAccessible.length,
      originalScores: capabilityScores,
      softenedScores,
    });

    return softenedAccessible.length > 0 ? softenedAccessible : baseAccessible;
  }, [capabilityScores]);

  const hasSoftOverride = useMemo(() => {
    if (!capabilityScores) return false;
    const baseAccessible = getAccessibleExercises(capabilityScores);
    return baseAccessible.length < 2 && accessibleExercises.length > baseAccessible.length;
  }, [capabilityScores, accessibleExercises]);

  const checkExerciseAccess = (exerciseId: string) => {
    return isExerciseAccessible(exerciseId, capabilityScores);
  };

  const getAdaptations = (exerciseId: string): ExerciseAdaptation | null => {
    return getExerciseAdaptations(exerciseId, capabilityScores);
  };

  return {
    capabilityScores,
    accessibleExercises,
    checkExerciseAccess,
    getAdaptations,
    hasAssessment: !!capabilityScores,
    hasSoftOverride,
  };
};
