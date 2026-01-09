import { useState, useEffect, useRef } from "react";
import {
  SentenceTrial,
  GrammarErrorType,
  getMixedTrials,
  analyzeSentenceErrors
} from "@/data/sentenceBank";
import { shuffleArray } from "@/lib/shuffle";
import { filterRecentlyShown, markItemShown } from "@/lib/sessionHistory";

interface GameState {
  currentTrial: number;
  trials: SentenceTrial[];
  currentAnswer: number[];
  score: number;
  completed: boolean;
  showFeedback: boolean;
  feedbackCorrect: boolean;
  recentErrors: Array<{
    errorType: GrammarErrorType | null;
    grammarFocus: string;
    incorrectPosition?: number;
  }>;
}

export const useSentenceGame = (
  totalTrials: number = 10,
  difficultyLevel: number = 1
) => {
  const shownTrialsRef = useRef<Set<string>>(new Set());
  
  const [gameState, setGameState] = useState<GameState>({
    currentTrial: 0,
    trials: [],
    currentAnswer: [],
    score: 0,
    completed: false,
    showFeedback: false,
    feedbackCorrect: false,
    recentErrors: []
  });

  // Initialize trials with deduplication
  useEffect(() => {
    let allTrials = getMixedTrials(difficultyLevel, totalTrials * 2);
    allTrials = filterRecentlyShown(allTrials, 'sentence_game', 2);
    const available = allTrials.filter(t => !shownTrialsRef.current.has(t.id));
    const trialsToUse = available.length >= totalTrials ? available : allTrials;
    const selectedTrials = shuffleArray(trialsToUse).slice(0, totalTrials);
    
    setGameState(prev => ({
      ...prev,
      trials: selectedTrials,
      currentTrial: 0,
      score: 0,
      completed: false,
      currentAnswer: []
    }));
  }, [difficultyLevel, totalTrials]);

  const getCurrentTrial = (): SentenceTrial | null => {
    if (gameState.trials.length === 0) return null;
    return gameState.trials[gameState.currentTrial] || null;
  };

  // Select a word by its INDEX in trial.options (handles duplicate words correctly)
  const selectWord = (wordIndex: number) => {
    setGameState(prev => ({
      ...prev,
      currentAnswer: [...prev.currentAnswer, wordIndex]
    }));
  };

  // Convert current answer indices to word strings (for display and submission)
  const getAnswerAsWords = (): string[] => {
    const trial = getCurrentTrial();
    if (!trial) return [];
    return gameState.currentAnswer.map(idx => trial.options[idx]);
  };

  const removeLastWord = () => {
    setGameState(prev => ({
      ...prev,
      currentAnswer: prev.currentAnswer.slice(0, -1)
    }));
  };

  const clearAnswer = () => {
    setGameState(prev => ({
      ...prev,
      currentAnswer: []
    }));
  };

  const submitAnswer = () => {
    const trial = getCurrentTrial();
    if (!trial) return null;

    // Convert indices to actual words for comparison
    const answerWords = getAnswerAsWords();
    
    // Check correctness - compare arrays
    const isCorrect = 
      answerWords.length === trial.correctAnswer.length &&
      trial.correctAnswer.every((word, i) => 
        word.toLowerCase() === answerWords[i]?.toLowerCase()
      );

    // Analyze errors
    const errorAnalysis = analyzeSentenceErrors(trial, answerWords);

    // Update state
    setGameState(prev => {
      const newScore = isCorrect ? prev.score + 1 : prev.score;
      const newErrors = !isCorrect
        ? [
            ...prev.recentErrors.slice(-4),
            {
              errorType: errorAnalysis.errorType,
              grammarFocus: trial.grammarFocus,
              incorrectPosition: errorAnalysis.incorrectPosition
            }
          ]
        : prev.recentErrors;

      return {
        ...prev,
        score: newScore,
        showFeedback: true,
        feedbackCorrect: isCorrect,
        recentErrors: newErrors
      };
    });

    return {
      correct: isCorrect,
      trial,
      errorAnalysis,
      userAnswer: answerWords
    };
  };

  const nextTrial = (newDifficultyLevel: number = difficultyLevel) => {
    const nextIndex = gameState.currentTrial + 1;

    // If difficulty changed, regenerate trials
    if (newDifficultyLevel !== difficultyLevel) {
      const newTrials = getMixedTrials(newDifficultyLevel, totalTrials);
      setGameState(prev => ({
        ...prev,
        trials: newTrials,
        currentTrial: 0,
        currentAnswer: [],
        showFeedback: false
      }));
      return;
    }

    // Check if game is complete
    if (nextIndex >= gameState.trials.length) {
      setGameState(prev => ({
        ...prev,
        completed: true,
        showFeedback: false
      }));
    } else {
      setGameState(prev => ({
        ...prev,
        currentTrial: nextIndex,
        currentAnswer: [],
        showFeedback: false
      }));
    }
  };

  const reset = (newLevel: number = 1) => {
    const trials = getMixedTrials(newLevel, totalTrials);
    setGameState({
      currentTrial: 0,
      trials,
      currentAnswer: [],
      score: 0,
      completed: false,
      showFeedback: false,
      feedbackCorrect: false,
      recentErrors: []
    });
  };

  const getWeakestGrammarArea = (): string | null => {
    if (gameState.recentErrors.length === 0) return null;

    const grammarCounts: Record<string, number> = {};
    gameState.recentErrors.forEach(err => {
      if (err.grammarFocus) {
        grammarCounts[err.grammarFocus] = (grammarCounts[err.grammarFocus] || 0) + 1;
      }
    });

    const sorted = Object.entries(grammarCounts).sort(([, a], [, b]) => b - a);
    return sorted[0]?.[0] || null;
  };

  return {
    ...gameState,
    getCurrentTrial,
    selectWord,
    removeLastWord,
    clearAnswer,
    submitAnswer,
    nextTrial,
    reset,
    getWeakestGrammarArea,
    getAnswerAsWords
  };
};
