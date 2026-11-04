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
import { completedPartnerSessionMetrics } from '@/lib/conversationPartnerMetrics';
import {
  EARLY_PARTNER_STAGES, chooseEarlyPartnerScenario, earlyPartnerTurnOnTarget,
  isEarlyPartnerLevel, type EarlyPartnerTrial,
} from '@/lib/progression/conversationPartnerClinical';
import type { SupportLevel } from '@/lib/progression/clinicalProgression';

interface ConversationPartnerGameProps {
  userId: string;
  profileId: string;
  sessionId: string | null;
  clinicalLevel?: number | null;
  onClinicalTrial?: (trial: EarlyPartnerTrial) => void;
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
  clinicalLevel,
  onClinicalTrial,
  onComplete,
  onExit
}: ConversationPartnerGameProps) {
  const stage = clinicalLevel != null && isEarlyPartnerLevel(clinicalLevel)
    ? EARLY_PARTNER_STAGES[clinicalLevel] : null;
  const scenarioRef = useRef(chooseEarlyPartnerScenario());
  const scenario = scenarioRef.current;
  const [helpUsed, setHelpUsed] = useState(false);
  const helpUsedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [currentAIText, setCurrentAIText] = useState<string>('');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
  
  const speechStartTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);
  const turnCountRef = useRef(0);
  const mountedRef = useRef(true);
  // Synchronous guards survive rapid taps before React re-renders.
  const conversationStartedRef = useRef(false);
  const turnSubmittingRef = useRef(false);

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
    maxTurns: stage?.turnCount ?? 3,
  });

  // Discourse Adaptation Bridge — turns conversational signals into
  // visible up/down/hold cues mirroring the trial-based games.
  const adaptation = useDiscourseAdaptation({ initialLevel: 2 });

  // LLM-first clinical scorer (with local fallback). Replaces word-count
  // heuristics with semantic / target-achievement / error-type judgement.
  const scorer = useDiscourseSignalScorer({
    sessionId,
    exerciseSlug: 'conversation_partner',
    logToDatabase: !stage,
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
    if (conversationStartedRef.current || phase !== 'ready') return;
    conversationStartedRef.current = true;
    const opener = stage ? scenario.opener : getRandomOpener();
    setCurrentAIText(opener);
    setPhase('ai_speaking');
    
    try {
      await speak(opener, { voiceId: MAYA_VOICE_ID });
    } catch (err) {
      console.warn('TTS failed, continuing without voice:', err);
    }
    
    if (!mountedRef.current) return;
    addAITurn(opener);
    setPhase('ready');
  }, [speak, addAITurn, phase, stage, scenario]);

  // Handle press-to-talk start
  const handleStartTalking = useCallback(() => {
    // The mic must not open over Maya's voice or before the first prompt.
    if (phase !== 'ready' || !currentAIText || turnSubmittingRef.current) return;
    
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
  }, [phase, currentAIText, startListening, silenceTimer, startAttempt, startRecording, userId, sessionId]);

  // Handle done talking
  const handleDoneTalking = useCallback(async () => {
    if (phase !== 'listening' || turnSubmittingRef.current) return;
    turnSubmittingRef.current = true;
    try {
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

    // Stage-level clinical practice uses a real task goal. Local fallback
    // scores may keep play moving but cannot count as progression evidence.
    const userWordCount = userTranscript.trim().split(/\s+/).filter(Boolean).length;
    const supportUsed: SupportLevel = helpUsedRef.current
      ? stage?.level === 1 ? 'choice_based' : 'semantic_cue'
      : 'independent';
    const scoreResult = await scorer.scoreAndRecord(
      {
        exerciseSlug: 'conversation_partner',
        promptText: currentAIText,
        transcript: userTranscript,
        wordCount: userWordCount,
        latencyToFirstWordMs: latencyMs,
        durationMs: durationMs,
        scaffoldUsed: helpUsedRef.current,
        taskGoal: stage?.taskGoal,
        turnNumber: currentTurn + 1,
      },
      adaptation.recordTurn,
    );

    // Process turn and get follow-up
    const clinicalCorrect = stage ? earlyPartnerTurnOnTarget(userTranscript, scoreResult.signal) : false;
    const scriptedFollowupText = stage
      ? currentTurn + 1 >= maxTurns ? 'Thank you for talking with me.' : scenario.followups[currentTurn]
      : undefined;
    const { followupText, updatedMetrics, eventSaved } = await processUserTurn(userTranscript, latencyMs,
      stage ? {
        scriptedFollowupText,
        clinical: {
          level: stage.level, support: supportUsed, signal: scoreResult.signal,
          meetsTarget: clinicalCorrect,
        },
      } : undefined,
    );
    if (stage && eventSaved && scoreResult.signal.source === 'llm') {
      onClinicalTrial?.({ turnNumber: currentTurn + 1, correct: clinicalCorrect, support: supportUsed });
    }
    helpUsedRef.current = false;
    setHelpUsed(false);

    // User exited mid-processing — don't resume speaking after unmount.
    if (!mountedRef.current) return;

    if (currentTurn + 1 >= maxTurns) {
      setCurrentAIText(followupText);
      setPhase('ai_speaking');
      
      try {
        await speak(followupText, { voiceId: MAYA_VOICE_ID });
      } catch (err) {
        console.warn('TTS failed:', err);
      }
      
      if (!mountedRef.current) return;
      addAITurn(followupText);
      setPhase('complete');
      
      if (onComplete) {
        onComplete(completedPartnerSessionMetrics(updatedMetrics, followupText));
      }
    } else {
      setCurrentAIText(followupText);
      setPhase('ai_speaking');
      
      try {
        await speak(followupText, { voiceId: MAYA_VOICE_ID });
      } catch (err) {
        console.warn('TTS failed:', err);
      }
      
      if (!mountedRef.current) return;
      addAITurn(followupText);
      setPhase('ready');
    }
    } catch (error) {
      console.warn('[ConversationPartner] turn did not finish; ready to try again', error);
      if (mountedRef.current) setPhase('ready');
    } finally {
      turnSubmittingRef.current = false;
    }
  }, [
    phase, stopListening, silenceTimer, userTranscript, currentAIText,
    processUserTurn, currentTurn, maxTurns, speak,
    addAITurn, onComplete, metrics, stopRecording, uploadRecording,
    userId, sessionId, currentAttemptId, logFinalAnalysis, resetAttempt,
    scorer, adaptation, stage, scenario, onClinicalTrial,
  ]);

  // Graded practice never speaks Maya's silence nudge over an active mic.
  useEffect(() => {
    if (stage) return;
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
  }, [phase, getNudge, speak, stage]);

  const handleHearHelp = useCallback(async () => {
    if (!stage || (phase !== 'ready' && phase !== 'listening') || !currentAIText ||
        turnSubmittingRef.current) return;
    if (phase === 'listening') {
      // Discard and restart the current attempt before any coach TTS.
      stopListening();
      await stopRecording();
      resetAttempt();
      turnCountRef.current = Math.max(0, turnCountRef.current - 1);
      setUserTranscript('');
    }
    helpUsedRef.current = true;
    setHelpUsed(true);
    const turnIndex = Math.min(currentTurn, 2);
    const cue = stage.level === 1
      ? `You could say ${scenario.choices.join(', or ')}. Choose what you like.`
      : scenario.semanticHelp[turnIndex];
    setPhase('ai_speaking');
    try {
      await speak(cue, { voiceId: MAYA_VOICE_ID });
    } catch (error) {
      console.warn('[ConversationPartner] cue audio unavailable', error);
    }
    if (mountedRef.current) setPhase('ready');
  }, [stage, phase, currentAIText, stopListening, stopRecording, resetAttempt,
      currentTurn, scenario, speak]);

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
      {stage && <div className="text-center space-y-1" aria-label="Clinical conversation goal">
        <p className="font-semibold">Clinical Level {stage.level} · {scenario.title}</p>
        <p className="text-sm text-muted-foreground">{stage.objective}</p>
        {helpUsed && <p className="text-xs text-muted-foreground">Maya helped with this answer.</p>}
      </div>}
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

          {phase === 'ready' && !currentAIText && (
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

          {phase === 'ready' && !!currentAIText && (
            <div className="text-center py-4 space-y-3">
              <Button
                size="lg"
                onClick={handleStartTalking}
                className="gap-2 min-w-[200px]"
              >
                <Mic className="w-5 h-5" />
                Press to Talk
              </Button>
              {stage && <Button size="lg" variant="outline" onClick={handleHearHelp}>
                <Volume2 className="w-5 h-5 mr-2" />
                {stage.level === 1 ? 'Hear choices' : 'Hear a clue'}
              </Button>}
            </div>
          )}

          {phase === 'ai_speaking' && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Volume2 className="w-5 h-5 animate-pulse" />
                <span>Listening to response...</span>
              </div>
              <p className="text-sm text-muted-foreground mt-3">Press to Talk will appear when Maya finishes.</p>
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
              {stage && <Button size="lg" variant="outline" onClick={handleHearHelp} className="mt-3">
                <Volume2 className="w-5 h-5 mr-2" />
                {stage.level === 1 ? 'Hear choices' : 'Hear a clue'}
              </Button>}
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
                  conversationStartedRef.current = false;
                  turnSubmittingRef.current = false;
                  helpUsedRef.current = false;
                  setHelpUsed(false);
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
