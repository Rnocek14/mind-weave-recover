/**
 * ConversationCoachGame - Fluid conversation coach
 * 
 * Works like a GPT voice chat:
 * - AI speaks, then automatically listens
 * - User speaks naturally, system detects when they're done
 * - No buttons needed during conversation flow
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Volume2, Loader2, MessageCircle } from 'lucide-react';
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

  const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
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
        await speak(aiResponse, { voiceId: 'EXAVITQu4vr4xnSDxMaL' });
      } catch (err) {
        console.warn('TTS failed, using browser:', err);
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
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isAISpeaking, isListening, isProcessing, currentPhase, isComplete]);

  const startConversationTurn = useCallback(() => {
    setUserTranscript('');
    firstWordTimeRef.current = null;
    speechStartTimeRef.current = Date.now();
    isProcessingRef.current = false;
    speechEndDetection.onStart();
    startListening();
  }, [speechEndDetection, startListening]);

  // Start conversation
  const handleStart = async () => {
    const opener = startSession();
    setIsAISpeaking(true);
    shouldAutoListenRef.current = true;
    
    try {
      await speak(opener, { voiceId: 'EXAVITQu4vr4xnSDxMaL' });
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
        await speak(outroText, { voiceId: 'EXAVITQu4vr4xnSDxMaL' });
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
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">
          Speech recognition is not supported in this browser.
        </p>
      </Card>
    );
  }

  // Progress indicator
  const progressDots = Array.from({ length: 5 }, (_, i) => (
    <div
      key={i}
      className={cn(
        'w-3 h-3 rounded-full transition-colors',
        i < metrics.turnsCompleted
          ? 'bg-primary'
          : i === metrics.turnsCompleted
          ? 'bg-primary/50'
          : 'bg-muted'
      )}
    />
  ));

  return (
    <div className="space-y-6">
      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {progressDots}
      </div>

      {/* Chat feed */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <CoachChatFeed 
            messages={messages}
            onCardComplete={handleCardDone}
            isProcessing={isProcessing}
          />

          {/* Controls area */}
          <div className="border-t bg-muted/30 p-4">
            {currentPhase === 'ready' && (
              <div className="text-center">
                <Button
                  size="lg"
                  onClick={handleStart}
                  disabled={ttsLoading}
                  className="gap-2"
                >
                  {ttsLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <MessageCircle className="w-5 h-5" />
                  )}
                  Start Chatting
                </Button>
                <p className="text-sm text-muted-foreground mt-3">
                  Just talk naturally - I'll listen and respond
                </p>
              </div>
            )}

            {isAISpeaking && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Volume2 className="w-5 h-5 animate-pulse" />
                  <span className="font-medium">Speaking...</span>
                </div>
              </div>
            )}

            {currentPhase === 'user_turn' && !isAISpeaking && !isListening && !isProcessing && (
              <div className="text-center">
                <Button
                  size="lg"
                  onClick={startConversationTurn}
                  className="gap-2"
                >
                  <Mic className="w-5 h-5" />
                  Tap to Talk
                </Button>
              </div>
            )}

            {isListening && (
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-medium">Listening...</span>
                </div>
                
                <div className={cn(
                  "text-lg min-h-[28px] px-4",
                  userTranscript ? "text-foreground" : "text-muted-foreground"
                )}>
                  {userTranscript || 'Go ahead, I\'m listening...'}
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Just pause when you're done - I'll respond
                </p>
              </div>
            )}

            {currentPhase === 'card_active' && (
              <div className="text-center text-sm text-muted-foreground">
                Complete the exercise above
              </div>
            )}

            {isProcessing && !isListening && (
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground mt-2">Thinking...</p>
              </div>
            )}

            {currentPhase === 'complete' && (
              <div className="text-center space-y-4">
                <div className="text-4xl">🎉</div>
                <h3 className="text-lg font-medium">Great conversation!</h3>
                <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {metrics.turnsCompleted}
                    </div>
                    <div className="text-muted-foreground">turns</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {metrics.totalUserWords}
                    </div>
                    <div className="text-muted-foreground">your words</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {metrics.cardsCompleted}
                    </div>
                    <div className="text-muted-foreground">exercises</div>
                  </div>
                </div>
                <div className="flex gap-3 justify-center pt-4">
                  <Button onClick={() => { reset(); handleFinish(); }}>
                    Chat Again
                  </Button>
                  {onExit && (
                    <Button variant="outline" onClick={() => { handleFinish(); onExit(); }}>
                      Done
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Exit button */}
      {currentPhase !== 'complete' && onExit && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onExit}>
            End session
          </Button>
        </div>
      )}
    </div>
  );
}