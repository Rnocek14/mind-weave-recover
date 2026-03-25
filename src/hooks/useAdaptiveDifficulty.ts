import { useState, useRef, useCallback, useEffect } from 'react';
import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import { useAdaptationEventLogger } from '@/hooks/useAdaptationEventLogger';
import { SuccessBandController, type SuccessBandConfig, type SuccessBandState } from '@/lib/successBandController';
import { useAdaptationEventLogger } from '@/hooks/useAdaptationEventLogger';

interface UseAdaptiveDifficultyOptions {
  initialDifficulty: number;
  bounds: DifficultyBounds;
  windowSize?: number;
  targetSuccessRate?: number;
  adjustmentThreshold?: number;
  onDifficultyChange?: (newLevel: number) => void;
  // Logging context
  userId?: string;
  profileId?: string;
  sessionId?: string | null;
  exerciseSlug?: string;
  // Success-band controller config
  successBandConfig?: Partial<SuccessBandConfig>;
}

export const useAdaptiveDifficulty = ({
  initialDifficulty,
  bounds,
  windowSize = 5,
  targetSuccessRate = 0.80,
  adjustmentThreshold = 0.15,
  onDifficultyChange,
  userId,
  profileId,
  sessionId,
  exerciseSlug,
  successBandConfig,
}: UseAdaptiveDifficultyOptions) => {
  const [currentDifficulty, setCurrentDifficulty] = useState(initialDifficulty);
  const trialIndexRef = useRef(0);
  
  const controllerRef = useRef(
    new AdaptiveDifficultyController(
      windowSize,
      targetSuccessRate,
      adjustmentThreshold,
      bounds
    )
  );

  // Adaptation event logger - only active if userId provided
  const { logDifficultyChange } = useAdaptationEventLogger({
    userId,
    profileId,
  });

  // Update bounds when they change
  useEffect(() => {
    controllerRef.current.setBounds(bounds);
  }, [bounds]);

  // Update a trial result
  const updateTrial = useCallback((wasCorrect: boolean) => {
    controllerRef.current.update(wasCorrect);
    trialIndexRef.current += 1;
  }, []);

  // Check if difficulty should adjust and return the result
  const checkAndAdjust = useCallback((): { adjusted: boolean; newLevel: number } => {
    const previousLevel = currentDifficulty;
    const newLevel = controllerRef.current.adjustLevel(currentDifficulty);
    const adjusted = newLevel !== currentDifficulty;
    
    if (adjusted) {
      setCurrentDifficulty(newLevel);
      onDifficultyChange?.(newLevel);
      
      // Log adaptation event if we have userId
      if (userId && exerciseSlug) {
        const state = controllerRef.current.getState();
        logDifficultyChange(
          newLevel > previousLevel ? 'up' : 'down',
          previousLevel,
          newLevel,
          state.successRate,
          0, // consecutiveErrors not tracked here
          sessionId,
          exerciseSlug,
          trialIndexRef.current
        );
      }
    }
    
    return { adjusted, newLevel };
  }, [currentDifficulty, onDifficultyChange, userId, exerciseSlug, sessionId, logDifficultyChange]);

  // Emergency step down
  const stepDown = useCallback((): number => {
    const previousLevel = currentDifficulty;
    const newLevel = controllerRef.current.handleFrustration(currentDifficulty);
    setCurrentDifficulty(newLevel);
    onDifficultyChange?.(newLevel);
    
    // Log frustration stepdown
    if (userId && exerciseSlug && newLevel !== previousLevel) {
      const state = controllerRef.current.getState();
      logDifficultyChange(
        'down',
        previousLevel,
        newLevel,
        state.successRate,
        3, // Frustration implies consecutive errors
        sessionId,
        exerciseSlug,
        trialIndexRef.current
      );
    }
    
    return newLevel;
  }, [currentDifficulty, onDifficultyChange, userId, exerciseSlug, sessionId, logDifficultyChange]);

  // Update bounds dynamically
  const setBounds = useCallback((newBounds: DifficultyBounds) => {
    controllerRef.current.setBounds(newBounds);
  }, []);

  // Get current controller state for debugging
  const getState = useCallback(() => {
    return controllerRef.current.getState();
  }, []);

  // Reset controller for new session
  const reset = useCallback(() => {
    controllerRef.current.reset();
    trialIndexRef.current = 0;
  }, []);

  // Get cue level based on recent errors
  const getCueLevel = useCallback((recentErrorCount: number): number => {
    return controllerRef.current.getCueLevel(recentErrorCount);
  }, []);

  // Get current success rate
  const getSuccessRate = useCallback((): number => {
    return controllerRef.current.getSuccessRate();
  }, []);

  return {
    currentDifficulty,
    updateTrial,
    checkAndAdjust,
    stepDown,
    setBounds,
    getCueLevel,
    getSuccessRate,
    getState,
    reset,
    controller: controllerRef.current,
  };
};
