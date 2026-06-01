import { supabase } from '@/integrations/supabase/client';

// Convert timestamp to UTC day (days since epoch)
const toUtcDay = (timestamp: string): number => {
  return Math.floor(Date.parse(timestamp) / 86400000);
};

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

  // Get unique UTC days
  const uniqueDays = [...new Set(sessions.map(s => toUtcDay(s.started_at)))].sort((a, b) => b - a);

  if (uniqueDays.length === 0) return 0;

  const today = toUtcDay(new Date().toISOString());
  
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
  const today = new Date().toISOString().split('T')[0];
  
  let query = supabase
    .from('sessions')
    .select('duration_sec')
    .eq('user_id', userId)
    .gte('started_at', `${today}T00:00:00`)
    .lte('started_at', `${today}T23:59:59`);
  if (profileId) query = query.eq('profile_id', profileId);
  const { data, error } = await query;

  if (error || !data) return 0;

  const totalMinutes = data.reduce((sum, s) => sum + (s.duration_sec || 0), 0) / 60;
  return Math.min(100, Math.round((totalMinutes / dailyGoalMinutes) * 100));
};
