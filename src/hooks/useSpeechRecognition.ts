import { useState, useEffect, useRef, useCallback } from 'react';

type RecognitionState = 'IDLE' | 'STARTING' | 'LISTENING' | 'STOPPING' | 'RESTARTING';

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  /** Full accumulated transcript across all recognition restarts (discourse mode) */
  fullTranscript: string;
  /** Clear all visible and accumulated transcript state without changing mic state */
  resetTranscript: () => void;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
  error: string | null;
}

interface UseSpeechRecognitionOptions {
  onResult: (transcript: string) => void;
  autoStart?: boolean;
  continuousListening?: boolean;
  /** Patient mode: keeps mic on continuously, no auto-end on silence */
  patientMode?: boolean;
  /** If false, all recognition attempts are blocked. Use to gate on permission status. */
  enabled?: boolean;
  /**
   * Discourse mode: accumulates transcripts across recognition restarts
   * instead of replacing. Use for story retell, planning, conversation —
   * any task where the user speaks multiple sentences.
   */
  discourseMode?: boolean;
}

export const useSpeechRecognition = (
  onResultOrOptions: ((transcript: string) => void) | UseSpeechRecognitionOptions,
  autoStart = false,
  continuousListening = false
): SpeechRecognitionHook => {
  // Support both old signature and new options object
  const options: UseSpeechRecognitionOptions = typeof onResultOrOptions === 'function'
    ? { onResult: onResultOrOptions, autoStart, continuousListening, patientMode: false, enabled: true }
    : onResultOrOptions;
  
  const { 
    onResult, 
    autoStart: optAutoStart = false, 
    continuousListening: optContinuous = false,
    patientMode = false,
    enabled = true,
    discourseMode = false,
  } = options;
  
  // Track if permission was denied to stop all restart attempts
  const permissionDeniedRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [fullTranscript, setFullTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // State machine to prevent race conditions
  const stateRef = useRef<RecognitionState>('IDLE');
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const cooldownTimeoutRef = useRef<any>(null);
  const queuedStartTimeoutRef = useRef<any>(null);
  const noSpeechCountRef = useRef(0);
  const manuallyStoppedRef = useRef(false);
  const pendingTranscriptRef = useRef<string>('');
  const lastProcessedTranscriptRef = useRef<string>('');
  const lastStopTimeRef = useRef<number>(0);
  const enabledRef = useRef(enabled);
  
  // Discourse accumulation
  const accumulatedTranscriptRef = useRef<string[]>([]);
  
  // Cooldown period after stop before allowing restart (prevents race)
  const COOLDOWN_MS = 300;
  
  // Store callback in ref to avoid stale closures
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  
  // Keep enabled ref updated
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Check if Speech Recognition is supported
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    const clearRestartTimers = () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
        cooldownTimeoutRef.current = null;
      }
      if (queuedStartTimeoutRef.current) {
        clearTimeout(queuedStartTimeoutRef.current);
        queuedStartTimeoutRef.current = null;
      }
    };

    const scheduleRestartAttempt = (attempt = 0) => {
      const restartDelays = [COOLDOWN_MS, 450, 700, 1000, 1400];

      if (attempt >= restartDelays.length) {
        console.error('🎤 Failed to auto-restart after max attempts');
        stateRef.current = 'IDLE';
        setIsListening(false);
        setError('Microphone paused. Please tap Voice Off, then On.');
        return;
      }

      clearRestartTimers();
      restartTimeoutRef.current = setTimeout(() => {
        restartTimeoutRef.current = null;

        if (manuallyStoppedRef.current) {
          return;
        }

        try {
          stateRef.current = 'STARTING';
          recognitionRef.current?.start();
          console.log(`🎤 Restart attempt ${attempt + 1}/${restartDelays.length}`);
        } catch (err) {
          console.error('🎤 Restart attempt failed:', err);
          stateRef.current = 'RESTARTING';
          scheduleRestartAttempt(attempt + 1);
        }
      }, restartDelays[attempt]);
    };

    // Patient mode uses continuous recognition to avoid mic flickering
    recognition.continuous = patientMode;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
      clearRestartTimers();
      console.log('🎤 Speech recognition started');
      stateRef.current = 'LISTENING';
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      
      if (lastResult.isFinal) {
        const finalTranscript = lastResult[0].transcript.trim().toLowerCase();
        console.log('🎤 Final transcript:', finalTranscript);
        setTranscript(finalTranscript);
        
        // Reset no-speech counter on successful recognition
        noSpeechCountRef.current = 0;
        
        // In discourse mode, accumulate all final segments
        if (discourseMode && finalTranscript) {
          accumulatedTranscriptRef.current.push(finalTranscript);
          const full = accumulatedTranscriptRef.current.join(' ');
          setFullTranscript(full);
          
          // Fire callback with accumulated transcript
          if (full !== lastProcessedTranscriptRef.current) {
            lastProcessedTranscriptRef.current = full;
            pendingTranscriptRef.current = '';
            onResultRef.current(full);
          }
        } else {
          // Standard mode: fire with just this segment
          pendingTranscriptRef.current = '';
          if (finalTranscript !== lastProcessedTranscriptRef.current) {
            lastProcessedTranscriptRef.current = finalTranscript;
            onResultRef.current(finalTranscript);
          }
        }
      } else {
        // Show interim results
        const interimTranscript = lastResult[0].transcript.trim().toLowerCase();
        setTranscript(interimTranscript);
        pendingTranscriptRef.current = interimTranscript;
        
        // In discourse mode, show accumulated + current interim
        if (discourseMode) {
          const accumulated = accumulatedTranscriptRef.current.join(' ');
          const combined = accumulated ? `${accumulated} ${interimTranscript}` : interimTranscript;
          setFullTranscript(combined);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('🎤 Speech recognition error:', event.error);
      
      // Handle 'aborted' errors - don't auto-restart but allow manual restart
      if (event.error === 'aborted') {
        console.log('🎤 Recognition aborted - state reset (manual restart still allowed)');
        clearRestartTimers();
        stateRef.current = 'IDLE';
        setIsListening(false);
        return;
      }
      
      if (event.error === 'no-speech') {
        // Let onend handle the single restart path so we don't double-start and flicker the UI
        const maxRestarts = patientMode ? 999 : 15;
        const shouldRestart = (patientMode || optContinuous) && noSpeechCountRef.current < maxRestarts && !manuallyStoppedRef.current;
        
        if (shouldRestart) {
          noSpeechCountRef.current += 1;
          console.log('🎤 No speech detected, waiting for end event before restart (attempt', noSpeechCountRef.current, patientMode ? '/∞)' : '/15)');
          stateRef.current = 'RESTARTING';
          return;
        }
        
        setError('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        // Permission denied - set flag to prevent ALL restart attempts
        permissionDeniedRef.current = true;
        manuallyStoppedRef.current = true;
        clearRestartTimers();
        setError('Microphone access denied. Please enable microphone permissions.');
        stateRef.current = 'IDLE';
        setIsListening(false);
        return; // Exit early, no restart
      } else {
        clearRestartTimers();
        setError(`Error: ${event.error}`);
      }
      
      stateRef.current = 'IDLE';
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('🎤 Speech recognition ended, state was:', stateRef.current);
      const restartingAfterSilence = stateRef.current === 'RESTARTING';
      const shouldHoldListeningUi = restartingAfterSilence || (patientMode && !manuallyStoppedRef.current);
      const wasListening = stateRef.current === 'LISTENING' || stateRef.current === 'STOPPING' || restartingAfterSilence;
      stateRef.current = 'IDLE';
      if (!shouldHoldListeningUi) {
        setIsListening(false);
      }
      lastStopTimeRef.current = Date.now();
      
      // Process any pending interim transcript as final result if not already processed
      if (pendingTranscriptRef.current && 
          !manuallyStoppedRef.current) {
        const pending = pendingTranscriptRef.current;
        pendingTranscriptRef.current = '';
        
        if (discourseMode && pending) {
          // Accumulate the pending interim as a final segment
          accumulatedTranscriptRef.current.push(pending);
          const full = accumulatedTranscriptRef.current.join(' ');
          setFullTranscript(full);
          if (full !== lastProcessedTranscriptRef.current) {
            lastProcessedTranscriptRef.current = full;
            onResultRef.current(full);
          }
        } else if (pending !== lastProcessedTranscriptRef.current) {
          console.log('🎤 Processing pending transcript:', pending);
          lastProcessedTranscriptRef.current = pending;
          onResultRef.current(pending);
        }
      }
      
      // Auto-restart for continuous/patient mode if not manually stopped
      const maxRestarts = patientMode ? 999 : 15;
      const shouldRestart = (patientMode || optContinuous) && !manuallyStoppedRef.current && wasListening && noSpeechCountRef.current < maxRestarts;
      
      if (shouldRestart) {
        console.log('🎤 Scheduling auto-restart for', patientMode ? 'patient' : 'continuous', 'listening...');
        stateRef.current = 'RESTARTING';
        scheduleRestartAttempt(0);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
      clearRestartTimers();
    };
  }, [isSupported, optContinuous, patientMode, discourseMode]);


  const startListening = useCallback(() => {
    // Gate on enabled prop - if disabled, don't try to start
    if (!enabledRef.current) {
      console.log('🎤 startListening blocked - recognition disabled (permission not granted)');
      return;
    }
    
    // Gate on permission denied - once denied, don't try again
    if (permissionDeniedRef.current) {
      console.log('🎤 startListening blocked - permission was denied');
      return;
    }
    
    // State machine guard: only start from IDLE
    if (stateRef.current !== 'IDLE') {
      console.log('🎤 startListening blocked - state is:', stateRef.current);
      return;
    }
    
    // Cooldown guard: prevent rapid start after stop
    const timeSinceStop = Date.now() - lastStopTimeRef.current;
    if (timeSinceStop < COOLDOWN_MS) {
      console.log('🎤 startListening blocked - in cooldown period');
      return;
    }
    
    if (!recognitionRef.current) {
      console.log('🎤 startListening blocked - no recognition instance');
      return;
    }
    
    console.log('🎤 Starting listening...');
    stateRef.current = 'STARTING';
    manuallyStoppedRef.current = false;
    setTranscript('');
    setError(null);
    
    // Reset accumulated transcript on fresh start
    if (discourseMode) {
      accumulatedTranscriptRef.current = [];
      setFullTranscript('');
      lastProcessedTranscriptRef.current = '';
    }
    
    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('🎤 Error starting recognition:', error);
      stateRef.current = 'IDLE';
      setError('Failed to start speech recognition');
    }
  }, [discourseMode]);

  const resetTranscript = useCallback(() => {
    pendingTranscriptRef.current = '';
    lastProcessedTranscriptRef.current = '';
    accumulatedTranscriptRef.current = [];
    setTranscript('');
    setFullTranscript('');
  }, []);

  const stopListening = useCallback(() => {
    // Only stop if recognition is active or auto-restarting
    if (
      stateRef.current !== 'LISTENING' &&
      stateRef.current !== 'STARTING' &&
      stateRef.current !== 'RESTARTING'
    ) {
      console.log('🎤 stopListening - already stopped, state:', stateRef.current);
      return;
    }
    
    console.log('🎤 Manually stopping listening...');
    stateRef.current = 'STOPPING';
    manuallyStoppedRef.current = true;
    
    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }
    
    // Reset no-speech counter
    noSpeechCountRef.current = 0;
    
    try {
      recognitionRef.current?.stop();
    } catch (error) {
      console.error('🎤 Error stopping recognition:', error);
      stateRef.current = 'IDLE';
      setIsListening(false);
    }
  }, []);

  // Auto-start if requested
  useEffect(() => {
    if (optAutoStart && isSupported && stateRef.current === 'IDLE') {
      startListening();
    }
  }, [optAutoStart, isSupported, startListening]);

  return {
    isListening,
    transcript,
    fullTranscript,
    resetTranscript,
    startListening,
    stopListening,
    isSupported,
    error,
  };
};
