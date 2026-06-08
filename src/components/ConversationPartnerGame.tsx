/**
 * Conversation Partner Game
 * 
 * UPGRADED: Capture parity with PhotoNaming:
 * - useUtteranceLogger for persisted utterance analysis records
 * - useAudioRecorder for WAV capture/upload
 * - Discourse-focused: no pronunciation analysis
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MAYA_VOICE_ID } from '@/lib/constants/voice';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useConversationPartner } from '@/hooks/useConversationPartner';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { getRandomOpener } from '@/lib/conversationFollowups';
import { useDiscourseAdaptation } from '@/hooks/useDiscourseAdaptation';
import { useDiscourseSignalScorer } from '@/hooks/useDiscourseSignalScorer';
import { AdaptationBadge } from '@/components/AdaptationBadge';
import { cn } from '@/lib/utils';
import { flushVoiceSessionQueue } from '@/lib/voiceController';

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
  const turnCountRef = useRef(0);
  const mountedRef = useRef(true);

  const { speak, stop: stopTTS, isLoading: ttsLoading } = useTextToSpeech();
  
  // Clinical pipeline hooks
  const {
    startAttempt,
    logFinalAnalysis,
    resetAttempt,
    currentAttemptId,
  } = useUtteranceLogger();

  const {
    startRecording,
    stopRecording,
    uploadRecording,
  } = useAudioRecorder();

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

  // Discourse Adaptation Bridge — turns conversational signals into
  // visible up/down/hold cues mirroring the trial-based games.
  const adaptation = useDiscourseAdaptation({ initialLevel: 2 });

  // LLM-first clinical scorer (with local fallback). Replaces word-count
  // heuristics with semantic / target-achievement / error-type judgement.
  const scorer = useDiscourseSignalScorer({
    sessionId,
    exerciseSlug: 'conversation_partner',
  });

  const handleSpeechResult = useCallback((transcript: string) => {
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

  // Hard-stop all voice + recognition when the user exits/unmounts so Maya
  // never keeps talking after the session is left.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try { stopTTS(); } catch { /* noop */ }
      try { stopListening(); } catch { /* noop */ }
      flushVoiceSessionQueue('conversation-partner unmount');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // Start conversation with opener
  const startConversation = useCallback(async () => {
    const opener = getRandomOpener();
    setCurrentAIText(opener);
    setPhase('ai_speaking');
    
    try {
      await speak(opener, { voiceId: MAYA_VOICE_ID });
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
    turnCountRef.current += 1;
    setPhase('listening');
    
    // Start clinical pipeline
    startAttempt({
      sessionId: sessionId || 'standalone',
      userId,
      exerciseSlug: 'conversation_partner',
      trialIndex: turnCountRef.current - 1,
      attemptNumber: 1,
      targetWord: 'conversation',
      category: 'discourse',
    });
    
    startRecording();
    startListening();

    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
  }, [phase, startListening, silenceTimer, startAttempt, startRecording, userId, sessionId]);

  // Handle done talking
  const handleDoneTalking = useCallback(async () => {
    if (phase !== 'listening') return;

    stopListening();
    setPhase('processing');
    
    // Stop recording and capture audio
    const recordingResult = await stopRecording();

    if (silenceTimer) {
      clearTimeout(silenceTimer);
      setSilenceTimer(null);
    }

    const latencyMs = firstWordTimeRef.current && speechStartTimeRef.current
      ? firstWordTimeRef.current - speechStartTimeRef.current
      : null;
    
    const durationMs = speechStartTimeRef.current
      ? Date.now() - speechStartTimeRef.current
      : null;

    // Upload audio for clinical persistence
    let audioStoragePath: string | null = null;
    if (recordingResult?.audioBlob && sessionId) {
      audioStoragePath = await uploadRecording(
        recordingResult.audioBlob,
        userId,
        sessionId,
        turnCountRef.current,
        recordingResult.mimeType
      );
    }
    
    // Log utterance to utterance_analyses
    if (currentAttemptId) {
      await logFinalAnalysis({
        transcript: userTranscript || undefined,
        transcriptSource: 'browser',
        evaluationModel: 'flow',
        isCorrect: null,
        didSpeak: userTranscript.trim().length > 0,
        utteranceComplete: userTranscript.trim().length > 0,
        latencyToFirstWordMs: latencyMs || undefined,
        recordingDurationMs: durationMs || undefined,
        audioStoragePath: audioStoragePath || undefined,
        fluencyAvailable: false,
        fluencyUnavailableReason: 'discourse_task',
      });
      resetAttempt();
    }

    // Score this turn with the LLM-first clinical scorer.
    // Falls back to local heuristics on timeout/failure. Logs to DB.
    const userWordCount = userTranscript.trim().split(/\s+/).filter(Boolean).length;
    await scorer.scoreAndRecord(
      {
        exerciseSlug: 'conversation_partner',
        promptText: currentAIText,
        transcript: userTranscript,
        wordCount: userWordCount,
        latencyToFirstWordMs: latencyMs,
        durationMs: durationMs,
        scaffoldUsed: false,
        turnNumber: currentTurn + 1,
      },
      adaptation.recordTurn,
    );

    // Process turn and get follow-up
    const { followupText } = await processUserTurn(userTranscript, latencyMs);

    if (currentTurn + 1 >= maxTurns) {
      setCurrentAIText(followupText);
      setPhase('ai_speaking');
      
      try {
        await speak(followupText, { voiceId: MAYA_VOICE_ID });
      } catch (err) {
        console.warn('TTS failed:', err);
      }
      
      addAITurn(followupText);
      setPhase('complete');
      
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
      setCurrentAIText(followupText);
      setPhase('ai_speaking');
      
      try {
        await speak(followupText, { voiceId: MAYA_VOICE_ID });
      } catch (err) {
        console.warn('TTS failed:', err);
      }
      
      addAITurn(followupText);
      setPhase('ready');
    }
  }, [
    phase, stopListening, silenceTimer, userTranscript, currentAIText,
    processUserTurn, currentTurn, maxTurns, speak,
    addAITurn, onComplete, metrics, stopRecording, uploadRecording,
    userId, sessionId, currentAttemptId, logFinalAnalysis, resetAttempt,
    scorer, adaptation,
  ]);

  // Start silence timer when listening begins
  useEffect(() => {
    if (phase === 'listening') {
      const timer = setTimeout(async () => {
        const nudge = getNudge(8000);
        try {
          await speak(nudge, { voiceId: MAYA_VOICE_ID });
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
      <div className="flex justify-center gap-2">
        {progressDots}
      </div>

      {adaptation.shiftDirection && (
        <div className="flex justify-center">
          <AdaptationBadge
            direction={adaptation.shiftDirection}
            reason={adaptation.shiftReason}
            variant="card"
          />
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-6 space-y-6">
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
                  turnCountRef.current = 0;
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
