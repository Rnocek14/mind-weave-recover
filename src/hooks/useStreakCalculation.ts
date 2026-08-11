import { supabase } from '@/integrations/supabase/client';
import { localDayNumber, localDayStart } from '@/lib/localDate';

export const calculateStreak = async (userId: string, profileId?: string | null): Promise<number> => {
  let query = supabase
    .from('sessions')
    .select('started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });
  if (profileId) query = query.eq('profile_id', profileId);
  const { data: sessions, error } = await query;

  if (error || !sessions || sessions.length === 0) {
    return 0;
  }

  // Bucket by the user's local calendar day, not UTC.
  const uniqueDays = [...new Set(sessions.map(s => localDayNumber(s.started_at)))].sort((a, b) => b - a);

  if (uniqueDays.length === 0) return 0;

  const today = localDayNumber(new Date());
  
  // Streak must include today or yesterday
  if (uniqueDays[0] !== today && uniqueDays[0] !== today - 1) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    if (uniqueDays[i - 1] - uniqueDays[i] === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
};

export const getTotalReps = async (userId: string, profileId?: string | null): Promise<number> => {
  let query = supabase
    .from('exercise_events')
    .select('id, session_id!inner(user_id)', { count: 'exact', head: true })
    .eq('session_id.user_id', userId);
  if (profileId) query = query.eq('profile_id', profileId);
  const { count, error } = await query;

  if (error || count === null) return 0;
  return count;
};

export const getTodayProgress = async (userId: string, dailyGoalMinutes: number = 20, profileId?: string | null): Promise<number> => {
  // "Today" = the user's local calendar day, sent as real instants so the
  // DB compares actual timestamps instead of a timezone-less string.
  const dayStart = localDayStart();
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  let query = supabase
    .from('sessions')
    .select('duration_sec')
    .eq('user_id', userId)
    .gte('started_at', dayStart.toISOString())
    .lt('started_at', dayEnd.toISOString());
  if (profileId) query = query.eq('profile_id', profileId);
  const { data, error } = await query;

  if (error || !data) return 0;

  const totalMinutes = data.reduce((sum, s) => sum + (s.duration_sec || 0), 0) / 60;
  return Math.min(100, Math.round((totalMinutes / dailyGoalMinutes) * 100));
};
