/**
 * useSkillMastery — read-only hook for the Mastery Layer.
 * Used by /dev/mastery-shadow today; will power patient + clinician UI later.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SkillMasteryRow {
  skill_slug: string;
  mastery_score: number;
  confidence: 'none' | 'low' | 'medium' | 'high';
  trials_total: number;
  trials_recent: number;
  accuracy_recent: number | null;
  cue_independence: number | null;
  velocity_per_week: number | null;
  plateau_flag: boolean;
  fatigue_adjusted_score: number | null;
  support_dependency_trend: string | null;
  last_practiced_at: string | null;
  updated_at: string;
}

export function useSkillMastery(profileId: string | null | undefined) {
  const [rows, setRows] = useState<SkillMasteryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('user_skill_mastery')
        .select('*')
        .eq('profile_id', profileId)
        .order('mastery_score', { ascending: false });
      if (cancel) return;
      if (error) setError(error.message);
      else setRows((data ?? []) as any);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [profileId]);

  return { rows, loading, error };
}
