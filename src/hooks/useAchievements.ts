import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Achievement {
  type: string;
  value: number;
  awardedAt: string;
}

interface UseAchievementsReturn {
  achievements: Achievement[];
  loading: boolean;
  newAchievements: Achievement[];
  clearNew: () => void;
}

const ACHIEVEMENT_DEFS = [
  { type: 'streak_3', label: '3-Day Streak', threshold: 3, icon: '🔥' },
  { type: 'streak_7', label: 'Week Warrior', threshold: 7, icon: '⭐' },
  { type: 'streak_14', label: 'Two-Week Champion', threshold: 14, icon: '🏆' },
  { type: 'streak_30', label: 'Monthly Master', threshold: 30, icon: '👑' },
  { type: 'sessions_5', label: 'Getting Started', threshold: 5, icon: '🌱' },
  { type: 'sessions_25', label: 'Dedicated Learner', threshold: 25, icon: '📚' },
  { type: 'sessions_50', label: 'Half Century', threshold: 50, icon: '💪' },
  { type: 'sessions_100', label: 'Century Club', threshold: 100, icon: '🌟' },
  { type: 'words_10', label: 'First Words', threshold: 10, icon: '💬' },
  { type: 'words_50', label: 'Vocabulary Builder', threshold: 50, icon: '📖' },
  { type: 'words_100', label: 'Word Master', threshold: 100, icon: '🎓' },
] as const;

export { ACHIEVEMENT_DEFS };

export function useAchievements(userId: string | undefined, profileId: string | undefined) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !profileId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data, error } = await supabase
        .from('achievements')
        .select('type, value, awarded_at')
        .eq('user_id', userId)
        .eq('profile_id', profileId);

      if (!error && data) {
        setAchievements(
          data.map((a) => ({
            type: a.type,
            value: a.value ?? 0,
            awardedAt: a.awarded_at ?? '',
          }))
        );
      }
      setLoading(false);
    };

    fetch();
  }, [userId, profileId]);

  const clearNew = () => setNewAchievements([]);

  /** Call after session to check and award new achievements */
  const checkAndAward = async (streak: number, totalSessions: number, wordsMastered: number) => {
    if (!userId || !profileId) return;

    const earned = achievements.map((a) => a.type);
    const toAward: Array<{ type: string; value: number }> = [];

    // Streak milestones
    if (streak >= 3 && !earned.includes('streak_3')) toAward.push({ type: 'streak_3', value: streak });
    if (streak >= 7 && !earned.includes('streak_7')) toAward.push({ type: 'streak_7', value: streak });
    if (streak >= 14 && !earned.includes('streak_14')) toAward.push({ type: 'streak_14', value: streak });
    if (streak >= 30 && !earned.includes('streak_30')) toAward.push({ type: 'streak_30', value: streak });

    // Session milestones
    if (totalSessions >= 5 && !earned.includes('sessions_5')) toAward.push({ type: 'sessions_5', value: totalSessions });
    if (totalSessions >= 25 && !earned.includes('sessions_25')) toAward.push({ type: 'sessions_25', value: totalSessions });
    if (totalSessions >= 50 && !earned.includes('sessions_50')) toAward.push({ type: 'sessions_50', value: totalSessions });
    if (totalSessions >= 100 && !earned.includes('sessions_100')) toAward.push({ type: 'sessions_100', value: totalSessions });

    // Word mastery milestones
    if (wordsMastered >= 10 && !earned.includes('words_10')) toAward.push({ type: 'words_10', value: wordsMastered });
    if (wordsMastered >= 50 && !earned.includes('words_50')) toAward.push({ type: 'words_50', value: wordsMastered });
    if (wordsMastered >= 100 && !earned.includes('words_100')) toAward.push({ type: 'words_100', value: wordsMastered });

    if (toAward.length === 0) return;

    const newOnes: Achievement[] = [];
    for (const item of toAward) {
      const { error } = await supabase.from('achievements').upsert(
        {
          user_id: userId,
          profile_id: profileId,
          type: item.type,
          value: item.value,
          awarded_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,type', ignoreDuplicates: true }
      );
      if (!error) {
        newOnes.push({ type: item.type, value: item.value, awardedAt: new Date().toISOString() });
      }
    }

    if (newOnes.length > 0) {
      setAchievements((prev) => [...prev, ...newOnes]);
      setNewAchievements(newOnes);
    }
  };

  return { achievements, loading, newAchievements, clearNew, checkAndAward } as UseAchievementsReturn & { checkAndAward: typeof checkAndAward };
}
