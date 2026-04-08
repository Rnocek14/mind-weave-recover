/**
 * useMayaExerciseFrame — Centralizes Maya intro/reflection logic for exercises.
 * 
 * Prevents each exercise from reinventing its own Maya behavior.
 * Returns purpose text (for intro) and a buildReflection function (for summary).
 * 
 * Part of the system foundation (Phase 1).
 */

import { useMemo, useCallback } from 'react';
import { getExercisePurpose } from '@/lib/exercisePurposeMap';
import { getExerciseReflection, ExerciseReflectionTemplate } from '@/lib/exerciseReflectionMap';

interface UseMayaExerciseFrameOptions {
  exerciseSlug: string;
}

interface MayaReflectionResult {
  reflection: string;
  nextStep: string;
  realLifeLine: string;
}

export function useMayaExerciseFrame({ exerciseSlug }: UseMayaExerciseFrameOptions) {
  const purposeText = useMemo(() => getExercisePurpose(exerciseSlug), [exerciseSlug]);

  const template = useMemo(() => getExerciseReflection(exerciseSlug), [exerciseSlug]);

  const buildReflection = useCallback((accuracy: number): MayaReflectionResult => {
    if (!template) {
      return {
        reflection: 'Good work today. Each session builds on the last.',
        nextStep: 'Keep practicing to strengthen these skills.',
        realLifeLine: 'These skills help in everyday communication.',
      };
    }

    return {
      reflection: template.getReflection(accuracy),
      nextStep: template.getNextStep(accuracy),
      realLifeLine: template.realLifeLine,
    };
  }, [template]);

  return {
    purposeText,
    buildReflection,
    skillCategories: template?.skillCategories ?? [],
  };
}
