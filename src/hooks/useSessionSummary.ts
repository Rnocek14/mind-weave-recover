import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * A missing measurement is not a measured zero. Preserve the distinction
 * through the RPC read, React state, and the patient-facing summary card.
 */
export interface SessionSummary {
  totalTrials: number;
  /** Fraction in [0,1] when measured; null when the RPC has no accuracy. */
  accuracy: number | null;
  avgRtMs: number | null;
  medianRtMs: number | null;
  avgCueLevel: number | null;
  cueReduction: number | null;
  startDifficulty: number | null;
  endDifficulty: number | null;
  errorBreakdown: {
    semantic_related: number;
    timeout: number;
    unrelated: number;
  };
  timeoutCount: number;
}

interface SummaryState {
  /** The session this snapshot actually belongs to; never reuse across IDs. */
  forSessionId: string | null;
  summary: SessionSummary | null;
  loading: boolean;
  error: string | null;
}

function measuredNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  // PostgreSQL numeric columns may arrive as strings. Empty strings and
  // non-numeric garbage are not evidence of a measured zero.
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export const useSessionSummary = (sessionId: string | null) => {
  const [state, setState] = useState<SummaryState>(() => ({
    forSessionId: sessionId,
    summary: null,
    loading: sessionId !== null,
    error: null,
  }));

  useEffect(() => {
    let active = true;
    // Clear the previous patient/session before starting a new RPC read.
    setState({ forSessionId: sessionId, summary: null, loading: !!sessionId, error: null });
    if (!sessionId) return () => { active = false; };

    const fetchSummary = async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc(
          'get_session_summary',
          { p_session_id: sessionId },
        );
        if (rpcError) throw rpcError;
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('Session summary evidence unavailable');
        }

        const row = data[0];
        const rawBreakdown = typeof row.error_breakdown === 'object' && row.error_breakdown !== null
          ? row.error_breakdown as { semantic_related?: number; timeout?: number; unrelated?: number }
          : {};

        const summary: SessionSummary = {
          totalTrials: measuredNumber(row.total_trials) ?? 0,
          accuracy: measuredNumber(row.accuracy),
          avgRtMs: measuredNumber(row.avg_rt_ms),
          medianRtMs: measuredNumber(row.median_rt_ms),
          avgCueLevel: measuredNumber(row.avg_cue_level),
          cueReduction: measuredNumber(row.cue_reduction),
          startDifficulty: measuredNumber(row.start_difficulty),
          endDifficulty: measuredNumber(row.end_difficulty),
          errorBreakdown: {
            semantic_related: measuredNumber(rawBreakdown.semantic_related) ?? 0,
            timeout: measuredNumber(rawBreakdown.timeout) ?? 0,
            unrelated: measuredNumber(rawBreakdown.unrelated) ?? 0,
          },
          timeoutCount: measuredNumber(row.timeout_count) ?? 0,
        };

        if (active) setState({ forSessionId: sessionId, summary, loading: false, error: null });
      } catch (e) {
        console.error('Error fetching session summary:', e);
        if (active) setState({
          forSessionId: sessionId,
          summary: null,
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load summary',
        });
      }
    };

    void fetchSummary();
    return () => { active = false; };
  }, [sessionId]);

  // Effects run after rendering. Scope the public return as well, so a quick
  // profile switch cannot expose the previous patient's result for one frame.
  const belongsToSelectedSession = state.forSessionId === sessionId;
  return {
    summary: belongsToSelectedSession ? state.summary : null,
    loading: belongsToSelectedSession ? state.loading : sessionId !== null,
    error: belongsToSelectedSession ? state.error : null,
  };
};
