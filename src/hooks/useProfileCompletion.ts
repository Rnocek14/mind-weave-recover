import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProfileCompletionData {
  userId: string;
  displayName: string;
  completionPercentage: number;
  missingFields: string[];
  sessionCount: number;
  lastSessionDate: string | null;
  strokeDate: string | null;
  isPriority: boolean;
}

interface ProfileCompletionStats {
  totalUsers: number;
  avgCompletion: number;
  incompleteUsers: number;
  priorityUsers: number;
}

export const useProfileCompletion = () => {
  const [users, setUsers] = useState<ProfileCompletionData[]>([]);
  const [stats, setStats] = useState<ProfileCompletionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateCompletion = (profile: any): { percentage: number; missing: string[] } => {
    const requiredFields = [
      { key: 'stroke_date', label: 'Stroke Date', check: (p: any) => p.stroke_date },
      { key: 'stroke_mechanism', label: 'Stroke Mechanism', check: (p: any) => p.clinical_profile?.stroke_mechanism && p.clinical_profile.stroke_mechanism !== 'unknown' },
      { key: 'affected_side', label: 'Affected Side', check: (p: any) => p.clinical_profile?.affected_side && p.clinical_profile.affected_side !== 'unknown' },
      { key: 'stroke_location', label: 'Stroke Location', check: (p: any) => p.clinical_profile?.stroke_location && p.clinical_profile.stroke_location !== 'unspecified' },
      { key: 'impairments', label: 'Impairments', check: (p: any) => {
        const imp = p.clinical_profile?.impairments;
        if (!imp) return false;
        const hasAny = (imp.motor?.length || 0) + (imp.speech?.length || 0) + 
                       (imp.visual?.length || 0) + (imp.cognitive?.length || 0) > 0;
        return hasAny;
      }},
    ];

    const completedFields = requiredFields.filter(field => field.check(profile));
    const percentage = (completedFields.length / requiredFields.length) * 100;
    const missing = requiredFields
      .filter(field => !field.check(profile))
      .map(field => field.label);

    return { percentage, missing };
  };

  const fetchProfileCompletion = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all profiles with session counts
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, stroke_date, clinical_profile');

      if (profilesError) throw profilesError;

      if (!profiles) {
        setUsers([]);
        setStats({
          totalUsers: 0,
          avgCompletion: 0,
          incompleteUsers: 0,
          priorityUsers: 0
        });
        return;
      }

      // Fetch session counts and last session date for each user
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('user_id, started_at');

      if (sessionError) throw sessionError;

      // Group sessions by user
      const sessionsByUser = new Map<string, { count: number; lastDate: string }>();
      sessionData?.forEach(session => {
        const existing = sessionsByUser.get(session.user_id);
        if (!existing || new Date(session.started_at) > new Date(existing.lastDate)) {
          sessionsByUser.set(session.user_id, {
            count: (existing?.count || 0) + 1,
            lastDate: session.started_at
          });
        } else {
          sessionsByUser.set(session.user_id, {
            count: existing.count + 1,
            lastDate: existing.lastDate
          });
        }
      });

      // Calculate completion for each user
      const userData: ProfileCompletionData[] = profiles.map(profile => {
        const { percentage, missing } = calculateCompletion(profile);
        const sessionInfo = sessionsByUser.get(profile.user_id);
        const sessionCount = sessionInfo?.count || 0;
        const lastSessionDate = sessionInfo?.lastDate || null;

        // Priority: High session count (>5) but low completion (<80%)
        const isPriority = sessionCount >= 5 && percentage < 80;

        return {
          userId: profile.user_id,
          displayName: profile.display_name || 'Unknown User',
          completionPercentage: Math.round(percentage),
          missingFields: missing,
          sessionCount,
          lastSessionDate,
          strokeDate: profile.stroke_date,
          isPriority
        };
      });

      // Sort by priority first, then by completion percentage
      userData.sort((a, b) => {
        if (a.isPriority !== b.isPriority) {
          return a.isPriority ? -1 : 1;
        }
        if (a.completionPercentage !== b.completionPercentage) {
          return a.completionPercentage - b.completionPercentage;
        }
        return b.sessionCount - a.sessionCount;
      });

      // Calculate stats
      const totalUsers = userData.length;
      const avgCompletion = userData.reduce((sum, u) => sum + u.completionPercentage, 0) / totalUsers;
      const incompleteUsers = userData.filter(u => u.completionPercentage < 100).length;
      const priorityUsers = userData.filter(u => u.isPriority).length;

      setUsers(userData);
      setStats({
        totalUsers,
        avgCompletion: Math.round(avgCompletion),
        incompleteUsers,
        priorityUsers
      });
    } catch (err) {
      console.error('Error fetching profile completion:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile completion data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileCompletion();
  }, []);

  return { users, stats, loading, error, refetch: fetchProfileCompletion };
};
