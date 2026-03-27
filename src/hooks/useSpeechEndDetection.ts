/**
 * Smart Speech End Detection Hook
 * 
 * Detects when a user has finished speaking by analyzing:
 * - Final transcript from browser (IMMEDIATE processing)
 * - Silence duration (backup only)
 * - Transcript patterns (trailing "um", "and..." vs natural endings)
 * 
 * Priority: Final transcript > Silence detection
 * 
 * IMPORTANT: Uses ref-based enabled check to avoid stale closure races.
 * The `enabled` value is synced to a ref immediately, so checks inside
 * callbacks always reflect the current truth — not a captured closure value.
 */

import { useRef, useCallback, useEffect } from 'react';
import { detectUtteranceComplete } from '@/lib/completionDetector';

interface UseSpeechEndDetectionOptions {
  /** Called when we're confident the user is done speaking */
  onSpeechEnd: (transcript: string) => void;
  /** Minimum silence for incomplete utterances (trailing off) - backup only */
  incompletesilenceMs?: number;
  /** Silence threshold for complete utterances (natural endings) - backup only */
  completesilenceMs?: number;
  /** Whether detection is active */
  enabled?: boolean;
}

interface SpeechEndDetection {
  /** Call this whenever the transcript updates (interim or final) */
  onTranscriptUpdate: (transcript: string, isFinal: boolean) => void;
  /** Call when speech recognition starts */
  onStart: () => void;
  /** Call when speech recognition stops (cleanup) */
  onStop: () => void;
  /** Reset the detection state */
  reset: () => void;
}

export function useSpeechEndDetection({
  onSpeechEnd,
  incompletesilenceMs = 1000,
  completesilenceMs = 400,
  enabled = true,
}: UseSpeechEndDetectionOptions): SpeechEndDetection {
  
  const lastTranscriptRef = useRef<string>('');
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const silenceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredRef = useRef(false);
  const isActiveRef = useRef(false);
  
  // REF-BASED enabled — no stale closure risk
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  
  const onSpeechEndRef = useRef(onSpeechEnd);
  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd;
  }, [onSpeechEnd]);

  const checkForSpeechEnd = useCallback(() => {
    // Use ref for enabled check — always current
    if (!isActiveRef.current || !enabledRef.current || hasTriggeredRef.current) {
      return;
    }

    const transcript = lastTranscriptRef.current;
    const silenceDuration = Date.now() - lastUpdateTimeRef.current;
    
    if (!transcript || transcript.trim().length === 0) {
      return;
    }
    
    const completion = detectUtteranceComplete(transcript);
    
    let silenceThreshold: number;
    if (completion.isComplete && completion.confidence === 'high') {
      silenceThreshold = completesilenceMs;
    } else if (completion.isComplete && completion.confidence === 'medium') {
      silenceThreshold = completesilenceMs + 500;
    } else {
      silenceThreshold = incompletesilenceMs;
    }
    
    if (silenceDuration >= silenceThreshold) {
      console.log('🎯 Speech end detected:', {
        transcript: transcript.slice(0, 50) + '...',
        silenceDuration,
        threshold: silenceThreshold,
        completion,
      });
      
      hasTriggeredRef.current = true;
      onSpeechEndRef.current(transcript);
    }
  }, [completesilenceMs, incompletesilenceMs]); // No `enabled` dependency — uses ref

  const onTranscriptUpdate = useCallback((transcript: string, isFinal: boolean) => {
    // Use ref for enabled check — always current
    if (!enabledRef.current) return;
    
    lastTranscriptRef.current = transcript;
    lastUpdateTimeRef.current = Date.now();
    
    if (isFinal && transcript.trim() && !hasTriggeredRef.current) {
      console.log('🎯 Final transcript received, triggering immediately:', transcript.slice(0, 50));
      hasTriggeredRef.current = true;
      onSpeechEndRef.current(transcript);
      return;
    }
  }, []); // No dependencies — uses refs for everything

  const onStart = useCallback(() => {
    lastTranscriptRef.current = '';
    lastUpdateTimeRef.current = Date.now();
    hasTriggeredRef.current = false;
    isActiveRef.current = true;
    
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
    }
    silenceCheckIntervalRef.current = setInterval(checkForSpeechEnd, 200);
    
    console.log('🎯 Speech end detection started');
  }, [checkForSpeechEnd]);

  const onStop = useCallback(() => {
    isActiveRef.current = false;
    
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    
    console.log('🎯 Speech end detection stopped');
  }, []);

  const reset = useCallback(() => {
    lastTranscriptRef.current = '';
    lastUpdateTimeRef.current = Date.now();
    hasTriggeredRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (silenceCheckIntervalRef.current) {
        clearInterval(silenceCheckIntervalRef.current);
      }
    };
  }, []);

  return {
    onTranscriptUpdate,
    onStart,
    onStop,
    reset,
  };
}
