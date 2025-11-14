import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

        // Get today's sessions
        const { data: todaySessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('user_id', userId)
          .gte('started_at', `${today}T00:00:00`)
          .lte('started_at', `${today}T23:59:59`);

        const sessionIds = todaySessions?.map(s => s.id) || [];

        // Get today's events
        let todayCorrect = 0;
        let todayTotal = 0;

        if (sessionIds.length > 0) {
          const { data: todayEvents } = await supabase
            .from('exercise_events')
            .select('score')
            .in('session_id', sessionIds);

          todayTotal = todayEvents?.length || 0;
          todayCorrect = todayEvents?.filter(e => e.score > 0).length || 0;
        }

        // Get last week's accuracy
        const { data: lastWeekSessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('user_id', userId)
          .gte('started_at', lastWeek.toISOString())
          .lte('started_at', new Date().toISOString());

        const lastWeekSessionIds = lastWeekSessions?.map(s => s.id) || [];

        let weeklyAccuracy = 0;
        if (lastWeekSessionIds.length > 0) {
          const { data: weekEvents } = await supabase
            .from('exercise_events')
            .select('score')
            .in('session_id', lastWeekSessionIds);

          if (weekEvents && weekEvents.length > 0) {
            const weekCorrect = weekEvents.filter(e => e.score > 0).length;
            weeklyAccuracy = (weekCorrect / weekEvents.length) * 100;
          }
        }

        // Get two weeks ago accuracy for improvement calculation
        const { data: twoWeeksAgoSessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('user_id', userId)
          .gte('started_at', twoWeeksAgo.toISOString())
          .lte('started_at', lastWeek.toISOString());

        const twoWeeksAgoSessionIds = twoWeeksAgoSessions?.map(s => s.id) || [];

        let improvement = 0;
        if (twoWeeksAgoSessionIds.length > 0) {
          const { data: oldWeekEvents } = await supabase
            .from('exercise_events')
            .select('score')
            .in('session_id', twoWeeksAgoSessionIds);

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
  }, [userId]);

  return stats;
};
