/**
 * Hook for managing generalization probe assessment
 * Tracks probe trial state, scoring, and completion
 */

import { useState, useCallback, useEffect } from 'react';
import { getProbeTrials, type PROBE_WORDS } from '@/data/probeWords';
import type { PhotoTrial } from '@/data/photoBank';
import { generateChoices } from '@/data/photoBank';

export interface ProbeResult {
  word: string;
  correct: boolean;
  errorType: string;
  cuesNeeded: number;
  reactionTimeMs: number;
  difficulty: number;
}

export interface ProbeState {
  currentTrial: PhotoTrial | null;
  choices: string[];
  trialNumber: number;
  totalTrials: number;
  isComplete: boolean;
  results: ProbeResult[];
}

export const useGeneralizationProbe = (
  difficultyLevel: number = 1,
  totalTrials: number = 5
) => {
  const [trials, setTrials] = useState<PhotoTrial[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  // Initialize probe trials
  useEffect(() => {
    const probeTrials = getProbeTrials(difficultyLevel, totalTrials);
    setTrials(probeTrials);
    
    if (probeTrials.length > 0) {
      setChoices(generateChoices(probeTrials[0], difficultyLevel));
    }
  }, [difficultyLevel, totalTrials]);

  const currentTrial = trials[currentTrialIndex] || null;

  /**
   * Record a probe trial result
   */
  const recordResult = useCallback(
    (result: ProbeResult) => {
      setResults(prev => [...prev, result]);
    },
    []
  );

  /**
   * Move to next probe trial
   */
  const nextTrial = useCallback(() => {
    if (currentTrialIndex + 1 >= trials.length) {
      setIsComplete(true);
      return;
    }

    const nextIndex = currentTrialIndex + 1;
    setCurrentTrialIndex(nextIndex);
    setChoices(generateChoices(trials[nextIndex], difficultyLevel));
  }, [currentTrialIndex, trials, difficultyLevel]);

  /**
   * Reset probe assessment
   */
  const reset = useCallback(() => {
    setCurrentTrialIndex(0);
    setResults([]);
    setIsComplete(false);
    
    const probeTrials = getProbeTrials(difficultyLevel, totalTrials);
    setTrials(probeTrials);
    
    if (probeTrials.length > 0) {
      setChoices(generateChoices(probeTrials[0], difficultyLevel));
    }
  }, [difficultyLevel, totalTrials]);

  /**
   * Calculate probe summary statistics
   */
  const getSummary = useCallback(() => {
    if (results.length === 0) {
      return {
        accuracy: 0,
        totalTrials: 0,
        correctCount: 0,
        averageCues: 0,
        averageReactionTime: 0
      };
    }

    const correctCount = results.filter(r => r.correct).length;
    const totalCues = results.reduce((sum, r) => sum + r.cuesNeeded, 0);
    const totalReactionTime = results.reduce((sum, r) => sum + r.reactionTimeMs, 0);

    return {
      accuracy: correctCount / results.length,
      totalTrials: results.length,
      correctCount,
      averageCues: totalCues / results.length,
      averageReactionTime: totalReactionTime / results.length
    };
  }, [results]);

  const state: ProbeState = {
    currentTrial,
    choices,
    trialNumber: currentTrialIndex + 1,
    totalTrials: trials.length,
    isComplete,
    results
  };

  return {
    state,
    recordResult,
    nextTrial,
    reset,
    getSummary
  };
};
