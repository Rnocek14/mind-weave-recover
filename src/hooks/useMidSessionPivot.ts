/**
 * useMidSessionPivot — React hook wrapping the mid-session pivot engine.
 * 
 * Exercises opt in by calling `recordTrial()` after each trial.
 * The hook evaluates pivot rules every 5 trials and returns a recommendation.
 * 
 * Feature-flagged: disabled by default. Enable with `enabled: true`.
 */

import { useState, useCallback, useRef } from 'react';
import {
  evaluateMidSessionPivot,
  createPivotState,
  updatePivotState,
  type RecentTrialData,
  type PivotRecommendation,
  type MidSessionPivotState,
} from '@/lib/midSessionPivot';
import type { DomainScore } from '@/lib/cognitiveStateEngine';

interface UseMidSessionPivotOptions {
  /** Feature flag — default false */
  enabled?: boolean;
  /** Check interval in trials — default 5 */
  checkInterval?: number;
  /** Current domain slug for this exercise */
  currentDomainSlug?: string;
  /** Cognitive domain scores to identify strength domains */
  domainScores?: DomainScore[];
}

interface UseMidSessionPivotResult {
  /** Current pivot recommendation (resets after acknowledgment) */
  pivotRecommendation: PivotRecommendation | null;
  /** Record a trial result — triggers pivot check every N trials */
  recordTrial: (trial: RecentTrialData) => void;
  /** Acknowledge and clear the recommendation (exercise handled it) */
  acknowledgePivot: () => void;
  /** Current pivot state for telemetry */
  pivotState: MidSessionPivotState;
  /** Whether a pivot is currently pending */
  hasPendingPivot: boolean;
}

export function useMidSessionPivot(
  options: UseMidSessionPivotOptions = {}
): UseMidSessionPivotResult {
  const {
    enabled = false,
    checkInterval = 5,
    domainScores,
  } = options;

  const [pivotState, setPivotState] = useState<MidSessionPivotState>(createPivotState());
  const [pivotRecommendation, setPivotRecommendation] = useState<PivotRecommendation | null>(null);
  const recentTrialsRef = useRef<RecentTrialData[]>([]);

  // Compute strength domains from scores
  const strengthDomains = (domainScores || [])
    .filter(d => d.confidence !== 'low' && d.score >= 0.7)
    .sort((a, b) => b.score - a.score)
    .map(d => d.domainSlug);

  const recordTrial = useCallback((trial: RecentTrialData) => {
    if (!enabled) return;

    // Add to rolling window (keep last 10)
    recentTrialsRef.current.push(trial);
    if (recentTrialsRef.current.length > 10) {
      recentTrialsRef.current.shift();
    }

    // Update state
    const newState = updatePivotState(pivotState);
    setPivotState(newState);

    // Only check every N trials
    if (newState.totalTrials % checkInterval !== 0) return;

    // Don't check if there's already a pending recommendation
    if (pivotRecommendation !== null) return;

    const recommendation = evaluateMidSessionPivot(
      recentTrialsRef.current,
      newState,
      strengthDomains,
      enabled,
    );

    if (recommendation.action !== 'none') {
      setPivotRecommendation(recommendation);
    }
  }, [enabled, pivotState, pivotRecommendation, checkInterval, strengthDomains]);

  const acknowledgePivot = useCallback(() => {
    if (pivotRecommendation && pivotRecommendation.action !== 'none') {
      setPivotState(prev => updatePivotState(prev, true));
    }
    setPivotRecommendation(null);
  }, [pivotRecommendation]);

  return {
    pivotRecommendation,
    recordTrial,
    acknowledgePivot,
    pivotState,
    hasPendingPivot: pivotRecommendation !== null && pivotRecommendation.action !== 'none',
  };
}
