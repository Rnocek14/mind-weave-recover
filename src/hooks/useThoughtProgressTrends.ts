import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { startOfWeek, subWeeks, format } from 'date-fns';

export interface ThoughtProgressTrends {
  // This week
  thoughtsCompleted: number;
  thoughtsAttempted: number;
  avgLatencyMs: number | null;
  avgNarrowingLevel: number;
  trailingOffRate: number; // % of incomplete utterances
  
  // Last week (for comparison)
  lastWeekCompleted: number;
  lastWeekAttempted: number;
  lastWeekAvgLatency: number | null;
  lastWeekTrailingOffRate: number;
  
  // Best themes/anchors
  bestThemes: string[];
  
  // Trends
  completionTrend: 'improving' | 'stable' | 'declining' | null;
  latencyTrend: 'improving' | 'stable' | 'declining' | null;
}

export function useThoughtProgressTrends() {
  const { activeProfile } = useProfile();
  const [trends, setTrends] = useState<ThoughtProgressTrends | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProfile?.id) return;

    const fetchTrends = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
        const lastWeekStart = subWeeks(thisWeekStart, 1);

        // Fetch this week's data
        const { data: thisWeekData } = await supabase
          .from('thought_decision_logs' as any)
          .select('*')
          .eq('profile_id', activeProfile.id)
          .gte('log_date', format(thisWeekStart, 'yyyy-MM-dd'))
          .not('outcome_did_speak', 'is', null);

        // Fetch last week's data
        const { data: lastWeekData } = await supabase
          .from('thought_decision_logs' as any)
          .select('*')
          .eq('profile_id', activeProfile.id)
          .gte('log_date', format(lastWeekStart, 'yyyy-MM-dd'))
          .lt('log_date', format(thisWeekStart, 'yyyy-MM-dd'))
          .not('outcome_did_speak', 'is', null);

        // Calculate this week metrics
        const thisWeek = (thisWeekData || []) as any[];
        const lastWeek = (lastWeekData || []) as any[];

        const thoughtsAttempted = thisWeek.length;
        const thoughtsCompleted = thisWeek.filter(d => d.outcome_utterance_complete).length;
        
        const latencies = thisWeek
          .filter(d => d.outcome_latency_ms != null && d.outcome_latency_ms > 0)
          .map(d => d.outcome_latency_ms);
        const avgLatencyMs = latencies.length > 0 
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
          : null;

        const narrowingLevels = thisWeek
          .filter(d => d.narrowing_levels_used?.length > 0)
          .flatMap(d => d.narrowing_levels_used);
        const avgNarrowingLevel = narrowingLevels.length > 0
          ? narrowingLevels.reduce((a: number, b: number) => a + b, 0) / narrowingLevels.length
          : 0;

        const incompleteCount = thisWeek.filter(d => 
          d.outcome_did_speak && !d.outcome_utterance_complete
        ).length;
        const trailingOffRate = thoughtsAttempted > 0 
          ? incompleteCount / thoughtsAttempted 
          : 0;

        // Last week metrics
        const lastWeekAttempted = lastWeek.length;
        const lastWeekCompleted = lastWeek.filter(d => d.outcome_utterance_complete).length;
        
        const lastWeekLatencies = lastWeek
          .filter(d => d.outcome_latency_ms != null && d.outcome_latency_ms > 0)
          .map(d => d.outcome_latency_ms);
        const lastWeekAvgLatency = lastWeekLatencies.length > 0 
          ? lastWeekLatencies.reduce((a, b) => a + b, 0) / lastWeekLatencies.length 
          : null;

        const lastWeekIncomplete = lastWeek.filter(d => 
          d.outcome_did_speak && !d.outcome_utterance_complete
        ).length;
        const lastWeekTrailingOffRate = lastWeekAttempted > 0 
          ? lastWeekIncomplete / lastWeekAttempted 
          : 0;

        // Find best themes (themes with highest completion rate)
        const themeStats: Record<string, { completed: number; total: number }> = {};
        thisWeek.forEach(d => {
          if (!d.prompt_theme) return;
          if (!themeStats[d.prompt_theme]) {
            themeStats[d.prompt_theme] = { completed: 0, total: 0 };
          }
          themeStats[d.prompt_theme].total++;
          if (d.outcome_utterance_complete) {
            themeStats[d.prompt_theme].completed++;
          }
        });
        
        const bestThemes = Object.entries(themeStats)
          .filter(([, stats]) => stats.total >= 2)
          .sort((a, b) => (b[1].completed / b[1].total) - (a[1].completed / a[1].total))
          .slice(0, 3)
          .map(([theme]) => theme);

        // Calculate trends
        let completionTrend: ThoughtProgressTrends['completionTrend'] = null;
        if (thoughtsAttempted >= 3 && lastWeekAttempted >= 3) {
          const thisRate = thoughtsCompleted / thoughtsAttempted;
          const lastRate = lastWeekCompleted / lastWeekAttempted;
          const diff = thisRate - lastRate;
          if (diff > 0.1) completionTrend = 'improving';
          else if (diff < -0.1) completionTrend = 'declining';
          else completionTrend = 'stable';
        }

        let latencyTrend: ThoughtProgressTrends['latencyTrend'] = null;
        if (avgLatencyMs && lastWeekAvgLatency) {
          const improvement = lastWeekAvgLatency - avgLatencyMs;
          const percentChange = improvement / lastWeekAvgLatency;
          if (percentChange > 0.15) latencyTrend = 'improving';
          else if (percentChange < -0.15) latencyTrend = 'declining';
          else latencyTrend = 'stable';
        }

        setTrends({
          thoughtsCompleted,
          thoughtsAttempted,
          avgLatencyMs,
          avgNarrowingLevel,
          trailingOffRate,
          lastWeekCompleted,
          lastWeekAttempted,
          lastWeekAvgLatency,
          lastWeekTrailingOffRate,
          bestThemes,
          completionTrend,
          latencyTrend,
        });
      } catch (error) {
        console.error('Error fetching thought progress trends:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, [activeProfile?.id]);

  return { trends, loading };
}
