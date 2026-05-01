import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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

/**
 * Fisher-Yates shuffle for randomizing lane contents once at init
 */
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Partition trials into difficulty lanes, shuffled for consistent selection
 */
function partitionIntoLanes(trials: MixedTrial[]): ContentLanes {
  const lanes: ContentLanes = { easy: [], mid: [], hard: [] };
  
  // Dedupe by target word — multiple variants (e.g. dog_1, dog_2) of the
  // same target must never co-exist in a session pool, otherwise the user
  // gets the same word twice in a row and the echo filter / scoring breaks.
  const seenTargets = new Set<string>();
  for (const trial of trials) {
    const key = (trial.target ?? '').trim().toLowerCase();
    if (!key || seenTargets.has(key)) continue;
    seenTargets.add(key);
    
    // Fallback to mid (3) if computed_difficulty is missing
    const diff = trial.computed_difficulty ?? 3;
    if (diff <= 2) {
      lanes.easy.push(trial);
    } else if (diff === 3) {
      lanes.mid.push(trial);
    } else {
      lanes.hard.push(trial);
    }
  }
  
  // Shuffle each lane once so pop() gives random-but-deterministic selection
  lanes.easy = shuffleArray(lanes.easy);
  lanes.mid = shuffleArray(lanes.mid);
  lanes.hard = shuffleArray(lanes.hard);
  
  return lanes;
}

function getLaneForLevel(level: number): keyof ContentLanes {
  // Map game difficulty (1-10) to lane
  if (level <= 3) return 'easy';
  if (level <= 6) return 'mid';
  return 'hard';
}

/**
 * Pop a trial from the appropriate lane (removes it to prevent re-selection)
 * Falls back to other lanes if preferred is empty
 * 
 * Returns both the trial and which lane it came from (for debugging)
 */
interface PopResult {
  trial: MixedTrial | null;
  fromLane: keyof ContentLanes | null;
  preferredLane: keyof ContentLanes;
  remaining: { easy: number; mid: number; hard: number };
}

function popFromLanesWithInfo(lanes: ContentLanes, level: number, debug = false): PopResult {
  const preferredLane = getLaneForLevel(level);
  const laneOrder: (keyof ContentLanes)[] = 
    preferredLane === 'easy' ? ['easy', 'mid', 'hard'] :
    preferredLane === 'mid' ? ['mid', 'easy', 'hard'] :
    ['hard', 'mid', 'easy'];
  
  // Try each lane in priority order, pop removes from array
  for (const laneName of laneOrder) {
    const lane = lanes[laneName];
    if (lane.length > 0) {
      const trial = lane.pop()!;
      
      const remaining = {
        easy: lanes.easy.length,
        mid: lanes.mid.length,
        hard: lanes.hard.length,
      };
      
      // Debug logging for lane switching verification
      if (debug || import.meta.env.DEV) {
        console.debug(
          `[PhotoNaming] Lane: ${laneName} (preferred: ${preferredLane}) | ` +
          `Level: ${level} | Target: "${trial.target}" | ` +
          `Remaining: E:${remaining.easy} M:${remaining.mid} H:${remaining.hard}`
        );
      }
      
      return { trial, fromLane: laneName, preferredLane, remaining };
    }
  }
  
  if (debug || import.meta.env.DEV) {
    console.warn('[PhotoNaming] Pool exhausted - no trials in any lane');
  }
  
  return { 
    trial: null, 
    fromLane: null, 
    preferredLane,
    remaining: { easy: 0, mid: 0, hard: 0 } 
  };
}

// Backwards-compatible wrapper
function popFromLanes(lanes: ContentLanes, level: number, debug = false): MixedTrial | null {
  return popFromLanesWithInfo(lanes, level, debug).trial;
}

/**
 * Peek at next trial without removing it
 */
