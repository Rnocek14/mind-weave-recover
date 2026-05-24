import { useState, useEffect } from 'react';
import { loadPatientIntelligence, type PatientIntelligenceProfile } from '@/lib/patientIntelligence';

/**
 * Loads cross-session Maya intelligence for a patient.
 *
 * IMPORTANT: pass `profileId` whenever you can. Accounts with multiple profiles
 * (e.g. clinician demo accounts, families sharing a login) will otherwise
 * aggregate other patients' summaries into the active patient's review.
 */
export function usePatientIntelligence(
  userId: string | undefined,
  profileId?: string | null,
) {
  const [profile, setProfile] = useState<PatientIntelligenceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    loadPatientIntelligence(userId, 20, profileId ?? null).then((result) => {
      if (!cancelled) {
        setProfile(result);
        setIsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [userId, profileId]);

  return { profile, isLoading };
}
