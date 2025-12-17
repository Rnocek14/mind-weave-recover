import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AudioWaveform } from './AudioWaveform';

interface AudioPlaybackWithWaveformProps {
  storagePath: string;
  className?: string;
  showWaveform?: boolean;
}

export const AudioPlaybackWithWaveform = ({ 
  storagePath, 
  className = '',
  showWaveform = true
}: AudioPlaybackWithWaveformProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Fetch signed URL
  const fetchSignedUrl = async (): Promise<string | null> => {
    try {
      const { data } = await supabase.storage
        .from('session-recordings')
        .createSignedUrl(storagePath, 600);

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
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [storagePath]);

  const updateProgress = () => {
    if (audioRef.current) {
      const currentProgress = audioRef.current.currentTime / audioRef.current.duration;
      setProgress(isNaN(currentProgress) ? 0 : currentProgress);
      
      if (isPlaying && !audioRef.current.paused) {
        animationRef.current = requestAnimationFrame(updateProgress);
      }
    }
  };

  const togglePlayback = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    setIsLoading(true);
    try {
      let url = audioUrl;
      if (!url) {
        url = await fetchSignedUrl();
      }

      if (!url) {
        toast.error('Audio not available');
        setIsLoading(false);
        return;
      }

      // Create or reuse audio element
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
          setProgress(0);
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
        });
        audioRef.current.addEventListener('error', async () => {
          // Try fetching fresh URL
          const freshUrl = await fetchSignedUrl();
          if (freshUrl && audioRef.current) {
            audioRef.current.src = freshUrl;
            audioRef.current.play();
          }
        });
      }

      audioRef.current.src = url;
      await audioRef.current.play();
      setIsPlaying(true);
      animationRef.current = requestAnimationFrame(updateProgress);
    } catch (error) {
      console.error('Playback error:', error);
      toast.error('Failed to play audio');
    } finally {
      setIsLoading(false);
    }
  };

  if (!showWaveform) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlayback}
        disabled={isLoading}
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
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlayback}
        disabled={isLoading}
        className="h-8 w-8 shrink-0"
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
      <AudioWaveform 
        audioUrl={audioUrl} 
        isPlaying={isPlaying} 
        progress={progress}
        barCount={30}
      />
    </div>
  );
};
