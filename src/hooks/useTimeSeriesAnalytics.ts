import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, format, subWeeks } from 'date-fns';

export interface TimeSeriesDataPoint {
  date: string;
  corrections: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  correctionRate: number; // percentage
}

export interface MechanismEngagement {
  mechanism: string;
  sessionCount: number;
  avgDuration: number;
  completionRate: number;
}

export const useTimeSeriesAnalytics = (weeksBack: number = 12) => {
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [mechanismData, setMechanismData] = useState<MechanismEngagement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTimeSeriesData();
  }, [weeksBack]);

  const fetchTimeSeriesData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const startDate = subWeeks(new Date(), weeksBack);

      // Fetch corrections over time
      const { data: corrections, error: correctionsError } = await supabase
        .from('clinical_profile_corrections')
        .select('created_at, confidence_before')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (correctionsError) throw correctionsError;

      // Group by week
      const weeklyData: Record<string, {
        corrections: number;
        high: number;
        medium: number;
        low: number;
      }> = {};

      corrections?.forEach(correction => {
        const weekStart = startOfWeek(new Date(correction.created_at));
        const weekKey = format(weekStart, 'MMM d');

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { corrections: 0, high: 0, medium: 0, low: 0 };
        }

        weeklyData[weekKey].corrections++;
        
        const conf = correction.confidence_before?.toLowerCase();
        if (conf === 'high') weeklyData[weekKey].high++;
        else if (conf === 'medium') weeklyData[weekKey].medium++;
        else if (conf === 'low') weeklyData[weekKey].low++;
      });

      // Convert to array and calculate correction rate
      const timeSeriesArray = Object.entries(weeklyData).map(([date, data]) => ({
        date,
        corrections: data.corrections,
        highConfidence: data.high,
        mediumConfidence: data.medium,
        lowConfidence: data.low,
        correctionRate: data.corrections > 0 
          ? Math.round(((data.medium + data.low) / data.corrections) * 100)
          : 0
      }));

      setTimeSeriesData(timeSeriesArray);

      // Fetch mechanism-specific engagement
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('plan, duration_sec, ended_at')
        .gte('started_at', startDate.toISOString());

      if (sessionsError) throw sessionsError;

      const mechanismStats: Record<string, {
        count: number;
        totalDuration: number;
        completed: number;
      }> = {};

      sessions?.forEach(session => {
        const mechanism = (session.plan as any)?.mechanism || 'undetermined';
        
        if (!mechanismStats[mechanism]) {
          mechanismStats[mechanism] = { count: 0, totalDuration: 0, completed: 0 };
        }

        mechanismStats[mechanism].count++;
        if (session.duration_sec) {
          mechanismStats[mechanism].totalDuration += session.duration_sec;
        }
        if (session.ended_at) {
          mechanismStats[mechanism].completed++;
        }
      });

      const mechanismArray = Object.entries(mechanismStats).map(([mechanism, stats]) => ({
        mechanism,
        sessionCount: stats.count,
        avgDuration: stats.count > 0 ? Math.round(stats.totalDuration / stats.count / 60) : 0,
        completionRate: stats.count > 0 
          ? Math.round((stats.completed / stats.count) * 100)
          : 0
      }));

      setMechanismData(mechanismArray);
    } catch (err: any) {
      console.error('Error fetching time series analytics:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return { timeSeriesData, mechanismData, isLoading, error, refetch: fetchTimeSeriesData };
};
