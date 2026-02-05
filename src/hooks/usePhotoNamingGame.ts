import { useState, useCallback, useEffect, useRef } from 'react';
import { PhotoTrial, getTrialsForLevel, generateChoices, PHOTO_BANK } from '@/data/photoBank';

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

// ============================================================================
// Content Lanes: Partition session pool by difficulty tier
// 
// This makes mid-session difficulty changes "feel real" by pulling from
// different content pools (easy/mid/hard) based on current difficulty,
// while still preventing repeats within the session.
// ============================================================================

interface ContentLanes {
  easy: MixedTrial[];   // computed_difficulty 1-2
  mid: MixedTrial[];    // computed_difficulty 3
  hard: MixedTrial[];   // computed_difficulty 4-5
}

function partitionIntoLanes(trials: MixedTrial[]): ContentLanes {
  const lanes: ContentLanes = { easy: [], mid: [], hard: [] };
  
  for (const trial of trials) {
    const diff = trial.computed_difficulty;
    if (diff <= 2) {
      lanes.easy.push(trial);
    } else if (diff === 3) {
      lanes.mid.push(trial);
    } else {
      lanes.hard.push(trial);
    }
  }
  
  return lanes;
}

function getLaneForLevel(level: number): keyof ContentLanes {
  // Map game difficulty (1-10) to lane
  if (level <= 3) return 'easy';
  if (level <= 6) return 'mid';
  return 'hard';
}

function selectFromLanes(
  lanes: ContentLanes,
  level: number,
  shownTargets: Set<string>
): MixedTrial | null {
  const preferredLane = getLaneForLevel(level);
  const laneOrder: (keyof ContentLanes)[] = 
    preferredLane === 'easy' ? ['easy', 'mid', 'hard'] :
    preferredLane === 'mid' ? ['mid', 'easy', 'hard'] :
    ['hard', 'mid', 'easy'];
  
  // Try each lane in priority order
  for (const laneName of laneOrder) {
    const lane = lanes[laneName];
    const available = lane.filter(t => !shownTargets.has(t.target));
    if (available.length > 0) {
      // Pick randomly from available
      const idx = Math.floor(Math.random() * available.length);
      return available[idx];
    }
  }
  
  return null; // Pool exhausted
}

export const usePhotoNamingGame = (
  totalTrials: number = 10, 
  difficultyLevel: number = 1,
  customTrials?: MixedTrial[],
  options?: PhotoNamingGameOptions
) => {
  const [currentTrial, setCurrentTrial] = useState<MixedTrial | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [trialNumber, setTrialNumber] = useState(0);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  // Session-level deduplication: track shown photo targets
  const shownTargetsRef = useRef<Set<string>>(new Set());
  
  // Content lanes for difficulty-aware selection
  const lanesRef = useRef<ContentLanes | null>(null);
  
  // Track initial difficulty for pool building
  const initialDifficultyRef = useRef(difficultyLevel);
  const isInitializedRef = useRef(false);
  
  // Current difficulty ref (updated by external hook)
  const currentLevelRef = useRef(difficultyLevel);
  useEffect(() => {
    currentLevelRef.current = difficultyLevel;
  }, [difficultyLevel]);
  
  // Extract phoneme/word targeting options
  const focusPhonemes = options?.focusPhonemes || [];
  const focusWords = options?.focusWords || [];

  // Build session pool and partition into lanes ONCE at mount
  useEffect(() => {
    if (isInitializedRef.current && !customTrials) {
      return;
    }
    
    if (customTrials) {
      // Custom trials: use directly, partition into lanes
      lanesRef.current = partitionIntoLanes(customTrials);
    } else {
      // Build a larger pool (2x-3x requested count) to allow lane switching
      const poolSize = Math.min(totalTrials * 3, PHOTO_BANK.length);
      
      // Get broad pool with ±2 difficulty tolerance
      const broadPool = getTrialsForLevel(initialDifficultyRef.current, poolSize, {
        excludeTargets: Array.from(shownTargetsRef.current),
        focusPhonemes: focusPhonemes.length > 0 ? focusPhonemes : undefined,
        focusWords: focusWords.length > 0 ? focusWords : undefined,
      });
      
      lanesRef.current = partitionIntoLanes(broadPool as MixedTrial[]);
    }
    
    // Select first trial from appropriate lane
    if (lanesRef.current) {
      const firstTrial = selectFromLanes(
        lanesRef.current, 
        initialDifficultyRef.current, 
        shownTargetsRef.current
      );
      
      if (firstTrial) {
        shownTargetsRef.current.add(firstTrial.target);
        setCurrentTrial(firstTrial);
        setTrialNumber(1);
        setChoices(generateChoices(firstTrial as PhotoTrial, initialDifficultyRef.current));
      }
    }
    
    isInitializedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalTrials, customTrials]);
  
  // Update choices when difficulty changes mid-session
  useEffect(() => {
    if (isInitializedRef.current && currentTrial) {
      setChoices(generateChoices(currentTrial as PhotoTrial, difficultyLevel));
    }
  }, [difficultyLevel, currentTrial]);

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
    if (!lanesRef.current) return;
    
    // Check if we've hit the trial limit
    if (trialNumber >= totalTrials) {
      setIsComplete(true);
      return;
    }
    
    // Select NEXT trial from appropriate lane based on CURRENT difficulty
    // This is the key: difficulty changes affect which lane we pull from
    const nextTrialData = selectFromLanes(
      lanesRef.current,
      currentLevel,
      shownTargetsRef.current
    );
    
    if (!nextTrialData) {
      // Pool exhausted
      setIsComplete(true);
      return;
    }
    
    shownTargetsRef.current.add(nextTrialData.target);
    setCurrentTrial(nextTrialData);
    setTrialNumber(prev => prev + 1);
    setChoices(generateChoices(nextTrialData as PhotoTrial, currentLevel));
  }, [trialNumber, totalTrials]);

  const reset = useCallback((level: number = 1) => {
    // Clear shown targets on explicit reset (new session)
    shownTargetsRef.current.clear();
    isInitializedRef.current = false;
    initialDifficultyRef.current = level;
    currentLevelRef.current = level;
    lanesRef.current = null;
    
    setCurrentTrial(null);
    setTrialNumber(0);
    setScore(0);
    setIsComplete(false);
    setChoices([]);
    
    // Re-trigger initialization effect
    // Note: Since we cleared isInitializedRef, the useEffect will run again
  }, []);

  // Peek at next trial for preloading (without consuming it)
  const peekNextTrial = useCallback((): MixedTrial | null => {
    if (!lanesRef.current) return null;
    
    // Simulate what selectFromLanes would return WITHOUT adding to shown
    const preferredLane = getLaneForLevel(currentLevelRef.current);
    const laneOrder: (keyof ContentLanes)[] = 
      preferredLane === 'easy' ? ['easy', 'mid', 'hard'] :
      preferredLane === 'mid' ? ['mid', 'easy', 'hard'] :
      ['hard', 'mid', 'easy'];
    
    for (const laneName of laneOrder) {
      const lane = lanesRef.current[laneName];
      const available = lane.filter(t => !shownTargetsRef.current.has(t.target));
      if (available.length > 0) {
        return available[0]; // Return first available (for preload)
      }
    }
    
    return null;
  }, []);

  const state: PhotoNamingGameState = {
    currentTrial,
    choices,
    trialNumber,
    totalTrials,
    isComplete,
    score,
  };

  return {
    state,
    nextTrial: peekNextTrial(), // Expose next trial for preloading
    selectAnswer,
    advanceTrial: nextTrial,
    reset,
  };
};
