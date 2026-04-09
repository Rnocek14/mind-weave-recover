/**
 * useAutoResponseMic — Reusable mic auto-response for Full Coaching mode.
 * 
 * After Maya finishes speaking (TTS ends), waits a configurable delay,
 * then auto-starts the microphone. Mode-aware: only activates in Full Coaching.
 * 
 * Coordinates with:
 * - useTextToSpeech (isSpeaking state)
 * - useVoiceGuidance (interrupt protocol)
 * - useSpeechRecognition (startListening/stopListening)
 * 
 * User action always wins — if user interacts manually, auto-start is cancelled.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useCoachingMode } from '@/contexts/CoachingModeContext';

export interface AutoResponseMicOptions {
  /** Delay in ms after TTS ends before auto-starting mic. Default 800ms */
  delayAfterTTS?: number;
  /** Whether the exercise is currently in a phase where mic should auto-start */
  enabled?: boolean;
  /** Is TTS currently speaking? */
  isTTSSpeaking?: boolean;
  /** Function to call to start listening */
  startListening: () => void;
  /** Is mic currently listening? */
  isListening?: boolean;
  /** Optional: callback when auto-start fires (for logging) */
  onAutoStart?: () => void;
}

export interface AutoResponseMicReturn {
  /** Trigger auto-start after a TTS prompt completes. Call this after await speak(). */
  scheduleAutoListen: () => void;
  /** Cancel any pending auto-start (e.g., user tapped something) */
  cancelAutoListen: () => void;
  /** Whether auto-response is active (Full Coaching + enabled) */
  isAutoResponseActive: boolean;
}

export function useAutoResponseMic({
  delayAfterTTS = 800,
  enabled = true,
  isTTSSpeaking = false,
  startListening,
  isListening = false,
  onAutoStart,
}: AutoResponseMicOptions): AutoResponseMicReturn {
  const { isVoiceLed } = useCoachingMode();
  const autoListenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const isAutoResponseActive = isVoiceLed && enabled;

  const cancelAutoListen = useCallback(() => {
    cancelledRef.current = true;
    if (autoListenTimerRef.current) {
      clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }
  }, []);

  const scheduleAutoListen = useCallback(() => {
    if (!isAutoResponseActive) return;

    // Cancel any previous pending auto-start
    cancelAutoListen();
    cancelledRef.current = false;

    autoListenTimerRef.current = setTimeout(() => {
      autoListenTimerRef.current = null;
      if (cancelledRef.current) return;
      if (!isAutoResponseActive) return;

      console.log('[AutoResponseMic] Auto-starting mic after TTS delay');
      onAutoStart?.();
      startListening();
    }, delayAfterTTS);
  }, [isAutoResponseActive, delayAfterTTS, startListening, onAutoStart, cancelAutoListen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoListenTimerRef.current) {
        clearTimeout(autoListenTimerRef.current);
      }
    };
  }, []);

  // Safety: if TTS starts speaking while we have a pending auto-listen, cancel it
  useEffect(() => {
    if (isTTSSpeaking && autoListenTimerRef.current) {
      cancelAutoListen();
    }
  }, [isTTSSpeaking, cancelAutoListen]);

  return {
    scheduleAutoListen,
    cancelAutoListen,
    isAutoResponseActive,
  };
}
