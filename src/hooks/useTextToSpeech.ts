import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MAYA_VOICE_ID, type MayaTtsMode } from '@/lib/constants/voice';
import { voiceController } from '@/lib/voiceController';
import { getUnlockedAudioElement } from '@/lib/audioUnlock';

// Wrap setIsSpeaking-style updates so the global VoiceController stays in
// sync with whichever component instance is currently driving TTS. Every game
// that needs Sync-Wait reads from the controller, not from its local state.
const notifyVC = (speaking: boolean) => voiceController.notifySpeakingChanged(speaking);

// Use environment variables for Supabase config
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface TTSOptions {
  voiceId?: string;
  autoPlay?: boolean;
  useStreaming?: boolean;
  /**
   * 'fast' (default) — eleven_turbo_v2_5, ~300ms TTFB, used for live conversation.
   * 'natural' — eleven_multilingual_v2, richer prosody for intros, summaries,
   *             instructions and any non-time-critical speech.
   */
  mode?: MayaTtsMode;
  /** Optional stitching context for multi-segment narration. */
  previousText?: string;
  nextText?: string;
}

let globalAudio: HTMLAudioElement | null = null;
let globalAudioUrl: string | null = null;
let globalAbortController: AbortController | null = null;

/**
 * Browser TTS fallback (window.speechSynthesis) is the source of the "rogue
 * second voice" users hear bleeding between exercises. We keep the code path
 * intact but gate it behind an env flag so production stays Maya-only.
 *
 * Set VITE_ALLOW_BROWSER_TTS_FALLBACK=true to re-enable for debugging.
 */
const ALLOW_BROWSER_TTS_FALLBACK =
  import.meta.env.VITE_ALLOW_BROWSER_TTS_FALLBACK === 'true';

export const stopGlobalTTS = () => {
  globalAbortController?.abort();
  globalAbortController = null;

  if (globalAudio) {
    globalAudio.pause();
    globalAudio.currentTime = 0;
    globalAudio = null;
  }

  if (globalAudioUrl) {
    URL.revokeObjectURL(globalAudioUrl);
    globalAudioUrl = null;
  }

  // Always cancel any pending browser-synth utterances, even when the
  // fallback is disabled — older audio may still be queued from earlier sessions.
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
};

export const useTextToSpeech = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Browser TTS - reliable fallback that always works.
  // Disabled by default so we never play OS voices (Samantha/Karen) over Maya.
  // Resolves immediately as a no-op when the fallback is off.
  const speakBrowser = useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!ALLOW_BROWSER_TTS_FALLBACK) {
        console.warn('[TTS] Browser fallback disabled — skipping utterance:', text.slice(0, 60));
        // Make sure no stale browser audio is still queued from a prior session.
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try { window.speechSynthesis.cancel(); } catch {}
        }
        setIsSpeaking(false); notifyVC(false);
        resolve();
        return;
      }
      if (!('speechSynthesis' in window)) {
        console.warn('[TTS] Browser speech synthesis not supported');
        resolve();
        return;
      }

      console.log('[TTS] Starting browser TTS for:', text.substring(0, 50) + '...');
      
      // Cancel any ongoing speech first, including audio from other exercises
      stopGlobalTTS();
      
      let hasResolved = false;
      const safeResolve = () => {
        if (!hasResolved) {
          hasResolved = true;
          setIsSpeaking(false); notifyVC(false);
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
        
        setIsSpeaking(true); notifyVC(true);
        
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
    const {
      voiceId = MAYA_VOICE_ID,
      mode = 'fast',
      previousText,
      nextText,
    } = options;

    setIsLoading(true);
    setIsSpeaking(false); notifyVC(false);
    setError(null);

      // Cancel any previous request/audio across all exercise instances
      stopGlobalTTS();
    abortControllerRef.current = new AbortController();
      globalAbortController = abortControllerRef.current;

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
          body: JSON.stringify({ text, voiceId, mode, previousText, nextText }),
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
        
        const audio = getUnlockedAudioElement(audioUrl);
        audio.volume = 1;
        audio.playbackRate = 1;
        audioRef.current = audio;
        globalAudio = audio;
        globalAudioUrl = audioUrl;
        
        setIsLoading(false);
        setIsSpeaking(true); notifyVC(true);

        return new Promise((resolve, reject) => {
          // Safety timeout — resolve quickly so session never stalls.
          // Keep the fallback buffer tight; VoiceController already adds a
          // post-speech tail lock, and long buffers leave the mic off.
          const audioDuration = audio.duration;
          const timeoutMs = (!isNaN(audioDuration) && audioDuration > 0) 
            ? Math.min((audioDuration + 0.4) * 1000, 60000)
            : 5000; // If duration unknown, 5s fallback
          const safetyTimeout = setTimeout(() => {
            console.warn(`[TTS] Safety timeout — resolving after ${timeoutMs}ms`);
            setIsSpeaking(false); notifyVC(false);
            if (globalAudio === audio) globalAudio = null;
            if (globalAudioUrl === audioUrl) globalAudioUrl = null;
            URL.revokeObjectURL(audioUrl);
            resolve();
          }, timeoutMs);

          // Also set a secondary timeout after metadata loads with accurate duration
          audio.onloadedmetadata = () => {
            if (!isNaN(audio.duration) && audio.duration > 0) {
              clearTimeout(safetyTimeout);
              const accurateTimeout = setTimeout(() => {
                console.warn('[TTS] Duration-based timeout — resolving');
                setIsSpeaking(false); notifyVC(false);
                if (globalAudio === audio) globalAudio = null;
                if (globalAudioUrl === audioUrl) globalAudioUrl = null;
                URL.revokeObjectURL(audioUrl);
                resolve();
              }, (audio.duration + 0.4) * 1000);
              // Store for cleanup
              (audio as any)._accurateTimeout = accurateTimeout;
            }
          };

          audio.onended = () => {
            clearTimeout(safetyTimeout);
            if ((audio as any)._accurateTimeout) clearTimeout((audio as any)._accurateTimeout);
            setIsSpeaking(false); notifyVC(false);
            if (globalAudio === audio) globalAudio = null;
            if (globalAudioUrl === audioUrl) globalAudioUrl = null;
            URL.revokeObjectURL(audioUrl);
            resolve();
          };

          audio.onerror = () => {
            clearTimeout(safetyTimeout);
            if ((audio as any)._accurateTimeout) clearTimeout((audio as any)._accurateTimeout);
            setIsSpeaking(false); notifyVC(false);
            if (globalAudio === audio) globalAudio = null;
            if (globalAudioUrl === audioUrl) globalAudioUrl = null;
            URL.revokeObjectURL(audioUrl);
            // Don't reject — fall through gracefully so session continues
            console.warn('[TTS] Audio playback error, falling back to browser TTS');
            speakBrowser(text).then(resolve).catch(() => resolve());
          };

          audio.play().catch((playError) => {
            clearTimeout(safetyTimeout);
            setIsSpeaking(false); notifyVC(false);
            if (globalAudio === audio) globalAudio = null;
            if (globalAudioUrl === audioUrl) globalAudioUrl = null;
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
    // Record what Maya is about to say so EchoFilter can detect parroting.
    voiceController.recordSpoken(text);
    return speakStream(text, options);
  }, [speakStream]);

  const stop = useCallback(() => {
    stopGlobalTTS();
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false); notifyVC(false);
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
