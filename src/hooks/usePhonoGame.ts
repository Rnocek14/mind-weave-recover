import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PhonologicalTrial,
  getMixedTrials,
  getTrialsByTargetWords,
  analyzePhonemeErrors,
} from '@/data/phonologicalBank';
import { shuffleArray } from '@/lib/shuffle';
import { filterRecentlyShown, markItemShown } from '@/lib/sessionHistory';

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
  difficultyLevel: number = 1,
  customTrials?: PhonologicalTrial[]
) => {
  // Track shown trials within session to prevent repeats
  const shownTrialsRef = useRef<Set<string>>(new Set());
  
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

  // Initialize trials with deduplication.
  // CRITICAL: difficultyLevel is intentionally NOT a dep — mid-session level
  // changes must NOT reset score/progress. Use setActiveDifficulty() instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let allTrials = customTrials && customTrials.length > 0
      ? customTrials
      : getMixedTrials(difficultyLevel, totalTrials * 3, { focusPhonemes: undefined });

    allTrials = filterRecentlyShown(allTrials, 'phono_game', 2);
    const availableTrials = allTrials.filter(t => !shownTrialsRef.current.has(t.id));
    const trialsToUse = availableTrials.length >= totalTrials ? availableTrials : allTrials;
    const selectedTrials = shuffleArray(trialsToUse).slice(0, totalTrials);

    setState(prev => ({
      ...prev,
      trials: selectedTrials,
      currentTrial: 0,
      userAnswer: null,
      score: 0,
      completed: false,
      showFeedback: false,
      incorrectTrials: [],
    }));
  }, [totalTrials, customTrials]);

  /**
   * Mid-session difficulty shift. Replaces ONLY the upcoming (unplayed) trials
   * with ones at the new level. Preserves currentTrial index, score, history.
   */
  const setActiveDifficulty = useCallback((newLevel: number) => {
    setState(prev => {
      const upcomingNeeded = prev.trials.length - (prev.currentTrial + 1);
      if (upcomingNeeded <= 0) return prev;
      const fresh = shuffleArray(
        getMixedTrials(newLevel, upcomingNeeded * 3, { focusPhonemes: undefined })
          .filter(t => !shownTrialsRef.current.has(t.id))
      ).slice(0, upcomingNeeded);
      if (fresh.length === 0) return prev;
      const playedAndCurrent = prev.trials.slice(0, prev.currentTrial + 1);
      const padded = fresh.length < upcomingNeeded
        ? [...fresh, ...prev.trials.slice(prev.currentTrial + 1 + fresh.length)]
        : fresh;
      return { ...prev, trials: [...playedAndCurrent, ...padded] };
    });
  }, []);

  const submitAnswer = (answer: 'same' | 'different'): {
    correct: boolean;
    expectedAnswer: 'same' | 'different';
    relationType: string;
  } => {
    const trial = state.trials[state.currentTrial];
    
    // Mark as shown for cross-session and session tracking
    shownTrialsRef.current.add(trial.id);
    markItemShown('phono_game', trial.id);
    
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
    // Clear session tracking on explicit reset
    shownTrialsRef.current.clear();
    
    const trials = shuffleArray(getMixedTrials(newLevel, totalTrials));
    
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
