import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AudioPlaybackOptions {
  voice?: string;
  fallbackToTTS?: boolean;
  playbackSpeed?: number; // 0.5 = half speed, 1.0 = normal, 1.5 = faster
}

/**
 * Bulletproof audio playback hook with fallback chain
 * Phase 1: OpenAI TTS → Browser TTS → Text display
 * Never crashes the UI, always degrades gracefully
 */
export function usePhraseAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playPhrase = useCallback(async (
    text: string,
    options: AudioPlaybackOptions = {}
  ) => {
    // Prevent double-play
    if (isPlaying || isLoading) {
      console.log('Audio already playing or loading, ignoring request');
      return;
    }

    setLastError(null);
    setIsLoading(true);

    try {
      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Try OpenAI TTS first
      const audioUrl = await generateOpenAIAudio(text, options.voice);
      
      if (audioUrl) {
        await playAudioUrl(audioUrl, options.playbackSpeed || 1.0);
        return;
      }

      // Fallback to browser TTS
      throw new Error('OpenAI TTS failed, trying browser fallback');

    } catch (primaryError) {
      console.warn('Primary audio failed:', primaryError);
      
      // Try browser TTS fallback
      try {
        await speakWithBrowserTTS(text, options.playbackSpeed || 1.0);
      } catch (fallbackError) {
        console.error('All audio methods failed:', fallbackError);
        setLastError('audio-unavailable');
        
        // Show gentle error message
        toast({
          title: "Audio unavailable",
          description: "You can still read and practice the phrase.",
          variant: "default",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, isLoading, toast]);

  const generateOpenAIAudio = async (
    text: string,
    _voice: string = 'alloy'
  ): Promise<string | null> => {
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
          body: JSON.stringify({ text, voiceId: 'XrExE9yKIg1WjnnlVkGX' }),
        }
      );

      if (!response.ok) throw new Error(`TTS request failed: ${response.status}`);

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('ElevenLabs TTS failed:', error);
      return null;
    }
  };

  const playAudioUrl = async (url: string, speed: number = 1.0): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      
      // Set playback speed for accessibility
      audio.playbackRate = speed;

      audio.onerror = () => {
        setLastError('audio-load-error');
        setIsPlaying(false);
        reject(new Error('Audio failed to load'));
      };

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
        resolve();
      };

      audio.onpause = () => {
        setIsPlaying(false);
      };

      setIsPlaying(true);
      audio.play().catch((err) => {
        console.error('Audio play failed:', err);
        setLastError('audio-play-error');
        setIsPlaying(false);
        reject(err);
      });
    });
  };

  const speakWithBrowserTTS = async (text: string, speed: number = 1.0): Promise<void> => {
    if (!('speechSynthesis' in window)) {
      throw new Error('Browser TTS not supported');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed; // Set playback speed
      
      utterance.onstart = () => {
        setIsPlaying(true);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        resolve();
      };

      utterance.onerror = (error) => {
        setIsPlaying(false);
        reject(error);
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    setIsPlaying(false);
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
