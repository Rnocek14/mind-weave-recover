import { useState, useEffect } from 'react';
import { getSignedPhotoUrl } from '@/lib/photoStorage';

type SignedUrlState = {
  url: string | null;
  loading: boolean;
  error: Error | null;
};

export const useSignedUrl = (storagePath: string | null) => {
  const [state, setState] = useState<SignedUrlState>({
    url: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    if (!storagePath) {
      setState({ url: null, loading: false, error: null });
      return;
    }

    let mounted = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const fetchUrl = async () => {
      try {
        if (!mounted) return;
        setState(prev => ({ ...prev, loading: true, error: null }));
        const signedUrl = await getSignedPhotoUrl(storagePath, 900); // 15 min
        
        if (!mounted) return;
        setState({ url: signedUrl, loading: false, error: null });
        
        // Refresh 60s before expiry
        refreshTimer = setTimeout(() => {
          if (mounted) fetchUrl();
        }, 14 * 60 * 1000); // 14 min
      } catch (err) {
        if (!mounted) return;
        setState({ url: null, loading: false, error: err as Error });
      }
    };

    fetchUrl();

    return () => {
      mounted = false;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [storagePath]);

  return state;
};
