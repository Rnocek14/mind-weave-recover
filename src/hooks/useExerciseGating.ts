import { useMemo } from 'react';
import { useCapabilityAssessment } from './useCapabilityAssessment';
import { 
  isExerciseAccessible, 
  getAccessibleExercises, 
  getExerciseAdaptations,
  type ExerciseAdaptation 
} from '@/lib/exerciseGating';
import type { CapabilityScores } from '@/lib/capabilityAssessor';

export const useExerciseGating = (userId: string | undefined) => {
  const { currentAssessment } = useCapabilityAssessment(userId);

  const capabilityScores: CapabilityScores | null = useMemo(() => {
    if (!currentAssessment || !currentAssessment.completed) {
      return null;
    }

    return {
      vision: currentAssessment.vision_score || 0,
      motor: currentAssessment.motor_score || 0,
      attention: currentAssessment.attention_score || 0,
      confidence: currentAssessment.confidence_score || 0,
    };
  }, [currentAssessment]);

  const accessibleExercises = useMemo(() => {
    return getAccessibleExercises(capabilityScores);
  }, [capabilityScores]);

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
  };
};
