/**
 * useMinimalPairsGame Hook
 * 
 * Manages state and logic for the minimal pairs discrimination exercise.
 * Presents two images side-by-side and asks user to identify the target word.
 */

import { useState, useCallback, useMemo } from 'react';
import { MinimalPairTrial, getMinimalPairTrialsForLevel } from '@/data/minimalPairsBank';

export interface MinimalPairsGameState {
  currentTrial: MinimalPairTrial | null;
  trialIndex: number;
  totalTrials: number;
  score: number;
  correctCount: number;
  incorrectCount: number;
  selectedIndex: number | null;
  isCorrect: boolean | null;
  isComplete: boolean;
  showFeedback: boolean;
  trials: MinimalPairTrial[];
}

export interface MinimalPairsGameOptions {
  totalTrials?: number;
  difficultyLevel?: number;
  focusPhonemes?: string[];
}

export function useMinimalPairsGame(options: MinimalPairsGameOptions = {}) {
  const { totalTrials = 10, difficultyLevel = 1, focusPhonemes } = options;
  
  // Generate trials based on difficulty
  const initialTrials = useMemo(() => {
    const trials = getMinimalPairTrialsForLevel(difficultyLevel, totalTrials, {
      focusPhonemes,
    });
    // Regenerate target indices for variety
    return trials.map(trial => ({
      ...trial,
      targetIndex: (Math.random() < 0.5 ? 0 : 1) as 0 | 1,
      targetWord: Math.random() < 0.5 ? trial.pair.word1 : trial.pair.word2,
    })).map(trial => ({
      ...trial,
      targetWord: trial.targetIndex === 0 ? trial.pair.word1 : trial.pair.word2,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyLevel, totalTrials, focusPhonemes?.join(',')]);
  
  const [state, setState] = useState<MinimalPairsGameState>({
    currentTrial: initialTrials[0] || null,
    trialIndex: 0,
    totalTrials: initialTrials.length,
    score: 0,
    correctCount: 0,
    incorrectCount: 0,
    selectedIndex: null,
    isCorrect: null,
    isComplete: false,
    showFeedback: false,
    trials: initialTrials,
  });
  
  // Select an answer (0 = left image, 1 = right image)
  const selectAnswer = useCallback((selectedIndex: 0 | 1) => {
    if (!state.currentTrial || state.showFeedback) return;
    
    const isCorrect = selectedIndex === state.currentTrial.targetIndex;
    
    setState(prev => ({
      ...prev,
      selectedIndex,
      isCorrect,
      showFeedback: true,
      score: isCorrect ? prev.score + 10 : prev.score,
      correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount,
      incorrectCount: !isCorrect ? prev.incorrectCount + 1 : prev.incorrectCount,
    }));
  }, [state.currentTrial, state.showFeedback]);
  
  // Advance to next trial
  const nextTrial = useCallback(() => {
    setState(prev => {
      const nextIndex = prev.trialIndex + 1;
      
      if (nextIndex >= prev.trials.length) {
        return {
          ...prev,
          isComplete: true,
          showFeedback: false,
        };
      }
      
      return {
        ...prev,
        currentTrial: prev.trials[nextIndex],
        trialIndex: nextIndex,
        selectedIndex: null,
        isCorrect: null,
        showFeedback: false,
      };
    });
  }, []);
  
  // Reset game
  const reset = useCallback((newDifficulty?: number) => {
    const difficulty = newDifficulty ?? difficultyLevel;
    const newTrials = getMinimalPairTrialsForLevel(difficulty, totalTrials)
      .map(trial => ({
        ...trial,
        targetIndex: (Math.random() < 0.5 ? 0 : 1) as 0 | 1,
        targetWord: '',
      }))
      .map(trial => ({
        ...trial,
        targetWord: trial.targetIndex === 0 ? trial.pair.word1 : trial.pair.word2,
      }));
    
    setState({
      currentTrial: newTrials[0] || null,
      trialIndex: 0,
      totalTrials: newTrials.length,
      score: 0,
      correctCount: 0,
      incorrectCount: 0,
      selectedIndex: null,
      isCorrect: null,
      isComplete: false,
      showFeedback: false,
      trials: newTrials,
    });
  }, [difficultyLevel, totalTrials]);
  
  return {
    state,
    selectAnswer,
    nextTrial,
    reset,
  };
}
