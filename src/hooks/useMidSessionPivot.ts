/**
 * useMidSessionPivot — React hook wrapping the mid-session pivot engine.
 * 
 * Exercises opt in by calling `recordTrial()` after each trial.
 * The hook evaluates pivot rules every 5 trials and returns a recommendation.
 * 
 * Feature-flagged: disabled by default. Enable with `enabled: true`.
 * 
 * State timing: Uses refs for mutable state accessed in recordTrial()
 * to avoid stale closures during rapid trial completion.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
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

  // Use refs for mutable state to avoid stale closures in recordTrial
  const pivotStateRef = useRef<MidSessionPivotState>(createPivotState());
  const pendingRecommendationRef = useRef<PivotRecommendation | null>(null);
  const recentTrialsRef = useRef<RecentTrialData[]>([]);

  // React state for rendering (synced from refs)
  const [pivotState, setPivotState] = useState<MidSessionPivotState>(pivotStateRef.current);
  const [pivotRecommendation, setPivotRecommendation] = useState<PivotRecommendation | null>(null);

  // Compute strength domains from scores (memoized to avoid recalc)
  const strengthDomains = useMemo(() => 
    (domainScores || [])
      .filter(d => d.confidence !== 'low' && d.score >= 0.7)
      .sort((a, b) => b.score - a.score)
      .map(d => d.domainSlug),
    [domainScores]
  );

  const recordTrial = useCallback((trial: RecentTrialData) => {
    if (!enabled) return;

    // Add to rolling window (keep last 10)
    recentTrialsRef.current.push(trial);
    if (recentTrialsRef.current.length > 10) {
      recentTrialsRef.current.shift();
    }

    // Update state via ref (always current, no stale closure)
    const newState = updatePivotState(pivotStateRef.current);
    pivotStateRef.current = newState;
    setPivotState(newState); // Sync to React for rendering

    // Only check every N trials
    if (newState.totalTrials % checkInterval !== 0) return;

    // Don't check if there's already a pending recommendation
    if (pendingRecommendationRef.current !== null) return;

    const recommendation = evaluateMidSessionPivot(
      recentTrialsRef.current,
      newState,
      strengthDomains,
      enabled,
    );

    if (recommendation.action !== 'none') {
      pendingRecommendationRef.current = recommendation;
      setPivotRecommendation(recommendation);
    }
  }, [enabled, checkInterval, strengthDomains]);

  const acknowledgePivot = useCallback(() => {
    if (pendingRecommendationRef.current && pendingRecommendationRef.current.action !== 'none') {
      const newState = updatePivotState(pivotStateRef.current, true);
      pivotStateRef.current = newState;
      setPivotState(newState);
    }
    pendingRecommendationRef.current = null;
    setPivotRecommendation(null);
  }, []);

  return {
    pivotRecommendation,
    recordTrial,
    acknowledgePivot,
    pivotState,
    hasPendingPivot: pivotRecommendation !== null && pivotRecommendation.action !== 'none',
  };
}
