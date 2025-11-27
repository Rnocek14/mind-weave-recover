import { useState, useEffect, useRef, useCallback } from 'react';

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
  error: string | null;
}

export const useSpeechRecognition = (
  onResult: (transcript: string) => void,
  autoStart = false,
  continuousListening = false
): SpeechRecognitionHook => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const noSpeechCountRef = useRef(0);
  const isListeningRef = useRef(false);
  const manuallyStoppedRef = useRef(false);
  
  // Store callback in ref to avoid stale closures
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  // Keep isListeningRef in sync with state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

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

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      
      if (lastResult.isFinal) {
        const finalTranscript = lastResult[0].transcript.trim().toLowerCase();
        console.log('Final transcript:', finalTranscript);
        setTranscript(finalTranscript);
        
        // Reset no-speech counter on successful recognition
        noSpeechCountRef.current = 0;
        
        // Use ref to get latest callback, avoiding stale closure
        onResultRef.current(finalTranscript);
      } else {
        // Show interim results
        const interimTranscript = lastResult[0].transcript.trim().toLowerCase();
        setTranscript(interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      // Handle 'aborted' errors - DO NOT auto-restart
      if (event.error === 'aborted') {
        console.log('🎤 Recognition aborted - marking as manually stopped');
        manuallyStoppedRef.current = true; // Prevent auto-restart
        setIsListening(false);
        return; // Exit early, don't set user-facing error
      }
      
      if (event.error === 'no-speech') {
        // Auto-restart if continuous listening is enabled
        if (continuousListening && noSpeechCountRef.current < 5) {
          noSpeechCountRef.current += 1;
          console.log('🎤 No speech detected, auto-restarting (attempt', noSpeechCountRef.current, ')');
          
          // Clear any existing restart timeout
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          
          // Schedule restart after brief pause
          restartTimeoutRef.current = setTimeout(() => {
            try {
              recognitionRef.current?.start();
              console.log('🎤 Successfully restarted after no-speech');
            } catch (err) {
              console.error('🎤 Failed to restart after no-speech:', err);
              setIsListening(false);
            }
          }, 500);
          
          return; // Don't set error or stop listening
        }
        
        setError('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please enable microphone permissions.');
      } else {
        setError(`Error: ${event.error}`);
      }
      
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
      
      // Auto-restart for continuous mode if not manually stopped
      if (continuousListening && !manuallyStoppedRef.current && noSpeechCountRef.current < 5) {
        console.log('🎤 Auto-restarting continuous listening...');
        setTimeout(() => {
          try {
            if (recognitionRef.current && !manuallyStoppedRef.current) {
              recognitionRef.current.start();
              console.log('🎤 Successfully auto-restarted');
            }
          } catch (err) {
            console.error('🎤 Failed to auto-restart:', err);
          }
        }, 300);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [isSupported]); // Removed onResult from deps - using ref instead

  const startListening = useCallback(() => {
    // Use REF for current value, not stale closure
    if (!recognitionRef.current || isListeningRef.current) {
      console.log('🎤 startListening blocked:', { 
        hasRecognition: !!recognitionRef.current, 
        isListening: isListeningRef.current 
      });
      return;
    }
    
    console.log('🎤 Starting listening...');
    manuallyStoppedRef.current = false; // Clear manual stop flag
    setTranscript('');
    setError(null);
    
    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
      setError('Failed to start speech recognition');
    }
  }, []);

  const stopListening = useCallback(() => {
    // Use REF for current value
    if (!recognitionRef.current || !isListeningRef.current) return;
    
    console.log('🎤 Manually stopping listening...');
    manuallyStoppedRef.current = true; // Mark as intentional stop
    
    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    // Reset no-speech counter
    noSpeechCountRef.current = 0;
    
    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  }, []);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && isSupported && !isListening) {
      startListening();
    }
  }, [autoStart, isSupported, startListening, isListening]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
    error,
  };
};
