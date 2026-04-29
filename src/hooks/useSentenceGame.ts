import { useState, useEffect, useRef, useCallback } from "react";
import {
  SentenceTrial,
  GrammarErrorType,
  getMixedTrials,
  analyzeSentenceErrors
} from "@/data/sentenceBank";
import { getAdaptiveGradedTrials } from "@/lib/gradedSentenceAdapter";
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
  difficultyLevel: number = 1,
  focusPhonemes: string[] = []
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

  // Initialize trials with graded sentence injection.
  // CRITICAL: difficultyLevel is intentionally NOT a dep — mid-session level
  // changes must NOT reset score/progress. Use setActiveDifficulty().
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Get phoneme-targeted graded trials (up to 40% of total)
    const gradedCount = focusPhonemes.length > 0 ? Math.ceil(totalTrials * 0.4) : 0;
    const gradedTrials = gradedCount > 0
      ? getAdaptiveGradedTrials(difficultyLevel, focusPhonemes, gradedCount)
      : [];
    
    // Fill remaining with standard sentence bank trials
    const standardCount = totalTrials - gradedTrials.length;
    let standardTrials = getMixedTrials(difficultyLevel, standardCount * 2);
    standardTrials = filterRecentlyShown(standardTrials, 'sentence_game', 2);
    const available = standardTrials.filter(t => !shownTrialsRef.current.has(t.id));
    const trialsToUse = available.length >= standardCount ? available : standardTrials;
    const selectedStandard = shuffleArray(trialsToUse).slice(0, standardCount);
    
    // Merge, shuffle, and deduplicate
    const seen = new Set<string>();
    const allTrials = shuffleArray([...gradedTrials, ...selectedStandard]).filter(t => {
      const key = t.targetSentence.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Mark all selected trials as shown for within-session dedup
    allTrials.forEach(t => {
      shownTrialsRef.current.add(t.id);
      markItemShown(t.id, 'sentence_game');
    });
    
    setGameState(prev => ({
      ...prev,
      trials: allTrials,
      currentTrial: 0,
      score: 0,
      completed: false,
      currentAnswer: []
    }));
  }, [totalTrials, focusPhonemes.join(',')]);

  /**
   * Mid-session difficulty shift. Replaces ONLY upcoming (unplayed) trials.
   * Preserves currentTrial index, score, and history.
   */
  const setActiveDifficulty = useCallback((newLevel: number) => {
    setGameState(prev => {
      const upcomingNeeded = prev.trials.length - (prev.currentTrial + 1);
      if (upcomingNeeded <= 0) return prev;
      const playedIds = new Set(prev.trials.slice(0, prev.currentTrial + 1).map(t => t.id));
      const fresh = getMixedTrials(newLevel, upcomingNeeded * 3)
        .filter(t => !playedIds.has(t.id) && !shownTrialsRef.current.has(t.id))
        .slice(0, upcomingNeeded);
      if (fresh.length === 0) return prev;
      fresh.forEach(t => {
        shownTrialsRef.current.add(t.id);
        markItemShown(t.id, 'sentence_game');
      });
      const padded = fresh.length < upcomingNeeded
        ? [...fresh, ...prev.trials.slice(prev.currentTrial + 1 + fresh.length)]
        : fresh;
      return {
        ...prev,
        trials: [...prev.trials.slice(0, prev.currentTrial + 1), ...padded],
      };
    });
  }, []);

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

  const nextTrial = (_newDifficultyLevel: number = difficultyLevel) => {
    // NOTE: difficulty changes are handled by setActiveDifficulty, NOT here.
    // Restarting trials on level change destroys session progress.
    const nextIndex = gameState.currentTrial + 1;

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
