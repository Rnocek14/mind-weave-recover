/**
 * useCueIndependence — Tracks cue independence over time
 * 
 * cue_independence = 1 - (weighted_avg_cue / max_cue)
 * 
 * Weights correct trials more heavily (independence on correct responses matters more).
 * Range: 0.0 (fully dependent) → 1.0 (fully independent)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const MAX_CUE_LEVEL = 3;

export interface CueIndependenceDataPoint {
  date: string;                // ISO date
  independenceScore: number;   // 0-1
  avgCueLevel: number;         // raw average
  trialCount: number;
  correctWithNoCue: number;    // trials correct at cue_level 0
  totalCorrect: number;
}

export interface UseCueIndependenceResult {
  dataPoints: CueIndependenceDataPoint[];
  currentScore: number | null;
  trend: 'improving' | 'stable' | 'declining' | 'insufficient';
  loading: boolean;
}

export function useCueIndependence(
  userId: string | undefined,
  options: { enabled?: boolean; lookbackDays?: number; profileId?: string } = {}
): UseCueIndependenceResult {
  const { enabled = true, lookbackDays = 90, profileId } = options;
  const [dataPoints, setDataPoints] = useState<CueIndependenceDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId || !enabled) { setLoading(false); return; }
    setLoading(true);

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - lookbackDays);

      // If scoped to a profile, prefetch session ids belonging to it
      let sessionIds: string[] | null = null;
      if (profileId) {
        const { data: sessRows } = await supabase
          .from('sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('profile_id', profileId)
          .gte('started_at', cutoff.toISOString());
        sessionIds = (sessRows || []).map((s) => s.id);
        if (sessionIds.length === 0) {
          setDataPoints([]); setLoading(false); return;
        }
      }

      let q = supabase
        .from('exercise_events')
        .select('score, cue_level, created_at, session_id!inner(user_id)')
        .eq('session_id.user_id', userId)
        .gte('created_at', cutoff.toISOString())
        .not('cue_level', 'is', null)
        .order('created_at', { ascending: true });
      if (sessionIds) q = q.in('session_id', sessionIds);
      const { data, error } = await q;

      if (error) throw error;
      if (!data || data.length === 0) { setDataPoints([]); setLoading(false); return; }

      // Group by date
      const byDate: Record<string, typeof data> = {};
      for (const row of data) {
        const date = row.created_at!.slice(0, 10);
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(row);
      }

      const points: CueIndependenceDataPoint[] = [];
      for (const date of Object.keys(byDate)) {
        const rows = byDate[date];
        if (rows.length < 5) continue;

        // Weight correct trials 2x for independence calculation
        // (being independent on correct trials matters more than being independent on errors)
        let weightedCueSum = 0;
        let weightSum = 0;
        let correctWithNoCue = 0;
        let totalCorrect = 0;

        for (const row of rows) {
          const isCorrect = (row.score ?? 0) > 0;
          const cue = row.cue_level ?? 0;
          const weight = isCorrect ? 2 : 1;
          
          weightedCueSum += cue * weight;
          weightSum += weight;

          if (isCorrect) {
            totalCorrect++;
            if (cue === 0) correctWithNoCue++;
          }
        }

        const weightedAvgCue = weightSum > 0 ? weightedCueSum / weightSum : 0;
        const independenceScore = 1 - (weightedAvgCue / MAX_CUE_LEVEL);

        points.push({
          date,
          independenceScore: Math.round(Math.max(0, Math.min(1, independenceScore)) * 1000) / 1000,
          avgCueLevel: Math.round((rows.reduce((s, r) => s + (r.cue_level ?? 0), 0) / rows.length) * 100) / 100,
          trialCount: rows.length,
          correctWithNoCue,
          totalCorrect,
        });
      }

      setDataPoints(points);
    } catch (err) {
      console.error('[useCueIndependence] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, enabled, lookbackDays, profileId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Current = last 7 days weighted average
  const recent = dataPoints.slice(-7);
  const currentScore = recent.length > 0
    ? Math.round((recent.reduce((s, d) => s + d.independenceScore * d.trialCount, 0) /
        recent.reduce((s, d) => s + d.trialCount, 0)) * 1000) / 1000
    : null;

  // Trend
  let trend: 'improving' | 'stable' | 'declining' | 'insufficient' = 'insufficient';
  if (dataPoints.length >= 6) {
    const mid = Math.floor(dataPoints.length / 2);
    const firstAvg = dataPoints.slice(0, mid).reduce((s, d) => s + d.independenceScore, 0) / mid;
    const secondAvg = dataPoints.slice(mid).reduce((s, d) => s + d.independenceScore, 0) / (dataPoints.length - mid);
    const delta = secondAvg - firstAvg;
    if (delta > 0.03) trend = 'improving';
    else if (delta < -0.03) trend = 'declining';
    else trend = 'stable';
  }

  return { dataPoints, currentScore, trend, loading };
}
