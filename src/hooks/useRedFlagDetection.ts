import { useState, useEffect } from 'react';
import { detectAllRedFlags, RedFlag } from '@/lib/redFlagDetector';

interface UseRedFlagOptions {
  enabled?: boolean;
}

export const useRedFlagDetection = (
  userId: string | null | undefined,
  options: UseRedFlagOptions = {}
) => {
  const { enabled = true } = options;
  const [flags, setFlags] = useState<RedFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlags = async () => {
      if (!enabled || !userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const detectedFlags = await detectAllRedFlags(userId);
        setFlags(detectedFlags);
      } catch (err) {
        console.error('Error detecting red flags:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlags();
  }, [userId, enabled]);

  const refresh = async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const detectedFlags = await detectAllRedFlags(userId);
      setFlags(detectedFlags);
    } catch (err) {
      console.error('Error refreshing red flags:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return { flags, isLoading, error, refresh };
};
