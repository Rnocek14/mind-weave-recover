/**
 * Detective Mind Game State Machine
 * 
 * Manages case selection, scoring, rank progression, and deduplication.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { DETECTIVE_CASES, DetectiveCase, levelToTier } from '@/data/detectiveMindCases';
import { shuffleArray } from '@/lib/shuffle';
import { orderFreshFirst, markManyUsed } from '@/lib/recency/selectWithRecency';

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
  explanation?: {
    transcript: string;
    level: 'excellent' | 'good' | 'partial' | 'off-topic' | 'no-response';
    score: number;
    conceptsFound: number;
    conceptsTotal: number;
    matchedConcepts: string[];
    durationMs: number;
    skipped: boolean;
  };
}

const RANK_THRESHOLDS: { rank: DetectiveRank; minPoints: number }[] = [
  { rank: 'Chief Detective', minPoints: 80 },
  { rank: 'Senior Detective', minPoints: 50 },
  { rank: 'Investigator', minPoints: 25 },
  { rank: 'Junior Detective', minPoints: 10 },
  { rank: 'Rookie', minPoints: 0 },
];

function buildCasePool(tier: number, roundCount: number, seen: Set<string>): DetectiveCase[] {
  const primary = DETECTIVE_CASES.filter(c => c.tier === tier);
  const adjacent = DETECTIVE_CASES.filter(c => Math.abs(c.tier - tier) === 1);
  const pool = [...shuffleArray(primary), ...shuffleArray(adjacent)];
  const unique = pool.filter(c => !seen.has(c.id));
  const base = unique.length >= roundCount ? unique : shuffleArray(pool);
  // Cross-session recency on top of the in-session `seen` filter — ~20
  // cases/tier with 10-round sessions repeats by day two otherwise. Soft:
  // stale cases fall to the back, never below roundCount.
  const picked = orderFreshFirst('detective_mind', base, { tier }).slice(0, roundCount);
  markManyUsed('detective_mind', picked.map(c => c.id), { tier });
  return picked;
}

export function useDetectiveMindGame(roundCount: number = 10, difficultyLevel: number = 1) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<DetectiveTrialResult[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [activeTier, setActiveTierState] = useState<number>(levelToTier(difficultyLevel));
  const seenCaseIdsRef = useRef<Set<string>>(new Set());
  const [cases, setCases] = useState<DetectiveCase[]>(() =>
    buildCasePool(levelToTier(difficultyLevel), roundCount, new Set())
  );

  // Reset seen state when difficulty/round changes (e.g. replay)
  useEffect(() => {
    seenCaseIdsRef.current = new Set();
    const t = levelToTier(difficultyLevel);
    setActiveTierState(t);
    setCases(buildCasePool(t, roundCount, seenCaseIdsRef.current));
    setCurrentIndex(0);
  }, [difficultyLevel, roundCount]);

  /**
   * Mid-session adaptation: swap UPCOMING cases to a new tier.
   * Preserves played cases; replaces the rest from the new tier pool.
   */
  const setActiveTier = useCallback((newTier: number) => {
    const tier = Math.max(1, Math.min(3, newTier));
    setActiveTierState(prev => {
      if (prev === tier) return prev;
      setCases(prevCases => {
        const played = prevCases.slice(0, currentIndex);
        played.forEach(c => seenCaseIdsRef.current.add(c.id));
        const remainingNeeded = roundCount - played.length;
        if (remainingNeeded <= 0) return prevCases;
        const fresh = buildCasePool(tier, remainingNeeded, seenCaseIdsRef.current);
        return [...played, ...fresh];
      });
      return tier;
    });
  }, [currentIndex, roundCount]);

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
    activeTier,
    setActiveTier,
    submitAnswer,
    nextCase,
  };
}
