import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

interface CueEvent {
  created_at: string;
  target_word: string;
  cue_type_given: string | null;
  cue_trigger: string | null;
  cue_was_effective: boolean | null;
  time_to_success_after_cue_ms: number | null;
  audio_storage_path: string | null;
}

interface CueTelemetryStats {
  // Delivery metrics
  totalUtterances: number;
  cuesDelivered: number;
  cueDeliveryRate: number;
  
  // Trigger breakdown
  triggerBreakdown: {
    stall: number;
    consecutive_errors: number;
    user_request: number;
    unknown: number; // null trigger
  };
  
  // Effectiveness breakdown (only for delivered cues)
  effectivenessBreakdown: {
    effective: number;      // cue_was_effective = true
    ineffective: number;    // cue_was_effective = false
    ambiguous: number;      // cue_was_effective = null (>6s)
  };
  
  // Timing
  medianTimeToSuccess: number | null;
  avgTimeToSuccess: number | null;
  
  // Top targets where cues fire
  topCuedTargets: { target: string; count: number }[];
  
  // Top categories where cues fire
  topCuedCategories: { category: string; count: number }[];
  
  // Last 10 cue events (for debugging)
  recentCueEvents: CueEvent[];
  
  // Warning if we hit the limit
  hitQueryLimit: boolean;
}

const QUERY_LIMIT = 2000;

interface UseCueTelemetryOptions {
  daysBack?: number;
  enabled?: boolean;
}

export const useCueTelemetry = (
  userId: string | null | undefined,
  options: UseCueTelemetryOptions = {}
) => {
  const { daysBack = 7, enabled = true } = options;
  const activeProfileId = useActiveProfileId();
  const [stats, setStats] = useState<CueTelemetryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    // This function should only be called when enabled + userId are valid
    // The useEffect handles the gating
    try {
      setLoading(true);
      setError(null);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      // Fetch utterances with limit to protect performance
      let q = supabase
        .from('utterance_analyses')
        .select('cue_type_given, cue_trigger, cue_was_effective, time_to_success_after_cue_ms, target_word, category, created_at, audio_storage_path')
        .eq('user_id', userId)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(QUERY_LIMIT);
      if (activeProfileId) q = q.eq('profile_id', activeProfileId);
      const { data: utterances, error: fetchError } = await q;

      if (fetchError) throw fetchError;

      const hitQueryLimit = utterances?.length === QUERY_LIMIT;

      if (!utterances || utterances.length === 0) {
        setStats({
          totalUtterances: 0,
          cuesDelivered: 0,
          cueDeliveryRate: 0,
          triggerBreakdown: { stall: 0, consecutive_errors: 0, user_request: 0, unknown: 0 },
          effectivenessBreakdown: { effective: 0, ineffective: 0, ambiguous: 0 },
          medianTimeToSuccess: null,
          avgTimeToSuccess: null,
          topCuedTargets: [],
          topCuedCategories: [],
          recentCueEvents: [],
          hitQueryLimit: false,
        });
        setLoading(false);
        return;
      }

      // Count total and delivered cues
      const totalUtterances = utterances.length;
      const deliveredCues = utterances.filter(u => u.cue_type_given && u.cue_type_given !== 'none');
      const cuesDelivered = deliveredCues.length;
      const cueDeliveryRate = totalUtterances > 0 ? (cuesDelivered / totalUtterances) * 100 : 0;

      // Trigger breakdown (only for delivered cues)
      const triggerBreakdown = {
        stall: deliveredCues.filter(u => u.cue_trigger === 'stall').length,
        consecutive_errors: deliveredCues.filter(u => u.cue_trigger === 'consecutive_errors').length,
        user_request: deliveredCues.filter(u => u.cue_trigger === 'user_request').length,
        unknown: deliveredCues.filter(u => !u.cue_trigger).length,
      };

      // Effectiveness breakdown (only for delivered cues)
      const effectivenessBreakdown = {
        effective: deliveredCues.filter(u => u.cue_was_effective === true).length,
        ineffective: deliveredCues.filter(u => u.cue_was_effective === false).length,
        ambiguous: deliveredCues.filter(u => u.cue_was_effective === null).length,
      };

      // Time to success calculations (only where we have data)
      const timings = deliveredCues
        .map(u => u.time_to_success_after_cue_ms)
        .filter((t): t is number => t !== null && t > 0);
      
      let medianTimeToSuccess: number | null = null;
      let avgTimeToSuccess: number | null = null;
      
      if (timings.length > 0) {
        timings.sort((a, b) => a - b);
        const mid = Math.floor(timings.length / 2);
        medianTimeToSuccess = timings.length % 2 !== 0 
          ? timings[mid] 
          : (timings[mid - 1] + timings[mid]) / 2;
        avgTimeToSuccess = timings.reduce((a, b) => a + b, 0) / timings.length;
      }

      // Top cued targets
      const targetCounts: Record<string, number> = {};
      deliveredCues.forEach(u => {
        if (u.target_word) {
          targetCounts[u.target_word] = (targetCounts[u.target_word] || 0) + 1;
        }
      });
      const topCuedTargets = Object.entries(targetCounts)
        .map(([target, count]) => ({ target, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top cued categories
      const categoryCounts: Record<string, number> = {};
      deliveredCues.forEach(u => {
        if (u.category) {
          categoryCounts[u.category] = (categoryCounts[u.category] || 0) + 1;
        }
      });
      const topCuedCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Recent cue events (last 10 where cue was delivered)
      const recentCueEvents: CueEvent[] = deliveredCues.slice(0, 10).map(u => ({
        created_at: u.created_at,
        target_word: u.target_word,
        cue_type_given: u.cue_type_given,
        cue_trigger: u.cue_trigger,
        cue_was_effective: u.cue_was_effective,
        time_to_success_after_cue_ms: u.time_to_success_after_cue_ms,
        audio_storage_path: u.audio_storage_path,
      }));

      setStats({
        totalUtterances,
        cuesDelivered,
        cueDeliveryRate,
        triggerBreakdown,
        effectivenessBreakdown,
        medianTimeToSuccess,
        avgTimeToSuccess,
        topCuedTargets,
        topCuedCategories,
        recentCueEvents,
        hitQueryLimit,
      });

    } catch (err) {
      console.error('Failed to fetch cue telemetry:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userId, daysBack, enabled, activeProfileId]);

  useEffect(() => {
    if (!enabled || !userId) {
      setLoading(false);
      setStats(null);
      return;
    }
    fetchStats();
  }, [enabled, userId, fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
};
