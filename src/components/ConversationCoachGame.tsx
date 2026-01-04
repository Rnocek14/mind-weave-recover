/**
 * ConversationCoachGame - Beautiful, fluid conversation coach
 * 
 * Features:
 * - Proper mic permission request upfront
 * - AI speaks, then automatically listens
 * - Smart silence detection for natural flow
 * - Beautiful animated UI
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Loader2, MessageCircle, Sparkles, X, CheckCircle2 } from 'lucide-react';
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

export function ConversationCoachGame({
  userId,
  profileId,
  sessionId,
  onComplete,
  onExit,
}: ConversationCoachGameProps) {
  const [userTranscript, setUserTranscript] = useState('');
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  
  const speechStartTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const shouldAutoListenRef = useRef(false);

  const { speak, isLoading: ttsLoading } = useTextToSpeech();
  
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

  const { isListening, startListening, stopListening, isSupported, error: speechError } = useSpeechRecognition({
    onResult: (transcript) => {
      if (!firstWordTimeRef.current && transcript.trim().length > 0) {
        firstWordTimeRef.current = Date.now();
      }
      setUserTranscript(transcript);
      speechEndDetection.onTranscriptUpdate(transcript, false);
    },
    patientMode: true,
    continuousListening: false,
  });

  // Request microphone permission upfront
  const requestMicPermission = useCallback(async () => {
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

  // Process turn and speak AI response
  const processTurnAndRespond = useCallback(async (transcript: string) => {
    if (isProcessingRef.current || !transcript.trim()) return;
    isProcessingRef.current = true;

    const latencyMs = firstWordTimeRef.current && speechStartTimeRef.current
      ? firstWordTimeRef.current - speechStartTimeRef.current
      : null;

    const aiResponse = await processUserTurn(transcript, latencyMs);
    
    if (aiResponse && currentPhase !== 'card_active') {
      setIsAISpeaking(true);
      shouldAutoListenRef.current = true;
      
      try {
        await speak(aiResponse);
      } catch (err) {
        console.warn('TTS failed, continuing:', err);
      }
      
      setIsAISpeaking(false);
      clearPendingAI();
    }

    setUserTranscript('');
    isProcessingRef.current = false;
  }, [processUserTurn, speak, clearPendingAI, currentPhase]);

  // Smart speech end detection
  const speechEndDetection = useSpeechEndDetection({
    onSpeechEnd: (transcript) => {
      console.log('🎯 Speech end detected:', transcript.slice(0, 50));
      stopListening();
      processTurnAndRespond(transcript);
    },
    incompletesilenceMs: 3500,
    completesilenceMs: 2000,
    enabled: currentPhase === 'user_turn' && !isAISpeaking,
  });

  // Auto-start listening after AI finishes speaking
  useEffect(() => {
    if (
      micPermission === 'granted' &&
      !isAISpeaking && 
      !isListening && 
      !isProcessing && 
      currentPhase === 'user_turn' && 
      shouldAutoListenRef.current &&
      !isComplete
    ) {
      const timer = setTimeout(() => {
        if (currentPhase === 'user_turn' && !isListening) {
          console.log('🎤 Auto-starting listening after AI spoke');
          startConversationTurn();
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isAISpeaking, isListening, isProcessing, currentPhase, isComplete, micPermission]);

  const startConversationTurn = useCallback(() => {
    setUserTranscript('');
    firstWordTimeRef.current = null;
    speechStartTimeRef.current = Date.now();
    isProcessingRef.current = false;
    speechEndDetection.onStart();
    startListening();
  }, [speechEndDetection, startListening]);

  // Start conversation (requests permission first)
  const handleStart = async () => {
    const hasPermission = micPermission === 'granted' || await requestMicPermission();
    if (!hasPermission) return;
    
    const opener = startSession();
    setIsAISpeaking(true);
    shouldAutoListenRef.current = true;
    
    try {
      await speak(opener);
    } catch (err) {
      console.warn('TTS failed:', err);
    }
    
    setIsAISpeaking(false);
    clearPendingAI();
  };

  // Cleanup on stop
  useEffect(() => {
    if (!isListening) {
      speechEndDetection.onStop();
    }
  }, [isListening, speechEndDetection]);

  // Handle card completion
  const handleCardDone = async (messageId: string, result: unknown) => {
    const outroText = handleCardComplete(messageId, result);
    
    if (outroText) {
      setIsAISpeaking(true);
      shouldAutoListenRef.current = true;
      
      try {
        await speak(outroText);
      } catch (err) {
        console.warn('TTS failed:', err);
      }
      
      setIsAISpeaking(false);
      clearPendingAI();
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

  if (!isSupported) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <MicOff className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Speech Not Supported</h2>
          <p className="text-muted-foreground">
            Your browser doesn't support speech recognition. Please try Chrome or Edge.
          </p>
        </div>
      </div>
    );
  }

  if (micPermission === 'denied') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <MicOff className="w-16 h-16 mx-auto text-destructive/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Microphone Access Needed</h2>
          <p className="text-muted-foreground mb-4">
            Please enable microphone access in your browser settings to use the conversation coach.
          </p>
          <Button onClick={() => setMicPermission('pending')}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex flex-col">
      {/* Header with progress */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Conversation Coach</h2>
            <p className="text-xs text-muted-foreground">
              Turn {metrics.turnsCompleted + 1} of 5
            </p>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${(metrics.turnsCompleted / 5) * 100}%` }}
            />
          </div>
          {onExit && currentPhase !== 'complete' && (
            <Button variant="ghost" size="icon" onClick={onExit} className="h-8 w-8">
              <X className="w-4 h-4" />
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
      <div className="border-t bg-gradient-to-t from-background via-background to-background/80 p-4 pb-6">
        {/* Ready state - Start button */}
        {currentPhase === 'ready' && (
          <div className="text-center space-y-4">
            <Button
              size="lg"
              onClick={handleStart}
              disabled={ttsLoading}
              className="px-8 py-6 text-lg gap-3 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              {ttsLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <MessageCircle className="w-6 h-6" />
              )}
              Start Conversation
            </Button>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              We'll have a friendly chat. Just speak naturally and I'll respond.
            </p>
          </div>
        )}

        {/* AI Speaking state */}
        {isAISpeaking && (
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Volume2 className="w-8 h-8 text-primary animate-pulse" />
              </div>
              {/* Animated rings */}
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDelay: '0.5s' }} />
            </div>
            <span className="text-sm font-medium text-primary">Speaking...</span>
          </div>
        )}

        {/* Waiting for user to speak */}
        {currentPhase === 'user_turn' && !isAISpeaking && !isListening && !isProcessing && (
          <div className="text-center space-y-3">
            <Button
              size="lg"
              onClick={startConversationTurn}
              className="w-20 h-20 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <Mic className="w-8 h-8" />
            </Button>
            <p className="text-sm text-muted-foreground">Tap to speak</p>
          </div>
        )}

        {/* Listening state */}
        {isListening && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center border-4 border-red-500/50">
                <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
              </div>
              {/* Sound wave animation */}
              <div className="absolute -inset-2 flex items-center justify-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-500/50 rounded-full animate-pulse"
                    style={{
                      height: `${20 + Math.random() * 30}px`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '0.5s',
                    }}
                  />
                ))}
              </div>
            </div>
            
            <div className="text-center max-w-sm">
              <p className={cn(
                "text-lg min-h-[28px] transition-colors",
                userTranscript ? "text-foreground font-medium" : "text-muted-foreground italic"
              )}>
                {userTranscript || "I'm listening..."}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Pause when you're done — I'll respond automatically
              </p>
            </div>
          </div>
        )}

        {/* Card active state */}
        {currentPhase === 'card_active' && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              Complete the activity above
            </p>
          </div>
        )}

        {/* Processing state */}
        {isProcessing && !isListening && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Thinking...</span>
          </div>
        )}

        {/* Completion state */}
        {currentPhase === 'complete' && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-1">Great conversation!</h3>
              <p className="text-muted-foreground">You did wonderfully</p>
            </div>
            
            <div className="flex justify-center gap-8 py-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{metrics.turnsCompleted}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Turns</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{metrics.totalUserWords}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Your Words</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{metrics.cardsCompleted}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Activities</div>
              </div>
            </div>
            
            <div className="flex gap-3 justify-center">
              <Button size="lg" onClick={() => { reset(); }}>
                Chat Again
              </Button>
              {onExit && (
                <Button size="lg" variant="outline" onClick={() => { handleFinish(); onExit(); }}>
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
