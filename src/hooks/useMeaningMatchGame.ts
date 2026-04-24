/**
 * Meaning Match Arena Game State Machine
 *
 * Manages item selection, scoring, and deduplication.
 * 
 * ADAPTIVE: Supports mid-game tier shifts via `setActiveTier()`. The current
 * upcoming item is replaced with one matching the new tier so the user
 * sees a real content change in response to their performance.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { MEANING_MATCH_ITEMS, MeaningMatchItem, levelToTier, MeaningMatchTier } from '@/data/meaningMatchItems';
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

function buildPool(tier: MeaningMatchTier, seen: Set<string>): MeaningMatchItem[] {
  const primary = MEANING_MATCH_ITEMS.filter(i => i.tier === tier && !seen.has(i.id));
  const adjacent = MEANING_MATCH_ITEMS.filter(i => Math.abs(i.tier - tier) === 1 && !seen.has(i.id));
  const fallbackPrimary = MEANING_MATCH_ITEMS.filter(i => i.tier === tier);
  const pool = [...shuffleArray(primary), ...shuffleArray(adjacent)];
  return pool.length > 0 ? pool : shuffleArray(fallbackPrimary);
}

export function useMeaningMatchGame(roundCount: number = 10, difficultyLevel: number = 1) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<MeaningMatchTrialResult[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const seenItemIdsRef = useRef<Set<string>>(new Set());

  // Active tier — initially derived from initial level, mutable mid-game
  const [activeTier, setActiveTierState] = useState<MeaningMatchTier>(() => levelToTier(difficultyLevel));

  // Dynamic queue: regenerated when tier changes
  const initialQueue = useMemo(
    () => buildPool(levelToTier(difficultyLevel), seenItemIdsRef.current).slice(0, roundCount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [queue, setQueue] = useState<MeaningMatchItem[]>(initialQueue);

  // Reset on roundCount change (replay)
  useEffect(() => {
    seenItemIdsRef.current = new Set();
    const t = levelToTier(difficultyLevel);
    setActiveTierState(t);
    setQueue(buildPool(t, seenItemIdsRef.current).slice(0, roundCount));
    setCurrentIndex(0);
    setResults([]);
    setTotalPoints(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundCount]);

  /**
   * Set the active tier mid-game. The current upcoming item (and beyond) is
   * replaced with items at the new tier so the user immediately sees the
   * content shift. Past items are preserved.
   */
  const setActiveTier = useCallback((tier: MeaningMatchTier) => {
    setActiveTierState(prev => {
      if (prev === tier) return prev;
      setQueue(prevQueue => {
        const past = prevQueue.slice(0, currentIndex);
        const remainingNeeded = roundCount - currentIndex;
        const fresh = buildPool(tier, seenItemIdsRef.current).slice(0, remainingNeeded);
        return [...past, ...fresh];
      });
      return tier;
    });
  }, [currentIndex, roundCount]);

  const currentItem: MeaningMatchItem | null = queue[currentIndex] ?? null;
  const isComplete = currentIndex >= queue.length || currentIndex >= roundCount;

  const submitAnswer = useCallback((selectedIndex: number, reactionTimeMs: number, usedHint: boolean): MeaningMatchTrialResult | null => {
    if (!currentItem) return null;

    const correct = selectedIndex === currentItem.correctIndex;
    let points = 0;
    if (correct) {
      points = 10;
      if (!usedHint) points += 5;
      if (reactionTimeMs < 10000) points += 3;
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
    totalItems: Math.min(queue.length, roundCount),
    isComplete,
    results,
    totalPoints,
    accuracy,
    submitAnswer,
    nextItem,
    activeTier,
    setActiveTier,
  };
}
