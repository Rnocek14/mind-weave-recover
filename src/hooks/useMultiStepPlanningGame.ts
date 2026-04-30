/**
 * Multi-Step Planning Game Hook
 * 
 * "Plan [goal] in steps" — speech-based executive sequencing task.
 * Scores step coverage and sequence ordering.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { PLANNING_ITEMS, PlanningItem } from '@/data/multiStepPlanningStimuli';
import { shuffleArray } from '@/lib/shuffle';
import { scoreExplanation } from '@/lib/explanationScorer';

export interface PlanningTrialResult {
  itemId: string;
  goal: string;
  tier: number;
  transcript: string;
  stepCount: number;
  stepsFound: number;
  stepsTotal: number;
  goalCoverage: number;
  sequenceScore: number;
  durationMs: number;
  skipped: boolean;
  depthTelemetry: {
    taskType: 'multi_step_plan';
    stepCount: number;
    sequenceScore: number;
    goalCoverage: number;
  };
}

function buildPlanningItems(tier: number, roundCount: number, exclude: Set<string>): PlanningItem[] {
  const t = Math.max(1, Math.min(3, tier));
  const pool = PLANNING_ITEMS.filter(i => i.tier <= Math.min(t + 1, 3) && i.tier >= Math.max(t - 1, 1));
  const fresh = pool.filter(i => !exclude.has(i.id));
  const finalPool = fresh.length >= roundCount ? fresh : pool;
  return shuffleArray(finalPool).slice(0, roundCount);
}

export function useMultiStepPlanningGame(roundCount: number = 3, tier: number = 1) {
  const [activeTier, setActiveTierState] = useState<number>(tier);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [items, setItems] = useState<PlanningItem[]>(() =>
    buildPlanningItems(tier, roundCount, new Set())
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<PlanningTrialResult[]>([]);

  useEffect(() => {
    seenIdsRef.current = new Set();
    setActiveTierState(tier);
    setItems(buildPlanningItems(tier, roundCount, seenIdsRef.current));
    setCurrentIndex(0);
  }, [tier, roundCount]);

  /** Mid-session adaptation: swap upcoming planning items to new tier */
  const setActiveTier = useCallback((newTier: number) => {
    const t = Math.max(1, Math.min(3, newTier));
    setActiveTierState(prev => {
      if (prev === t) return prev;
      setItems(prevItems => {
        const played = prevItems.slice(0, currentIndex);
        played.forEach(i => seenIdsRef.current.add(i.id));
        const remaining = roundCount - played.length;
        if (remaining <= 0) return prevItems;
        const fresh = buildPlanningItems(t, remaining, seenIdsRef.current);
        return [...played, ...fresh];
      });
      return t;
    });
  }, [currentIndex, roundCount]);

  const currentItem: PlanningItem | null = items[currentIndex] ?? null;
  const isComplete = currentIndex >= items.length;

  const submitPlan = useCallback((transcript: string, durationMs: number): PlanningTrialResult | null => {
    if (!currentItem) return null;

    const score = scoreExplanation(transcript, currentItem.keySteps, currentItem.goal);

    // Count user's steps (lines, numbered items, or sentence-like chunks)
    const stepCount = Math.max(1,
      transcript.split(/(?:\d+[.)]\s*|then\s|next\s|after\s|finally\s|first\s|second\s|third\s|[.!?\n]+)/i)
        .filter(s => s.trim().length > 3).length
    );

    // Sequence score: check if matched concepts appear in roughly correct order in transcript
    const transcriptLower = transcript.toLowerCase();
    const matchedIndices: number[] = [];
    for (let i = 0; i < currentItem.keySteps.length; i++) {
      const stepWords = currentItem.keySteps[i].toLowerCase().split(/\s+/);
      const found = stepWords.some(w => w.length > 3 && transcriptLower.includes(w));
      if (found) {
        matchedIndices.push(i);
      }
    }

    // Sequence score = ratio of in-order pairs
    let inOrderPairs = 0;
    let totalPairs = 0;
    for (let i = 0; i < matchedIndices.length; i++) {
      for (let j = i + 1; j < matchedIndices.length; j++) {
        totalPairs++;
        if (matchedIndices[i] < matchedIndices[j]) inOrderPairs++;
      }
    }
    const sequenceScore = totalPairs > 0 ? inOrderPairs / totalPairs : 0;

    const result: PlanningTrialResult = {
      itemId: currentItem.id,
      goal: currentItem.goal,
      tier: activeTier,
      transcript,
      stepCount,
      stepsFound: score.conceptsFound,
      stepsTotal: score.conceptsTotal,
      goalCoverage: score.coverageRatio,
      sequenceScore,
      durationMs,
      skipped: !transcript || transcript.trim().length < 3,
      depthTelemetry: {
        taskType: 'multi_step_plan',
        stepCount,
        sequenceScore,
        goalCoverage: score.coverageRatio,
      },
    };

    setResults(prev => [...prev, result]);
    return result;
  }, [currentItem, activeTier]);

  const nextItem = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  return { currentItem, currentIndex, totalItems: items.length, isComplete, results, activeTier, setActiveTier, submitPlan, nextItem };
}
