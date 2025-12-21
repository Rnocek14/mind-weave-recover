import { useState, useCallback, useEffect, useRef } from 'react';
import { PhotoTrial, getTrialsForLevel, generateChoices } from '@/data/photoBank';

// Extended trial type that supports optional imageUrl for audio-only trials
export interface MixedTrial extends Omit<PhotoTrial, 'imageUrl'> {
  imageUrl?: string;
  isAudioOnly?: boolean;
}

export interface PhotoNamingGameState {
  currentTrial: MixedTrial | null;
  choices: string[];
  trialNumber: number;
  totalTrials: number;
  isComplete: boolean;
  score: number;
}

export interface PhotoNamingGameOptions {
  totalTrials?: number;
  difficultyLevel?: number;
  customTrials?: MixedTrial[];
  focusPhonemes?: string[]; // Phonemes to prioritize in word selection
  focusWords?: string[]; // Specific words to prioritize
}

export const usePhotoNamingGame = (
  totalTrials: number = 10, 
  difficultyLevel: number = 1,
  customTrials?: MixedTrial[],
  options?: PhotoNamingGameOptions
) => {
  const [trials, setTrials] = useState<MixedTrial[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  // Session-level deduplication: track shown photo targets across difficulty changes
  const shownTargetsRef = useRef<Set<string>>(new Set());
  
  // Track initial difficulty to use for trial selection (don't regenerate on mid-session changes)
  const initialDifficultyRef = useRef(difficultyLevel);
  const isInitializedRef = useRef(false);
  
  // Extract phoneme/word targeting options
  const focusPhonemes = options?.focusPhonemes || [];
  const focusWords = options?.focusWords || [];

  // Initialize trials ONCE at mount (or when totalTrials/customTrials change)
  // Do NOT re-initialize when difficultyLevel changes mid-session to prevent photo repetition
  useEffect(() => {
    // Skip if already initialized (prevents mid-session trial regeneration)
    if (isInitializedRef.current && !customTrials) {
      return;
    }
    
    if (customTrials) {
      // Custom trials bypass deduplication (they're intentionally selected)
      setTrials(customTrials);
      if (customTrials.length > 0) {
        // generateChoices only uses target and semanticFoils, safe to cast
        setChoices(generateChoices(customTrials[0] as PhotoTrial, difficultyLevel));
      }
    } else {
      // Get new trials excluding already-shown targets, with phoneme targeting
      // Use initial difficulty for trial selection (difficulty affects choices, not trial pool)
      const newTrials = getTrialsForLevel(initialDifficultyRef.current, totalTrials, {
        excludeTargets: Array.from(shownTargetsRef.current),
        focusPhonemes: focusPhonemes.length > 0 ? focusPhonemes : undefined,
        focusWords: focusWords.length > 0 ? focusWords : undefined,
      });
      setTrials(newTrials as MixedTrial[]);
      if (newTrials.length > 0) {
        setChoices(generateChoices(newTrials[0], initialDifficultyRef.current));
      }
    }
    
    isInitializedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalTrials, customTrials]);
  
  // Update choices when difficulty changes mid-session (affects choice generation, not trials)
  useEffect(() => {
    if (isInitializedRef.current && trials.length > 0 && trials[currentTrialIndex]) {
      setChoices(generateChoices(trials[currentTrialIndex] as PhotoTrial, difficultyLevel));
    }
  }, [difficultyLevel, currentTrialIndex, trials]);

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
    setChoices(generateChoices(trials[nextIndex] as PhotoTrial, currentLevel));
  }, [currentTrialIndex, trials, currentTrial]);

  const reset = useCallback((level: number = 1) => {
    // Clear shown targets on explicit reset (new session)
    shownTargetsRef.current.clear();
    isInitializedRef.current = false;
    initialDifficultyRef.current = level;
    setCurrentTrialIndex(0);
    setScore(0);
    setIsComplete(false);
    const newTrials = getTrialsForLevel(level, totalTrials);
    setTrials(newTrials);
    if (newTrials.length > 0) {
      setChoices(generateChoices(newTrials[0], level));
    }
    isInitializedRef.current = true;
  }, [totalTrials]);

  // Expose next trial for image preloading
  const nextTrialData = trials[currentTrialIndex + 1] || null;

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
    nextTrial: nextTrialData, // Expose next trial for preloading
    selectAnswer,
    advanceTrial: nextTrial, // Renamed for clarity
    reset,
  };
};
