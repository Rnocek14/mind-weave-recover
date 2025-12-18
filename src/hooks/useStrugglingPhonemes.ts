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

export interface StrugglingPhonemesResult {
  strugglingPhonemes: StrugglingPhoneme[];
  strongPhonemes: StrugglingPhoneme[];
  targetWords: string[];
  loading: boolean;
  error: Error | null;
  hasEnoughData: boolean;
}

export function useStrugglingPhonemes(
  userId: string | undefined,
  options: {
    accuracyThreshold?: number; // Default 70
    minTrials?: number; // Default 3
    maxPhonemes?: number; // Default 5
    maxTargetWords?: number; // Default 10
  } = {}
): StrugglingPhonemesResult {
  const {
    accuracyThreshold = 70,
    minTrials = 3,
    maxPhonemes = 5,
    maxTargetWords = 10,
  } = options;

  const { profile, loading, error } = useUserSpeechProfile(userId);

  const result = useMemo(() => {
    const phonemeDifficultyMap = profile?.phoneme_difficulty_map as Record<
      string,
      { accuracy: number; trials: number }
    > | null;

    if (!phonemeDifficultyMap || Object.keys(phonemeDifficultyMap).length === 0) {
      return {
        strugglingPhonemes: [],
        strongPhonemes: [],
        targetWords: [],
        hasEnoughData: false,
      };
    }

    const allPhonemes: StrugglingPhoneme[] = Object.entries(phonemeDifficultyMap)
      .filter(([_, stats]) => stats.trials >= minTrials)
      .map(([phoneme, stats]) => ({
        phoneme: normalizePhoneme(phoneme),
        accuracy: stats.accuracy,
        trials: stats.trials,
      }));

    // Sort by accuracy ascending (weakest first)
    const sorted = [...allPhonemes].sort((a, b) => a.accuracy - b.accuracy);

    // Split into struggling vs strong
    const struggling = sorted
      .filter(p => p.accuracy < accuracyThreshold)
      .slice(0, maxPhonemes);

    const strong = sorted
      .filter(p => p.accuracy >= 90)
      .sort((a, b) => b.accuracy - a.accuracy) // Best first
      .slice(0, maxPhonemes);

    // Get words that target struggling phonemes
    const phonemeList = struggling.map(p => p.phoneme);
    const wordMatches = getWordsByPhonemeOverlap(phonemeList, maxTargetWords);
    const targetWords = wordMatches.map(m => m.word);

    return {
      strugglingPhonemes: struggling,
      strongPhonemes: strong,
      targetWords,
      hasEnoughData: allPhonemes.length >= 3,
    };
  }, [profile, accuracyThreshold, minTrials, maxPhonemes, maxTargetWords]);

  return {
    ...result,
    loading,
    error,
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
