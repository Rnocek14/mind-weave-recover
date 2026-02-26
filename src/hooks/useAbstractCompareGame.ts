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

export function useAbstractCompareGame(roundCount: number = 4, tier: number = 1) {
  const items = useMemo(() => {
    const pool = ABSTRACT_COMPARE_ITEMS.filter(i => i.tier <= Math.min(tier + 1, 3));
    return shuffleArray(pool).slice(0, roundCount);
  }, [roundCount, tier]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<AbstractCompareTrialResult[]>([]);

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
