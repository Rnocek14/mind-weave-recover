/**
 * React hook for cue preference learning
 * 
 * Wraps CuePreferenceLearner for use in exercise components.
 * Automatically persists per user+profile and provides
 * recommendations via epsilon-greedy bandit.
 */

import { useRef, useCallback, useMemo } from 'react';
import { CuePreferenceLearner, type CueType, type CuePreferenceState } from '@/lib/cuePreferenceLearner';

interface UseCuePreferenceOptions {
  userId?: string;
  profileId?: string;
}

export function useCuePreference({ userId, profileId }: UseCuePreferenceOptions) {
  const learnerRef = useRef<CuePreferenceLearner | null>(null);

  // Lazy init — only create if we have a userId
  const getLearner = useCallback((): CuePreferenceLearner | null => {
    if (!userId) return null;
    if (!learnerRef.current) {
      learnerRef.current = new CuePreferenceLearner(userId, profileId);
    }
    return learnerRef.current;
  }, [userId, profileId]);

  /** Record whether a cue helped the user */
  const recordCueOutcome = useCallback((cueType: CueType, wasEffective: boolean) => {
    getLearner()?.recordCueOutcome(cueType, wasEffective);
  }, [getLearner]);

  /** Get recommended cue type (epsilon-greedy) */
  const getRecommendedCue = useCallback((excludeTypes?: CueType[]) => {
    const learner = getLearner();
    if (!learner) return { cueType: 'semantic' as CueType, isExploring: true };
    return learner.getRecommendedCue(excludeTypes);
  }, [getLearner]);

  /** Get current preference state for display */
  const getState = useCallback((): CuePreferenceState | null => {
    return getLearner()?.getState() ?? null;
  }, [getLearner]);

  /** Get clinical insight string */
  const getInsight = useCallback((): string | null => {
    return getLearner()?.generateInsight() ?? null;
  }, [getLearner]);

  /** Reset all cue preference data */
  const reset = useCallback(() => {
    getLearner()?.reset();
  }, [getLearner]);

  return {
    recordCueOutcome,
    getRecommendedCue,
    getState,
    getInsight,
    reset,
    isAvailable: !!userId,
  };
}
