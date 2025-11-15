import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TTSOptions {
  voiceId?: string;
  autoPlay?: boolean;
}

export const useTextToSpeech = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (
    text: string, 
    options: TTSOptions = {}
  ): Promise<void> => {
    const { voiceId = 'EXAVITQu4vr4xnSDxMaL', autoPlay = true } = options;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'text-to-speech-elevenlabs',
        {
          body: { text, voiceId }
        }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data?.audioBase64) {
        throw new Error('No audio data received');
      }

      // Convert base64 to audio blob
      const binaryString = atob(data.audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      // Create and play new audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      if (autoPlay) {
        await audio.play();
      }

      // Cleanup on end
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate speech';
      console.error('TTS error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return {
    speak,
    stop,
    isLoading,
    error,
  };
};
