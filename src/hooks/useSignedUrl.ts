import { useState, useEffect } from 'react';
import { getSignedPhotoUrl } from '@/lib/photoStorage';

interface UrlState {
  url: string | null;
  loading: boolean;
  error: Error | null;
}

export const useSignedUrl = (storagePath: string | null) => {
  const [state, setState] = useState<UrlState>({
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
    let refreshTimer: NodeJS.Timeout;

    const fetchUrl = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const signedUrl = await getSignedPhotoUrl(storagePath, 900); // 15 min
        
        if (mounted) {
          setState({ url: signedUrl, loading: false, error: null });
          
          // Refresh 60s before expiry
          refreshTimer = setTimeout(() => {
            if (mounted) fetchUrl();
          }, 840000); // 14 min
        }
      } catch (error) {
        if (mounted) {
          setState({ url: null, loading: false, error: error as Error });
        }
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