function peekFromLanes(lanes: ContentLanes, level: number): MixedTrial | null {
  const preferredLane = getLaneForLevel(level);
  const laneOrder: (keyof ContentLanes)[] = 
    preferredLane === 'easy' ? ['easy', 'mid', 'hard'] :
    preferredLane === 'mid' ? ['mid', 'easy', 'hard'] :
    ['hard', 'mid', 'easy'];
  
  for (const laneName of laneOrder) {
    const lane = lanes[laneName];
    if (lane.length > 0) {
      // Peek at last element (what pop would return)
      return lane[lane.length - 1];
    }
  }
  
  return null;
}

export const usePhotoNamingGame = (
  totalTrials: number = 10, 
  difficultyLevel: number = 1,
  customTrials?: MixedTrial[],
  options?: PhotoNamingGameOptions
) => {
  // ==========================================================================
  // State
  // ==========================================================================
  const [currentTrial, setCurrentTrial] = useState<MixedTrial | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [trialNumber, setTrialNumber] = useState(0);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [currentLane, setCurrentLane] = useState<keyof ContentLanes | null>(null);
  
  // ==========================================================================
  // Refs (authoritative counters to avoid stale closures)
  // ==========================================================================
  const lanesRef = useRef<ContentLanes | null>(null);
  const trialNumberRef = useRef(0);
  const currentLevelRef = useRef(difficultyLevel);
  const isInitializedRef = useRef(false);
  const previousLaneRef = useRef<keyof ContentLanes | null>(null);
  
  // Session start level - captured once, used for pool building
  // Prevents edge case where difficulty changes before init runs
  const startLevelRef = useRef<number | null>(null);
  if (startLevelRef.current === null) {
    startLevelRef.current = difficultyLevel;
  }
  
  // Sync currentLevel ref when prop changes
  useEffect(() => {
    currentLevelRef.current = difficultyLevel;
  }, [difficultyLevel]);
  
  // ==========================================================================
  // Memoize options to prevent callback recreation
  // ==========================================================================
  const focusPhonemes = useMemo(
    () => options?.focusPhonemes ?? [],
    [options?.focusPhonemes]
  );
  const focusWords = useMemo(
    () => options?.focusWords ?? [], 
    [options?.focusWords]
  );

  // ==========================================================================
  // Core pool builder - called from init AND reset
  // Returns ACTUAL firstLane from pop (not inferred)
  // ==========================================================================
  const buildSessionPool = useCallback((level: number): { 
    lanes: ContentLanes; 
    firstTrial: MixedTrial | null;
    firstChoices: string[];
    firstLane: keyof ContentLanes | null;
  } => {
    let lanes: ContentLanes;
    
    if (customTrials && customTrials.length > 0) {
      // Custom trials: partition directly
      lanes = partitionIntoLanes(customTrials);
    } else {
      // Build a larger pool (5x requested count) to ensure all lanes have content
      // This prevents lane starvation when difficulty shifts mid-session
      const poolSize = Math.min(totalTrials * 5, PHOTO_BANK.length);
      
      // Get broad pool with tolerance for difficulty
      const broadPool = getTrialsForLevel(level, poolSize, {
        focusPhonemes: focusPhonemes.length > 0 ? focusPhonemes : undefined,
        focusWords: focusWords.length > 0 ? focusWords : undefined,
      });
      
      lanes = partitionIntoLanes(broadPool as MixedTrial[]);
    }
    
    // Pop first trial using popFromLanesWithInfo to get ACTUAL lane
    const { trial: firstTrial, fromLane } = popFromLanesWithInfo(lanes, level);
    const firstChoices = firstTrial 
      ? generateChoices(firstTrial as PhotoTrial, level)
      : [];
    
    return { lanes, firstTrial, firstChoices, firstLane: fromLane };
  }, [customTrials, totalTrials, focusPhonemes, focusWords]);

  // ==========================================================================
  // Initialize on mount - uses ACTUAL firstLane from buildSessionPool
  // ==========================================================================
  useEffect(() => {
    if (isInitializedRef.current) return;
    
    // Use session start level for pool building (captured at first render)
    const buildLevel = startLevelRef.current ?? difficultyLevel;
    const { lanes, firstTrial, firstChoices, firstLane } = buildSessionPool(buildLevel);
    
    lanesRef.current = lanes;
    trialNumberRef.current = firstTrial ? 1 : 0;
    
    // Use ACTUAL lane from pop (not inferred from level)
    previousLaneRef.current = firstLane;
    setCurrentLane(firstLane);
    
    setCurrentTrial(firstTrial);
    setTrialNumber(trialNumberRef.current);
    setChoices(firstChoices);
    
    isInitializedRef.current = true;
  }, [buildSessionPool, difficultyLevel]);
  
  // Update choices when difficulty changes mid-session (affects choice count/foils)
  useEffect(() => {
    if (isInitializedRef.current && currentTrial) {
      setChoices(generateChoices(currentTrial as PhotoTrial, difficultyLevel));
    }
  }, [difficultyLevel, currentTrial]);

  // ==========================================================================
  // Answer selection
  // ==========================================================================
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

  // ==========================================================================
  // Advance to next trial - ref-based to avoid stale closures
  // Uses popFromLanesWithInfo for TRUE lane tracking
  // ==========================================================================
  const nextTrial = useCallback((currentLevel: number) => {
    if (!lanesRef.current) return;
    
    // Check completion BEFORE attempting to pop (avoids phantom trial increment)
    if (trialNumberRef.current >= totalTrials) {
      setIsComplete(true);
      return;
    }
    
    // Pop NEXT trial from appropriate lane based on CURRENT difficulty
    // This is the key: difficulty changes affect which lane we pull from
    const { trial: nextTrialData, fromLane } = popFromLanesWithInfo(lanesRef.current, currentLevel);
    
    if (!nextTrialData || !fromLane) {
      // Pool exhausted
      setIsComplete(true);
      return;
    }
    
    // Successfully got a trial - NOW increment counter
    trialNumberRef.current += 1;
    const nextNum = trialNumberRef.current;
    
    // Track actual lane (component logs off currentLane state)
    previousLaneRef.current = fromLane;
    setCurrentLane(fromLane);
    
    setTrialNumber(nextNum);
    setCurrentTrial(nextTrialData);
    setChoices(generateChoices(nextTrialData as PhotoTrial, currentLevel));
    
    // Check if this was the last trial (show trial 10, then complete)
    if (nextNum >= totalTrials) {
      setIsComplete(true);
    }
  }, [totalTrials]);

  // ==========================================================================
  // Reset - rebuilds pool directly (no dependency on useEffect)
  // ==========================================================================
  const reset = useCallback((level: number = 1) => {
    // Reset session start level for new pool build
    startLevelRef.current = level;
    currentLevelRef.current = level;
    
    // Rebuild pool directly
    const { lanes, firstTrial, firstChoices, firstLane } = buildSessionPool(level);
    
    lanesRef.current = lanes;
    trialNumberRef.current = firstTrial ? 1 : 0;
    
    // Use ACTUAL lane from pop (not inferred from level)
    previousLaneRef.current = firstLane;
    setCurrentLane(firstLane);
    
    setCurrentTrial(firstTrial);
    setTrialNumber(trialNumberRef.current);
    setChoices(firstChoices);
    setScore(0);
    setIsComplete(false);
  }, [buildSessionPool]);

  // ==========================================================================
  // Peek at next trial for preloading (consistent with actual selection)
  // ==========================================================================
  const peekNextTrial = useCallback((): MixedTrial | null => {
    if (!lanesRef.current) return null;
    return peekFromLanes(lanesRef.current, currentLevelRef.current);
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
    currentLane, // Expose actual lane for external logging
    nextTrial: peekNextTrial(), // Expose next trial for preloading
    selectAnswer,
    advanceTrial: nextTrial,
    reset,
  };
};
