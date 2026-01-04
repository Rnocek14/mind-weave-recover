import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TTSOptions {
  voiceId?: string;
  autoPlay?: boolean;
}

export const useTextToSpeech = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (
    text: string, 
    options: TTSOptions = {}
  ): Promise<void> => {
    const { voiceId = 'nova', autoPlay = true } = options;

    setIsLoading(true);
    setIsSpeaking(false);
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

      // Create new audio element
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      setIsLoading(false);

      if (autoPlay) {
        // Return a promise that resolves when audio FINISHES playing
        return new Promise((resolve, reject) => {
          setIsSpeaking(true);
          
          audio.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          
          audio.onerror = (e) => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            reject(new Error('Audio playback failed'));
          };
          
          audio.play().catch((playError) => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            reject(playError);
          });
        });
      }

    } catch (err) {
      console.warn('OpenAI TTS failed, falling back to browser speech:', err);
      setIsLoading(false);
      
      // Fallback to browser speech synthesis
      return new Promise((resolve, reject) => {
        try {
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            
            window.speechSynthesis.cancel(); // Stop any ongoing speech
            
            setIsSpeaking(true);
            
            utterance.onend = () => {
              setIsSpeaking(false);
              resolve();
            };
            
            utterance.onerror = (e) => {
              setIsSpeaking(false);
              // Don't reject on error, just resolve to continue flow
              console.warn('Browser TTS error:', e);
              resolve();
            };
            
            if (autoPlay) {
              window.speechSynthesis.speak(utterance);
            } else {
              setIsSpeaking(false);
              resolve();
            }
          } else {
            setIsSpeaking(false);
            reject(new Error('Speech synthesis not available'));
          }
        } catch (fallbackErr) {
          const errorMessage = fallbackErr instanceof Error ? fallbackErr.message : 'Failed to generate speech';
          console.error('TTS fallback error:', errorMessage);
          setError(errorMessage);
          setIsSpeaking(false);
          reject(fallbackErr);
        }
      });
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    speak,
    stop,
    isLoading,
    isSpeaking,
    error,
  };
};
