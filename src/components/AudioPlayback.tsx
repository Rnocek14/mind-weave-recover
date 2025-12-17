import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { audioManager } from '@/lib/audioManager';

interface AudioPlaybackProps {
  storagePath: string;
  className?: string;
}

export const AudioPlayback = ({ storagePath, className = '' }: AudioPlaybackProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Fetch signed URL (10 min expiry for PHI-adjacent audio)
  const fetchSignedUrl = async (): Promise<string | null> => {
    try {
      const { data } = await supabase.storage
        .from('session-recordings')
        .createSignedUrl(storagePath, 600); // 10 minute expiry

      if (data?.signedUrl) {
        setAudioUrl(data.signedUrl);
        return data.signedUrl;
      }
      return null;
    } catch (error) {
      console.error('Failed to load audio:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchSignedUrl();
  }, [storagePath]);

  // Subscribe to audio manager state changes (no polling)
  useEffect(() => {
    const unsubscribe = audioManager.subscribe(() => {
      setIsPlaying(audioManager.isPlayingKey(storagePath));
    });
    return unsubscribe;
  }, [storagePath]);

  const togglePlayback = async () => {
    if (isPlaying) {
      audioManager.stop();
      return;
    }

    setIsLoading(true);
    try {
      // Use cached URL or fetch fresh one
      let url = audioUrl;
      if (!url) {
        url = await fetchSignedUrl();
      }

      if (!url) {
        toast.error('Audio not available');
        setIsLoading(false);
        return;
      }

      try {
        await audioManager.play(url, storagePath);
      } catch (playError) {
        // Signed URL may have expired - retry with fresh URL
        console.log('Playback failed, retrying with fresh URL');
        const freshUrl = await fetchSignedUrl();
        if (freshUrl) {
          await audioManager.play(freshUrl, storagePath);
        } else {
          throw new Error('Could not fetch fresh URL');
        }
      }
    } catch (error) {
      console.error('Playback error:', error);
      toast.error('Failed to play audio');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={togglePlayback}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isPlaying ? (
        <Pause className="w-4 h-4" />
      ) : (
        <Play className="w-4 h-4" />
      )}
      <Volume2 className="w-3 h-3 ml-1" />
    </Button>
  );
};
