import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

// Use the database type and extend with typed versions of JSON fields
type UserSpeechProfileRow = Tables<'user_speech_profiles'>;

export interface UserSpeechProfile extends Omit<UserSpeechProfileRow, 'error_type_distribution' | 'cue_efficacy_by_type' | 'cue_efficacy_by_category' | 'most_challenging_categories' | 'phoneme_difficulty_map'> {
  error_type_distribution: Record<string, number> | null;
  cue_efficacy_by_type: Record<
    'semantic' | 'phonemic' | 'full_word' | 'none',
    { successRate: number; success: number; total: number; avgTimeToSuccessMs?: number }
  > | null;
  cue_efficacy_by_category: Record<string, { successRate: number; success: number; total: number }> | null;
  most_challenging_categories: Array<{ category: string; successRate: number; trials: number }> | null;
  phoneme_difficulty_map: Record<string, { accuracy: number; trials: number }> | null;
  // Phoneme coverage metadata
  trials_with_gop_data: number | null;
  trials_with_phonemes: number | null;
  trials_with_nonzero_accuracy: number | null;
  phoneme_token_count: number | null;
}

interface UseUserSpeechProfileOptions {
  profileId?: string;
}

export const useUserSpeechProfile = (
  userId: string | undefined,
  options?: UseUserSpeechProfileOptions
) => {
  const { profileId } = options ?? {};
  const [profile, setProfile] = useState<UserSpeechProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }

    // Dev warning for missing profileId
    if (import.meta.env.DEV && !profileId) {
      console.warn('[useUserSpeechProfile] profileId missing; will use most recent. Pass activeProfile.id for multi-profile safety.');
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('user_speech_profiles')
        .select('*')
        .eq('user_id', userId);

      // Filter by profile_id if provided for multi-profile support
      if (profileId) {
        query = query.eq('profile_id', profileId);
      }

      // If no profileId, get most recent to avoid .maybeSingle() failing with multiple rows
      if (!profileId) {
        query = query.order('last_computed_at', { ascending: false }).limit(1);
      }

      const { data, error: fetchError } = await query.maybeSingle();

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
  }, [userId, profileId]);

  const refresh = useCallback(() => {
    return fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refresh };
};
