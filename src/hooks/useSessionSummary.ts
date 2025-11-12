import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SessionSummary {
  totalTrials: number;
  accuracy: number; // 0-1
  avgRtMs: number;
  medianRtMs: number;
  avgCueLevel: number;
  cueReduction: number; // positive = improvement
  startDifficulty: number;
  endDifficulty: number;
  errorBreakdown: {
    semantic_related: number;
    timeout: number;
    unrelated: number;
  };
  timeoutCount: number;
}

export const useSessionSummary = (sessionId: string | null) => {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc(
          'get_session_summary',
          { p_session_id: sessionId }
        );

        if (rpcError) throw rpcError;

        if (data && data.length > 0) {
          const row = data[0];
          
          // Parse error breakdown safely
          const errorBreakdown = typeof row.error_breakdown === 'object' && row.error_breakdown !== null
            ? row.error_breakdown as { semantic_related?: number; timeout?: number; unrelated?: number }
            : { semantic_related: 0, timeout: 0, unrelated: 0 };
          
          setSummary({
            totalTrials: Number(row.total_trials) || 0,
            accuracy: Number(row.accuracy) || 0,
            avgRtMs: row.avg_rt_ms || 0,
            medianRtMs: row.median_rt_ms || 0,
            avgCueLevel: Number(row.avg_cue_level) || 0,
            cueReduction: Number(row.cue_reduction) || 0,
            startDifficulty: row.start_difficulty || 1,
            endDifficulty: row.end_difficulty || 1,
            errorBreakdown: {
              semantic_related: Number(errorBreakdown.semantic_related) || 0,
              timeout: Number(errorBreakdown.timeout) || 0,
              unrelated: Number(errorBreakdown.unrelated) || 0,
            },
            timeoutCount: Number(row.timeout_count) || 0,
          });
        }
      } catch (e) {
        console.error('Error fetching session summary:', e);
        setError(e instanceof Error ? e.message : 'Failed to load summary');
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchSummary();
  }, [sessionId]);

  return { summary, loading, error };
};
