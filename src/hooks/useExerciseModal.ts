/**
 * useExerciseModal — Modal controller for launching exercises from chat
 * 
 * Provides launch/close API and tracks active exercise state.
 * Used by ConversationCoachGame to open popup exercises.
 */

import { useState, useCallback } from 'react';

export interface ExerciseModalConfig {
  targetDomain?: string;
  targetWords?: string[];
  targetPhonemes?: string[];
  difficultyTier?: number;
  cueLevel?: number;
  source?: 'maya_chat';
  sessionId?: string;
  totalTrials?: number;
}

export interface ActiveModalExercise {
  slug: string;
  config: ExerciseModalConfig;
  launchedAt: number;
}

export interface ExerciseModalController {
  isOpen: boolean;
  activeExercise: ActiveModalExercise | null;
  launchExerciseModal: (slug: string, config?: ExerciseModalConfig) => void;
  closeExerciseModal: () => void;
}

export function useExerciseModal(): ExerciseModalController {
  const [activeExercise, setActiveExercise] = useState<ActiveModalExercise | null>(null);

  const launchExerciseModal = useCallback((slug: string, config: ExerciseModalConfig = {}) => {
    setActiveExercise({
      slug,
      config: { ...config, source: 'maya_chat' },
      launchedAt: Date.now(),
    });
  }, []);

  const closeExerciseModal = useCallback(() => {
    setActiveExercise(null);
  }, []);

  return {
    isOpen: activeExercise !== null,
    activeExercise,
    launchExerciseModal,
    closeExerciseModal,
  };
}
