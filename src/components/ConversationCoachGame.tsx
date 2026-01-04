/**
 * ConversationCoachGame - Main Conversation Coach component
 * 
 * A unified conversation experience where AI conversation is the spine
 * and mini-exercises appear as inline cards when the user gets stuck.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useCoachSession } from '@/hooks/useCoachSession';
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
  
  const speechStartTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);

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
    reset,
  } = useCoachSession({
    userId,
    profileId,
    sessionId,
    maxTurns: 5,
  });

  const handleSpeechResult = useCallback((transcript: string) => {
    if (!firstWordTimeRef.current && transcript.trim().length > 0) {
      firstWordTimeRef.current = Date.now();
    }
    setUserTranscript(transcript);
  }, []);

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
    } catch (err) {
      console.warn('TTS failed:', err);
    }
  };

  // Begin talking
  const handleStartTalking = () => {
    setUserTranscript('');
    firstWordTimeRef.current = null;
    speechStartTimeRef.current = Date.now();
    startListening();
  };

  // Done talking
  const handleDoneTalking = async () => {
    stopListening();

    const latencyMs = firstWordTimeRef.current && speechStartTimeRef.current
      ? firstWordTimeRef.current - speechStartTimeRef.current
      : null;

    await processUserTurn(userTranscript, latencyMs);
    
    // Speak the last AI message
    const lastAIMessage = [...messages].reverse().find(m => m.type === 'ai');
    if (lastAIMessage && lastAIMessage.type === 'ai') {
      try {
        await speak(lastAIMessage.text, { voiceId: 'EXAVITQu4vr4xnSDxMaL' });
      } catch (err) {
        console.warn('TTS failed:', err);
      }
    }

    setUserTranscript('');
  };

  // Handle card completion
  const handleCardDone = async (messageId: string, result: unknown) => {
    handleCardComplete(messageId, result);
    
    // Speak the outro
    const lastAIMessage = [...messages].reverse().find(m => m.type === 'ai');
    if (lastAIMessage && lastAIMessage.type === 'ai') {
      try {
        await speak(lastAIMessage.text, { voiceId: 'EXAVITQu4vr4xnSDxMaL' });
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
                <div className={cn(
                  "text-lg font-medium min-h-[28px]",
                  userTranscript ? "text-foreground" : "text-muted-foreground"
                )}>
                  {userTranscript || '...'}
                </div>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={handleDoneTalking}
                  className="gap-2 min-w-[200px]"
                >
                  <MicOff className="w-5 h-5" />
                  Done Talking
                </Button>
                <p className="text-sm text-muted-foreground">
                  Take your time. Press when finished.
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
