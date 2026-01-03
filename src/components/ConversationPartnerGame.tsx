import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useConversationPartner } from '@/hooks/useConversationPartner';
import { getRandomOpener } from '@/lib/conversationFollowups';
import { cn } from '@/lib/utils';

interface ConversationPartnerGameProps {
  userId: string;
  profileId: string;
  sessionId: string | null;
  onComplete?: (metrics: {
    turnsCompleted: number;
    avgLatencyMs: number;
    completionRate: number;
    userAIRatio: number;
  }) => void;
  onExit?: () => void;
}

type Phase = 'ready' | 'ai_speaking' | 'listening' | 'processing' | 'complete';

export function ConversationPartnerGame({
  userId,
  profileId,
  sessionId,
  onComplete,
  onExit
}: ConversationPartnerGameProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [currentAIText, setCurrentAIText] = useState<string>('');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
  
  const speechStartTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);

  const { speak, stop: stopTTS, isLoading: ttsLoading } = useTextToSpeech();
  
  const {
    conversationHistory,
    currentTurn,
    maxTurns,
    isLoadingFollowup,
    metrics,
    isComplete,
    addAITurn,
    processUserTurn,
    getNudge,
    startTurn,
    reset
  } = useConversationPartner({
    userId,
    profileId,
    sessionId,
    maxTurns: 3
  });

  const handleSpeechResult = useCallback((transcript: string) => {
    // Track first word timing
    if (!firstWordTimeRef.current && transcript.trim().length > 0) {
      firstWordTimeRef.current = Date.now();
    }
    setUserTranscript(transcript);
  }, []);

  const {
    isListening,
    startListening,
    stopListening,
    isSupported
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    patientMode: true,
    continuousListening: false
  });

  // Start conversation with opener
  const startConversation = useCallback(async () => {
    const opener = getRandomOpener();
    setCurrentAIText(opener);
    setPhase('ai_speaking');
    
    try {
      await speak(opener, { voiceId: 'EXAVITQu4vr4xnSDxMaL' }); // Sarah voice
    } catch (err) {
      console.warn('TTS failed, continuing without voice:', err);
    }
    
    addAITurn(opener);
    setPhase('ready');
  }, [speak, addAITurn]);

  // Handle press-to-talk start
  const handleStartTalking = useCallback(() => {
    if (phase !== 'ready' && phase !== 'ai_speaking') return;
    
    setUserTranscript('');
    firstWordTimeRef.current = null;
    speechStartTimeRef.current = Date.now();
    setPhase('listening');
    startListening();

    // Clear any existing silence timer
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
  }, [phase, startListening, silenceTimer]);

  // Handle done talking
  const handleDoneTalking = useCallback(async () => {
    if (phase !== 'listening') return;

    stopListening();
    setPhase('processing');

    // Clear silence timer
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      setSilenceTimer(null);
    }

    // Calculate latency
    const latencyMs = firstWordTimeRef.current && speechStartTimeRef.current
      ? firstWordTimeRef.current - speechStartTimeRef.current
      : null;

    // Process turn and get follow-up
    const { followupText } = await processUserTurn(userTranscript, latencyMs);

    // Check if we're done
    if (currentTurn + 1 >= maxTurns) {
      setCurrentAIText(followupText);
      setPhase('ai_speaking');
      
      try {
        await speak(followupText, { voiceId: 'EXAVITQu4vr4xnSDxMaL' });
      } catch (err) {
        console.warn('TTS failed:', err);
      }
      
      addAITurn(followupText);
      setPhase('complete');
      
      // Report completion
      if (onComplete) {
        const userAIRatio = metrics.totalAIWords > 0 
          ? (metrics.totalUserWords / metrics.totalAIWords) * 100 
          : 100;
        onComplete({
          turnsCompleted: metrics.turnsCompleted + 1,
          avgLatencyMs: metrics.avgLatencyMs,
          completionRate: metrics.completionRate,
          userAIRatio
        });
      }
    } else {
      // Speak follow-up
      setCurrentAIText(followupText);
      setPhase('ai_speaking');
      
      try {
        await speak(followupText, { voiceId: 'EXAVITQu4vr4xnSDxMaL' });
      } catch (err) {
        console.warn('TTS failed:', err);
      }
      
      addAITurn(followupText);
      setPhase('ready');
    }
  }, [
    phase, stopListening, silenceTimer, userTranscript, 
    processUserTurn, currentTurn, maxTurns, speak, 
    addAITurn, onComplete, metrics
  ]);

  // Start silence timer when listening begins
  useEffect(() => {
    if (phase === 'listening') {
      // 8 second nudge timer
      const timer = setTimeout(async () => {
        const nudge = getNudge(8000);
        try {
          await speak(nudge, { voiceId: 'EXAVITQu4vr4xnSDxMaL' });
        } catch (err) {
          console.warn('Nudge TTS failed:', err);
        }
      }, 8000);

      setSilenceTimer(timer);

      return () => clearTimeout(timer);
    }
  }, [phase, getNudge, speak]);

  // Progress dots
  const progressDots = Array.from({ length: maxTurns }, (_, i) => (
    <div
      key={i}
      className={cn(
        'w-3 h-3 rounded-full transition-colors',
        i < currentTurn
          ? 'bg-primary'
          : i === currentTurn
          ? 'bg-primary/50'
          : 'bg-muted'
      )}
    />
  ));

  if (!isSupported) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">
          Speech recognition is not supported in this browser.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {progressDots}
      </div>

      {/* Main conversation card */}
      <Card className="overflow-hidden">
        <CardContent className="p-6 space-y-6">
          {/* AI speech bubble */}
          {currentAIText && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Volume2 className="w-5 h-5 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                <p className="text-foreground">{currentAIText}</p>
              </div>
            </div>
          )}

          {/* User transcript (while listening/processing) */}
          {(phase === 'listening' || phase === 'processing') && (
            <div className="flex items-start gap-3 justify-end">
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                <p>{userTranscript || '...'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                {isListening ? (
                  <Mic className="w-5 h-5 text-primary-foreground animate-pulse" />
                ) : (
                  <MicOff className="w-5 h-5 text-primary-foreground" />
                )}
              </div>
            </div>
          )}

          {/* Phase-specific UI */}
          {phase === 'ready' && currentTurn === 0 && (
            <div className="text-center py-8">
              <Button
                size="lg"
                onClick={startConversation}
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
                I'll ask you a simple question. No wrong answers.
              </p>
            </div>
          )}

          {phase === 'ready' && currentTurn > 0 && (
            <div className="text-center py-4">
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

          {phase === 'ai_speaking' && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Volume2 className="w-5 h-5 animate-pulse" />
                <span>Listening to response...</span>
              </div>
              <Button
                size="lg"
                onClick={handleStartTalking}
                className="gap-2 min-w-[200px] mt-4"
              >
                <Mic className="w-5 h-5" />
                Press to Talk
              </Button>
            </div>
          )}

          {phase === 'listening' && (
            <div className="text-center py-4">
              <Button
                size="lg"
                variant="secondary"
                onClick={handleDoneTalking}
                className="gap-2 min-w-[200px]"
              >
                <MicOff className="w-5 h-5" />
                Done Talking
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Take your time. Press when you're finished.
              </p>
            </div>
          )}

          {phase === 'processing' && (
            <div className="text-center py-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">Processing...</p>
            </div>
          )}

          {phase === 'complete' && (
            <div className="text-center py-6 space-y-4">
              <div className="text-4xl">🎉</div>
              <h3 className="text-lg font-medium">Nice conversation!</h3>
              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto text-sm">
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
              </div>
              <div className="flex gap-3 justify-center pt-4">
                <Button onClick={() => {
                  reset();
                  setPhase('ready');
                  setCurrentAIText('');
                  setUserTranscript('');
                }}>
                  Talk Again
                </Button>
                {onExit && (
                  <Button variant="outline" onClick={onExit}>
                    Done
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exit button (always visible except when complete) */}
      {phase !== 'complete' && onExit && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onExit}>
            End session
          </Button>
        </div>
      )}
    </div>
  );
}
