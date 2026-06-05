import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MAYA_VOICE_ID } from '@/lib/constants/voice';
import { voiceController } from '@/lib/voiceController';
import { applyPronunciationOverrides } from '@/lib/speech/pronunciationOverrides';

interface AudioPlaybackOptions {
  voice?: string;
  fallbackToTTS?: boolean;
  playbackSpeed?: number; // 0.5 = half speed, 1.0 = normal, 1.5 = faster
}

/**
 * Phrase audio playback hook.
 *
 * As of the TTS-consolidation pass, ALL audio here goes through the same
 * ElevenLabs Maya voice the rest of the app uses, AND notifies the global
 * voiceController so the mic gate / Sync-Wait protocol stays correct.
 *
 * The previous browser-TTS fallback used a random OS voice and never
 * notified voiceController — that was the source of the "Maya's voice
 * suddenly switches and reads the last example" bug across exercises.
 */
export function usePhraseAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const setPlaying = (playing: boolean) => {
    setIsPlaying(playing);
    voiceController.notifySpeakingChanged(playing);
  };

  const playPhrase = useCallback(async (
    text: string,
    options: AudioPlaybackOptions = {}
  ) => {
    // Prevent double-play
    if (isPlaying || isLoading) {
      console.log('[usePhraseAudio] already playing or loading, ignoring request');
      return;
    }

    setLastError(null);
    setIsLoading(true);

    // Record what's about to be spoken so EchoFilter can detect parroting.
    voiceController.recordSpoken(text);

    try {
      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audioUrl = await generateMayaAudio(text);

      if (audioUrl) {
        await playAudioUrl(audioUrl, options.playbackSpeed || 1.0);
        return;
      }

      throw new Error('Maya TTS returned no audio');
    } catch (err) {
      console.warn('[usePhraseAudio] playback failed:', err);
      setLastError('audio-unavailable');
      toast({
        title: 'Audio unavailable',
        description: 'You can still read and practice the phrase.',
        variant: 'default',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, isLoading, toast]);

  const generateMayaAudio = async (text: string): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/text-to-speech-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': ANON_KEY,
          },
          // Always Maya — never a different voice id from this hook.
          body: JSON.stringify({ text, voiceId: MAYA_VOICE_ID, mode: 'natural' }),
        }
      );

      if (!response.ok) throw new Error(`TTS request failed: ${response.status}`);

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('[usePhraseAudio] ElevenLabs TTS failed:', error);
      return null;
    }
  };

  const playAudioUrl = async (url: string, speed: number = 1.0): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.playbackRate = speed;

      audio.onerror = () => {
        setLastError('audio-load-error');
        setPlaying(false);
        URL.revokeObjectURL(url);
        reject(new Error('Audio failed to load'));
      };

      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
        resolve();
      };

      audio.onpause = () => {
        setPlaying(false);
      };

      setPlaying(true);
      audio.play().catch((err) => {
        console.error('[usePhraseAudio] play failed:', err);
        setLastError('audio-play-error');
        setPlaying(false);
        URL.revokeObjectURL(url);
        reject(err);
      });
    });
  };

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
    setIsLoading(false);
  }, []);

  return {
    playPhrase,
    stop,
    isPlaying,
    isLoading,
    lastError,
  };
}
