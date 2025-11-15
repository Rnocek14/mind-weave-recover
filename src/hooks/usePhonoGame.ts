import { useState, useEffect } from 'react';
import {
  PhonologicalTrial,
  getMixedTrials,
  analyzePhonemeErrors,
} from '@/data/phonologicalBank';

interface GameState {
  currentTrial: number;
  trials: PhonologicalTrial[];
  userAnswer: 'same' | 'different' | null;
  score: number;
  completed: boolean;
  showFeedback: boolean;
  feedbackCorrect: boolean;
  incorrectTrials: PhonologicalTrial[];
}

export const usePhonoGame = (
  totalTrials: number = 10,
  difficultyLevel: number = 1
) => {
  const [state, setState] = useState<GameState>({
    currentTrial: 0,
    trials: [],
    userAnswer: null,
    score: 0,
    completed: false,
    showFeedback: false,
    feedbackCorrect: false,
    incorrectTrials: [],
  });

  // Initialize trials
  useEffect(() => {
    const trials = getMixedTrials(difficultyLevel, totalTrials);
    setState(prev => ({
      ...prev,
      trials,
      currentTrial: 0,
      userAnswer: null,
      score: 0,
      completed: false,
      showFeedback: false,
      incorrectTrials: [],
    }));
  }, [totalTrials, difficultyLevel]);

  const submitAnswer = (answer: 'same' | 'different'): {
    correct: boolean;
    expectedAnswer: 'same' | 'different';
    relationType: string;
  } => {
    const trial = state.trials[state.currentTrial];
    
    // Determine correct answer based on trial type
    const expectedAnswer: 'same' | 'different' = trial.areSame ? 'same' : 'different';
    const isCorrect = answer === expectedAnswer;
    
    setState(prev => ({
      ...prev,
      userAnswer: answer,
      score: isCorrect ? prev.score + 1 : prev.score,
      showFeedback: true,
      feedbackCorrect: isCorrect,
      incorrectTrials: isCorrect 
        ? prev.incorrectTrials 
        : [...prev.incorrectTrials, trial],
    }));
    
    return {
      correct: isCorrect,
      expectedAnswer,
      relationType: trial.relationType,
    };
  };

  const nextTrial = () => {
    const nextTrialIndex = state.currentTrial + 1;
    
    if (nextTrialIndex >= state.trials.length) {
      setState(prev => ({ ...prev, completed: true, showFeedback: false }));
      return;
    }
    
    setState(prev => ({
      ...prev,
      currentTrial: nextTrialIndex,
      userAnswer: null,
      showFeedback: false,
    }));
  };

  const reset = (newLevel: number = 1) => {
    const trials = getMixedTrials(newLevel, totalTrials);
    
    setState({
      currentTrial: 0,
      trials,
      userAnswer: null,
      score: 0,
      completed: false,
      showFeedback: false,
      feedbackCorrect: false,
      incorrectTrials: [],
    });
  };

  const getCurrentTrial = (): PhonologicalTrial | null => {
    return state.trials[state.currentTrial] || null;
  };

  const getErrorAnalysis = () => {
    return analyzePhonemeErrors(state.incorrectTrials);
  };

  return {
    ...state,
    submitAnswer,
    nextTrial,
    reset,
    getCurrentTrial,
    getErrorAnalysis,
    progress: state.trials.length > 0
      ? ((state.currentTrial + 1) / state.trials.length) * 100
      : 0,
  };
};
