/**
 * Meaning Match Arena Game State Machine
 * 
 * Manages item selection, scoring, and deduplication.
 * Mirrors useDetectiveMindGame pattern.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { MEANING_MATCH_ITEMS, MeaningMatchItem, levelToTier } from '@/data/meaningMatchItems';
import { shuffleArray } from '@/lib/shuffle';

export interface MeaningMatchTrialResult {
  itemId: string;
  correct: boolean;
  selectedIndex: number;
  correctIndex: number;
  reactionTimeMs: number;
  tier: number;
  type: string;
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

export function useMeaningMatchGame(roundCount: number = 10, difficultyLevel: number = 1) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<MeaningMatchTrialResult[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const seenItemIdsRef = useRef<Set<string>>(new Set());

  // Reset seen state on replay
  useEffect(() => {
    seenItemIdsRef.current = new Set();
  }, [difficultyLevel, roundCount]);

  // Select items based on difficulty tier, shuffled, deduplicated
  const items = useMemo(() => {
    const tier = levelToTier(difficultyLevel);
    const primary = MEANING_MATCH_ITEMS.filter(i => i.tier === tier);
    const adjacent = MEANING_MATCH_ITEMS.filter(i => Math.abs(i.tier - tier) === 1);
    
    const pool = [...shuffleArray(primary), ...shuffleArray(adjacent)];
    const unique = pool.filter(i => !seenItemIdsRef.current.has(i.id));
    
    const finalPool = unique.length >= roundCount ? unique : shuffleArray(pool);
    return finalPool.slice(0, roundCount);
  }, [difficultyLevel, roundCount]);

  const currentItem: MeaningMatchItem | null = items[currentIndex] ?? null;
  const isComplete = currentIndex >= items.length || currentIndex >= roundCount;

  const submitAnswer = useCallback((selectedIndex: number, reactionTimeMs: number, usedHint: boolean): MeaningMatchTrialResult | null => {
    if (!currentItem) return null;

    const correct = selectedIndex === currentItem.correctIndex;
    let points = 0;
    if (correct) {
      points = 10;
      if (!usedHint) points += 5;
      if (reactionTimeMs < 10000) points += 3; // Speed bonus for quick answers
    }

    const result: MeaningMatchTrialResult = {
      itemId: currentItem.id,
      correct,
      selectedIndex,
      correctIndex: currentItem.correctIndex,
      reactionTimeMs,
      tier: currentItem.tier,
      type: currentItem.type,
      usedHint,
      points,
    };

    setResults(prev => [...prev, result]);
    setTotalPoints(prev => prev + points);
    seenItemIdsRef.current.add(currentItem.id);

    return result;
  }, [currentItem]);

  const nextItem = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  const accuracy = useMemo(() => {
    if (results.length === 0) return 0;
    return results.filter(r => r.correct).length / results.length;
  }, [results]);

  return {
    currentItem,
    currentIndex,
    totalItems: Math.min(items.length, roundCount),
    isComplete,
    results,
    totalPoints,
    accuracy,
    submitAnswer,
    nextItem,
  };
}
