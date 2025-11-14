import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ErrorBreakdown {
  semantic: number;
  phonemic: number;
  unrelated: number;
  timeout: number;
}

interface CueTrend {
  date: string;
  avgCues: number;
  trialCount: number;
}

interface ProbeProgress {
  date: string;
  accuracy: number;
  avgCues: number;
  totalProbes: number;
}

interface ErrorPatternAnalytics {
  errorBreakdown: ErrorBreakdown;
  cueTrends: CueTrend[];
  probeProgress: ProbeProgress[];
  totalTrials: number;
  overallAccuracy: number;
}

export const useErrorPatternAnalytics = (userId: string, weeksBack: number = 12) => {
  const [analytics, setAnalytics] = useState<ErrorPatternAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (weeksBack * 7));

      // Fetch exercise events for error breakdown and cue trends
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercise_events')
        .select('error_type, cue_level, score, created_at, session_id')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (exerciseError) throw exerciseError;

      // Filter by user_id through sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId);

      const sessionIds = sessions?.map(s => s.id) || [];
      const userExerciseData = exerciseData?.filter(e => sessionIds.includes(e.session_id)) || [];

      // Calculate error breakdown
      const errorBreakdown: ErrorBreakdown = {
        semantic: 0,
        phonemic: 0,
        unrelated: 0,
        timeout: 0,
      };

      userExerciseData.forEach(event => {
        if (event.score === 0 && event.error_type) {
          const errorType = event.error_type.toLowerCase();
          if (errorType.includes('semantic')) {
            errorBreakdown.semantic++;
          } else if (errorType.includes('phonemic') || errorType.includes('phonological')) {
            errorBreakdown.phonemic++;
          } else if (errorType.includes('timeout')) {
            errorBreakdown.timeout++;
          } else {
            errorBreakdown.unrelated++;
          }
        }
      });

      // Calculate cue trends (weekly)
      const cueTrendsMap = new Map<string, { totalCues: number; count: number }>();
      
      userExerciseData.forEach(event => {
        const date = new Date(event.created_at!);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!cueTrendsMap.has(weekKey)) {
          cueTrendsMap.set(weekKey, { totalCues: 0, count: 0 });
        }

        const weekData = cueTrendsMap.get(weekKey)!;
        weekData.totalCues += event.cue_level || 0;
        weekData.count++;
      });

      const cueTrends: CueTrend[] = Array.from(cueTrendsMap.entries())
        .map(([date, data]) => ({
          date,
          avgCues: data.count > 0 ? data.totalCues / data.count : 0,
          trialCount: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Fetch probe results for generalization tracking
      let probeData: any[] = [];
      try {
        const result = await (supabase as any)
          .from('probe_results')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: true });
        
        probeData = result.data || [];
      } catch (probeError) {
        console.warn('Probe results table may not exist yet:', probeError);
      }

      // Calculate probe progress (by session)
      const probeProgressMap = new Map<string, { correct: number; total: number; totalCues: number }>();
      
      (probeData || []).forEach((probe: any) => {
        const date = new Date(probe.created_at!).toISOString().split('T')[0];

        if (!probeProgressMap.has(date)) {
          probeProgressMap.set(date, { correct: 0, total: 0, totalCues: 0 });
        }

        const sessionData = probeProgressMap.get(date)!;
        sessionData.total++;
        if (probe.correct) sessionData.correct++;
        sessionData.totalCues += probe.cues_needed || 0;
      });

      const probeProgress: ProbeProgress[] = Array.from(probeProgressMap.entries())
        .map(([date, data]) => ({
          date,
          accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
          avgCues: data.total > 0 ? data.totalCues / data.total : 0,
          totalProbes: data.total,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate overall stats
      const totalTrials = userExerciseData.length;
      const correctTrials = userExerciseData.filter(e => e.score && e.score > 0).length;
      const overallAccuracy = totalTrials > 0 ? (correctTrials / totalTrials) * 100 : 0;

      setAnalytics({
        errorBreakdown,
        cueTrends,
        probeProgress,
        totalTrials,
        overallAccuracy,
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchAnalytics();
    }
  }, [userId, weeksBack]);

  return {
    analytics,
    isLoading,
    error,
    refetch: fetchAnalytics,
  };
};
