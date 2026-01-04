import { useState, useEffect, useRef, useCallback } from 'react';

type RecognitionState = 'IDLE' | 'STARTING' | 'LISTENING' | 'STOPPING';

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
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
    enabled = true
  } = options;
  
  // Track if permission was denied to stop all restart attempts
  const permissionDeniedRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // State machine to prevent race conditions
  const stateRef = useRef<RecognitionState>('IDLE');
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const cooldownTimeoutRef = useRef<any>(null);
  const noSpeechCountRef = useRef(0);
  const manuallyStoppedRef = useRef(false);
  const pendingTranscriptRef = useRef<string>('');
  const lastProcessedTranscriptRef = useRef<string>('');
  const lastStopTimeRef = useRef<number>(0);
  
  // Cooldown period after stop before allowing restart (prevents race)
  const COOLDOWN_MS = 300;
  
  // Store callback in ref to avoid stale closures
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

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

    // Patient mode uses continuous recognition to avoid mic flickering
    recognition.continuous = patientMode;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
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
        
        // Clear pending transcript and process if not already processed
        pendingTranscriptRef.current = '';
        if (finalTranscript !== lastProcessedTranscriptRef.current) {
          lastProcessedTranscriptRef.current = finalTranscript;
          onResultRef.current(finalTranscript);
        }
      } else {
        // Show interim results and track for potential processing on end
        const interimTranscript = lastResult[0].transcript.trim().toLowerCase();
        setTranscript(interimTranscript);
        pendingTranscriptRef.current = interimTranscript;
      }
    };

    recognition.onerror = (event: any) => {
      console.error('🎤 Speech recognition error:', event.error);
      
      // Handle 'aborted' errors - DO NOT auto-restart
      if (event.error === 'aborted') {
        console.log('🎤 Recognition aborted - marking as manually stopped');
        manuallyStoppedRef.current = true;
        stateRef.current = 'IDLE';
        setIsListening(false);
        return;
      }
      
      if (event.error === 'no-speech') {
        // Patient mode: always restart on no-speech (unlimited restarts)
        // Standard mode: auto-restart if continuous listening is enabled (increased limit)
        const maxRestarts = patientMode ? 999 : 15;
        const shouldRestart = (patientMode || optContinuous) && noSpeechCountRef.current < maxRestarts && !manuallyStoppedRef.current;
        
        if (shouldRestart) {
          noSpeechCountRef.current += 1;
          console.log('🎤 No speech detected, auto-restarting (attempt', noSpeechCountRef.current, patientMode ? '/∞)' : '/15)');
          
          // Clear any existing restart timeout
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          
          // Schedule restart after brief pause
          stateRef.current = 'IDLE';
          restartTimeoutRef.current = setTimeout(() => {
            if (stateRef.current === 'IDLE' && !manuallyStoppedRef.current) {
              try {
                stateRef.current = 'STARTING';
                recognitionRef.current?.start();
                console.log('🎤 Successfully restarted after no-speech');
              } catch (err) {
                console.error('🎤 Failed to restart after no-speech:', err);
                stateRef.current = 'IDLE';
                setIsListening(false);
              }
            }
          }, 500);
          
          return;
        }
        
        setError('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        // Permission denied - set flag to prevent ALL restart attempts
        permissionDeniedRef.current = true;
        manuallyStoppedRef.current = true;
        setError('Microphone access denied. Please enable microphone permissions.');
        stateRef.current = 'IDLE';
        setIsListening(false);
        return; // Exit early, no restart
      } else {
        setError(`Error: ${event.error}`);
      }
      
      stateRef.current = 'IDLE';
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('🎤 Speech recognition ended, state was:', stateRef.current);
      const wasListening = stateRef.current === 'LISTENING' || stateRef.current === 'STOPPING';
      stateRef.current = 'IDLE';
      setIsListening(false);
      lastStopTimeRef.current = Date.now();
      
      // Process any pending interim transcript as final result if not already processed
      if (pendingTranscriptRef.current && 
          !manuallyStoppedRef.current &&
          pendingTranscriptRef.current !== lastProcessedTranscriptRef.current) {
        console.log('🎤 Processing pending transcript:', pendingTranscriptRef.current);
        lastProcessedTranscriptRef.current = pendingTranscriptRef.current;
        onResultRef.current(pendingTranscriptRef.current);
        pendingTranscriptRef.current = '';
      }
      
      // Auto-restart for continuous/patient mode if not manually stopped
      const maxRestarts = patientMode ? 999 : 15;
      const shouldRestart = (patientMode || optContinuous) && !manuallyStoppedRef.current && wasListening && noSpeechCountRef.current < maxRestarts;
      
      if (shouldRestart) {
        console.log('🎤 Scheduling auto-restart for', patientMode ? 'patient' : 'continuous', 'listening...');
        
        // Use cooldown timeout to prevent race
        if (cooldownTimeoutRef.current) {
          clearTimeout(cooldownTimeoutRef.current);
        }
        
        cooldownTimeoutRef.current = setTimeout(() => {
          if (stateRef.current === 'IDLE' && !manuallyStoppedRef.current) {
            try {
              stateRef.current = 'STARTING';
              recognitionRef.current?.start();
              console.log('🎤 Successfully auto-restarted');
            } catch (err) {
              console.error('🎤 Failed to auto-restart:', err);
              stateRef.current = 'IDLE';
            }
          }
        }, COOLDOWN_MS);
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
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
      }
    };
  }, [isSupported, optContinuous, patientMode]);

  const startListening = useCallback(() => {
    // Gate on enabled prop - if disabled, don't try to start
    if (!enabled) {
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
    
    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('🎤 Error starting recognition:', error);
      stateRef.current = 'IDLE';
      setError('Failed to start speech recognition');
    }
  }, [enabled]);

  const stopListening = useCallback(() => {
    // Only stop if actually listening or starting
    if (stateRef.current !== 'LISTENING' && stateRef.current !== 'STARTING') {
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
    startListening,
    stopListening,
    isSupported,
    error,
  };
};
