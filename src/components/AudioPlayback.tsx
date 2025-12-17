import { useState, useRef, useEffect } from 'react';
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load signed URL (short-lived, scoped by RLS to current user)
    const loadAudio = async () => {
      try {
        const { data } = await supabase.storage
          .from('session-recordings')
          .createSignedUrl(storagePath, 3600); // 1 hour expiry

        if (data?.signedUrl) {
          setAudioUrl(data.signedUrl);
        }
      } catch (error) {
        console.error('Failed to load audio:', error);
      }
    };

    loadAudio();
  }, [storagePath]);

  // Sync isPlaying state with global audio manager
  useEffect(() => {
    const checkPlaying = () => {
      setIsPlaying(audioManager.isPlaying(audioRef.current));
    };
    
    // Check periodically in case another audio started
    const interval = setInterval(checkPlaying, 100);
    return () => clearInterval(interval);
  }, []);

  const togglePlayback = async () => {
    if (!audioUrl) {
      toast.error('Audio not available');
      return;
    }

    try {
      if (isPlaying) {
        audioManager.stop();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        // Global manager stops any other playing audio automatically
        const audio = await audioManager.play(audioUrl, () => {
          setIsPlaying(false);
          audioRef.current = null;
        });
        audioRef.current = audio;
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Playback error:', error);
      toast.error('Failed to play audio');
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={togglePlayback}
      disabled={!audioUrl || isLoading}
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
