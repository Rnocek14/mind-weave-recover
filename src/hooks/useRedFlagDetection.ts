import { useState, useEffect } from 'react';
import { detectAllRedFlags, RedFlag } from '@/lib/redFlagDetector';

interface UseRedFlagOptions {
  enabled?: boolean;
}

export const useRedFlagDetection = (
  userId: string | null | undefined,
  options: UseRedFlagOptions = {},
  profileId?: string | null | undefined
) => {
  const { enabled = true } = options;
  const [flags, setFlags] = useState<RedFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !userId) {
      setIsLoading(false);
      setFlags([]);
      return;
    }

    const fetchFlags = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const detectedFlags = await detectAllRedFlags(userId, profileId ?? undefined);
        setFlags(detectedFlags);
      } catch (err) {
        console.error('Error detecting red flags:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlags();
  }, [userId, enabled, profileId]);

  const refresh = async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const detectedFlags = await detectAllRedFlags(userId, profileId ?? undefined);
      setFlags(detectedFlags);
    } catch (err) {
      console.error('Error refreshing red flags:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return { flags, isLoading, error, refresh };
};

