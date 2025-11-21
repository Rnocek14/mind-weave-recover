import { useState, useRef, useCallback, useEffect } from 'react';
import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';
import type { DifficultyBounds } from '@/lib/difficultyBounds';

interface UseAdaptiveDifficultyOptions {
  initialDifficulty: number;
  bounds: DifficultyBounds;
  windowSize?: number;
  targetSuccessRate?: number;
  adjustmentThreshold?: number;
  onDifficultyChange?: (newLevel: number) => void;
}

export const useAdaptiveDifficulty = ({
  initialDifficulty,
  bounds,
  windowSize = 5,
  targetSuccessRate = 0.80,
  adjustmentThreshold = 0.15,
  onDifficultyChange,
}: UseAdaptiveDifficultyOptions) => {
  const [currentDifficulty, setCurrentDifficulty] = useState(initialDifficulty);
  
  const controllerRef = useRef(
    new AdaptiveDifficultyController(
      windowSize,
      targetSuccessRate,
      adjustmentThreshold,
      bounds
    )
  );

  // Update bounds when they change
  useEffect(() => {
    controllerRef.current.setBounds(bounds);
  }, [bounds]);

  // Update a trial result
  const updateTrial = useCallback((wasCorrect: boolean) => {
    controllerRef.current.update(wasCorrect);
  }, []);

  // Check if difficulty should adjust and return the result
  const checkAndAdjust = useCallback((): { adjusted: boolean; newLevel: number } => {
    const newLevel = controllerRef.current.adjustLevel(currentDifficulty);
    const adjusted = newLevel !== currentDifficulty;
    
    if (adjusted) {
      setCurrentDifficulty(newLevel);
      onDifficultyChange?.(newLevel);
    }
    
    return { adjusted, newLevel };
  }, [currentDifficulty, onDifficultyChange]);

  // Emergency step down
  const stepDown = useCallback((): number => {
    const newLevel = controllerRef.current.handleFrustration(currentDifficulty);
    setCurrentDifficulty(newLevel);
    onDifficultyChange?.(newLevel);
    return newLevel;
  }, [currentDifficulty, onDifficultyChange]);

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
