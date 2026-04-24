/**
 * Abstract Comparison Game Hook
 * 
 * "How are X and Y similar?" — speech-based generative task.
 * Scores shared properties mentioned.
 */

import { useState, useCallback, useMemo } from 'react';
import { ABSTRACT_COMPARE_ITEMS, AbstractCompareItem } from '@/data/abstractCompareStimuli';
import { shuffleArray } from '@/lib/shuffle';
import { scoreExplanation } from '@/lib/explanationScorer';

export interface AbstractCompareTrialResult {
  itemId: string;
  wordA: string;
  wordB: string;
  transcript: string;
  conceptCount: number;
  conceptsTotal: number;
  coverageRatio: number;
  onTopicScore: number;
  abstractionLevel: string;
  durationMs: number;
  skipped: boolean;
  depthTelemetry: {
    taskType: 'abstract_compare';
    abstractionLevel: number;
    conceptCount: number;
    coverageRatio: number;
  };
}

const ABSTRACTION_NUMERIC: Record<string, number> = {
  concrete: 0.3,
  moderate: 0.6,
  abstract: 1.0,
};

function buildCompareItems(tier: number, roundCount: number, exclude: Set<string>): AbstractCompareItem[] {
  const t = Math.max(1, Math.min(3, tier));
  const pool = ABSTRACT_COMPARE_ITEMS.filter(i => i.tier <= Math.min(t + 1, 3) && i.tier >= Math.max(t - 1, 1));
  const fresh = pool.filter(i => !exclude.has(i.id));
  const finalPool = fresh.length >= roundCount ? fresh : pool;
  return shuffleArray(finalPool).slice(0, roundCount);
}

export function useAbstractCompareGame(roundCount: number = 4, tier: number = 1) {
  const [activeTier, setActiveTierState] = useState<number>(tier);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [items, setItems] = useState<AbstractCompareItem[]>(() =>
    buildCompareItems(tier, roundCount, new Set())
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<AbstractCompareTrialResult[]>([]);

  // Reset when external tier or round count changes
  useEffect(() => {
    seenIdsRef.current = new Set();
    setActiveTierState(tier);
    setItems(buildCompareItems(tier, roundCount, seenIdsRef.current));
    setCurrentIndex(0);
  }, [tier, roundCount]);

  /** Mid-session adaptation: swap upcoming pairs to new tier */
  const setActiveTier = useCallback((newTier: number) => {
    const t = Math.max(1, Math.min(3, newTier));
    setActiveTierState(prev => {
      if (prev === t) return prev;
      setItems(prevItems => {
        const played = prevItems.slice(0, currentIndex);
        played.forEach(i => seenIdsRef.current.add(i.id));
        const remaining = roundCount - played.length;
        if (remaining <= 0) return prevItems;
        const fresh = buildCompareItems(t, remaining, seenIdsRef.current);
        return [...played, ...fresh];
      });
      return t;
    });
  }, [currentIndex, roundCount]);

  const currentItem: AbstractCompareItem | null = items[currentIndex] ?? null;
  const isComplete = currentIndex >= items.length;

  const submitAnswer = useCallback((transcript: string, durationMs: number): AbstractCompareTrialResult | null => {
    if (!currentItem) return null;

    const correctContext = `${currentItem.wordA} and ${currentItem.wordB} are similar`;
    const score = scoreExplanation(transcript, currentItem.keyProperties, correctContext);

    const result: AbstractCompareTrialResult = {
      itemId: currentItem.id,
      wordA: currentItem.wordA,
      wordB: currentItem.wordB,
      transcript,
      conceptCount: score.conceptsFound,
      conceptsTotal: score.conceptsTotal,
      coverageRatio: score.coverageRatio,
      onTopicScore: score.onTopicScore,
      abstractionLevel: currentItem.abstractionLevel,
      durationMs,
      skipped: !transcript || transcript.trim().length < 3,
      depthTelemetry: {
        taskType: 'abstract_compare',
        abstractionLevel: ABSTRACTION_NUMERIC[currentItem.abstractionLevel] ?? 0.5,
        conceptCount: score.conceptsFound,
        coverageRatio: score.coverageRatio,
      },
    };

    setResults(prev => [...prev, result]);
    return result;
  }, [currentItem]);

  const nextItem = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  return { currentItem, currentIndex, totalItems: items.length, isComplete, results, submitAnswer, nextItem };
}
