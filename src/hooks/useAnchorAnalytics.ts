/**
 * useAnchorAnalytics — Surface anchoring quality metrics from session data
 * 
 * Reads anchor analytics persisted in sessions.engagement_summary
 * to provide dashboard-level visibility into Maya's anchoring behavior.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export interface AnchorAnalyticsSummary {
  /** Across all recent sessions */
  totalTurns: number;
  anchorRequiredTurns: number;
  anchorPassRate: number;        // 0-100
  preferredAnchorRate: number;   // 0-100
  regenerationRate: number;      // 0-100
  /** Per-session breakdown */
  sessions: SessionAnchorData[];
}

interface SessionAnchorData {
  sessionId: string;
  date: string;
  anchorPassRate: number;
  preferredAnchorRate: number;
  regenerationRate: number;
  totalTurns: number;
}

export function useAnchorAnalytics(userId: string | undefined, options?: { daysBack?: number; enabled?: boolean }) {
  const daysBack = options?.daysBack ?? 14;
  const enabled = options?.enabled !== false && !!userId;
  const activeProfileId = useActiveProfileId();

  return useQuery({
    queryKey: ['anchor-analytics', userId, activeProfileId, daysBack],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AnchorAnalyticsSummary> => {
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
      
      let sq = supabase
        .from('sessions')
        .select('id, started_at, engagement_summary')
        .eq('user_id', userId!)
        .not('ended_at', 'is', null)
        .gte('started_at', since)
        .order('started_at', { ascending: false });
      if (activeProfileId) sq = sq.eq('profile_id', activeProfileId);
      const { data: sessions } = await sq;

      if (!sessions?.length) {
        return { totalTurns: 0, anchorRequiredTurns: 0, anchorPassRate: 0, preferredAnchorRate: 0, regenerationRate: 0, sessions: [] };
      }

      const sessionData: SessionAnchorData[] = [];
      let totalTurns = 0;
      let totalRequired = 0;
      let totalPassed = 0;
      let totalPreferred = 0;
      let totalRegens = 0;

      for (const s of sessions) {
        const es = s.engagement_summary as any;
        if (!es?.anchor_pass_rate && es?.anchor_pass_rate !== 0) continue;

        const turns = es.total_turns || 0;
        const required = es.anchor_required_turns || 0;
        const passed = es.anchor_pass_count || 0;
        const preferred = es.preferred_anchor_hits || 0;
        const regens = es.regeneration_count || 0;

        totalTurns += turns;
        totalRequired += required;
        totalPassed += passed;
        totalPreferred += preferred;
        totalRegens += regens;

        sessionData.push({
          sessionId: s.id,
          date: s.started_at || '',
          anchorPassRate: es.anchor_pass_rate,
          preferredAnchorRate: es.preferred_anchor_rate || 0,
          regenerationRate: es.regeneration_rate || 0,
          totalTurns: turns,
        });
      }

      return {
        totalTurns,
        anchorRequiredTurns: totalRequired,
        anchorPassRate: totalRequired > 0 ? Math.round((totalPassed / totalRequired) * 100) : 0,
        preferredAnchorRate: totalRequired > 0 ? Math.round((totalPreferred / totalRequired) * 100) : 0,
        regenerationRate: totalTurns > 0 ? Math.round((totalRegens / totalTurns) * 100) : 0,
        sessions: sessionData,
      };
    },
  });
}
