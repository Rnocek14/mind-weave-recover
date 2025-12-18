import { useState, useCallback, useEffect, useRef } from 'react';
import { PhotoTrial, getTrialsForLevel, generateChoices } from '@/data/photoBank';

export interface PhotoNamingGameState {
  currentTrial: PhotoTrial | null;
  choices: string[];
  trialNumber: number;
  totalTrials: number;
  isComplete: boolean;
  score: number;
}

export const usePhotoNamingGame = (
  totalTrials: number = 10, 
  difficultyLevel: number = 1,
  customTrials?: PhotoTrial[]
) => {
  const [trials, setTrials] = useState<PhotoTrial[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  // Session-level deduplication: track shown photo targets across difficulty changes
  const shownTargetsRef = useRef<Set<string>>(new Set());

  // Initialize trials based on difficulty level or use custom trials
  useEffect(() => {
    if (customTrials) {
      // Custom trials bypass deduplication (they're intentionally selected)
      setTrials(customTrials);
      if (customTrials.length > 0) {
        setChoices(generateChoices(customTrials[0], difficultyLevel));
      }
    } else {
      // Get new trials excluding already-shown targets
      const newTrials = getTrialsForLevel(difficultyLevel, totalTrials, {
        excludeTargets: Array.from(shownTargetsRef.current),
      });
      setTrials(newTrials);
      if (newTrials.length > 0) {
        setChoices(generateChoices(newTrials[0], difficultyLevel));
      }
    }
  }, [totalTrials, difficultyLevel, customTrials]);

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
    // Track shown target BEFORE advancing
    if (currentTrial) {
      shownTargetsRef.current.add(currentTrial.target);
    }
    
    if (currentTrialIndex + 1 >= trials.length) {
      setIsComplete(true);
      return;
    }

    const nextIndex = currentTrialIndex + 1;
    setCurrentTrialIndex(nextIndex);
    setChoices(generateChoices(trials[nextIndex], currentLevel));
  }, [currentTrialIndex, trials, currentTrial]);

  const reset = useCallback((level: number = 1) => {
    // Clear shown targets on explicit reset (new session)
    shownTargetsRef.current.clear();
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
