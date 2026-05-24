/**
 * Adaptation Outcomes Hook
 * 
 * Compares adapted vs non-adapted trial accuracy to quantify
 * whether adaptation is actually improving performance.
 * 
 * Supports optional exercise filtering for per-game analysis.
 * 
 * Metrics:
 * - Adapted vs non-adapted accuracy + lift
 * - Phoneme-targeted vs non-targeted success
 * - Cue-personalized vs default cue success
 * - Difficulty-adapted vs fixed difficulty success
 */

import { useMemo } from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

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
  availableExercises: string[];
}

export interface UseAdaptationOutcomesResult {
  outcomes: AdaptationOutcomesSummary | null;
  isLoading: boolean;
}

function computeOutcomes(
  trials: any[],
  exerciseFilter?: string,
): AdaptationOutcomesSummary | null {
  // Collect available exercises from all trials
  const exerciseSet = new Set<string>();
  for (const trial of trials) {
    if (trial.exercise_slug) exerciseSet.add(trial.exercise_slug);
  }
  const availableExercises = Array.from(exerciseSet).sort();

  // Apply filter
  const filtered = exerciseFilter
    ? trials.filter(t => t.exercise_slug === exerciseFilter)
    : trials;

  if (filtered.length === 0) {
    return {
      comparisons: [],
      adaptedAccuracy: 0,
      nonAdaptedAccuracy: 0,
      adaptedTrials: 0,
      nonAdaptedTrials: 0,
      overallLift: 0,
      hasEnoughData: false,
      availableExercises,
    };
  }

  let adaptedCorrect = 0, adaptedTotal = 0;
  let nonAdaptedCorrect = 0, nonAdaptedTotal = 0;
  let phonemeTargetedCorrect = 0, phonemeTargetedTotal = 0;
  let nonPhonemeCorrect = 0, nonPhonemeTotal = 0;
  let cuePersonalizedCorrect = 0, cuePersonalizedTotal = 0;
  let defaultCueCorrect = 0, defaultCueTotal = 0;
  let diffAdaptedCorrect = 0, diffAdaptedTotal = 0;
  let diffFixedCorrect = 0, diffFixedTotal = 0;

  for (const trial of filtered) {
    const params = trial.task_parameters as Record<string, any> | null;
    const correct = (trial.score ?? 0) > 0 ? 1 : 0;
    const adaptationReasons = Array.isArray(params?.adaptation_reasons) ? params.adaptation_reasons : [];
    const phonemes = Array.isArray(params?.focus_phonemes) ? params.focus_phonemes : null;
    const cue = params?.recommended_cue_type || params?.hint_type || 'none';
    const diff = params?.difficulty_level ?? params?.difficulty ?? params?.tier ?? 1;
    const hasActiveAdaptationsObject = !!(params?.adaptations_active && typeof params.adaptations_active === 'object');
    const hasFields = !!(
      params && (
        'adaptation_applied' in params ||
        'adaptation_mode' in params ||
        adaptationReasons.length > 0 ||
        (phonemes && phonemes.length > 0) ||
        cue !== 'none' ||
        'profile_confidence' in params ||
        hasActiveAdaptationsObject
      )
    );

    if (!hasFields) {
      nonAdaptedTotal++;
      nonAdaptedCorrect += correct;
      continue;
    }

    const mode = params?.adaptation_mode
      || ((phonemes && phonemes.length > 0) ? 'phoneme_targeting' : undefined)
      || (cue !== 'none' ? 'cue_personalization' : undefined)
      || ((adaptationReasons.length > 0 || hasActiveAdaptationsObject) ? 'difficulty_only' : undefined)
      || ('profile_confidence' in (params || {}) ? 'profile_aware' : undefined)
      || 'none';
    const applied = typeof params?.adaptation_applied === 'boolean'
      ? params.adaptation_applied
      : mode !== 'none';

    if (applied) {
      adaptedTotal++;
      adaptedCorrect += correct;
    } else {
      nonAdaptedTotal++;
      nonAdaptedCorrect += correct;
    }

    if (mode === 'phoneme_targeting' && phonemes && phonemes.length > 0) {
      phonemeTargetedTotal++;
      phonemeTargetedCorrect += correct;
    } else if (hasFields) {
      nonPhonemeTotal++;
      nonPhonemeCorrect += correct;
    }

    if (mode === 'cue_personalization' && cue !== 'none') {
      cuePersonalizedTotal++;
      cuePersonalizedCorrect += correct;
    } else if (hasFields) {
      defaultCueTotal++;
      defaultCueCorrect += correct;
    }

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
    availableExercises,
  };
}

export const useAdaptationOutcomes = (
  userId: string | undefined,
  daysBack = 14,
  exerciseFilter?: string,
): UseAdaptationOutcomesResult => {
  const activeProfileId = useActiveProfileId();
  const [rawTrials, setRawTrials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const since = new Date(Date.now() - daysBack * 86400000).toISOString();

        let query = supabase
          .from('exercise_events')
          .select('score, task_parameters, exercise_slug, sessions!inner(user_id)')
          .eq('sessions.user_id', userId)
          .gte('created_at', since)
          .limit(2000);
        if (activeProfileId) query = query.eq('profile_id', activeProfileId);

        const { data, error } = await query;

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

    fetchData();
  }, [userId, daysBack, activeProfileId]);

  const outcomes = useMemo<AdaptationOutcomesSummary | null>(() => {
    if (rawTrials.length === 0) return null;
    return computeOutcomes(rawTrials, exerciseFilter);
  }, [rawTrials, exerciseFilter]);

  return { outcomes, isLoading };
};
