/**
 * Abstract Comparison Game Hook
 * 
 * "How are X and Y similar?" — speech-based generative task.
 * Scores shared properties mentioned.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ABSTRACT_COMPARE_ITEMS, AbstractCompareItem } from '@/data/abstractCompareStimuli';
import { shuffleArray } from '@/lib/shuffle';
import { scoreExplanation } from '@/lib/explanationScorer';
import { selectAbstractPracticeItems, type AbstractPracticeStage } from '@/lib/abstractCompare/trainingStages';

export interface AbstractCompareTrialResult {
  /** Observed input channel. Never conflate typed fallback with real microphone speech. */
  inputMode?: 'spoken' | 'typed' | 'skip';
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

function buildCompareItems(
  tier: number, roundCount: number, exclude: Set<string>,
  trainingStage: AbstractPracticeStage | null,
): AbstractCompareItem[] {
  if (trainingStage) return selectAbstractPracticeItems(trainingStage, roundCount, [...exclude]);
  const t = Math.max(1, Math.min(3, tier));
  const pool = ABSTRACT_COMPARE_ITEMS.filter(i => i.tier <= Math.min(t + 1, 3) && i.tier >= Math.max(t - 1, 1));
  const fresh = pool.filter(i => !exclude.has(i.id));
  const finalPool = fresh.length >= roundCount ? fresh : pool;
  return shuffleArray(finalPool).slice(0, roundCount);
}

export function useAbstractCompareGame(
  roundCount: number = 4, tier: number = 1,
  trainingStage: AbstractPracticeStage | null = null,
) {
  const [activeTier, setActiveTierState] = useState<number>(tier);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [items, setItems] = useState<AbstractCompareItem[]>(() =>
    buildCompareItems(tier, roundCount, new Set(), trainingStage)
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<AbstractCompareTrialResult[]>([]);

  // Reset when external tier or round count changes
  useEffect(() => {
    seenIdsRef.current = new Set();
    setActiveTierState(tier);
    setItems(buildCompareItems(tier, roundCount, seenIdsRef.current, trainingStage));
    setCurrentIndex(0);
    setResults([]);
  }, [tier, roundCount, trainingStage?.level]);

  /** Mid-session adaptation: swap upcoming pairs to new tier */
  const setActiveTier = useCallback((newTier: number) => {
    // A saved/selected stage owns its content tier for the entire session.
    if (trainingStage) return;
    const t = Math.max(1, Math.min(3, newTier));
    setActiveTierState(prev => {
      if (prev === t) return prev;
      setItems(prevItems => {
        const played = prevItems.slice(0, currentIndex);
        played.forEach(i => seenIdsRef.current.add(i.id));
        const remaining = roundCount - played.length;
        if (remaining <= 0) return prevItems;
        const fresh = buildCompareItems(t, remaining, seenIdsRef.current, null);
        return [...played, ...fresh];
      });
      return t;
    });
  }, [currentIndex, roundCount, trainingStage]);

  const currentItem: AbstractCompareItem | null = items[currentIndex] ?? null;
  const isComplete = currentIndex >= items.length;

  const submitAnswer = useCallback((transcript: string, durationMs: number, inputMode: 'spoken' | 'typed' | 'skip'): AbstractCompareTrialResult | null => {
    if (!currentItem) return null;

    const correctContext = `${currentItem.wordA} and ${currentItem.wordB} are similar`;
    const score = scoreExplanation(transcript, currentItem.keyProperties, correctContext);

    const result: AbstractCompareTrialResult = {
      inputMode,
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

  return { currentItem, currentIndex, totalItems: items.length, isComplete, results, activeTier, setActiveTier, submitAnswer, nextItem };
}
