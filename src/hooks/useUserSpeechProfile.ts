import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

// Use the database type and extend with typed versions of JSON fields
type UserSpeechProfileRow = Tables<'user_speech_profiles'>;

export interface UserSpeechProfile extends Omit<UserSpeechProfileRow, 'error_type_distribution' | 'cue_efficacy_by_type' | 'cue_efficacy_by_category' | 'most_challenging_categories'> {
  error_type_distribution: Record<string, number> | null;
  cue_efficacy_by_type: Record<
    'semantic' | 'phonemic' | 'full_word' | 'none',
    { successRate: number; success: number; total: number; avgTimeToSuccessMs?: number }
  > | null;
  cue_efficacy_by_category: Record<string, { successRate: number; success: number; total: number }> | null;
  most_challenging_categories: Array<{ category: string; successRate: number; trials: number }> | null;
}

export const useUserSpeechProfile = (userId: string | undefined) => {
  const [profile, setProfile] = useState<UserSpeechProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('user_speech_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      // Cast the data to our typed interface (JSONB fields are already the right shape)
      setProfile(data as UserSpeechProfile | null);
    } catch (err) {
      console.error('Error fetching user speech profile:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refresh = useCallback(() => {
    return fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refresh };
};
