/**
 * Smart Speech End Detection Hook
 * 
 * Detects when a user has finished speaking by analyzing:
 * - Final transcript from browser (IMMEDIATE processing)
 * - Speech state classification (struggling → wait longer, complete → finalize)
 * - Silence duration (adaptive based on speech state)
 * - Transcript patterns (trailing "um", "and..." vs natural endings)
 * 
 * Priority: Final transcript > Speech state > Silence detection
 * 
 * IMPORTANT: Uses ref-based enabled check to avoid stale closure races.
 */

import { useRef, useCallback, useEffect } from 'react';
import { detectUtteranceComplete } from '@/lib/completionDetector';
import { classifySpeechState, type SpeechStateResult, type SpeechState } from '@/lib/speechStateClassifier';

interface UseSpeechEndDetectionOptions {
  /** Called when we're confident the user is done speaking */
  onSpeechEnd: (transcript: string) => void;
  /** Minimum silence for incomplete utterances (trailing off) - backup only */
  incompletesilenceMs?: number;
  /** Silence threshold for complete utterances (natural endings) - backup only */
  completesilenceMs?: number;
  /** Whether detection is active */
  enabled?: boolean;
  /** The prompt/target text (for reading detection) */
  promptText?: string;
  /** Called when speech state changes (for UI indicators) */
  onSpeechStateChange?: (state: SpeechStateResult) => void;
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
  /** Current speech state (for UI) */
  currentSpeechState: SpeechState | null;
}

export function useSpeechEndDetection({
  onSpeechEnd,
  incompletesilenceMs = 1000,
  completesilenceMs = 400,
  enabled = true,
  promptText,
  onSpeechStateChange,
}: UseSpeechEndDetectionOptions): SpeechEndDetection {
  
  const lastTranscriptRef = useRef<string>('');
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const startTimeRef = useRef<number>(Date.now());
  const silenceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredRef = useRef(false);
  const isActiveRef = useRef(false);
  const speechStateRef = useRef<SpeechState | null>(null);
  
  // REF-BASED enabled — no stale closure risk
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  
  const promptTextRef = useRef(promptText);
  useEffect(() => {
    promptTextRef.current = promptText;
  }, [promptText]);
  
  const onSpeechEndRef = useRef(onSpeechEnd);
  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd;
  }, [onSpeechEnd]);

  const onSpeechStateChangeRef = useRef(onSpeechStateChange);
  useEffect(() => {
    onSpeechStateChangeRef.current = onSpeechStateChange;
  }, [onSpeechStateChange]);

  const checkForSpeechEnd = useCallback(() => {
    if (!isActiveRef.current || !enabledRef.current || hasTriggeredRef.current) {
      return;
    }

    const transcript = lastTranscriptRef.current;
    const silenceDuration = Date.now() - lastUpdateTimeRef.current;
    const elapsed = Date.now() - startTimeRef.current;
    
    if (!transcript || transcript.trim().length === 0) {
      // Classify silence state
      if (silenceDuration > 1000) {
        const stateResult = classifySpeechState({
          transcript: '',
          elapsedMs: elapsed,
          silenceDurationMs: silenceDuration,
          promptText: promptTextRef.current,
        });
        speechStateRef.current = stateResult.state;
        onSpeechStateChangeRef.current?.(stateResult);
      }
      return;
    }
    
    // Classify current speech state
    const stateResult = classifySpeechState({
      transcript,
      elapsedMs: elapsed,
      silenceDurationMs: silenceDuration,
      promptText: promptTextRef.current,
    });
    
    speechStateRef.current = stateResult.state;
    onSpeechStateChangeRef.current?.(stateResult);
    
    // If classifier says suppress, don't auto-submit
    if (stateResult.suppressAutoSubmit) {
      return;
    }
    
    // Use completion detector for structural analysis
    const completion = detectUtteranceComplete(transcript);
    
    // Calculate adaptive threshold based on speech state
    let baseThreshold: number;
    if (completion.isComplete && completion.confidence === 'high') {
      baseThreshold = completesilenceMs;
    } else if (completion.isComplete && completion.confidence === 'medium') {
      baseThreshold = completesilenceMs + 500;
    } else {
      baseThreshold = incompletesilenceMs;
    }
    
    // Apply patience multiplier from speech state
    const silenceThreshold = Math.round(baseThreshold * stateResult.patienceMultiplier);
    
    if (silenceDuration >= silenceThreshold) {
      console.log('🎯 Speech end detected:', {
        transcript: transcript.slice(0, 50) + '...',
        silenceDuration,
        threshold: silenceThreshold,
        speechState: stateResult.state,
        patience: stateResult.patienceMultiplier,
        completion,
      });
      
      hasTriggeredRef.current = true;
      onSpeechEndRef.current(transcript);
    }
  }, [completesilenceMs, incompletesilenceMs]);

  const onTranscriptUpdate = useCallback((transcript: string, isFinal: boolean) => {
    if (!enabledRef.current) return;
    
    lastTranscriptRef.current = transcript;
    lastUpdateTimeRef.current = Date.now();
    
    if (isFinal && transcript.trim() && !hasTriggeredRef.current) {
      console.log('🎯 Final transcript received, triggering immediately:', transcript.slice(0, 50));
      hasTriggeredRef.current = true;
      onSpeechEndRef.current(transcript);
      return;
    }
  }, []);

  const onStart = useCallback(() => {
    lastTranscriptRef.current = '';
    lastUpdateTimeRef.current = Date.now();
    startTimeRef.current = Date.now();
    hasTriggeredRef.current = false;
    isActiveRef.current = true;
    speechStateRef.current = null;
    
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
    startTimeRef.current = Date.now();
    hasTriggeredRef.current = false;
    speechStateRef.current = null;
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
    currentSpeechState: speechStateRef.current,
  };
}
