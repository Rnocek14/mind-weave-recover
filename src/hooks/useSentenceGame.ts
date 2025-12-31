import { useState, useEffect } from "react";
import {
  SentenceTrial,
  SentenceTaskType,
  GrammarErrorType,
  getTrialsForDifficulty,
  getMixedTrials,
  analyzeSentenceErrors
} from "@/data/sentenceBank";

interface GameState {
  currentTrial: number;
  trials: SentenceTrial[];
  currentAnswer: number[]; // Stores indices into trial.options, not word values (handles duplicates)
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

  // Initialize trials
  useEffect(() => {
    const trials = getMixedTrials(difficultyLevel, totalTrials);
    setGameState(prev => ({
      ...prev,
      trials,
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
    const trial = getCurrentTrial();
    if (!trial) return;

    // For fill_function, verb_agreement, cloze_picture: single selection
    if (
      trial.taskType === "fill_function" ||
      trial.taskType === "verb_agreement" ||
      trial.taskType === "cloze_picture"
    ) {
      setGameState(prev => ({
        ...prev,
        currentAnswer: [wordIndex]
      }));
    }
    // For word_order, sentence_reorder: build array of indices
    else {
      setGameState(prev => ({
        ...prev,
        currentAnswer: [...prev.currentAnswer, wordIndex]
      }));
    }
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
    
    let isCorrect = false;
    const userAnswer = trial.taskType === "fill_function" ||
                       trial.taskType === "verb_agreement" ||
                       trial.taskType === "cloze_picture"
      ? answerWords[0]
      : answerWords;

    // Check correctness
    if (Array.isArray(trial.correctAnswer)) {
      isCorrect = JSON.stringify(trial.correctAnswer.map(w => w.toLowerCase())) ===
                  JSON.stringify((userAnswer as string[]).map(w => w.toLowerCase()));
    } else {
      isCorrect = trial.correctAnswer.toLowerCase() === (userAnswer as string)?.toLowerCase();
    }

    // Analyze errors
    const errorAnalysis = analyzeSentenceErrors(trial, userAnswer);

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
      userAnswer
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
