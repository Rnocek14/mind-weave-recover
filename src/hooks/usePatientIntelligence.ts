import { useState, useEffect } from 'react';
import { loadPatientIntelligence, type PatientIntelligenceProfile } from '@/lib/patientIntelligence';

export function usePatientIntelligence(userId: string | undefined) {
  const [profile, setProfile] = useState<PatientIntelligenceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    loadPatientIntelligence(userId, 20).then((result) => {
      if (!cancelled) {
        setProfile(result);
        setIsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [userId]);

  return { profile, isLoading };
}
