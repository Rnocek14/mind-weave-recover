import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export interface DoseCap {
  todayMinutes: number;
  dailyCapMinutes: number;
  sessionCapMinutes: number;
  enforceCaps: boolean;
  canStartSession: boolean;
  minutesRemaining: number;
  lastSessionEnded: Date | null;
  cooldownRemaining: number;
  warningLevel: 'safe' | 'approaching' | 'warning' | 'limit';
}

const COOLDOWN_HOURS = 2;
const APPROACHING_THRESHOLD = 0.7; // 70% of daily cap
const WARNING_THRESHOLD = 0.85; // 85% of daily cap

export const useDoseCap = (userId: string | undefined) => {
  const [doseCap, setDoseCap] = useState<DoseCap>({
    todayMinutes: 0,
    dailyCapMinutes: 45,
    sessionCapMinutes: 30,
    enforceCaps: true,
    canStartSession: true,
    minutesRemaining: 45,
    lastSessionEnded: null,
    cooldownRemaining: 0,
    warningLevel: 'safe'
  });
  const [isLoading, setIsLoading] = useState(true);
  const activeProfileId = useActiveProfileId();

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const fetchDoseCap = async () => {
      try {
        // Get user's dose cap preferences (profile-scoped if available)
        let pq = supabase
          .from('profiles')
          .select('daily_cap_minutes, session_cap_minutes, enforce_dose_caps')
          .eq('user_id', userId);
        if (activeProfileId) pq = pq.eq('id', activeProfileId);
        const { data: profile } = await pq.maybeSingle();

        const dailyCapMinutes = profile?.daily_cap_minutes || 45;
        const sessionCapMinutes = profile?.session_cap_minutes || 30;
        const enforceCaps = profile?.enforce_dose_caps ?? true;

        // Get today's practice time
        const today = new Date().toISOString().split('T')[0];
        let sq = supabase
          .from('sessions')
          .select('duration_sec, ended_at')
          .eq('user_id', userId)
          .gte('started_at', `${today}T00:00:00`)
          .lte('started_at', `${today}T23:59:59`)
          .order('ended_at', { ascending: false });
        if (activeProfileId) sq = sq.eq('profile_id', activeProfileId);
        const { data: sessions } = await sq;

        const todayMinutes = sessions?.reduce((sum, s) => {
          return sum + (s.duration_sec ? Math.round(s.duration_sec / 60) : 0);
        }, 0) || 0;

        const minutesRemaining = Math.max(0, dailyCapMinutes - todayMinutes);

        // Check last session end time for cooldown
        const lastSessionEnded = sessions?.[0]?.ended_at 
          ? new Date(sessions[0].ended_at)
          : null;

        let cooldownRemaining = 0;
        if (lastSessionEnded && todayMinutes >= 30) {
          const hoursSinceEnd = (Date.now() - lastSessionEnded.getTime()) / (1000 * 60 * 60);
          cooldownRemaining = Math.max(0, COOLDOWN_HOURS - hoursSinceEnd);
        }

        const canStartSession = enforceCaps 
          ? (minutesRemaining >= 10 && cooldownRemaining === 0)
          : true;

        // Determine warning level
        let warningLevel: 'safe' | 'approaching' | 'warning' | 'limit' = 'safe';
        const percentUsed = todayMinutes / dailyCapMinutes;
        
        if (percentUsed >= 1) {
          warningLevel = 'limit';
        } else if (percentUsed >= WARNING_THRESHOLD) {
          warningLevel = 'warning';
        } else if (percentUsed >= APPROACHING_THRESHOLD) {
          warningLevel = 'approaching';
        }

        setDoseCap({
          todayMinutes,
          dailyCapMinutes,
          sessionCapMinutes,
          enforceCaps,
          canStartSession,
          minutesRemaining,
          lastSessionEnded,
          cooldownRemaining,
          warningLevel
        });
      } catch (error) {
        console.error('Error fetching dose cap:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDoseCap();

    // Refresh every minute during active session
    const interval = setInterval(fetchDoseCap, 60000);
    return () => clearInterval(interval);
  }, [userId, activeProfileId]);

  const refresh = async () => {
    if (!userId) return;
    setIsLoading(true);
    // Re-run the fetch logic
    const today = new Date().toISOString().split('T')[0];
    let rq = supabase
      .from('sessions')
      .select('duration_sec')
      .eq('user_id', userId)
      .gte('started_at', `${today}T00:00:00`)
      .lte('started_at', `${today}T23:59:59`);
    if (activeProfileId) rq = rq.eq('profile_id', activeProfileId);
    const { data: sessions } = await rq;

    const todayMinutes = sessions?.reduce((sum, s) => {
      return sum + (s.duration_sec ? Math.round(s.duration_sec / 60) : 0);
    }, 0) || 0;

    setDoseCap(prev => ({
      ...prev,
      todayMinutes,
      minutesRemaining: Math.max(0, prev.dailyCapMinutes - todayMinutes)
    }));
    setIsLoading(false);
  };

  return { doseCap, isLoading, refresh };
};
