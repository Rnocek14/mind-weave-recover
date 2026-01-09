import { useState, useEffect, useRef } from 'react';
import {
  SemanticFeature,
  SemanticFeatureTrial,
  getTrialsForLevel,
  getTrialsByTargetWords,
  generateFeatureOptions,
  analyzeFeatureErrors,
} from '@/data/semanticFeatureBank';
import { shuffleArray } from '@/lib/shuffle';
import { filterRecentlyShown, markItemShown } from '@/lib/sessionHistory';

interface GameState {
  currentTrial: number;
  trials: SemanticFeatureTrial[];
  currentOptions: SemanticFeature[];
  selectedFeatures: Set<string>;
  score: number;
  completed: boolean;
  showFeedback: boolean;
  feedbackCorrect: boolean;
  recentErrors: Array<{
    missedCategories: string[];
    incorrectCategories: string[];
    weakestAbstractness: number;
  }>;
}

export const useSemanticFeatureGame = (
  totalTrials: number = 10,
  difficultyLevel: number = 1,
  customTrials?: SemanticFeatureTrial[]
) => {
  const shownTrialsRef = useRef<Set<string>>(new Set());
  
  const [state, setState] = useState<GameState>({
    currentTrial: 0,
    trials: [],
    currentOptions: [],
    selectedFeatures: new Set(),
    score: 0,
    completed: false,
    showFeedback: false,
    feedbackCorrect: false,
    recentErrors: [],
  });

  // Initialize trials with deduplication
  useEffect(() => {
    let allTrials = customTrials && customTrials.length > 0 
      ? customTrials 
      : getTrialsForLevel(difficultyLevel, totalTrials * 2);
    if (allTrials.length === 0) return;
    
    // Filter recently shown
    const trialsWithIds = allTrials.map((t, i) => ({ ...t, id: t.word + '_' + i }));
    const filtered = trialsWithIds.filter(t => !shownTrialsRef.current.has(t.id));
    const trialsToUse = filtered.length >= totalTrials ? filtered : trialsWithIds;
    const selectedTrials = shuffleArray(trialsToUse).slice(0, totalTrials);
    
    const options = generateFeatureOptions(selectedTrials[0], difficultyLevel);
    setState(prev => ({
      ...prev,
      trials: selectedTrials,
      currentOptions: options,
      currentTrial: 0,
      selectedFeatures: new Set(),
      score: 0,
      completed: false,
      showFeedback: false,
      recentErrors: [],
    }));
  }, [totalTrials, difficultyLevel, customTrials]);

  const toggleFeature = (featureText: string) => {
    if (state.showFeedback) return;
    
    setState(prev => {
      const newSelected = new Set(prev.selectedFeatures);
      if (newSelected.has(featureText)) {
        newSelected.delete(featureText);
      } else {
        newSelected.add(featureText);
      }
      return { ...prev, selectedFeatures: newSelected };
    });
  };

  const submitAnswer = (): {
    correct: boolean;
    totalCorrect: number;
    totalMissed: number;
    totalIncorrect: number;
    errorAnalysis: {
      missedCategories: string[];
      incorrectCategories: string[];
      weakestAbstractness: number;
    };
  } => {
    const trial = state.trials[state.currentTrial];
    const selectedArray = state.currentOptions.filter(f =>
      state.selectedFeatures.has(f.text)
    );
    const correctSet = new Set(trial.correctFeatures.map(f => f.text));
    
    const correctSelections = selectedArray.filter(f => correctSet.has(f.text));
    const missedFeatures = trial.correctFeatures.filter(
      f => !state.selectedFeatures.has(f.text)
    );
    const incorrectSelections = selectedArray.filter(f => !correctSet.has(f.text));
    
    const errorAnalysis = analyzeFeatureErrors(selectedArray, trial.correctFeatures);
    
    // Consider it correct if they got at least 75% of features right
    const accuracy = correctSelections.length / trial.correctFeatures.length;
    const isCorrect = accuracy >= 0.75 && incorrectSelections.length <= 1;
    
    setState(prev => ({
      ...prev,
      score: isCorrect ? prev.score + 1 : prev.score,
      showFeedback: true,
      feedbackCorrect: isCorrect,
      recentErrors: [
        ...prev.recentErrors.slice(-4),
        errorAnalysis,
      ],
    }));
    
    return {
      correct: isCorrect,
      totalCorrect: correctSelections.length,
      totalMissed: missedFeatures.length,
      totalIncorrect: incorrectSelections.length,
      errorAnalysis,
    };
  };

  const nextTrial = (newDifficultyLevel: number = difficultyLevel) => {
    const nextTrialIndex = state.currentTrial + 1;
    
    if (nextTrialIndex >= state.trials.length) {
      setState(prev => ({ ...prev, completed: true, showFeedback: false }));
      return;
    }
    
    // If difficulty changed, regenerate options with new difficulty
    const options = generateFeatureOptions(
      state.trials[nextTrialIndex],
      newDifficultyLevel
    );
    
    setState(prev => ({
      ...prev,
      currentTrial: nextTrialIndex,
      currentOptions: options,
      selectedFeatures: new Set(),
      showFeedback: false,
    }));
  };

  const reset = (newLevel: number = 1) => {
    const trials = getTrialsForLevel(newLevel, totalTrials);
    const options = generateFeatureOptions(trials[0], newLevel);
    
    setState({
      currentTrial: 0,
      trials,
      currentOptions: options,
      selectedFeatures: new Set(),
      score: 0,
      completed: false,
      showFeedback: false,
      feedbackCorrect: false,
      recentErrors: [],
    });
  };

  const getCurrentTrial = (): SemanticFeatureTrial | null => {
    return state.trials[state.currentTrial] || null;
  };

  const isFeatureSelected = (featureText: string): boolean => {
    return state.selectedFeatures.has(featureText);
  };

  const isFeatureCorrect = (featureText: string): boolean | null => {
    if (!state.showFeedback) return null;
    const trial = getCurrentTrial();
    if (!trial) return null;
    return trial.correctFeatures.some(f => f.text === featureText);
  };

  return {
    ...state,
    toggleFeature,
    submitAnswer,
    nextTrial,
    reset,
    getCurrentTrial,
    isFeatureSelected,
    isFeatureCorrect,
    progress: state.trials.length > 0
      ? ((state.currentTrial + 1) / state.trials.length) * 100
      : 0,
  };
};
