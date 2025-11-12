import { useState, useCallback, useEffect } from 'react';
import { PhotoTrial, getTrialsForLevel, generateChoices } from '@/data/photoBank';

export interface PhotoNamingGameState {
  currentTrial: PhotoTrial | null;
  choices: string[];
  trialNumber: number;
  totalTrials: number;
  isComplete: boolean;
  score: number;
}

export const usePhotoNamingGame = (totalTrials: number = 10, difficultyLevel: number = 1) => {
  const [trials, setTrials] = useState<PhotoTrial[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Initialize trials based on difficulty level
  useEffect(() => {
    const newTrials = getTrialsForLevel(difficultyLevel, totalTrials);
    setTrials(newTrials);
    if (newTrials.length > 0) {
      setChoices(generateChoices(newTrials[0], difficultyLevel));
    }
  }, [totalTrials, difficultyLevel]);

  const currentTrial = trials[currentTrialIndex] || null;

  const selectAnswer = useCallback(
    (selectedWord: string): { correct: boolean; errorType?: string } => {
      if (!currentTrial) {
        return { correct: false };
      }

      const isCorrect = selectedWord === currentTrial.target;

      if (isCorrect) {
        setScore((prev) => prev + 100);
      }

      // Determine error type
      let errorType: string | undefined;
      if (!isCorrect) {
        if (currentTrial.semanticFoils.includes(selectedWord)) {
          errorType = 'semantic_related';
        } else {
          errorType = 'unrelated';
        }
      }

      return { correct: isCorrect, errorType };
    },
    [currentTrial]
  );

  const nextTrial = useCallback((currentLevel: number) => {
    if (currentTrialIndex + 1 >= trials.length) {
      setIsComplete(true);
      return;
    }

    const nextIndex = currentTrialIndex + 1;
    setCurrentTrialIndex(nextIndex);
    setChoices(generateChoices(trials[nextIndex], currentLevel));
  }, [currentTrialIndex, trials]);

  const reset = useCallback((level: number = 1) => {
    setCurrentTrialIndex(0);
    setScore(0);
    setIsComplete(false);
    const newTrials = getTrialsForLevel(level, totalTrials);
    setTrials(newTrials);
    if (newTrials.length > 0) {
      setChoices(generateChoices(newTrials[0], level));
    }
  }, [totalTrials]);

  const state: PhotoNamingGameState = {
    currentTrial,
    choices,
    trialNumber: currentTrialIndex + 1,
    totalTrials: trials.length,
    isComplete,
    score,
  };

  return {
    state,
    selectAnswer,
    nextTrial,
    reset,
  };
};
