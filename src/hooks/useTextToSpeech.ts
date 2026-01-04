import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Get Supabase URL from the client
const SUPABASE_URL = 'https://wjedbpjaiqdxhmjzkcxo.supabase.co';

interface TTSOptions {
  voiceId?: string;
  autoPlay?: boolean;
  useStreaming?: boolean;
}

export const useTextToSpeech = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Streaming TTS - plays audio as chunks arrive
  const speakStream = useCallback(async (
    text: string,
    options: TTSOptions = {}
  ): Promise<void> => {
    const { voiceId = 'EXAVITQu4vr4xnSDxMaL' } = options; // Sarah voice

    setIsLoading(true);
    setIsSpeaking(false);
    setError(null);

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/text-to-speech-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZWRicGphaXFkeGhtanprY3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NjgyNjcsImV4cCI6MjA3ODU0NDI2N30.tXfA1zdAqvCsZGKNlfn8OC48fhS4olS88kou0zyR7OA',
          },
          body: JSON.stringify({ text, voiceId }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      // Get audio blob from stream
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      setIsLoading(false);
      setIsSpeaking(true);

      return new Promise((resolve, reject) => {
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audio.onerror = () => {
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
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setIsLoading(false);
        return;
      }
      
      console.warn('Streaming TTS failed, falling back to browser TTS:', err);
      setIsLoading(false);
      
      // Fallback directly to browser speech synthesis (avoids autoplay issues)
      return new Promise<void>((resolve) => {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1;
          
          window.speechSynthesis.cancel();
          setIsSpeaking(true);
          
          utterance.onend = () => {
            setIsSpeaking(false);
            resolve();
          };
          
          utterance.onerror = () => {
            setIsSpeaking(false);
            resolve();
          };
          
          window.speechSynthesis.speak(utterance);
        } else {
          resolve();
        }
      });
    }
  }, []);

  // Standard non-streaming TTS (fallback)
  const speak = useCallback(async (
    text: string, 
    options: TTSOptions = {}
  ): Promise<void> => {
    const { voiceId = 'nova', autoPlay = true, useStreaming = true } = options;

    // Use streaming by default for faster response
    if (useStreaming) {
      return speakStream(text, options);
    }

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

      // Use data URI for cleaner base64 audio handling
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
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
            resolve();
          };
          
          audio.onerror = () => {
            setIsSpeaking(false);
            reject(new Error('Audio playback failed'));
          };
          
          audio.play().catch((playError) => {
            setIsSpeaking(false);
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
  }, [speakStream]);

  const stop = useCallback(() => {
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  return {
    speak,
    speakStream,
    stop,
    isLoading,
    isSpeaking,
    error,
  };
};
