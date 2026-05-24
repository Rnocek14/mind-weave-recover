/**
 * useSessionEndurance — Tracks cognitive endurance (within-session accuracy decay)
 * 
 * Compares accuracy in first half vs second half of each session.
 * endurance_ratio = second_half_accuracy / first_half_accuracy
 * 
 * Recovery signal: ratio trending toward 1.0 = better sustained performance.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export interface EnduranceDataPoint {
  sessionId: string;
  date: string;
  enduranceRatio: number;   // 0-1+, where 1.0 = no decay
  firstHalfAccuracy: number;
  secondHalfAccuracy: number;
  totalTrials: number;
}

export interface UseSessionEnduranceResult {
  dataPoints: EnduranceDataPoint[];
  currentRatio: number | null;
  trend: 'improving' | 'stable' | 'declining' | 'insufficient';
  loading: boolean;
}

export function useSessionEndurance(
  userId: string | undefined,
  options: { enabled?: boolean; lookbackDays?: number } = {}
): UseSessionEnduranceResult {
  const { enabled = true, lookbackDays = 90 } = options;
  const [dataPoints, setDataPoints] = useState<EnduranceDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const activeProfileId = useActiveProfileId();

  const fetch = useCallback(async () => {
    if (!userId || !enabled) { setLoading(false); return; }
    setLoading(true);

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - lookbackDays);

      // Get sessions with their trials ordered by trial_index
      let sq = supabase
        .from('sessions')
        .select('id, started_at')
        .eq('user_id', userId)
        .gte('started_at', cutoff.toISOString())
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: true });
      if (activeProfileId) sq = sq.eq('profile_id', activeProfileId);
      const { data: sessions, error: sessErr } = await sq;

      if (sessErr) throw sessErr;
      if (!sessions || sessions.length === 0) { setDataPoints([]); setLoading(false); return; }

      const sessionIds = sessions.map(s => s.id);

      // Fetch all exercise events for these sessions
      const { data: events, error: evErr } = await supabase
        .from('exercise_events')
        .select('session_id, score, trial_index, created_at')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true });

      if (evErr) throw evErr;
      if (!events || events.length === 0) { setDataPoints([]); setLoading(false); return; }

      // Group by session
      const bySession: Record<string, typeof events> = {};
      for (const ev of events) {
        if (!bySession[ev.session_id]) bySession[ev.session_id] = [];
        bySession[ev.session_id].push(ev);
      }

      const points: EnduranceDataPoint[] = [];
      const sessionDateMap: Record<string, string> = {};
      for (const s of sessions) { sessionDateMap[s.id] = s.started_at ?? ''; }

      for (const sessionId of Object.keys(bySession)) {
        const trials = bySession[sessionId];
        if (trials.length < 6) continue; // need enough trials to split meaningfully

        const mid = Math.floor(trials.length / 2);
        const firstHalf = trials.slice(0, mid);
        const secondHalf = trials.slice(mid);

        const firstAcc = firstHalf.filter(t => (t.score ?? 0) > 0).length / firstHalf.length;
        const secondAcc = secondHalf.filter(t => (t.score ?? 0) > 0).length / secondHalf.length;

        // Avoid division by zero
        const ratio = firstAcc > 0 ? Math.min(1.5, secondAcc / firstAcc) : (secondAcc > 0 ? 1.5 : 1.0);

        points.push({
          sessionId,
          date: (sessionDateMap[sessionId] ?? '').slice(0, 10),
          enduranceRatio: Math.round(ratio * 100) / 100,
          firstHalfAccuracy: Math.round(firstAcc * 100) / 100,
          secondHalfAccuracy: Math.round(secondAcc * 100) / 100,
          totalTrials: trials.length,
        });
      }

      setDataPoints(points);
    } catch (err) {
      console.error('[useSessionEndurance] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, enabled, lookbackDays, activeProfileId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Current = average of last 5 sessions
  const recent = dataPoints.slice(-5);
  const currentRatio = recent.length > 0
    ? Math.round((recent.reduce((s, d) => s + d.enduranceRatio, 0) / recent.length) * 100) / 100
    : null;

  // Trend
  let trend: 'improving' | 'stable' | 'declining' | 'insufficient' = 'insufficient';
  if (dataPoints.length >= 6) {
    const mid = Math.floor(dataPoints.length / 2);
    const firstAvg = dataPoints.slice(0, mid).reduce((s, d) => s + d.enduranceRatio, 0) / mid;
    const secondAvg = dataPoints.slice(mid).reduce((s, d) => s + d.enduranceRatio, 0) / (dataPoints.length - mid);
    const delta = secondAvg - firstAvg;
    if (delta > 0.05) trend = 'improving';
    else if (delta < -0.05) trend = 'declining';
    else trend = 'stable';
  }

  return { dataPoints, currentRatio, trend, loading };
}
