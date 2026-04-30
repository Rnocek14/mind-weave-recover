import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EnrollmentStatus, TrialRuntimeConfig } from '@/lib/clinicalTrial/types';

interface ActiveEnrollment {
  enrollmentId: string;
  studyId: string;
  studyName: string;
  status: EnrollmentStatus;
  enrolledAt: string | null;
  consentVersion: number | null;
  latestConsentVersionAvailable: number | null;
  needsReConsent: boolean;
  runtimeConfig: TrialRuntimeConfig | null;
}

/**
 * Resolves the patient's currently active study enrollment, if any,
 * along with the frozen trial runtime config.
 *
 * The runtime layer should call this and prefer
 * `enrollment.runtimeConfig.runtime_config` over `profile.runtime_config`
 * for any patient who is in an active study.
 */
export function useTrialEnrollment() {
  const [enrollment, setEnrollment] = useState<ActiveEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) {
        setEnrollment(null);
        setLoading(false);
        return;
      }

      // Find active enrollment
      const { data: enrollments, error: enrollErr } = await supabase
        .from('study_enrollments')
        .select('id, study_id, status, enrolled_at, studies(name)')
        .eq('user_id', uid)
        .in('status', ['consented', 'active'])
        .order('enrolled_at', { ascending: false })
        .limit(1);

      if (enrollErr) throw enrollErr;
      if (!enrollments || enrollments.length === 0) {
        setEnrollment(null);
        setLoading(false);
        return;
      }

      const e = enrollments[0] as {
        id: string;
        study_id: string;
        status: EnrollmentStatus;
        enrolled_at: string | null;
        studies: { name: string } | { name: string }[] | null;
      };
      const studyName = Array.isArray(e.studies)
        ? e.studies[0]?.name ?? 'Study'
        : e.studies?.name ?? 'Study';

      // Latest signed consent
      const { data: consentRows } = await supabase
        .from('consent_records')
        .select('consent_version')
        .eq('enrollment_id', e.id)
        .order('signed_at', { ascending: false })
        .limit(1);
      const consentVersion = consentRows?.[0]?.consent_version ?? null;

      // Latest available consent doc
      const { data: docRows } = await supabase
        .from('consent_documents')
        .select('version')
        .order('version', { ascending: false })
        .limit(1);
      const latestVersion = docRows?.[0]?.version ?? null;

      // Frozen runtime
      const { data: runtimeRows } = await supabase
        .from('trial_runtime_config')
        .select('study_id, engine_version, scorer_version, runtime_config, pinned_at')
        .eq('study_id', e.study_id)
        .limit(1);
      const runtime = (runtimeRows?.[0] ?? null) as TrialRuntimeConfig | null;

      setEnrollment({
        enrollmentId: e.id,
        studyId: e.study_id,
        studyName,
        status: e.status,
        enrolledAt: e.enrolled_at,
        consentVersion,
        latestConsentVersionAvailable: latestVersion,
        needsReConsent:
          consentVersion != null &&
          latestVersion != null &&
          latestVersion > consentVersion,
        runtimeConfig: runtime,
      });
    } catch (err) {
      console.error('[useTrialEnrollment] failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setEnrollment(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { enrollment, loading, error, refresh };
}
