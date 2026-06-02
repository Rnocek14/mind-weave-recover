import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export interface ExerciseStats {
  avgAccuracy: number; // 0-1
  medianRt: number; // milliseconds
  trialCount: number;
}

export const useExerciseStats = (
  userId: string | undefined,
  exerciseSlug: string
) => {
  const [stats, setStats] = useState<ExerciseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeProfileId = useActiveProfileId();

  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc(
          'get_exercise_stats_last7d',
          {
            uid: userId,
            slug: exerciseSlug,
            pid: activeProfileId ?? undefined,
          }
        );

        if (rpcError) throw rpcError;

        if (data && data.length > 0) {
          const row = data[0];
          setStats({
            avgAccuracy: Number(row.avg_accuracy) || 0,
            medianRt: row.median_rt || 0,
            trialCount: Number(row.trial_count) || 0,
          });
        } else {
          setStats({
            avgAccuracy: 0,
            medianRt: 0,
            trialCount: 0,
          });
        }
      } catch (e) {
        console.error('Error fetching exercise stats:', e);
        setError(e instanceof Error ? e.message : 'Failed to load stats');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, [userId, exerciseSlug, activeProfileId]);

  return { stats, loading, error };
};
