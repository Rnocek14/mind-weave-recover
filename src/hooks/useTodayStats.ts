import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export interface TodayStats {
  correct: number;
  total: number;
  weeklyAccuracy: number;
  improvement: number;
}

/**
 * Hook to fetch today's exercise statistics for confidence boost display
 */
export const useTodayStats = (userId: string | null) => {
  const activeProfileId = useActiveProfileId();
  const [stats, setStats] = useState<TodayStats>({
    correct: 0,
    total: 0,
    weeklyAccuracy: 0,
    improvement: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) return;

      try {
        const today = new Date().toISOString().split('T')[0];
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const buildSessionsQuery = (gte: string, lte: string) => {
          let q = supabase
            .from('sessions')
            .select('id')
            .eq('user_id', userId)
            .gte('started_at', gte)
            .lte('started_at', lte);
          if (activeProfileId) q = q.eq('profile_id', activeProfileId);
          return q;
        };

        const buildEventsQuery = (sessionIds: string[]) => {
          let q = supabase
            .from('exercise_events')
            .select('score')
            .in('session_id', sessionIds);
          if (activeProfileId) q = q.eq('profile_id', activeProfileId);
          return q;
        };

        // Today
        const { data: todaySessions } = await buildSessionsQuery(`${today}T00:00:00`, `${today}T23:59:59`);
        const sessionIds = todaySessions?.map(s => s.id) || [];

        let todayCorrect = 0;
        let todayTotal = 0;
        if (sessionIds.length > 0) {
          const { data: todayEvents } = await buildEventsQuery(sessionIds);
          todayTotal = todayEvents?.length || 0;
          todayCorrect = todayEvents?.filter(e => e.score > 0).length || 0;
        }

        // Last week
        const { data: lastWeekSessions } = await buildSessionsQuery(lastWeek.toISOString(), new Date().toISOString());
        const lastWeekSessionIds = lastWeekSessions?.map(s => s.id) || [];

        let weeklyAccuracy = 0;
        if (lastWeekSessionIds.length > 0) {
          const { data: weekEvents } = await buildEventsQuery(lastWeekSessionIds);
          if (weekEvents && weekEvents.length > 0) {
            const weekCorrect = weekEvents.filter(e => e.score > 0).length;
            weeklyAccuracy = (weekCorrect / weekEvents.length) * 100;
          }
        }

        // Two weeks ago
        const { data: twoWeeksAgoSessions } = await buildSessionsQuery(twoWeeksAgo.toISOString(), lastWeek.toISOString());
        const twoWeeksAgoSessionIds = twoWeeksAgoSessions?.map(s => s.id) || [];

        let improvement = 0;
        if (twoWeeksAgoSessionIds.length > 0) {
          const { data: oldWeekEvents } = await buildEventsQuery(twoWeeksAgoSessionIds);
          if (oldWeekEvents && oldWeekEvents.length > 0) {
            const oldWeekCorrect = oldWeekEvents.filter(e => e.score > 0).length;
            const oldWeekAccuracy = (oldWeekCorrect / oldWeekEvents.length) * 100;
            improvement = weeklyAccuracy - oldWeekAccuracy;
          }
        }

        setStats({
          correct: todayCorrect,
          total: todayTotal,
          weeklyAccuracy,
          improvement
        });
      } catch (error) {
        console.error('Error fetching today stats:', error);
      }
    };

    fetchStats();
  }, [userId, activeProfileId]);

  return stats;
};
