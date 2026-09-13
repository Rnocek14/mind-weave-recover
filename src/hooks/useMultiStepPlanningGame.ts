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

/**
 * How much of the plan did the patient say IN ORDER?
 *
 * Returns the share of recognised step pairs that were spoken in the plan's
 * expected order, or 0 when fewer than two steps are recognisable.
 *
 * This used to walk keySteps by index and collect the index itself, so the
 * collected list was ascending by construction: every pair counted as in-order
 * and the score was a flat 1.0 for any answer mentioning two steps — a
 * perfectly reversed plan included. Sequencing is the executive skill this
 * exercise trains, so the score has to read where each step appears in the
 * transcript. Matching is on words longer than three characters, the same
 * granularity the coverage scorer uses.
 */
export function computeSequenceScore(
  transcript: string,
  keySteps: string[],
  idealOrder?: number[],
): number {
  const transcriptLower = transcript.toLowerCase();

  // `idealOrder` lists keyStep INDICES in the order a good plan states them, so
  // the clinically correct position of keySteps[i] is where i appears in that
  // list, not i itself. Two items in the bank are authored non-monotonic, and
  // ranking by declaration index marked their authored ideal ordering as partly
  // out of order. Declaration order remains the fallback when the field is
  // absent or the wrong length.
  const rankOfStep = keySteps.map((_, i) => i);
  if (idealOrder && idealOrder.length === keySteps.length) {
    idealOrder.forEach((stepIndex, position) => {
      if (stepIndex >= 0 && stepIndex < keySteps.length) rankOfStep[stepIndex] = position;
    });
  }

  const matched: Array<{ step: number; at: number }> = [];

  for (let i = 0; i < keySteps.length; i++) {
    let earliest = -1;
    for (const word of keySteps[i].toLowerCase().split(/\s+/)) {
      if (word.length <= 3) continue;
      const at = transcriptLower.indexOf(word);
      if (at !== -1 && (earliest === -1 || at < earliest)) earliest = at;
    }
    if (earliest !== -1) matched.push({ step: rankOfStep[i], at: earliest });
  }

  const spokenOrder = [...matched].sort((a, b) => a.at - b.at);
  let inOrderPairs = 0;
  let totalPairs = 0;
  for (let i = 0; i < spokenOrder.length; i++) {
    for (let j = i + 1; j < spokenOrder.length; j++) {
      totalPairs++;
      if (spokenOrder[i].step < spokenOrder[j].step) inOrderPairs++;
    }
  }
  return totalPairs > 0 ? inOrderPairs / totalPairs : 0;
}

/**
 * Did this plan succeed?
 *
 * One trial must have ONE verdict. The in-game engine asked for coverage >= 0.6
 * AND order >= 0.5, while the page logged `goalCoverage >= 0.3` as correct — so
 * naming a single step out of five was written to the clinical ladder as a
 * fully-credited success, and a complete but perfectly reversed plan counted as
 * correct there too while the engine scored it a failure. Both now call this.
 */
export function isSuccessfulPlan(result: {
  goalCoverage: number;
  sequenceScore: number;
}): boolean {
  return result.goalCoverage >= 0.6 && result.sequenceScore >= 0.5;
}

function buildPlanningItems(tier: number, roundCount: number, exclude: Set<string>): PlanningItem[] {
  const t = Math.max(1, Math.min(3, tier));
  // Strict tier isolation, matching the data module's own selector contract
  // ("returns ONLY items at the tier ... allow repeats WITHIN tier, never
  // blend"). The old plus-or-minus-one window let content tier 2 draw from the
  // entire bank, so a patient who had just been told the task got harder could
  // be handed a tier-1 goal. Each tier holds 20 items against a 3-4 round
  // session.
  const pool = PLANNING_ITEMS.filter(i => i.tier === t);
  const fresh = pool.filter(i => !exclude.has(i.id));
  // Exhausted by exclusions: repeat within the tier rather than blending.
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

    const sequenceScore = computeSequenceScore(
      transcript,
      currentItem.keySteps,
      currentItem.idealOrder,
    );

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
