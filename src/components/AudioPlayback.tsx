import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { audioManager } from '@/lib/audioManager';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AudioPlaybackProps {
  storagePath: string;
  className?: string;
  listenForHint?: string;
}

export const AudioPlayback = ({ storagePath, className = '', listenForHint }: AudioPlaybackProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Use ref for URL to avoid unnecessary re-renders; store with timestamp for expiry check
  const audioUrlRef = useRef<{ url: string; fetchedAt: number } | null>(null);

  // Fetch signed URL (10 min expiry for PHI-adjacent audio)
  const fetchSignedUrl = useCallback(async (): Promise<string | null> => {
    try {
      const { data } = await supabase.storage
        .from('session-recordings')
        .createSignedUrl(storagePath, 600); // 10 minute expiry

      if (data?.signedUrl) {
        audioUrlRef.current = { url: data.signedUrl, fetchedAt: Date.now() };
        return data.signedUrl;
      }
      return null;
    } catch (error) {
      console.error('Failed to load audio:', error);
      return null;
    }
  }, [storagePath]);

  useEffect(() => {
    fetchSignedUrl();
  }, [fetchSignedUrl]);

  // Subscribe to audio manager state changes
  useEffect(() => {
    // Initial sync - check if this audio is already playing
    setIsPlaying(audioManager.isPlayingKey(storagePath));
    
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
      // Check if cached URL is still likely valid (fetched < 9 min ago)
      const cached = audioUrlRef.current;
      const urlAge = cached ? Date.now() - cached.fetchedAt : Infinity;
      let url = (cached && urlAge < 9 * 60 * 1000) ? cached.url : null;
      
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
      } catch (playError: any) {
        // Only retry if likely a 403/expiry error, not a general playback failure
        const isLikelyExpiry = playError?.message?.includes('403') || 
                               playError?.name === 'NotAllowedError' ||
                               playError?.message?.includes('expired');
        
        if (isLikelyExpiry) {
          console.log('Playback failed (likely expired), retrying with fresh URL');
          const freshUrl = await fetchSignedUrl();
          if (freshUrl) {
            await audioManager.play(freshUrl, storagePath);
          } else {
            throw new Error('Could not fetch fresh URL');
          }
        } else {
          throw playError;
        }
      }
    } catch (error) {
      console.error('Playback error:', error);
      toast.error('Failed to play audio');
    } finally {
      setIsLoading(false);
    }
  };

  const button = (
    <Button
      variant="ghost"
      size="icon"
      onClick={togglePlayback}
      disabled={isLoading}
      aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
      className={`h-8 w-8 ${className}`}
      title={isPlaying ? 'Pause audio' : 'Play audio'}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isPlaying ? (
        <Pause className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      )}
    </Button>
  );

  if (listenForHint) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Listen for: {listenForHint}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
};
