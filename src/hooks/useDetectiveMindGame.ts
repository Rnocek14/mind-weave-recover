/**
 * Detective Mind Game State Machine
 * 
 * Manages case selection, scoring, rank progression, and deduplication.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { DETECTIVE_CASES, DetectiveCase, levelToTier } from '@/data/detectiveMindCases';
import { shuffleArray } from '@/lib/shuffle';

export type DetectiveRank = 'Rookie' | 'Junior Detective' | 'Investigator' | 'Senior Detective' | 'Chief Detective';

export interface DetectiveTrialResult {
  caseId: string;
  correct: boolean;
  selectedIndex: number;
  correctIndex: number;
  reactionTimeMs: number;
  questionType: string;
  tier: number;
  usedHint: boolean;
  points: number;
}

const RANK_THRESHOLDS: { rank: DetectiveRank; minPoints: number }[] = [
  { rank: 'Chief Detective', minPoints: 80 },
  { rank: 'Senior Detective', minPoints: 50 },
  { rank: 'Investigator', minPoints: 25 },
  { rank: 'Junior Detective', minPoints: 10 },
  { rank: 'Rookie', minPoints: 0 },
];

export function useDetectiveMindGame(roundCount: number = 10, difficultyLevel: number = 1) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<DetectiveTrialResult[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const seenCaseIdsRef = useRef<Set<string>>(new Set());

  // Select cases based on difficulty tier, shuffled, deduplicated
  const cases = useMemo(() => {
    const tier = levelToTier(difficultyLevel);
    const primary = DETECTIVE_CASES.filter(c => c.tier === tier);
    const adjacent = DETECTIVE_CASES.filter(c => Math.abs(c.tier - tier) === 1);
    
    const pool = [...shuffleArray(primary), ...shuffleArray(adjacent)];
    const unique = pool.filter(c => !seenCaseIdsRef.current.has(c.id));
    
    const finalPool = unique.length >= roundCount ? unique : shuffleArray(pool);
    return finalPool.slice(0, roundCount);
  }, [difficultyLevel, roundCount]);

  const currentCase: DetectiveCase | null = cases[currentIndex] ?? null;
  const isComplete = currentIndex >= cases.length || currentIndex >= roundCount;

  const rank: DetectiveRank = useMemo(() => {
    return RANK_THRESHOLDS.find(r => totalPoints >= r.minPoints)?.rank ?? 'Rookie';
  }, [totalPoints]);

  const submitAnswer = useCallback((selectedIndex: number, reactionTimeMs: number, usedHint: boolean): DetectiveTrialResult | null => {
    if (!currentCase) return null;

    const correct = selectedIndex === currentCase.correctIndex;
    let points = 0;
    if (correct) {
      points = 10;
      if (!usedHint) points += 5; // Bonus for no hint
      if (reactionTimeMs < 15000) points += 3; // Speed bonus
    }

    const result: DetectiveTrialResult = {
      caseId: currentCase.id,
      correct,
      selectedIndex,
      correctIndex: currentCase.correctIndex,
      reactionTimeMs,
      questionType: currentCase.questionType,
      tier: currentCase.tier,
      usedHint,
      points,
    };

    setResults(prev => [...prev, result]);
    setTotalPoints(prev => prev + points);
    seenCaseIdsRef.current.add(currentCase.id);

    return result;
  }, [currentCase]);

  const nextCase = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  const accuracy = useMemo(() => {
    if (results.length === 0) return 0;
    return results.filter(r => r.correct).length / results.length;
  }, [results]);

  return {
    currentCase,
    currentIndex,
    totalCases: Math.min(cases.length, roundCount),
    isComplete,
    results,
    totalPoints,
    rank,
    accuracy,
    submitAnswer,
    nextCase,
  };
}
