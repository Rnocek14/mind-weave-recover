import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export interface EngagementIntervention {
  id: string;
  session_id: string;
  trigger_type: string;
  intervention: string;
  user_action: string | null;
  trigger_data: Record<string, any>;
  created_at: string;
}

export interface InterventionStats {
  total: number;
  byType: Record<string, number>;
  byIntervention: Record<string, number>;
  acceptanceRate: number;
  dismissalRate: number;
}

/**
 * Hook for fetching and analyzing engagement interventions
 */
export const useEngagementInterventions = (userId: string, daysBack: number = 30) => {
  const [interventions, setInterventions] = useState<EngagementIntervention[]>([]);
  const [stats, setStats] = useState<InterventionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeProfileId = useActiveProfileId();

  useEffect(() => {
    const fetchInterventions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        // Fetch interventions for user's sessions
        let sq = supabase
          .from('sessions')
          .select('id')
          .eq('user_id', userId)
          .gte('started_at', startDate.toISOString());
        if (activeProfileId) sq = sq.eq('profile_id', activeProfileId);
        const { data: sessionData, error: sessionError } = await sq;

        if (sessionError) throw sessionError;

        const sessionIds = sessionData?.map(s => s.id) || [];

        if (sessionIds.length === 0) {
          setInterventions([]);
          setStats(null);
          setIsLoading(false);
          return;
        }

        // Fetch interventions for those sessions (also profile-scoped for defense-in-depth)
        let iq: any = supabase
          .from('engagement_interventions')
          .select('*')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false });
        if (activeProfileId) iq = iq.eq('profile_id', activeProfileId);
        const { data, error: interventionError } = await iq;

        if (interventionError) throw interventionError;

        const interventionsData = (data || []) as EngagementIntervention[];
        setInterventions(interventionsData);

        // Calculate stats
        const stats: InterventionStats = {
          total: interventionsData.length,
          byType: {},
          byIntervention: {},
          acceptanceRate: 0,
          dismissalRate: 0
        };

        let acceptedCount = 0;
        let dismissedCount = 0;
        let actedUponCount = 0;

        interventionsData.forEach(intervention => {
          // Count by trigger type
          stats.byType[intervention.trigger_type] = 
            (stats.byType[intervention.trigger_type] || 0) + 1;
          
          // Count by intervention type
          stats.byIntervention[intervention.intervention] = 
            (stats.byIntervention[intervention.intervention] || 0) + 1;
          
          // Count user actions
          if (intervention.user_action === 'accepted') {
            acceptedCount++;
            actedUponCount++;
          } else if (intervention.user_action === 'dismissed') {
            dismissedCount++;
            actedUponCount++;
          }
        });

        if (actedUponCount > 0) {
          stats.acceptanceRate = acceptedCount / actedUponCount;
          stats.dismissalRate = dismissedCount / actedUponCount;
        }

        setStats(stats);
      } catch (err) {
        console.error('Error fetching engagement interventions:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchInterventions();
    }
  }, [userId, daysBack, activeProfileId]);

  /**
   * Get interventions for a specific session
   */
  const getSessionInterventions = (sessionId: string): EngagementIntervention[] => {
    return interventions.filter(i => i.session_id === sessionId);
  };

  /**
   * Get most recent intervention
   */
  const getMostRecentIntervention = (): EngagementIntervention | null => {
    return interventions.length > 0 ? interventions[0] : null;
  };

  return {
    interventions,
    stats,
    isLoading,
    error,
    getSessionInterventions,
    getMostRecentIntervention
  };
};
