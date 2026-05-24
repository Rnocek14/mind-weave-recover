/**
 * useErrorQualityScore — Tracks error pattern evolution over time
 * 
 * Maps error types to a severity-weighted quality score:
 *   no_response (0) → neologism (1) → unrelated (2) → semantic (3) → phonemic (4) → circumlocution (5) → correct (6)
 * 
 * Recovery signal: score trending upward = errors shifting from severe to mild.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

const ERROR_SEVERITY: Record<string, number> = {
  no_response: 0,
  neologism: 1,
  unrelated: 2,
  semantic_paraphasia: 3,
  semantic_related: 3,
  semantic: 3,
  phonemic_paraphasia: 4,
  phonemic: 4,
  phonological: 4,
  circumlocution: 5,
  attempted: 3,    // partial attempt ≈ semantic level
  self_corrected: 5.5, // almost correct
  correct: 6,
};
const MAX_SEVERITY = 6;

export interface ErrorQualityDataPoint {
  date: string;       // ISO date
  qualityScore: number; // 0-1
  trialCount: number;
  errorCounts: Record<string, number>;
}

export interface UseErrorQualityResult {
  dataPoints: ErrorQualityDataPoint[];
  currentScore: number | null;
  trend: 'improving' | 'stable' | 'declining' | 'insufficient';
  loading: boolean;
}

function getErrorPoints(errorType: string | null, isCorrect: boolean): number {
  if (isCorrect) return 6;
  if (!errorType) return 2; // unknown error ≈ unrelated
  const key = errorType.toLowerCase().trim();
  return ERROR_SEVERITY[key] ?? 2;
}

export function useErrorQualityScore(
  userId: string | undefined,
  options: { enabled?: boolean; lookbackDays?: number } = {}
): UseErrorQualityResult {
  const { enabled = true, lookbackDays = 90 } = options;
  const activeProfileId = useActiveProfileId();
  const [dataPoints, setDataPoints] = useState<ErrorQualityDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId || !enabled) { setLoading(false); return; }
    setLoading(true);

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - lookbackDays);

      let q = supabase
        .from('utterance_analyses')
        .select('is_correct, error_type, created_at')
        .eq('user_id', userId)
        .gte('created_at', cutoff.toISOString())
        .order('created_at', { ascending: true });
      if (activeProfileId) q = q.eq('profile_id', activeProfileId);
      const { data, error } = await q;

      if (error) throw error;
      if (!data || data.length === 0) { setDataPoints([]); setLoading(false); return; }

      // Group by date
      const byDate: Record<string, typeof data> = {};
      for (const row of data) {
        const date = row.created_at.slice(0, 10);
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(row);
      }

      // Compute per-date quality score
      const points: ErrorQualityDataPoint[] = [];
      for (const date of Object.keys(byDate)) {
        const rows = byDate[date];
        if (rows.length < 3) continue; // need minimum trials

        let totalPoints = 0;
        const errorCounts: Record<string, number> = {};
        
        for (const row of rows) {
          totalPoints += getErrorPoints(row.error_type, row.is_correct ?? false);
          const key = row.is_correct ? 'correct' : (row.error_type || 'unknown');
          errorCounts[key] = (errorCounts[key] || 0) + 1;
        }

        points.push({
          date,
          qualityScore: totalPoints / (rows.length * MAX_SEVERITY),
          trialCount: rows.length,
          errorCounts,
        });
      }

      setDataPoints(points);
    } catch (err) {
      console.error('[useErrorQualityScore] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, enabled, lookbackDays, activeProfileId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Current score = last 7 days average
  const recent = dataPoints.slice(-7);
  const currentScore = recent.length > 0
    ? recent.reduce((s, d) => s + d.qualityScore, 0) / recent.length
    : null;

  // Trend: compare first half to second half
  let trend: 'improving' | 'stable' | 'declining' | 'insufficient' = 'insufficient';
  if (dataPoints.length >= 6) {
    const mid = Math.floor(dataPoints.length / 2);
    const firstHalf = dataPoints.slice(0, mid);
    const secondHalf = dataPoints.slice(mid);
    const firstAvg = firstHalf.reduce((s, d) => s + d.qualityScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, d) => s + d.qualityScore, 0) / secondHalf.length;
    const delta = secondAvg - firstAvg;
    if (delta > 0.05) trend = 'improving';
    else if (delta < -0.05) trend = 'declining';
    else trend = 'stable';
  }

  return { dataPoints, currentScore, trend, loading };
}
