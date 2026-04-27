/**
 * useUserAdaptationProfile — read-only hook for the per-profile adaptation summary.
 *
 * Backed by `user_adaptation_profiles` (one row per profile).
 * Triggers a server refresh via the `compute-adaptation-profile` edge function
 * when the cached row is older than `staleAfterMs` (default 6h).
 *
 * Games never mutate this — they read it through `useSessionAdaptation` to bias
 * cue type, starting difficulty, and novelty rotation.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserAdaptationProfile {
  id: string;
  user_id: string;
  profile_id: string;
  dominant_error_type: string | null;
  error_type_distribution: Record<string, number>;
  recommended_cue_bias: string | null;
  cue_dependency_score: number | null;
  cue_dependency_trend: 'fading' | 'stable' | 'increasing' | 'unknown' | null;
  avg_response_latency_ms: number | null;
  latency_trend_pct: number | null;
  engagement_baseline: Record<string, unknown>;
  plateau_flag: boolean;
  plateau_domains: string[];
  trial_count_window: number;
  data_confidence: 'low' | 'medium' | 'high';
  version: number;
  last_computed_at: string;
}

interface Options {
  profileId?: string | null;
  enabled?: boolean;
  staleAfterMs?: number;
}

const DEFAULT_STALE_MS = 6 * 60 * 60 * 1000; // 6h

export function useUserAdaptationProfile({
  profileId,
  enabled = true,
  staleAfterMs = DEFAULT_STALE_MS,
}: Options) {
  const [profile, setProfile] = useState<UserAdaptationProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    try {
      await supabase.functions.invoke('compute-adaptation-profile', {
        body: { profileId },
      });
    } catch (e) {
      // Non-fatal: stale data is still useful
      console.warn('[useUserAdaptationProfile] refresh failed', e);
    }
  }, [profileId]);

  useEffect(() => {
    if (!enabled || !profileId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchErr } = await supabase
          .from('user_adaptation_profiles' as any)
          .select('*')
          .eq('profile_id', profileId)
          .maybeSingle();

        if (cancelled) return;
        if (fetchErr) throw fetchErr;

        if (data) {
          setProfile(data as unknown as UserAdaptationProfile);
          // Trigger a refresh in the background if stale
          const age = Date.now() - new Date((data as any).last_computed_at).getTime();
          if (age > staleAfterMs) {
            void refresh();
          }
        } else {
          // No row yet — request initial computation, then re-fetch
          await refresh();
          const { data: refreshed } = await supabase
            .from('user_adaptation_profiles' as any)
            .select('*')
            .eq('profile_id', profileId)
            .maybeSingle();
          if (!cancelled && refreshed) {
            setProfile(refreshed as unknown as UserAdaptationProfile);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load adaptation profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [profileId, enabled, staleAfterMs, refresh]);

  return { profile, loading, error, refresh };
}
