import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MAYA_VOICE_ID } from '@/lib/constants/voice';

// Get Supabase URL and anon key from the client
const SUPABASE_URL = 'https://wjedbpjaiqdxhmjzkcxo.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZWRicGphaXFkeGhtanprY3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NjgyNjcsImV4cCI6MjA3ODU0NDI2N30.tXfA1zdAqvCsZGKNlfn8OC48fhS4olS88kou0zyR7OA';

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

  // Browser TTS - reliable fallback that always works
  const speakBrowser = useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        console.warn('[TTS] Browser speech synthesis not supported');
        resolve();
        return;
      }

      console.log('[TTS] Starting browser TTS for:', text.substring(0, 50) + '...');
      
      // Cancel any ongoing speech first
      window.speechSynthesis.cancel();
      
      let hasResolved = false;
      const safeResolve = () => {
        if (!hasResolved) {
          hasResolved = true;
          setIsSpeaking(false);
          resolve();
        }
      };
      
      // Safety timeout - resolve after estimated speech duration + buffer
      const estimatedDuration = Math.max(3000, text.length * 80); // ~80ms per char, min 3s
      const safetyTimeout = setTimeout(() => {
        console.log('[TTS] Safety timeout reached, resolving');
        safeResolve();
      }, estimatedDuration);
      
      const attemptSpeak = () => {
        // Warm-up: speak a silent utterance first to prime the audio context
        // This prevents the first syllable from being clipped
        const warmup = new SpeechSynthesisUtterance('');
        warmup.volume = 0;
        window.speechSynthesis.speak(warmup);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Try to get a good, natural-sounding voice
        const voices = window.speechSynthesis.getVoices();
        console.log('[TTS] Available voices:', voices.length);
        
        // Voice preference order (best first)
        const preferredVoicePatterns = [
          // Natural/neural voices (best quality)
          /samantha/i,
          /karen/i,
          /moira/i,
          /tessa/i,
          /fiona/i,
          // Google voices (good quality on Chrome)
          /google.*female/i,
          /google.*us.*english/i,
          // Microsoft voices
          /zira/i,
          /hazel/i,
          /aria/i,
          // Apple voices
          /alex/i,
          // Generic fallbacks
          /female/i,
        ];
        
        let selectedVoice: SpeechSynthesisVoice | undefined;
        
        // Try each pattern in order of preference
        for (const pattern of preferredVoicePatterns) {
          selectedVoice = voices.find(v => 
            v.lang.startsWith('en') && pattern.test(v.name)
          );
          if (selectedVoice) break;
        }
        
        // Fallback to any English voice
        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.lang.startsWith('en') && v.localService);
        }
        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.lang.startsWith('en'));
        }
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          console.log('[TTS] Using voice:', selectedVoice.name);
        }
        
        setIsSpeaking(true);
        
        // Chrome workaround - keep speech synthesis active
        let keepAlive: ReturnType<typeof setInterval> | null = null;
        
        const cleanup = () => {
          clearTimeout(safetyTimeout);
          if (keepAlive) {
            clearInterval(keepAlive);
            keepAlive = null;
          }
        };
        
        utterance.onstart = () => {
          console.log('[TTS] Speech started (onstart fired)');
          // Chrome workaround for long text
          keepAlive = setInterval(() => {
            if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            }
          }, 10000);
        };
        
        utterance.onend = () => {
          console.log('[TTS] Speech ended (onend fired)');
          cleanup();
          safeResolve();
        };
        
        utterance.onerror = (event) => {
          console.warn('[TTS] Speech error:', event.error);
          cleanup();
          safeResolve();
        };
        
        console.log('[TTS] Calling speechSynthesis.speak()');
        window.speechSynthesis.speak(utterance);
        
        // Check if speaking actually started after a short delay
        setTimeout(() => {
          if (!window.speechSynthesis.speaking && !hasResolved) {
            console.warn('[TTS] Speech did not start, resolving anyway');
            cleanup();
            safeResolve();
          }
        }, 500);
      };
      
      // Check if voices are loaded
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        attemptSpeak();
      } else {
        // Wait for voices to load (needed on some browsers)
        console.log('[TTS] Waiting for voices to load...');
        const handleVoicesChanged = () => {
          window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
          attemptSpeak();
        };
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        
        // Fallback timeout in case voiceschanged never fires
        setTimeout(() => {
          window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
          if (!window.speechSynthesis.speaking && !hasResolved) {
            console.log('[TTS] Voices timeout, attempting to speak anyway');
            attemptSpeak();
          }
        }, 500);
      }
    });
  }, []);

  // Streaming TTS - uses ElevenLabs streaming for faster time-to-first-audio
  const speakStream = useCallback(async (
    text: string,
    options: TTSOptions = {}
  ): Promise<void> => {
    const { voiceId = MAYA_VOICE_ID } = options;

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
            'apikey': ANON_KEY,
          },
          body: JSON.stringify({ text, voiceId }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      // Check if the edge function signaled a fallback (billing/service issue)
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data.fallback) {
          console.warn('[TTS] Edge function signaled fallback:', data.error);
          throw new Error('TTS_FALLBACK');
        }
        throw new Error(data.error || 'TTS failed');
      }

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      // Try to use MediaSource for true streaming playback
      // Always use blob fallback — MediaSource streaming has fragile recursive pump() 
      // that can silently fail and leave the session stuck in tts_playing mode forever
      {
        // Fallback: wait for full blob then play
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        setIsLoading(false);
        setIsSpeaking(true);

        return new Promise((resolve, reject) => {
          // Safety timeout — never stay stuck in tts_playing for more than 30s
          const safetyTimeout = setTimeout(() => {
            console.warn('[TTS] Safety timeout — resolving after 30s');
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            resolve();
          }, 30000);

          audio.onended = () => {
            clearTimeout(safetyTimeout);
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            resolve();
          };

          audio.onerror = () => {
            clearTimeout(safetyTimeout);
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            // Don't reject — fall through gracefully so session continues
            console.warn('[TTS] Audio playback error, resolving gracefully');
            resolve();
          };

          audio.play().catch((playError) => {
            clearTimeout(safetyTimeout);
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            console.warn('[TTS] Play failed, falling back to browser:', playError);
            speakBrowser(text).then(resolve).catch(() => resolve());
          });
        });
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setIsLoading(false);
        return;
      }
      
      console.warn('Streaming TTS failed, using browser TTS:', err);
      setIsLoading(false);
      
      // Use browser TTS directly
      return speakBrowser(text);
    }
  }, [speakBrowser]);

  // Standard TTS — now routes through speakStream so ALL speech uses the same
  // ElevenLabs streaming pipeline and Maya always sounds like one person.
  const speak = useCallback(async (
    text: string, 
    options: TTSOptions = {}
  ): Promise<void> => {
    return speakStream(text, options);
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
