/**
 * ConversationCoachGame - Beautiful, fluid conversation coach
 * 
 * Features:
 * - Proper mic permission handling with retry
 * - AI speaks, then automatically listens
 * - Smart silence detection for natural flow
 * - Beautiful animated UI with gradient backgrounds
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Loader2, MessageCircle, Sparkles, X, CheckCircle2, RefreshCw } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useCoachSession } from '@/hooks/useCoachSession';
import { useSpeechEndDetection } from '@/hooks/useSpeechEndDetection';
import { CoachChatFeed } from '@/components/coach/CoachChatFeed';
import { cn } from '@/lib/utils';

interface ConversationCoachGameProps {
  userId: string;
  profileId: string;
  sessionId: string | null;
  onComplete?: (metrics: {
    turnsCompleted: number;
    cardsCompleted: number;
    avgLatencyMs: number;
    userAIRatio: number;
  }) => void;
  onExit?: () => void;
}

type ConversationState = 'idle' | 'ai_speaking' | 'listening' | 'processing';

export function ConversationCoachGame({
  userId,
  profileId,
  sessionId,
  onComplete,
  onExit,
}: ConversationCoachGameProps) {
  const [userTranscript, setUserTranscript] = useState('');
  const [micPermission, setMicPermission] = useState<'pending' | 'checking' | 'granted' | 'denied'>('pending');
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  
  const speechStartTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);

  const { speak, isLoading: ttsLoading, isSpeaking } = useTextToSpeech();
  
  const {
    messages,
    isComplete,
    isProcessing,
    metrics,
    currentPhase,
    startSession,
    processUserTurn,
    handleCardComplete,
    clearPendingAI,
    reset,
  } = useCoachSession({
    userId,
    profileId,
    sessionId,
    maxTurns: 5,
  });

  // Request microphone permission (only call on user gesture)
  const requestMicPermission = useCallback(async () => {
    setMicPermission('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Release immediately
      setMicPermission('granted');
      return true;
    } catch (err) {
      console.error('Mic permission denied:', err);
      setMicPermission('denied');
      return false;
    }
  }, []);

  // Check mic permission status on mount and listen for changes
  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;
    
    const handlePermissionChange = () => {
      if (permissionStatus) {
        if (permissionStatus.state === 'granted') {
          setMicPermission('granted');
        } else if (permissionStatus.state === 'denied') {
          setMicPermission('denied');
        } else {
          setMicPermission('pending');
        }
      }
    };
    
    const checkPermission = async () => {
      try {
        if (navigator.permissions) {
          permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          
          // Set initial state
          if (permissionStatus.state === 'granted') {
            setMicPermission('granted');
          } else if (permissionStatus.state === 'denied') {
            setMicPermission('denied');
          }
          // 'prompt' stays as 'pending'
          
          // Listen for permission changes (e.g., user changes in browser settings)
          permissionStatus.addEventListener('change', handlePermissionChange);
        }
      } catch {
        // Permissions API not supported, leave as pending
      }
    };
    checkPermission();
    
    return () => {
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', handlePermissionChange);
      }
    };
  }, []);

  // Process turn and speak AI response - defined early so it can be referenced
  const processTurnAndRespondRef = useRef<(transcript: string) => Promise<void>>();
  const startConversationTurnRef = useRef<() => void>();
  
  // Smart speech end detection - must be declared before useSpeechRecognition
  const speechEndDetection = useSpeechEndDetection({
    onSpeechEnd: (transcript) => {
      console.log('🎯 Speech end detected:', transcript.slice(0, 50));
      processTurnAndRespondRef.current?.(transcript);
    },
    incompletesilenceMs: 1500, // Reduced from 3500ms
    completesilenceMs: 800,    // Reduced from 2000ms
    enabled: conversationState === 'listening',
  });

  // Speech recognition - uses speechEndDetection
  const { isListening, transcript: liveTranscript, startListening, stopListening, isSupported, error: speechError } = useSpeechRecognition({
    onResult: (transcript) => {
      // This is called with the FINAL transcript from speech recognition
      console.log('🎤 Received final transcript:', transcript);
      if (!firstWordTimeRef.current && transcript.trim().length > 0) {
        firstWordTimeRef.current = Date.now();
      }
      setUserTranscript(transcript);
      // Signal as final transcript - this will trigger processing
      speechEndDetection.onTranscriptUpdate(transcript, true);
    },
    patientMode: true,
    continuousListening: false,
    enabled: micPermission === 'granted',
  });
  
  // Track interim (live) transcript for UI updates
  useEffect(() => {
    if (liveTranscript && conversationState === 'listening') {
      setUserTranscript(liveTranscript);
      
      if (!firstWordTimeRef.current && liveTranscript.trim().length > 0) {
        firstWordTimeRef.current = Date.now();
      }
      
      // Update speech end detection with interim result
      speechEndDetection.onTranscriptUpdate(liveTranscript, false);
    }
  }, [liveTranscript, conversationState, speechEndDetection]);

  // Process turn and speak AI response
  const processTurnAndRespond = useCallback(async (transcript: string) => {
    if (isProcessingRef.current || !transcript.trim()) return;
    isProcessingRef.current = true;
    
    // Stop listening first
    stopListening();
    setConversationState('processing');

    const latencyMs = firstWordTimeRef.current && speechStartTimeRef.current
      ? firstWordTimeRef.current - speechStartTimeRef.current
      : null;

    const aiResponse = await processUserTurn(transcript, latencyMs);
    
    if (aiResponse && currentPhase !== 'card_active') {
      setConversationState('ai_speaking');
      
      try {
        await speak(aiResponse);
      } catch (err) {
        console.warn('TTS failed, continuing:', err);
      }
      
      clearPendingAI();
      
      // Auto-start listening IMMEDIATELY after AI finishes (no delay)
      if (!isComplete) {
        setConversationState('listening');
        startConversationTurnRef.current?.();
      } else {
        setConversationState('idle');
      }
    } else {
      setConversationState('idle');
    }

    setUserTranscript('');
    isProcessingRef.current = false;
  }, [processUserTurn, speak, clearPendingAI, currentPhase, isComplete, stopListening]);

  // Keep the refs updated
  useEffect(() => {
    processTurnAndRespondRef.current = processTurnAndRespond;
  }, [processTurnAndRespond]);

  const startConversationTurn = useCallback(() => {
    console.log('[Coach] Starting conversation turn - will listen');
    setUserTranscript('');
    firstWordTimeRef.current = null;
    speechStartTimeRef.current = Date.now();
    isProcessingRef.current = false;
    speechEndDetection.onStart();
    setConversationState('listening');
    console.log('[Coach] Calling startListening()');
    startListening();
  }, [speechEndDetection, startListening]);
  
  // Keep startConversationTurn ref updated
  useEffect(() => {
    startConversationTurnRef.current = startConversationTurn;
  }, [startConversationTurn]);

  // Start conversation (requests permission first)
  const handleStart = async () => {
    // Request permission on this user gesture
    const hasPermission = micPermission === 'granted' || await requestMicPermission();
    if (!hasPermission) return;
    
    const opener = startSession();
    setConversationState('ai_speaking');
    
    try {
      await speak(opener);
    } catch (err) {
      console.warn('TTS failed:', err);
    }
    
    clearPendingAI();
    
    // Auto-start listening IMMEDIATELY after AI finishes (no delay)
    setConversationState('listening');
    startConversationTurn();
  };

  // Cleanup on stop
  useEffect(() => {
    if (!isListening && conversationState === 'listening') {
      speechEndDetection.onStop();
    }
  }, [isListening, conversationState, speechEndDetection]);

  // Handle card completion
  const handleCardDone = async (messageId: string, result: unknown) => {
    const outroText = handleCardComplete(messageId, result);
    
    if (outroText) {
      setConversationState('ai_speaking');
      
      try {
        await speak(outroText);
      } catch (err) {
        console.warn('TTS failed:', err);
      }
      
      clearPendingAI();
      
      // Auto-start listening IMMEDIATELY after card outro (no delay)
      if (!isComplete) {
        setConversationState('listening');
        startConversationTurn();
      } else {
        setConversationState('idle');
      }
    }
  };

  const handleFinish = () => {
    if (onComplete) {
      const userAIRatio = metrics.totalAIWords > 0
        ? (metrics.totalUserWords / metrics.totalAIWords) * 100
        : 100;
      onComplete({
        turnsCompleted: metrics.turnsCompleted,
        cardsCompleted: metrics.cardsCompleted,
        avgLatencyMs: metrics.avgLatencyMs,
        userAIRatio,
      });
    }
  };

  // Handle retry for denied permission
  const handleRetryPermission = async () => {
    setMicPermission('pending');
    await requestMicPermission();
  };

  if (!isSupported) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-gradient-calm">
        <div className="text-center p-8 max-w-md bg-card rounded-3xl shadow-card">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <MicOff className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold mb-3">Speech Not Supported</h2>
          <p className="text-muted-foreground text-lg">
            Your browser doesn't support speech recognition. Please try Chrome or Edge on desktop.
          </p>
        </div>
      </div>
    );
  }

  if (micPermission === 'denied') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-gradient-calm">
        <div className="text-center p-8 max-w-md bg-card rounded-3xl shadow-card">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
            <MicOff className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="text-2xl font-semibold mb-3">Microphone Blocked</h2>
          <p className="text-muted-foreground mb-4">
            Your browser has blocked microphone access. To fix this:
          </p>
          <ol className="text-left text-muted-foreground mb-6 space-y-2 text-sm bg-muted/50 p-4 rounded-xl">
            <li className="flex gap-2">
              <span className="font-medium text-foreground">1.</span>
              Click the 🔒 lock icon in your browser's address bar
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">2.</span>
              Find "Microphone" and change it to "Allow"
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">3.</span>
              Refresh this page
            </li>
          </ol>
          <div className="flex gap-3 justify-center">
            <Button 
              variant="outline"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </Button>
            <Button 
              onClick={handleRetryPermission}
              className="gap-2"
            >
              <Mic className="w-5 h-5" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex flex-col bg-gradient-calm">
      {/* Header with progress */}
      <div className="flex items-center justify-between px-6 py-4 bg-card/80 backdrop-blur-md border-b shadow-soft sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            {conversationState === 'ai_speaking' && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-card animate-pulse" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-lg">Conversation Coach</h2>
            <p className="text-sm text-muted-foreground">
              Turn {metrics.turnsCompleted + 1} of 5
            </p>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="w-32 h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-primary transition-all duration-500 ease-out rounded-full"
              style={{ width: `${(metrics.turnsCompleted / 5) * 100}%` }}
            />
          </div>
          {onExit && currentPhase !== 'complete' && (
            <Button variant="ghost" size="icon" onClick={onExit} className="h-10 w-10 rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <CoachChatFeed 
          messages={messages}
          onCardComplete={handleCardDone}
          isProcessing={isProcessing}
        />
      </div>

      {/* Control panel */}
      <div className="border-t bg-card/95 backdrop-blur-md p-6 pb-8 shadow-soft">
        {/* Ready state - Start button */}
        {currentPhase === 'ready' && (
          <div className="text-center space-y-5">
            <Button
              size="lg"
              onClick={handleStart}
              disabled={ttsLoading || micPermission === 'checking'}
              className="px-10 py-7 text-xl gap-4 rounded-2xl bg-gradient-primary shadow-glow hover:shadow-lg transition-all hover:scale-105 active:scale-100"
            >
              {(ttsLoading || micPermission === 'checking') ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : (
                <MessageCircle className="w-7 h-7" />
              )}
              Start Conversation
            </Button>
            <p className="text-base text-muted-foreground max-w-sm mx-auto">
              We'll have a friendly chat. Just speak naturally — I'll listen and respond.
            </p>
          </div>
        )}

        {/* AI Speaking state */}
        {conversationState === 'ai_speaking' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
                <Volume2 className="w-12 h-12 text-primary-foreground" />
              </div>
              {/* Animated rings */}
              <div className="absolute inset-0 rounded-full border-4 border-primary/40 animate-ping" />
              <div className="absolute inset-[-4px] rounded-full border-4 border-primary/20 animate-ping" style={{ animationDelay: '0.3s' }} />
              <div className="absolute inset-[-8px] rounded-full border-4 border-primary/10 animate-ping" style={{ animationDelay: '0.6s' }} />
            </div>
            <span className="text-lg font-medium text-primary">Speaking...</span>
          </div>
        )}

        {/* Waiting for user to speak (tap to start) */}
        {currentPhase === 'user_turn' && conversationState === 'idle' && !isProcessing && (
          <div className="text-center space-y-4">
            <Button
              size="lg"
              onClick={startConversationTurn}
              className="w-24 h-24 rounded-full bg-gradient-primary shadow-glow hover:shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              <Mic className="w-10 h-10 text-primary-foreground" />
            </Button>
            <p className="text-base text-muted-foreground">Tap to speak</p>
          </div>
        )}

        {/* Listening state */}
        {(conversationState === 'listening' || isListening) && (
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              {/* Main microphone circle */}
              <div className="w-28 h-28 rounded-full bg-destructive/15 flex items-center justify-center border-4 border-destructive/60 shadow-lg">
                <div className="w-6 h-6 rounded-full bg-destructive animate-pulse" />
              </div>
              
              {/* Animated sound bars */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-end gap-1 h-16">
                  {[...Array(7)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-destructive/70 rounded-full animate-pulse"
                      style={{
                        height: `${16 + Math.sin(i * 0.8) * 20 + 10}px`,
                        animationDelay: `${i * 0.08}s`,
                        animationDuration: `${0.4 + Math.random() * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="text-center max-w-sm">
              <p className={cn(
                "text-xl min-h-[32px] transition-all",
                userTranscript ? "text-foreground font-medium" : "text-muted-foreground italic"
              )}>
                {userTranscript || "Listening..."}
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                Pause when you're done — I'll respond automatically
              </p>
            </div>
          </div>
        )}

        {/* Card active state */}
        {currentPhase === 'card_active' && (
          <div className="text-center">
            <p className="text-base text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Complete the activity above
            </p>
          </div>
        )}

        {/* Processing state */}
        {conversationState === 'processing' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
            <span className="text-base text-muted-foreground">Thinking...</span>
          </div>
        )}

        {/* Completion state */}
        {currentPhase === 'complete' && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-success/15 shadow-lg">
              <CheckCircle2 className="w-14 h-14 text-success" />
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-2">Great conversation!</h3>
              <p className="text-muted-foreground text-lg">You did wonderfully</p>
            </div>
            
            <div className="flex justify-center gap-10 py-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">{metrics.turnsCompleted}</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wide mt-1">Turns</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">{metrics.totalUserWords}</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wide mt-1">Your Words</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">{metrics.cardsCompleted}</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wide mt-1">Activities</div>
              </div>
            </div>
            
            <div className="flex gap-4 justify-center">
              <Button size="lg" onClick={() => { reset(); setConversationState('idle'); }} className="px-8">
                Chat Again
              </Button>
              {onExit && (
                <Button size="lg" variant="outline" onClick={() => { handleFinish(); onExit(); }} className="px-8">
                  Finish
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
