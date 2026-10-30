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
  trialIndex: number;
  correct: boolean;
  selectedIndex: number;
  correctIndex: number;
  /** Exact displayed selections, not only a correctness flag or option letter. */
  selectedOption: string;
  correctOption: string;
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

/** Shuffle options with their original index, retaining the exact correct answer.
 * The authored bank keeps answers in slot A; that order must not be presented
 * to patients, or always choosing A can fabricate high comprehension scores.
 * A fresh permutation is generated for each queued presentation. */
function shuffleDisplayedOptions(item: MeaningMatchItem): MeaningMatchItem {
  const order = shuffleArray(item.options.map((_, index) => index));
  return {
    ...item,
    options: order.map(index => item.options[index]),
    correctIndex: order.indexOf(item.correctIndex),
  };
}

function buildPool(tier: MeaningMatchTier, seen: Set<string>): MeaningMatchItem[] {
  const primary = MEANING_MATCH_ITEMS.filter(i => i.tier === tier && !seen.has(i.id));
  const adjacent = MEANING_MATCH_ITEMS.filter(i => Math.abs(i.tier - tier) === 1 && !seen.has(i.id));
  const fallbackPrimary = MEANING_MATCH_ITEMS.filter(i => i.tier === tier);
  const pool = [...shuffleArray(primary), ...shuffleArray(adjacent)];
  return (pool.length > 0 ? pool : shuffleArray(fallbackPrimary)).map(shuffleDisplayedOptions);
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
        // The currently displayed item may already have been answered:
        // adaptation.recordTrial changes tiers before the user taps Next.
        // Keep that item intact so feedback and its explanation still match
        // the actual answer; changes take effect only on subsequent items.
        const preservedCount = Math.min(prevQueue.length, currentIndex + 1);
        const past = prevQueue.slice(0, preservedCount);
        const remainingNeeded = roundCount - preservedCount;
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
      trialIndex: currentIndex + 1,
      correct,
      selectedIndex,
      correctIndex: currentItem.correctIndex,
      selectedOption: currentItem.options[selectedIndex],
      correctOption: currentItem.options[currentItem.correctIndex],
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
  }, [currentItem, currentIndex]);

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
