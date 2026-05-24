import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay, subWeeks, parseISO } from 'date-fns';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export interface DaySession {
  date: Date;
  hasSession: boolean;
  sessionCount: number;
}

export interface WeeklyStats {
  weekStart: Date;
  weekEnd: Date;
  completedDays: number;
  totalDays: number;
  completionRate: number;
}

export const useSessionAdherence = (userId: string | null, weeksToShow: number = 4) => {
  const [days, setDays] = useState<DaySession[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const activeProfileId = useActiveProfileId();

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchAdherence = async () => {
      const endDate = new Date();
      const startDate = subWeeks(endDate, weeksToShow);

      let sq = supabase
        .from('sessions')
        .select('started_at')
        .eq('user_id', userId)
        .gte('started_at', startDate.toISOString())
        .order('started_at', { ascending: true });
      if (activeProfileId) sq = sq.eq('profile_id', activeProfileId);
      const { data: sessions, error } = await sq;

      if (error || !sessions) {
        setLoading(false);
        return;
      }

      // Get all days in range
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });

      // Create map of session dates
      const sessionDates = new Map<string, number>();
      sessions.forEach(session => {
        const dateKey = format(parseISO(session.started_at), 'yyyy-MM-dd');
        sessionDates.set(dateKey, (sessionDates.get(dateKey) || 0) + 1);
      });

      // Build day sessions
      const daySessions: DaySession[] = allDays.map(date => ({
        date,
        hasSession: sessionDates.has(format(date, 'yyyy-MM-dd')),
        sessionCount: sessionDates.get(format(date, 'yyyy-MM-dd')) || 0
      }));

      setDays(daySessions);

      // Calculate weekly stats
      const weeks: WeeklyStats[] = [];
      for (let i = 0; i < weeksToShow; i++) {
        const weekEnd = subWeeks(endDate, i);
        const weekStart = startOfWeek(weekEnd, { weekStartsOn: 1 }); // Monday start
        const weekEndDate = endOfWeek(weekEnd, { weekStartsOn: 1 });

        const weekDays = daySessions.filter(day => 
          day.date >= weekStart && day.date <= weekEndDate
        );

        const completedDays = weekDays.filter(d => d.hasSession).length;

        weeks.unshift({
          weekStart,
          weekEnd: weekEndDate,
          completedDays,
          totalDays: 7,
          completionRate: Math.round((completedDays / 7) * 100)
        });
      }

      setWeeklyStats(weeks);
      setLoading(false);
    };

    fetchAdherence();
  }, [userId, weeksToShow, activeProfileId]);

  return { days, weeklyStats, loading };
};
