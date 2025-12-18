/**
 * Hook to fetch phoneme trend history from speech_profile_snapshots
 * Returns time series data for sparklines and delta calculations
 */

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneme } from '@/lib/phonemeWordMap';

interface PhonemeSnapshot {
  computed_at: string;
  trial_count_at_computation: number;
  phoneme_difficulty_map: Record<string, { accuracy: number; trials: number }> | null;
}

interface PhonemePoint {
  date: string;
  accuracy: number;
  trials: number;
}

export interface PhonemeTrend {
  phoneme: string;
  points: PhonemePoint[];
  delta: number | null; // Change from previous to latest snapshot
  hasEnoughData: boolean; // >= 3 points for sparkline
}

export function usePhonemeHistory(userId: string, options?: { limit?: number }) {
  const limit = options?.limit ?? 20;

  const query = useQuery({
    queryKey: ['phoneme-history', userId, limit],
    queryFn: async (): Promise<PhonemeSnapshot[]> => {
      const { data, error } = await supabase
        .from('speech_profile_snapshots')
        .select('computed_at, trial_count_at_computation, phoneme_difficulty_map')
        .eq('user_id', userId)
        .order('computed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      // Cast Json to our expected type and reverse to get oldest → newest for charting
      return (data ?? []).reverse().map(row => ({
        computed_at: row.computed_at,
        trial_count_at_computation: row.trial_count_at_computation,
        phoneme_difficulty_map: row.phoneme_difficulty_map as Record<string, { accuracy: number; trials: number }> | null,
      }));
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract trend data for a specific phoneme
  const getTrendForPhoneme = (phoneme: string): PhonemeTrend => {
    const snapshots = query.data ?? [];
    // Use the same normalization as phonemeWordMap for consistent lookups
    const normalizedKey = normalizePhoneme(phoneme);
    
    const points: PhonemePoint[] = snapshots
      .map(s => {
        // Try both the normalized key and the raw phoneme (handles both old/new formats)
        const phonemeData = s.phoneme_difficulty_map?.[normalizedKey] 
          || s.phoneme_difficulty_map?.[phoneme];
        if (!phonemeData) return null;
        return {
          date: s.computed_at,
          accuracy: phonemeData.accuracy,
          trials: phonemeData.trials,
        };
      })
      .filter((p): p is PhonemePoint => p !== null);

    // Calculate delta (latest - previous)
    let delta: number | null = null;
    if (points.length >= 2) {
      const latest = points[points.length - 1].accuracy;
      const previous = points[points.length - 2].accuracy;
      delta = Math.round(latest - previous);
    }

    return {
      phoneme,
      points,
      delta,
      hasEnoughData: points.length >= 3,
    };
  };

  // Get trends for multiple phonemes at once (memoized)
  const getTrendsForPhonemes = useCallback((phonemes: string[]): Record<string, PhonemeTrend> => {
    const result: Record<string, PhonemeTrend> = {};
    for (const phoneme of phonemes) {
      result[phoneme] = getTrendForPhoneme(phoneme);
    }
    return result;
  }, [query.data]);

  return {
    snapshots: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    getTrendForPhoneme,
    getTrendsForPhonemes,
  };
}
