import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { format, subDays, startOfDay } from 'date-fns';
import {
  isScorableTaskAttempt,
  reduceAccuracy,
  type ScoredRow,
} from '@/lib/sessionAccuracySummary';

export interface DailyTrend {
  date: string;
  displayDate: string;
  timeMinutes: number;
  /** Task accuracy (0-100), not ASR recognition quality. */
  accuracy: number;
  /** Canonically scorable clinical attempts, excluding invalid/manual/diagnostic events. */
  totalTrials: number;
  /** Fully correct (100-point) scorable attempts. */
  correctTrials: number;
}

/**
 * Seven-day chart sourced from persisted completed sessions. Never silently
 * advertise a 0% score or fabricated recovery trend when a data query fails.
 */
export function useWeeklyTrends() {
  const { activeProfile } = useProfile();
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!activeProfile?.id) {
      setTrends([]);
      setError(null);
      setLoading(false);
      return () => { active = false; };
    }

    const fetchWeeklyTrends = async () => {
      setLoading(true);
      setError(null);

      try {
        const today = startOfDay(new Date());
        const sevenDaysAgo = subDays(today, 6);
        const dailyData: Record<string, DailyTrend> = {};
        for (let i = 0; i < 7; i++) {
          const date = subDays(today, 6 - i);
          const dateKey = format(date, 'yyyy-MM-dd');
          dailyData[dateKey] = {
            date: dateKey,
            displayDate: format(date, 'EEE'),
            timeMinutes: 0,
            accuracy: 0,
            totalTrials: 0,
            correctTrials: 0,
          };
        }

        // A clinical trend must be based on confirmed, completed sessions.
        // Fetch in pages so a default PostgREST 1,000-row cap does not turn
        // missing evidence into reassuringly low counts.
        const sessions: Array<{
          id: string;
          started_at: string | null;
          duration_sec: number | null;
        }> = [];
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
          const { data, error: sessionsError } = await supabase
            .from('sessions')
            .select('id, started_at, duration_sec')
            .eq('profile_id', activeProfile.id)
            .not('ended_at', 'is', null)
            .gte('started_at', sevenDaysAgo.toISOString())
            .order('id', { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (sessionsError || !Array.isArray(data)) {
            throw new Error('Could not verify completed session history');
          }
          sessions.push(...data);
          if (data.length < pageSize) break;
        }

        const byDate = new Map<string, ScoredRow[]>();
        for (const session of sessions) {
          if (!session.started_at) continue;
          const dateKey = format(new Date(session.started_at), 'yyyy-MM-dd');
          if (dailyData[dateKey]) {
            dailyData[dateKey].timeMinutes += Math.round((session.duration_sec || 0) / 60);
          }
        }

        // All relevant raw attempts must be fetched and filtered by the exact
        // same scorable-ness rule as foreground session completion.
        const sessionIds = sessions.map(s => s.id);
        for (let i = 0; i < sessionIds.length; i += 100) {
          const chunk = sessionIds.slice(i, i + 100);
          for (let offset = 0; ; offset += pageSize) {
            const { data: events, error: eventError } = await supabase
              .from('exercise_events')
              .select('id, session_id, score, cue_level, counts_toward_score, validity_label, exercise_slug, created_at')
              .in('session_id', chunk)
              .order('id', { ascending: true })
              .range(offset, offset + pageSize - 1);
            if (eventError || !Array.isArray(events)) {
              throw new Error('Could not verify clinical event history');
            }

            for (const event of events) {
              if (!isScorableTaskAttempt(event)) continue;
              if (!event.created_at) continue;
              const dateKey = format(new Date(event.created_at), 'yyyy-MM-dd');
              if (!dailyData[dateKey]) continue;
              const day = dailyData[dateKey];
              day.totalTrials++;
              if (event.score === 100) day.correctTrials++;
              const rows = byDate.get(dateKey) ?? [];
              rows.push(event);
              byDate.set(dateKey, rows);
            }
            if (events.length < pageSize) break;
          }
        }

        for (const day of Object.values(dailyData)) {
          day.accuracy = reduceAccuracy(byDate.get(day.date) ?? []).accuracy ?? 0;
        }
        if (active) setTrends(Object.values(dailyData));
      } catch (cause) {
        console.error('[useWeeklyTrends] clinical evidence read failed', cause);
        if (active) {
          setTrends([]);
          setError('Weekly clinical metrics unavailable. Please retry.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchWeeklyTrends();
    return () => { active = false; };
  }, [activeProfile?.id]);

  return { trends, loading, error };
}
