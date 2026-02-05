/**
 * Hook to identify struggling phonemes from user's speech profile
 * 
 * Returns phonemes with accuracy < threshold (default 70%) and minimum trial count
 * for use in targeted word selection and practice recommendations.
 */

import { useMemo } from 'react';
import { useUserSpeechProfile } from './useUserSpeechProfile';
import { getWordsByPhonemeOverlap, normalizePhoneme } from '@/lib/phonemeWordMap';

export interface StrugglingPhoneme {
  phoneme: string;
  accuracy: number;
  trials: number;
}

export interface BuildingPhoneme {
  phoneme: string;
  accuracy: number;
  trials: number;
  neededTrials: number; // minTrials - trials
}

export interface StrugglingPhonemesResult {
  strugglingPhonemes: StrugglingPhoneme[];
  strongPhonemes: StrugglingPhoneme[];
  buildingPhonemes: BuildingPhoneme[]; // Phonemes with 1-2 trials, not yet visible
  targetWords: string[];
  loading: boolean;
  error: Error | null;
  // Clarity: separate "has anything" from "has enough for trends"
  hasReadyPhonemes: boolean; // At least 1 phoneme with minTrials
  hasEnoughDataForTrends: boolean; // 3+ phonemes for reliable patterns
  readyCount: number; // Count of phonemes meeting minTrials threshold
  lastComputedAt: string | null;
  totalTrials: number;
  // Phoneme coverage metadata
  trialsWithGopData: number;
  trialsWithPhonemes: number;
  trialsWithNonZeroAccuracy: number;
  // Profile metadata for debug
  trialCountAtComputation: number;
  // Refresh function to re-fetch data
  refresh: () => void;
}

interface UseStrugglingPhonemesOptions {
  accuracyThreshold?: number; // Default 70
  minTrials?: number; // Default 3
  maxPhonemes?: number; // Default 5
  maxTargetWords?: number; // Default 10
  profileId?: string; // Filter by specific profile
}

export function useStrugglingPhonemes(
  userId: string | undefined,
  options: UseStrugglingPhonemesOptions = {}
): StrugglingPhonemesResult {
  const {
    accuracyThreshold = 70,
    minTrials = 3,
    maxPhonemes = 5,
    maxTargetWords = 10,
    profileId,
  } = options;

  const { profile, loading, error, refresh } = useUserSpeechProfile(userId, { profileId });

  const result = useMemo(() => {
    const phonemeDifficultyMap = profile?.phoneme_difficulty_map as Record<
      string,
      { accuracy: number; trials: number }
    > | null;

    if (!phonemeDifficultyMap || Object.keys(phonemeDifficultyMap).length === 0) {
      return {
        strugglingPhonemes: [],
        strongPhonemes: [],
        buildingPhonemes: [],
        targetWords: [],
        hasReadyPhonemes: false,
        hasEnoughDataForTrends: false,
        readyCount: 0,
        totalTrials: 0,
      };
    }

    // Calculate total trials across all phonemes
    const totalTrials = Object.values(phonemeDifficultyMap).reduce((sum, p) => sum + p.trials, 0);

    // Split phonemes into "ready" (≥ minTrials) and "building" (< minTrials but > 0)
    const readyPhonemes: StrugglingPhoneme[] = [];
    const buildingPhonemes: BuildingPhoneme[] = [];

    Object.entries(phonemeDifficultyMap).forEach(([phoneme, stats]) => {
      const normalized = normalizePhoneme(phoneme);
      if (stats.trials >= minTrials) {
        readyPhonemes.push({
          phoneme: normalized,
          accuracy: stats.accuracy,
          trials: stats.trials,
        });
      } else if (stats.trials > 0) {
        buildingPhonemes.push({
          phoneme: normalized,
          accuracy: stats.accuracy,
          trials: stats.trials,
          neededTrials: minTrials - stats.trials,
        });
      }
    });

    // Sort ready phonemes by accuracy ascending (weakest first)
    const sorted = [...readyPhonemes].sort((a, b) => a.accuracy - b.accuracy);

    // Split into struggling vs strong
    const struggling = sorted
      .filter(p => p.accuracy < accuracyThreshold)
      .slice(0, maxPhonemes);

    const strong = sorted
      .filter(p => p.accuracy >= 90)
      .sort((a, b) => b.accuracy - a.accuracy) // Best first
      .slice(0, maxPhonemes);

    // Sort building phonemes by accuracy (show weakest first as "priority")
    const sortedBuilding = [...buildingPhonemes]
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, maxPhonemes);

    // Get words that target struggling phonemes
    const phonemeList = struggling.map(p => p.phoneme);
    const wordMatches = getWordsByPhonemeOverlap(phonemeList, maxTargetWords);
    const targetWords = wordMatches.map(m => m.word);

    return {
      strugglingPhonemes: struggling,
      strongPhonemes: strong,
      buildingPhonemes: sortedBuilding,
      targetWords,
      hasReadyPhonemes: readyPhonemes.length > 0,
      hasEnoughDataForTrends: readyPhonemes.length >= 3,
      readyCount: readyPhonemes.length,
      totalTrials,
    };
  }, [profile, accuracyThreshold, minTrials, maxPhonemes, maxTargetWords]);

  return {
    ...result,
    loading,
    error,
    lastComputedAt: profile?.last_computed_at || null,
    trialsWithGopData: profile?.trials_with_gop_data ?? 0,
    trialsWithPhonemes: profile?.trials_with_phonemes ?? 0,
    trialsWithNonZeroAccuracy: profile?.trials_with_nonzero_accuracy ?? 0,
    trialCountAtComputation: profile?.trial_count_at_computation ?? 0,
    refresh,
  };
}

/**
 * Format phoneme for display (e.g., "/k/" → "k")
 */
export function formatPhonemeDisplay(phoneme: string): string {
  return phoneme.replace(/\//g, '');
}

/**
 * Get difficulty label for phoneme accuracy
 */
export function getPhonemeAccuracyLabel(accuracy: number): {
  label: string;
  color: string;
} {
  if (accuracy >= 90) {
    return { label: 'Strong', color: 'text-green-600 dark:text-green-400' };
  }
  if (accuracy >= 70) {
    return { label: 'Good', color: 'text-blue-600 dark:text-blue-400' };
  }
  if (accuracy >= 50) {
    return { label: 'Needs practice', color: 'text-amber-600 dark:text-amber-400' };
  }
  return { label: 'Focus area', color: 'text-red-600 dark:text-red-400' };
}

/**
 * Get trend-lite label based on trial count (honest about data confidence)
 */
export function getTrendLiteLabel(trials: number): {
  label: string;
  color: string;
} {
  if (trials < 10) {
    return { label: 'Needs more data', color: 'text-muted-foreground' };
  }
  if (trials < 20) {
    return { label: 'Early estimate', color: 'text-amber-600 dark:text-amber-400' };
  }
  return { label: 'Current level', color: 'text-foreground' };
}

/**
 * Format relative time for "Updated X ago" display
 */
export function formatTimeAgo(date: Date | string | null): string {
  if (!date) return 'Never';
  
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}
