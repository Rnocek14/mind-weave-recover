/**
 * Dual-Load Naming Game Hook
 * 
 * Remember 3 words → name 6 pictures → recall the 3 words.
 * Measures executive load tolerance and interference.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { DUAL_LOAD_SETS, DualLoadSet } from '@/data/dualLoadNamingStimuli';
import { shuffleArray } from '@/lib/shuffle';

/** Build a list of dual-load sets for a given tier, prioritising focus phonemes and avoiding repeats. */
function buildSets(
  tier: number,
  count: number,
  focusPhonemes: string[],
  excludeIds: Set<string>,
): DualLoadSet[] {
  const pool = DUAL_LOAD_SETS.filter(
    (s) => s.tier <= Math.min(tier + 1, 3) && !excludeIds.has(s.id),
  );

  if (focusPhonemes.length > 0) {
    const normalizedFocus = new Set(focusPhonemes.map((p) => p.replace(/\//g, '').toLowerCase()));
    const scored = pool.map((set) => {
      const matchCount = set.namingTargets.filter((t) => {
        const word = t.word.toLowerCase();
        return Array.from(normalizedFocus).some((phoneme) => word.includes(phoneme));
      }).length;
      return { set, matchCount };
    });
    scored.sort((a, b) => b.matchCount - a.matchCount);
    return scored.map((s) => s.set).slice(0, count);
  }

  return shuffleArray(pool).slice(0, count);
}

export type DualLoadPhase = 'memorize' | 'naming' | 'recall' | 'results';

export interface NamingAttempt {
  targetWord: string;
  userResponse: string;
  correct: boolean;
  reactionTimeMs: number;
}

export interface DualLoadTrialResult {
  setId: string;
  /** Naming accuracy during load */
  namingAccuracy: number;
  namingAttempts: NamingAttempt[];
  /** Memory recall accuracy (0-1, how many of 3 words recalled) */
  recallAccuracy: number;
  recalledWords: string[];
  /** Interference index: normal accuracy - loaded accuracy (higher = more interference) */
  interferenceIndex: number;
  durationMs: number;
  depthTelemetry: {
    taskType: 'dual_load_naming';
    namingAccuracy: number;
    recallAccuracy: number;
    interferenceIndex: number;
    baselineSource: 'user_history' | 'heuristic';
    baselineAcc: number;
  };
}

export function useDualLoadNamingGame(roundCount: number = 2, tier: number = 1, focusPhonemes: string[] = []) {
  const sets = useMemo(() => {
    const pool = DUAL_LOAD_SETS.filter(s => s.tier <= Math.min(tier + 1, 3));
    
    // Prioritize sets whose naming targets contain focus phonemes
    if (focusPhonemes.length > 0) {
      const normalizedFocus = new Set(focusPhonemes.map(p => p.replace(/\//g, '').toLowerCase()));
      
      const scored = pool.map(set => {
        const matchCount = set.namingTargets.filter(t => {
          const word = t.word.toLowerCase();
          return Array.from(normalizedFocus).some(phoneme => word.includes(phoneme));
        }).length;
        return { set, matchCount };
      });
      
      // Sort by match count descending, then shuffle within equal groups
      scored.sort((a, b) => b.matchCount - a.matchCount);
      return scored.map(s => s.set).slice(0, roundCount);
    }
    
    return shuffleArray(pool).slice(0, roundCount);
  }, [roundCount, tier, focusPhonemes.join(',')]);

  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [phase, setPhase] = useState<DualLoadPhase>('memorize');
  const [namingIndex, setNamingIndex] = useState(0);
  const [namingAttempts, setNamingAttempts] = useState<NamingAttempt[]>([]);
  const [results, setResults] = useState<DualLoadTrialResult[]>([]);
  const [startTime, setStartTime] = useState(Date.now());

  const currentSet: DualLoadSet | null = sets[currentSetIndex] ?? null;
  const isComplete = currentSetIndex >= sets.length;
  const currentNamingTarget = currentSet?.namingTargets[namingIndex] ?? null;

  const startNaming = useCallback(() => {
    setPhase('naming');
    setNamingIndex(0);
    setNamingAttempts([]);
    setStartTime(Date.now());
  }, []);

  const submitNaming = useCallback((userResponse: string, reactionTimeMs: number) => {
    if (!currentSet) return;
    const target = currentSet.namingTargets[namingIndex];
    if (!target) return;

    const correct = userResponse.toLowerCase().trim() === target.word.toLowerCase();
    const attempt: NamingAttempt = { targetWord: target.word, userResponse, correct, reactionTimeMs };
    
    setNamingAttempts(prev => [...prev, attempt]);
    
    if (namingIndex + 1 >= currentSet.namingTargets.length) {
      setPhase('recall');
    } else {
      setNamingIndex(prev => prev + 1);
    }
  }, [currentSet, namingIndex]);

  const submitRecall = useCallback((recalledWords: string[]): DualLoadTrialResult | null => {
    if (!currentSet) return null;

    const durationMs = Date.now() - startTime;
    const namingCorrect = namingAttempts.filter(a => a.correct).length;
    const namingAccuracy = namingAttempts.length > 0 ? namingCorrect / namingAttempts.length : 0;

    // Score recall: fuzzy match each memory word
    const normalizedRecall = recalledWords.map(w => w.toLowerCase().trim());
    const recalled = currentSet.memoryWords.filter(mw =>
      normalizedRecall.some(rw => rw.includes(mw.toLowerCase()) || mw.toLowerCase().includes(rw))
    );
    const recallAccuracy = recalled.length / currentSet.memoryWords.length;

    // Interference index: v0 heuristic (0.9 baseline assumed)
    // TODO: Replace with user's actual historical naming baseline
    const heuristicBaseline = 0.9;
    const interferenceIndex = Math.max(0, heuristicBaseline - namingAccuracy);

    const result: DualLoadTrialResult = {
      setId: currentSet.id,
      namingAccuracy,
      namingAttempts,
      recallAccuracy,
      recalledWords: recalled,
      interferenceIndex,
      durationMs,
      depthTelemetry: {
        taskType: 'dual_load_naming',
        namingAccuracy,
        recallAccuracy,
        interferenceIndex,
        baselineSource: 'heuristic' as const,
        baselineAcc: heuristicBaseline,
      },
    };

    setResults(prev => [...prev, result]);
    setPhase('results');
    return result;
  }, [currentSet, namingAttempts, startTime]);

  const nextSet = useCallback(() => {
    setCurrentSetIndex(prev => prev + 1);
    setPhase('memorize');
    setNamingIndex(0);
    setNamingAttempts([]);
  }, []);

  return {
    currentSet, currentSetIndex, totalSets: sets.length, isComplete,
    phase, currentNamingTarget, namingIndex, namingAttempts, results,
    startNaming, submitNaming, submitRecall, nextSet,
  };
}
