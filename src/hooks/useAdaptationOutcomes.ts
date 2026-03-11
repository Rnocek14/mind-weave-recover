/**
 * Adaptation Outcomes Hook
 * 
 * Compares adapted vs non-adapted trial accuracy to quantify
 * whether adaptation is actually improving performance.
 * 
 * Metrics:
 * - Adapted vs non-adapted accuracy + lift
 * - Phoneme-targeted vs non-targeted success
 * - Cue-personalized vs default cue success
 * - Difficulty-adapted vs fixed difficulty success
 */

import { useMemo } from 'react';
import { useAdaptationProof, type AdaptationProofSummary } from './useAdaptationProof';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OutcomeComparison {
  label: string;
  groupA: { name: string; accuracy: number; trials: number };
  groupB: { name: string; accuracy: number; trials: number };
  lift: number; // percentage points
  liftPercent: number; // relative %
  significant: boolean; // n >= 20 each
}

export interface AdaptationOutcomesSummary {
  comparisons: OutcomeComparison[];
  adaptedAccuracy: number;
  nonAdaptedAccuracy: number;
  adaptedTrials: number;
  nonAdaptedTrials: number;
  overallLift: number;
  hasEnoughData: boolean;
}

export interface UseAdaptationOutcomesResult {
  outcomes: AdaptationOutcomesSummary | null;
  isLoading: boolean;
}

export const useAdaptationOutcomes = (
  userId: string | undefined,
  daysBack = 14
): UseAdaptationOutcomesResult => {
  const [rawTrials, setRawTrials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetch = async () => {
      setIsLoading(true);
      try {
        const since = new Date(Date.now() - daysBack * 86400000).toISOString();

        const { data, error } = await supabase
          .from('exercise_events')
          .select('score, task_parameters, exercise_slug, sessions!inner(user_id)')
          .eq('sessions.user_id', userId)
          .gte('created_at', since)
          .limit(2000);

        if (error) {
          console.error('[useAdaptationOutcomes] Query error:', error);
          setRawTrials([]);
        } else {
          setRawTrials(data || []);
        }
      } catch (err) {
        console.error('[useAdaptationOutcomes] Error:', err);
        setRawTrials([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetch();
  }, [userId, daysBack]);

  const outcomes = useMemo<AdaptationOutcomesSummary | null>(() => {
    if (rawTrials.length === 0) return null;

    // Classify each trial
    let adaptedCorrect = 0, adaptedTotal = 0;
    let nonAdaptedCorrect = 0, nonAdaptedTotal = 0;
    let phonemeTargetedCorrect = 0, phonemeTargetedTotal = 0;
    let nonPhonemeCorrect = 0, nonPhonemeTotal = 0;
    let cuePersonalizedCorrect = 0, cuePersonalizedTotal = 0;
    let defaultCueCorrect = 0, defaultCueTotal = 0;
    let diffAdaptedCorrect = 0, diffAdaptedTotal = 0;
    let diffFixedCorrect = 0, diffFixedTotal = 0;

    for (const trial of rawTrials) {
      const params = trial.task_parameters as Record<string, any> | null;
      const correct = (trial.score ?? 0) > 0 ? 1 : 0;
      const hasFields = params && ('adaptation_applied' in params || 'adaptation_mode' in params);

      if (!hasFields) {
        // Trial without telemetry — treat as non-adapted
        nonAdaptedTotal++;
        nonAdaptedCorrect += correct;
        continue;
      }

      const applied = !!params!.adaptation_applied;
      const mode = params!.adaptation_mode || 'none';
      const phonemes = Array.isArray(params!.focus_phonemes) ? params!.focus_phonemes : null;
      const cue = params!.recommended_cue_type || 'none';
      const diff = params!.difficulty_level ?? 1;

      // Adapted vs non-adapted
      if (applied) {
        adaptedTotal++;
        adaptedCorrect += correct;
      } else {
        nonAdaptedTotal++;
        nonAdaptedCorrect += correct;
      }

      // Phoneme-targeted vs not
      if (mode === 'phoneme_targeting' && phonemes && phonemes.length > 0) {
        phonemeTargetedTotal++;
        phonemeTargetedCorrect += correct;
      } else if (hasFields) {
        nonPhonemeTotal++;
        nonPhonemeCorrect += correct;
      }

      // Cue-personalized vs default
      if (mode === 'cue_personalization' && cue !== 'none') {
        cuePersonalizedTotal++;
        cuePersonalizedCorrect += correct;
      } else if (hasFields) {
        defaultCueTotal++;
        defaultCueCorrect += correct;
      }

      // Difficulty adapted vs fixed (tier > 1 means adapted)
      if (diff > 1) {
        diffAdaptedTotal++;
        diffAdaptedCorrect += correct;
      } else {
        diffFixedTotal++;
        diffFixedCorrect += correct;
      }
    }

    const makeComparison = (
      label: string,
      aName: string, aCorrect: number, aTotal: number,
      bName: string, bCorrect: number, bTotal: number,
    ): OutcomeComparison => {
      const aAcc = aTotal > 0 ? aCorrect / aTotal : 0;
      const bAcc = bTotal > 0 ? bCorrect / bTotal : 0;
      const lift = (aAcc - bAcc) * 100;
      const liftPercent = bAcc > 0 ? ((aAcc - bAcc) / bAcc) * 100 : 0;
      return {
        label,
        groupA: { name: aName, accuracy: aAcc, trials: aTotal },
        groupB: { name: bName, accuracy: bAcc, trials: bTotal },
        lift,
        liftPercent,
        significant: aTotal >= 20 && bTotal >= 20,
      };
    };

    const comparisons: OutcomeComparison[] = [
      makeComparison(
        'Adapted vs Non-adapted',
        'Adapted', adaptedCorrect, adaptedTotal,
        'Non-adapted', nonAdaptedCorrect, nonAdaptedTotal,
      ),
      makeComparison(
        'Phoneme-targeted vs Non-targeted',
        'Phoneme-targeted', phonemeTargetedCorrect, phonemeTargetedTotal,
        'Non-targeted', nonPhonemeCorrect, nonPhonemeTotal,
      ),
      makeComparison(
        'Cue-personalized vs Default',
        'Personalized cue', cuePersonalizedCorrect, cuePersonalizedTotal,
        'Default cue', defaultCueCorrect, defaultCueTotal,
      ),
      makeComparison(
        'Adaptive difficulty vs Fixed',
        'Adaptive difficulty', diffAdaptedCorrect, diffAdaptedTotal,
        'Fixed difficulty', diffFixedCorrect, diffFixedTotal,
      ),
    ];

    const adaptedAcc = adaptedTotal > 0 ? adaptedCorrect / adaptedTotal : 0;
    const nonAdaptedAcc = nonAdaptedTotal > 0 ? nonAdaptedCorrect / nonAdaptedTotal : 0;

    return {
      comparisons,
      adaptedAccuracy: adaptedAcc,
      nonAdaptedAccuracy: nonAdaptedAcc,
      adaptedTrials: adaptedTotal,
      nonAdaptedTrials: nonAdaptedTotal,
      overallLift: (adaptedAcc - nonAdaptedAcc) * 100,
      hasEnoughData: adaptedTotal >= 10 && nonAdaptedTotal >= 10,
    };
  }, [rawTrials]);

  return { outcomes, isLoading };
};
