/**
 * useMinimalPairsGame Hook
 * 
 * Manages state and logic for the minimal pairs discrimination exercise.
 * Presents two images side-by-side and asks user to identify the target word.
 */

import { useState, useCallback, useMemo } from 'react';
import { MinimalPairTrial, getMinimalPairTrialsForLevel } from '@/data/minimalPairsBank';
import { clampKidsMinimalPairsLevel } from '@/data/kidsContent';
import { useKidsMode } from '@/contexts/KidsModeContext';
import {
  selectMinimalPairsPool,
  writeMinimalPairsSelectorDiagnostics,
} from '@/lib/progression/minimalPairsContentSelector';

export interface MinimalPairsGameState {
  currentTrial: MinimalPairTrial | null;
  trialIndex: number;
  totalTrials: number;
  score: number;
  correctCount: number;
  incorrectCount: number;
  selectedIndex: number | null;
  isCorrect: boolean | null;
  isComplete: boolean;
  showFeedback: boolean;
  trials: MinimalPairTrial[];
}

export interface MinimalPairsGameOptions {
  totalTrials?: number;
  difficultyLevel?: number;
  focusPhonemes?: string[];
  /**
   * PR5 (Phase 2.5): when present, the session pool is built from the
   * clinical content selector (contrast class / signal condition) instead
   * of the engine difficulty selector. Skipped tiers (L7 degraded signal,
   * L8 triplet RT) fall back to the engine pool with a diagnostic surfaced
   * via writeMinimalPairsSelectorDiagnostics.
   */
  clinicalLevel?: number | null;
}

