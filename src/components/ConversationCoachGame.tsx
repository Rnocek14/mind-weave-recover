/**
 * ConversationCoachGame - Main Conversation Coach component
 * 
 * A unified conversation experience where AI conversation is the spine
 * and mini-exercises appear as inline cards when the user gets stuck.
 * 
 * Features smart auto-detection of when user finishes speaking,
 * distinguishing between pauses/fillers ("um", "and...") and actual completion.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
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
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(true);
  
  const speechStartTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);
  const isProcessingTurnRef = useRef(false);

  const { speak, isLoading: ttsLoading } = useTextToSpeech();
  
  const {
    messages,
    isComplete,
    isProcessing,
    metrics,
    currentPhase,
    pendingAIText,
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

  // Process the user's turn (called by auto-detection or manual button)
  const processTurn = useCallback(async (transcript: string) => {
    if (isProcessingTurnRef.current || !transcript.trim()) return;
    isProcessingTurnRef.current = true;

    const latencyMs = firstWordTimeRef.current && speechStartTimeRef.current
      ? firstWordTimeRef.current - speechStartTimeRef.current
      : null;

    // Process and get the AI response text directly
    const aiResponse = await processUserTurn(transcript, latencyMs);
    
    // Speak the response
    if (aiResponse) {
      try {
        await speak(aiResponse, { voiceId: 'EXAVITQu4vr4xnSDxMaL' });
        clearPendingAI();
      } catch (err) {
        console.warn('TTS failed:', err);
      }
    }

    setUserTranscript('');
    isProcessingTurnRef.current = false;
  }, [processUserTurn, speak, clearPendingAI]);

  // Smart speech end detection - auto-detects when user is done
  const speechEndDetection = useSpeechEndDetection({
    onSpeechEnd: (transcript) => {
      console.log('🎯 Auto-detected speech end:', transcript.slice(0, 50));
      stopListening();
      processTurn(transcript);
    },
    incompletesilenceMs: 4000, // 4s patience for "um", trailing "and..."
    completesilenceMs: 2500,   // 2.5s for natural sentence endings
    enabled: autoDetectionEnabled && currentPhase === 'user_turn',
  });

  const handleSpeechResult = useCallback((transcript: string) => {
    if (!firstWordTimeRef.current && transcript.trim().length > 0) {
      firstWordTimeRef.current = Date.now();
    }
    setUserTranscript(transcript);
    // Feed transcript to end detection
    speechEndDetection.onTranscriptUpdate(transcript, false);
  }, [speechEndDetection]);

  const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
    onResult: handleSpeechResult,
    patientMode: true,
    continuousListening: false,
  });

  // Start conversation
  const handleStart = async () => {
    const opener = startSession();
    try {
      await speak(opener, { voiceId: 'EXAVITQu4vr4xnSDxMaL' });
      clearPendingAI();
    } catch (err) {
      console.warn('TTS failed:', err);
    }
  };

  // Begin talking
  const handleStartTalking = () => {
    setUserTranscript('');
    firstWordTimeRef.current = null;
    speechStartTimeRef.current = Date.now();
    isProcessingTurnRef.current = false;
    speechEndDetection.onStart();
    startListening();
  };

  // Manual done talking (fallback)
  const handleDoneTalking = async () => {
    speechEndDetection.onStop();
    stopListening();
    await processTurn(userTranscript);
  };

  // Cleanup speech end detection when listening stops
  useEffect(() => {
    if (!isListening) {
      speechEndDetection.onStop();
    }
  }, [isListening, speechEndDetection]);

  // Handle card completion
  const handleCardDone = async (messageId: string, result: unknown) => {
    const outroText = handleCardComplete(messageId, result);
    
    // Speak the outro
    if (outroText) {
      try {
        await speak(outroText, { voiceId: 'EXAVITQu4vr4xnSDxMaL' });
        clearPendingAI();
      } catch (err) {
        console.warn('TTS failed:', err);
      }
    }
  };

  // Handle completion report
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
                    <Volume2 className="w-5 h-5" />
                  )}
                  Start Conversation
                </Button>
                <p className="text-sm text-muted-foreground mt-3">
                  We'll have a short chat. I'll help if you get stuck.
                </p>
              </div>
            )}

            {currentPhase === 'user_turn' && !isListening && (
              <div className="text-center">
                <Button
                  size="lg"
                  onClick={handleStartTalking}
                  className="gap-2 min-w-[200px]"
                >
                  <Mic className="w-5 h-5" />
                  Press to Talk
                </Button>
              </div>
            )}

            {currentPhase === 'user_turn' && isListening && (
              <div className="text-center space-y-3">
                {/* Listening indicator */}
                <div className="flex items-center justify-center gap-2 text-primary">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-medium">Listening...</span>
                </div>
                
                <div className={cn(
                  "text-lg font-medium min-h-[28px] px-4",
                  userTranscript ? "text-foreground" : "text-muted-foreground"
                )}>
                  {userTranscript || 'Start speaking...'}
                </div>
                
                {/* Manual stop button as fallback */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDoneTalking}
                  className="gap-2 text-muted-foreground"
                >
                  <MicOff className="w-4 h-4" />
                  Tap when done (or just pause)
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  I'll know when you're finished speaking
                </p>
              </div>
            )}

            {currentPhase === 'card_active' && (
              <div className="text-center text-sm text-muted-foreground">
                Complete the exercise above
              </div>
            )}

            {isProcessing && (
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground mt-2">Processing...</p>
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
                    Talk Again
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

      {/* Exit button (always visible except when complete) */}
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
