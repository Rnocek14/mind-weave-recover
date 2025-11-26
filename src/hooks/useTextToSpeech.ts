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
    const { voiceId = 'alloy', autoPlay = true } = options;

    setIsLoading(true);
    setError(null);

    try {
      // Try OpenAI TTS first
      const { data, error: functionError } = await supabase.functions.invoke(
        'text-to-speech',
        {
          body: { text, voice: voiceId }
        }
      );

      if (functionError || !data?.audioContent) {
        throw new Error(functionError?.message || 'No audio data received');
      }

      // Convert base64 to audio blob
      const binaryString = atob(data.audioContent);
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
      console.warn('OpenAI TTS failed, falling back to browser speech:', err);
      
      // Fallback to browser speech synthesis
      try {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1;
          window.speechSynthesis.cancel(); // Stop any ongoing speech
          if (autoPlay) {
            window.speechSynthesis.speak(utterance);
          }
        } else {
          throw new Error('Speech synthesis not available');
        }
      } catch (fallbackErr) {
        const errorMessage = fallbackErr instanceof Error ? fallbackErr.message : 'Failed to generate speech';
        console.error('TTS fallback error:', errorMessage);
        setError(errorMessage);
      }
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
