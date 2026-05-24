import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export interface StrugglingWord {
  word: string;
  category: string;
  errorRate: number;
  attempts: number;
  lastAttempted: string;
  primaryErrorType: string;
  daysSinceLastPractice: number;
}

interface UseStrugglingWordsOptions {
  userId: string | undefined;
  minAttempts?: number;       // Minimum attempts to consider (default: 3)
  minErrorRate?: number;      // Minimum error rate to flag as struggling (default: 0.4)
  lookbackDays?: number;      // How far back to look (default: 14)
  maxWords?: number;          // Maximum words to return (default: 10)
  enabled?: boolean;          // Whether to enable the query (default: true)
}

interface UseStrugglingWordsResult {
  strugglingWords: StrugglingWord[];
  focusWords: string[];       // Top 3-5 words for today's session
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to compute words the user is struggling with based on error history
 * Used to inject targeted practice into daily lessons
 */
export const useStrugglingWords = ({
  userId,
  minAttempts = 3,
  minErrorRate = 0.4,
  lookbackDays = 14,
  maxWords = 10,
  enabled = true,
}: UseStrugglingWordsOptions): UseStrugglingWordsResult => {
  const activeProfileId = useActiveProfileId();
  const [strugglingWords, setStrugglingWords] = useState<StrugglingWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStrugglingWords = useCallback(async () => {
    if (!userId || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

      // Fetch recent utterance analyses
      let q = supabase
        .from('utterance_analyses')
        .select('target_word, category, is_correct, error_type, created_at')
        .eq('user_id', userId)
        .gte('created_at', cutoffDate.toISOString())
        .not('target_word', 'is', null)
        .order('created_at', { ascending: false });
      if (activeProfileId) q = q.eq('profile_id', activeProfileId);
      const { data, error: fetchError } = await q;

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        setStrugglingWords([]);
        setLoading(false);
        return;
      }

      // Aggregate by word
      const wordStats: Record<string, {
        category: string;
        correct: number;
        total: number;
        errorTypes: Record<string, number>;
        lastAttempted: string;
      }> = {};

      for (const row of data) {
        const word = row.target_word!.toLowerCase();
        if (!wordStats[word]) {
          wordStats[word] = {
            category: row.category || 'unknown',
            correct: 0,
            total: 0,
            errorTypes: {},
            lastAttempted: row.created_at,
          };
        }

        wordStats[word].total += 1;
        if (row.is_correct) {
          wordStats[word].correct += 1;
        }

        const errorType = row.error_type || 'unknown';
        wordStats[word].errorTypes[errorType] = (wordStats[word].errorTypes[errorType] || 0) + 1;

        // Track most recent attempt
        if (row.created_at > wordStats[word].lastAttempted) {
          wordStats[word].lastAttempted = row.created_at;
        }
      }

      // Filter and sort by struggling criteria
      const now = new Date();
      const struggling: StrugglingWord[] = Object.entries(wordStats)
        .filter(([_, stats]) => {
          const errorRate = 1 - (stats.correct / stats.total);
          return stats.total >= minAttempts && errorRate >= minErrorRate;
        })
        .map(([word, stats]) => {
          const errorRate = 1 - (stats.correct / stats.total);
          const primaryErrorType = Object.entries(stats.errorTypes)
            .filter(([type]) => type !== 'correct' && type !== 'self_corrected')
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

          const lastAttemptedDate = new Date(stats.lastAttempted);
          const daysSinceLastPractice = Math.floor(
            (now.getTime() - lastAttemptedDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            word,
            category: stats.category,
            errorRate,
            attempts: stats.total,
            lastAttempted: stats.lastAttempted,
            primaryErrorType,
            daysSinceLastPractice,
          };
        })
        // Sort by: high error rate, then by days since practice (spaced repetition lite)
        .sort((a, b) => {
          // Prioritize words not practiced in 3+ days
          if (a.daysSinceLastPractice >= 3 && b.daysSinceLastPractice < 3) return -1;
          if (b.daysSinceLastPractice >= 3 && a.daysSinceLastPractice < 3) return 1;
          // Then by error rate
          return b.errorRate - a.errorRate;
        })
        .slice(0, maxWords);

      setStrugglingWords(struggling);
    } catch (err) {
      console.error('[useStrugglingWords] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch struggling words');
    } finally {
      setLoading(false);
    }
  }, [userId, minAttempts, minErrorRate, lookbackDays, maxWords, enabled, activeProfileId]);

  useEffect(() => {
    fetchStrugglingWords();
  }, [fetchStrugglingWords]);

  // Top 3-5 focus words for today (most impactful to practice)
  const focusWords = strugglingWords
    .slice(0, 5)
    .map(w => w.word);

  return {
    strugglingWords,
    focusWords,
    loading,
    error,
    refresh: fetchStrugglingWords,
  };
};
