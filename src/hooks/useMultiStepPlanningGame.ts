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
import {
  scorePlanningSequence,
  type PlanningInputMode,
  type PlanningCompletionReason,
} from '@/lib/multiStepPlanning/roundEvidence';

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
  inputMode: PlanningInputMode;
  completionReason: PlanningCompletionReason;
  responseValid: boolean;
  /** True only when >=2 distinct step positions were actually detected. */
  sequenceEvidenceAvailable: boolean;
  sequenceMatchedSteps: number;
  sequenceMethod: 'distinctive_tokens_v1';
  /** Real browser recognizer output only; typed input is never fabricated as ASR. */
  browserTranscript: string | null;
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

  const submitPlan = useCallback((
    transcript: string,
    durationMs: number,
    evidence: {
      inputMode: PlanningInputMode;
      completionReason: PlanningCompletionReason;
      responseValid: boolean;
      browserTranscript?: string | null;
    } = { inputMode: 'none', completionReason: 'skipped', responseValid: false },
  ): PlanningTrialResult | null => {
    if (!currentItem) return null;

    const score = scoreExplanation(transcript, currentItem.keySteps, currentItem.goal);

    // Count user's steps (lines, numbered items, or sentence-like chunks)
    const stepCount = Math.max(1,
      transcript.split(/(?:\d+[.)]\s*|then\s|next\s|after\s|finally\s|first\s|second\s|third\s|[.!?\n]+)/i)
        .filter(s => s.trim().length > 3).length
    );

    // Order must reflect actual observed transcript positions, not the
    // index order of the predefined keySteps array (the old bug).
    const sequence = scorePlanningSequence(
      transcript, currentItem.keySteps, currentItem.idealOrder,
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
      sequenceScore: sequence.sequenceScore,
      durationMs,
      skipped: evidence.completionReason === 'skipped' || !transcript?.trim(),
      inputMode: evidence.inputMode,
      completionReason: evidence.completionReason,
      responseValid: evidence.responseValid,
      sequenceEvidenceAvailable: sequence.sequenceEvidenceAvailable,
      sequenceMatchedSteps: sequence.matchedStepCount,
      sequenceMethod: sequence.sequenceMethod,
      browserTranscript: evidence.inputMode === 'spoken' ? (evidence.browserTranscript ?? null) : null,
      depthTelemetry: {
        taskType: 'multi_step_plan',
        stepCount,
        sequenceScore: sequence.sequenceScore,
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
