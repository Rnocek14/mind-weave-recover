import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export interface CaregiverSummary {
  totalSessions: number;
  completedSessions: number;
  redFlags: number;
  orangeFlags: number;
  yellowFlags: number;
  interventionsCount: number;
  acceptanceRate: number;
  avgAccuracy: number;
  totalMinutes: number;
}

export interface SessionFlag {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  engagement_summary: any;
  severity: 'red' | 'orange' | 'yellow' | 'green';
  interventions: Array<{
    id: string;
    trigger_type: string;
    intervention: string;
    user_action: string | null;
    trigger_data: any;
    created_at: string;
  }>;
  summary: any;
}

export const useCaregiverAnalytics = (userId: string | null, daysBack: number = 30) => {
  const activeProfileId = useActiveProfileId();
  const [summary, setSummary] = useState<CaregiverSummary | null>(null);
  const [flaggedSessions, setFlaggedSessions] = useState<SessionFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        // Step 1: Fetch recent sessions
        let sessionsQuery = supabase
          .from('sessions')
          .select('id, started_at, ended_at, duration_sec, engagement_summary, summary')
          .eq('user_id', userId)
          .gte('started_at', startDate.toISOString())
          .order('started_at', { ascending: false });
        if (activeProfileId) sessionsQuery = sessionsQuery.eq('profile_id', activeProfileId);
        const { data: sessions, error: sessionError } = await sessionsQuery;

        if (sessionError) throw sessionError;

        const sessionIds = sessions?.map(s => s.id) || [];

        // Step 2: Fetch interventions for those sessions
        let intQuery = supabase
          .from('engagement_interventions')
          .select('*')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false });
        if (activeProfileId) intQuery = intQuery.eq('profile_id', activeProfileId);
        const { data: interventions, error: interventionError } = await intQuery;

        if (interventionError) throw interventionError;

        // Step 3: Categorize sessions by severity
        const flagged: SessionFlag[] = [];
        let redCount = 0;
        let orangeCount = 0;
        let yellowCount = 0;
        let totalAccuracy = 0;
        let sessionWithAccuracy = 0;
        let totalMinutes = 0;

        sessions?.forEach(session => {
          const engagementSummary = (session.engagement_summary as any) || {};
          const sessionInterventions = interventions?.filter(i => i.session_id === session.id) || [];
          
          // Determine severity
          let severity: 'red' | 'orange' | 'yellow' | 'green' = 'green';
          
          const fatigue = engagementSummary.fatigue || 'none';
          const frustration = engagementSummary.frustration || 'none';
          const quitEarly = session.ended_at && session.duration_sec && session.duration_sec < 300; // Less than 5 minutes

          if (fatigue === 'high' || quitEarly) {
            severity = 'red';
            redCount++;
          } else if (frustration === 'high' || sessionInterventions.length >= 3) {
            severity = 'orange';
            orangeCount++;
          } else if (frustration === 'medium' || fatigue === 'medium' || sessionInterventions.length > 0) {
            severity = 'yellow';
            yellowCount++;
          }

          // Only add flagged sessions (not green)
          if (severity !== 'green') {
            flagged.push({
              ...session,
              severity,
              interventions: sessionInterventions
            });
          }

          // Accumulate stats
          const sessionSummary = session.summary as any;
          if (sessionSummary?.accuracy !== undefined) {
            totalAccuracy += sessionSummary.accuracy;
            sessionWithAccuracy++;
          }
          if (session.duration_sec) {
            totalMinutes += session.duration_sec / 60;
          }
        });

        // Step 4: Calculate summary stats
        const total = sessions?.length || 0;
        const completed = sessions?.filter(s => s.ended_at !== null).length || 0;
        const interventionCount = interventions?.length || 0;
        const acceptedCount = interventions?.filter(i => i.user_action === 'accepted').length || 0;
        const actedCount = interventions?.filter(i => i.user_action !== null).length || 0;

        setSummary({
          totalSessions: total,
          completedSessions: completed,
          redFlags: redCount,
          orangeFlags: orangeCount,
          yellowFlags: yellowCount,
          interventionsCount: interventionCount,
          acceptanceRate: actedCount > 0 ? acceptedCount / actedCount : 0,
          avgAccuracy: sessionWithAccuracy > 0 ? totalAccuracy / sessionWithAccuracy : 0,
          totalMinutes: Math.round(totalMinutes)
        });

        setFlaggedSessions(flagged);
      } catch (err) {
        console.error('Error fetching caregiver analytics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [userId, daysBack, activeProfileId]);

  return { summary, flaggedSessions, isLoading, error };
};
