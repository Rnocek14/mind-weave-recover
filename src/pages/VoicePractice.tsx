/**
 * Voice Practice Mode — Eyes-free, audio-only therapy
 * 
 * Minimal visual UI: just a mic indicator, Maya's status, and subtitles.
 * User can practice anywhere — walking, driving, cooking.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, Volume2, SkipForward, Square, Headphones, Play } from 'lucide-react';
import { classifySpeechState } from '@/lib/speechStateClassifier';
import { TIMING_PROFILES, getProfileMultiplier } from '@/lib/speechTimingProfiles';
import { SpeechNudge } from '@/components/SpeechNudge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useVoicePracticeSession, VoicePracticePhase } from '@/hooks/useVoicePracticeSession';
import { cn } from '@/lib/utils';

export default function VoicePractice() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  // Create a real session so rounds actually persist (profile_id, session_id).
  // Previously the hook was called without a sessionId, so every scored round
  // was silently dropped.
  const { activeSessionId } = useStandaloneSession(user?.id, undefined, 'voice_practice');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const silenceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSpokenRef = useRef(false);
  const lastTranscriptTimeRef = useRef<number>(Date.now());
  const listeningStartTimeRef = useRef<number>(Date.now());
  const [nudgeHint, setNudgeHint] = useState<string | null>(null);

  const {
    phase,
    currentRound,
    currentIndex,
    totalRounds,
    results,
    isMayaSpeaking,
    currentMayaText,
    startSession,
    submitResponse,
    submitFollowUp,
    skipRound,
    endSession,
    sessionTopic,
  } = useVoicePracticeSession(6, 1, activeSessionId ?? undefined, activeProfile?.id);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Speech recognition setup
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[VoicePractice] Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      const full = (finalTranscript + ' ' + interimTranscript).trim();
      transcriptRef.current = full;
      setTranscript(full);

      // Track that user has spoken meaningful content
      const wordCount = full.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount >= 2) {
        hasSpokenRef.current = true;
      }

      // Track when last speech occurred
      lastTranscriptTimeRef.current = Date.now();
    };

    recognition.onerror = (event: any) => {
      console.warn('[VoicePractice] Recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still in listening phase
      if (isRecording) {
        try { recognition.start(); } catch (e) { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setTranscript('');
    transcriptRef.current = '';
  }, [isRecording]);

  const stopListening = useCallback(() => {
    if (silenceCheckRef.current) {
      clearInterval(silenceCheckRef.current);
      silenceCheckRef.current = null;
    }
    hasSpokenRef.current = false;
    setNudgeHint(null);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Auto-start listening + adaptive silence check when phase changes to 'listening'
  useEffect(() => {
    if (phase === 'listening' || phase === 'listening_followup') {
      startListening();
      listeningStartTimeRef.current = Date.now();
      lastTranscriptTimeRef.current = Date.now();

      // Adaptive silence check using speech state classifier
      if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
      silenceCheckRef.current = setInterval(() => {
        const transcript = transcriptRef.current;
        const silenceMs = Date.now() - lastTranscriptTimeRef.current;
        const elapsedMs = Date.now() - listeningStartTimeRef.current;

        const state = classifySpeechState({
          transcript,
          elapsedMs,
          silenceDurationMs: silenceMs,
          promptText: currentRound?.label,
        });

        setNudgeHint(state.nudgeHint);

        if (state.suppressAutoSubmit) return;

        const profile = TIMING_PROFILES.discourse;
        const multiplier = getProfileMultiplier(profile, state.state, state.confidence);
        const threshold = Math.round(profile.baseSilenceMs * multiplier);
        const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;

        if (hasSpokenRef.current && wordCount >= profile.minWordsForSubmit && silenceMs >= threshold) {
          console.log('[VoicePractice] Adaptive auto-submit', { silenceMs, threshold, state: state.state });
          handleAutoSubmit();
        }
      }, 200);
    } else if (isRecording) {
      stopListening();
    }

    return () => {
      if (silenceCheckRef.current) {
        clearInterval(silenceCheckRef.current);
        silenceCheckRef.current = null;
      }
    };
  }, [phase]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
      }
    };
  }, []);

  // Ref-stable auto-submit (called from silence timer closure)
  const handleAutoSubmitRef = useRef<() => void>(() => {});

  const handleSubmit = useCallback(async () => {
    const captured = transcriptRef.current;
    stopListening();
    if (phase === 'listening_followup') {
      await submitFollowUp(captured);
    } else {
      await submitResponse(captured);
    }
  }, [submitResponse, submitFollowUp, stopListening, phase]);

  // Keep auto-submit ref in sync
  handleAutoSubmitRef.current = handleSubmit;
  const handleAutoSubmit = useCallback(() => {
    handleAutoSubmitRef.current();
  }, []);

  const handleSkip = useCallback(async () => {
    stopListening();
    await skipRound();
  }, [skipRound, stopListening]);

  // ─── Ready Screen ───
  if (phase === 'ready') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <VoiceHeader onBack={() => navigate(-1)} />
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Headphones className="w-12 h-12 text-primary" />
          </div>
          <div className="text-center space-y-3 max-w-sm">
            <h1 className="text-2xl font-semibold text-foreground">Voice Practice</h1>
            <p className="text-muted-foreground">
              Practice speaking with Maya using just your voice. No screen needed — put in your earbuds and go.
            </p>
          </div>
          <Button size="lg" onClick={startSession} className="gap-2 px-8">
            <Play className="w-5 h-5" />
            Start Practice
          </Button>
        </div>
      </div>
    );
  }

  // ─── Complete Screen ───
  if (phase === 'complete') {
    const completed = results.filter(r => r.score > 0).length;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <VoiceHeader onBack={() => navigate(-1)} />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Volume2 className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Practice Complete!</h2>
            <p className="text-muted-foreground">
              {completed} of {results.length} exercises completed
            </p>
            {/* Voice Practice is conversational practice, not a scored exercise
                (Voice Engine v2 quarantine, spec §11). Showing a percentage here
                implied clinical measurement the heuristic can't support. */}
            <p className="text-sm text-muted-foreground">
              Great conversational practice — every spoken answer counts.
            </p>
          </div>
          {/* Round summary — participation, not scores */}
          <div className="w-full max-w-sm space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm px-3 py-2 bg-muted/30 rounded-lg">
                <span className="text-foreground">{r.label}</span>
                <span className={cn(
                  "font-medium",
                  r.score > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                )}>
                  {r.score > 0 ? 'Completed' : 'Skipped'}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/today')}>
              Back to Home
            </Button>
            <Button onClick={() => window.location.reload()}>
              Practice Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Session ───
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <VoiceHeader 
        onBack={() => { endSession(); navigate(-1); }}
        roundInfo={`${currentIndex + 1} / ${totalRounds}`}
      />
      
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
        {/* Maya's voice visualizer */}
        <MayaVoiceOrb isSpeaking={isMayaSpeaking} isListening={phase === 'listening'} />
        
        {/* Subtitle / current text */}
        <div className="min-h-[80px] flex items-center justify-center px-6 max-w-md">
          {isMayaSpeaking && currentMayaText ? (
            <p className="text-center text-foreground text-lg leading-relaxed animate-fade-in">
              {currentMayaText}
            </p>
          ) : (phase === 'listening' || phase === 'listening_followup') ? (
            <div className="text-center space-y-2">
              <p className="text-muted-foreground text-sm">
                {phase === 'listening_followup' ? 'Follow-up' : (
                  <span>
                    {currentRound?.arcPhase === 'open' ? '💬' : 
                     currentRound?.arcPhase === 'expand' ? '🔍' : 
                     currentRound?.arcPhase === 'challenge' ? '⚡' : '🎯'}{' '}
                    {currentRound?.label}
                  </span>
                )}
              </p>
              {transcript ? (
                <div className="space-y-1">
                  <p className="text-foreground text-lg">{transcript}</p>
                  <p className="text-muted-foreground/40 text-xs">
                    Auto-submits when you pause
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground/60 text-sm animate-pulse">
                  Listening...
                </p>
              )}
            </div>
          ) : phase === 'scoring' ? (
            <p className="text-muted-foreground animate-pulse">Thinking...</p>
          ) : null}
        </div>

        {/* Speech nudge */}
        {(phase === 'listening' || phase === 'listening_followup') && (
          <SpeechNudge nudgeHint={nudgeHint} isSpeaking={!!transcript} />
        )}

        {/* Controls */}
        <div className="flex items-center gap-4">
          {(phase === 'listening' || phase === 'listening_followup') && (
            <>
              <Button
                variant="outline"
                size="icon"
                aria-label="Skip"
                onClick={handleSkip}
                className="h-12 w-12 rounded-full"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={!transcript.trim()}
                className="h-14 px-8 rounded-full gap-2"
              >
                <Mic className="w-5 h-5" />
                Done
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="End session"
                onClick={() => { endSession(); }}
                className="h-12 w-12 rounded-full"
              >
                <Square className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pb-8">
        {Array.from({ length: totalRounds }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              i < currentIndex ? "bg-primary" :
              i === currentIndex ? "bg-primary w-4" :
              "bg-muted-foreground/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Sub-components ───

function VoiceHeader({ onBack, roundInfo }: { onBack: () => void; roundInfo?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
      <Button variant="ghost" size="icon" aria-label="Go back" onClick={onBack}>
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px]">
        {roundInfo || 'Voice Practice'}
      </span>
      <div className="w-10" /> {/* spacer */}
    </div>
  );
}

function MayaVoiceOrb({ isSpeaking, isListening }: { isSpeaking: boolean; isListening: boolean }) {
  return (
    <div className={cn(
      "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500",
      isSpeaking 
        ? "bg-primary/20 shadow-[0_0_40px_rgba(var(--primary-rgb,99,102,241),0.3)] scale-110" 
        : isListening
          ? "bg-accent/20 shadow-[0_0_30px_rgba(var(--accent-rgb,99,102,241),0.2)]"
          : "bg-muted/30"
    )}>
      <div className={cn(
        "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
        isSpeaking 
          ? "bg-primary/30 animate-pulse" 
          : isListening
            ? "bg-accent/30"
            : "bg-muted/40"
      )}>
        {isSpeaking ? (
          <Volume2 className="w-8 h-8 text-primary" />
        ) : isListening ? (
          <Mic className={cn("w-8 h-8 text-accent-foreground", isListening && "animate-pulse")} />
        ) : (
          <Volume2 className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