export function useMinimalPairsGame(options: MinimalPairsGameOptions = {}) {
  const {
    totalTrials = 10,
    difficultyLevel: rawDifficultyLevel = 1,
    focusPhonemes,
    clinicalLevel: rawClinicalLevel = null,
  } = options;
  const { kidsMode } = useKidsMode();
  // Kids Mode caps discrimination difficulty at tier-2 initial contrasts
  // (cat/hat) — tier-3 final-position contrasts are acoustically too hard.
  const difficultyLevel = kidsMode ? clampKidsMinimalPairsLevel(rawDifficultyLevel) : rawDifficultyLevel;
  const clinicalLevel = kidsMode && rawClinicalLevel != null
    ? clampKidsMinimalPairsLevel(rawClinicalLevel)
    : rawClinicalLevel;

  // Generate trials based on difficulty.
  const initialTrials = useMemo(() => {
    let trials: MinimalPairTrial[];
    if (clinicalLevel != null && clinicalLevel >= 4) {
      const sel = selectMinimalPairsPool(clinicalLevel);
      writeMinimalPairsSelectorDiagnostics(sel, clinicalLevel);
      if (sel.fallback?.skipped || sel.pool.length === 0) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn(
            '[minimalPairs:selector] tier %s skipped (%s) — using engine baseline',
            sel.tier, sel.fallback?.reason,
          );
        }
        trials = getMinimalPairTrialsForLevel(difficultyLevel, totalTrials, { focusPhonemes });
      } else {
        // Selector returned a contrast-class-filtered pool; trim/repeat to count.
        const pool = sel.pool as unknown as MinimalPairTrial[];
        if (pool.length >= totalTrials) {
          trials = pool.slice(0, totalTrials);
        } else {
          const out: MinimalPairTrial[] = [];
          while (out.length < totalTrials) out.push(pool[out.length % pool.length]);
          trials = out;
        }
      }
    } else {
      trials = getMinimalPairTrialsForLevel(difficultyLevel, totalTrials, { focusPhonemes });
    }
    // Regenerate target sides with enforced alternation — pure Math.random
    // was producing long "always on the right" streaks that patients read as
    // a bias. Cap runs of same-side targets at 2 in a row.
    let lastSide: 0 | 1 | null = null;
    let sameRun = 0;
    return trials.map((trial) => {
      let side = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
      if (lastSide !== null && side === lastSide && sameRun >= 2) {
        side = (1 - side) as 0 | 1;
      }
      sameRun = side === lastSide ? sameRun + 1 : 1;
      lastSide = side;
      return {
        ...trial,
        targetIndex: side,
        targetWord: side === 0 ? trial.pair.word1 : trial.pair.word2,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyLevel, totalTrials, focusPhonemes?.join(','), clinicalLevel]);
  
  const [state, setState] = useState<MinimalPairsGameState>({
    currentTrial: initialTrials[0] || null,
    trialIndex: 0,
    totalTrials: initialTrials.length,
    score: 0,
    correctCount: 0,
    incorrectCount: 0,
    selectedIndex: null,
    isCorrect: null,
    isComplete: false,
    showFeedback: false,
    trials: initialTrials,
  });
  
  // Select an answer (0 = left image, 1 = right image)
  const selectAnswer = useCallback((selectedIndex: 0 | 1) => {
    if (!state.currentTrial || state.showFeedback) return;
    
    const isCorrect = selectedIndex === state.currentTrial.targetIndex;
    
    setState(prev => ({
      ...prev,
      selectedIndex,
      isCorrect,
      showFeedback: true,
      score: isCorrect ? prev.score + 10 : prev.score,
      correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount,
      incorrectCount: !isCorrect ? prev.incorrectCount + 1 : prev.incorrectCount,
    }));
  }, [state.currentTrial, state.showFeedback]);
  
  // Advance to next trial
  const nextTrial = useCallback(() => {
    setState(prev => {
      const nextIndex = prev.trialIndex + 1;
      
      if (nextIndex >= prev.trials.length) {
        return {
          ...prev,
          isComplete: true,
          showFeedback: false,
        };
      }
      
      return {
        ...prev,
        currentTrial: prev.trials[nextIndex],
        trialIndex: nextIndex,
        selectedIndex: null,
        isCorrect: null,
        showFeedback: false,
      };
    });
  }, []);

  /**
   * Adapt mid-game: replace upcoming trials with new difficulty.
   * Past + current trial preserved; remaining trials swapped to new pool.
   */
  const setActiveDifficulty = useCallback((newDifficulty: number) => {
    const cappedDifficulty = kidsMode ? clampKidsMinimalPairsLevel(newDifficulty) : newDifficulty;
    setState(prev => {
      const upcomingNeeded = prev.totalTrials - prev.trialIndex - 1;
      if (upcomingNeeded <= 0) return prev;
      // Alternation guard: cap runs of same-side targets at 2 in a row.
      let lastSide: 0 | 1 | null = null;
      let sameRun = 0;
      const fresh = getMinimalPairTrialsForLevel(cappedDifficulty, upcomingNeeded, { focusPhonemes })
        .map(trial => {
          let side = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
          if (lastSide !== null && side === lastSide && sameRun >= 2) side = (1 - side) as 0 | 1;
          sameRun = side === lastSide ? sameRun + 1 : 1;
          lastSide = side;
          return {
            ...trial,
            targetIndex: side,
            targetWord: side === 0 ? trial.pair.word1 : trial.pair.word2,
          };
        });
      const past = prev.trials.slice(0, prev.trialIndex + 1);
      return {
        ...prev,
        trials: [...past, ...fresh],
      };
    });
  }, [focusPhonemes, kidsMode]);

  
  // Reset game
  const reset = useCallback((newDifficulty?: number) => {
    const requested = newDifficulty ?? difficultyLevel;
    const difficulty = kidsMode ? clampKidsMinimalPairsLevel(requested) : requested;
    // Alternation guard: cap runs of same-side targets at 2 in a row.
    let lastSide: 0 | 1 | null = null;
    let sameRun = 0;
    const newTrials = getMinimalPairTrialsForLevel(difficulty, totalTrials)
      .map(trial => {
        let side = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
        if (lastSide !== null && side === lastSide && sameRun >= 2) side = (1 - side) as 0 | 1;
        sameRun = side === lastSide ? sameRun + 1 : 1;
        lastSide = side;
        return {
          ...trial,
          targetIndex: side,
          targetWord: side === 0 ? trial.pair.word1 : trial.pair.word2,
        };
      });
    
    setState({
      currentTrial: newTrials[0] || null,
      trialIndex: 0,
      totalTrials: newTrials.length,
      score: 0,
      correctCount: 0,
      incorrectCount: 0,
      selectedIndex: null,
      isCorrect: null,
      isComplete: false,
      showFeedback: false,
      trials: newTrials,
    });
  }, [difficultyLevel, totalTrials, kidsMode]);
  
  return {
    state,
    selectAnswer,
    nextTrial,
    reset,
    setActiveDifficulty,
  };
}
