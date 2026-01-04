/**
 * Smart Speech End Detection Hook
 * 
 * Detects when a user has finished speaking by analyzing:
 * - Silence duration (no new speech)
 * - Transcript patterns (trailing "um", "and..." vs natural endings)
 * - Uses adaptive thresholds based on utterance completeness
 */

import { useRef, useCallback, useEffect } from 'react';
import { detectUtteranceComplete } from '@/lib/completionDetector';

interface UseSpeechEndDetectionOptions {
  /** Called when we're confident the user is done speaking */
  onSpeechEnd: (transcript: string) => void;
  /** Minimum silence for incomplete utterances (trailing off) - more patience */
  incompletesilenceMs?: number;
  /** Silence threshold for complete utterances (natural endings) */
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
  incompletesilenceMs = 4000, // 4s patience for "um", "and..."
  completesilenceMs = 2000,   // 2s for natural endings
  enabled = true,
}: UseSpeechEndDetectionOptions): SpeechEndDetection {
  
  const lastTranscriptRef = useRef<string>('');
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const silenceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredRef = useRef(false);
  const isActiveRef = useRef(false);
  
  const onSpeechEndRef = useRef(onSpeechEnd);
  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd;
  }, [onSpeechEnd]);

  const checkForSpeechEnd = useCallback(() => {
    if (!isActiveRef.current || !enabled || hasTriggeredRef.current) {
      return;
    }

    const transcript = lastTranscriptRef.current;
    const silenceDuration = Date.now() - lastUpdateTimeRef.current;
    
    // Need some speech to analyze
    if (!transcript || transcript.trim().length === 0) {
      return;
    }
    
    // Analyze utterance completeness
    const completion = detectUtteranceComplete(transcript);
    
    // Determine silence threshold based on completeness
    let silenceThreshold: number;
    if (completion.isComplete && completion.confidence === 'high') {
      // Natural ending detected - shorter wait
      silenceThreshold = completesilenceMs;
    } else if (completion.isComplete && completion.confidence === 'medium') {
      // Probably complete - medium wait
      silenceThreshold = completesilenceMs + 500;
    } else {
      // Trailing off ("um", "and...") or incomplete - more patience
      silenceThreshold = incompletesilenceMs;
    }
    
    // Check if we've been silent long enough
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
  }, [enabled, completesilenceMs, incompletesilenceMs]);

  const onTranscriptUpdate = useCallback((transcript: string, isFinal: boolean) => {
    if (!enabled) return;
    
    // Update tracking
    lastTranscriptRef.current = transcript;
    lastUpdateTimeRef.current = Date.now();
    
    // If it's a final transcript, trigger immediately - don't wait for silence
    if (isFinal && transcript.trim() && !hasTriggeredRef.current) {
      console.log('🎯 Final transcript received, triggering immediately:', transcript.slice(0, 50));
      hasTriggeredRef.current = true;
      onSpeechEndRef.current(transcript);
      return;
    }
  }, [enabled]);

  const onStart = useCallback(() => {
    // Reset state
    lastTranscriptRef.current = '';
    lastUpdateTimeRef.current = Date.now();
    hasTriggeredRef.current = false;
    isActiveRef.current = true;
    
    // Start checking for silence
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
    }
    silenceCheckIntervalRef.current = setInterval(checkForSpeechEnd, 500);
    
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

  // Cleanup on unmount
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
