/**
 * Narrative Retell Game Component — v2
 * 
 * Shows full story upfront → user retells via speech → structured feedback.
 * 
 * v2 changes:
 * - All story cards visible at once (no scene gating)
 * - Purpose banner for entry clarity
 * - Stall support prompts during retell
 * - Structured beginning/middle/end feedback with next-step hint
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNarrativeRetellGame, NarrativeTrialResult, SectionStatus } from '@/hooks/useNarrativeRetellGame';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useAutoResponseMic } from '@/hooks/useAutoResponseMic';
import { MicFailureRecovery } from '@/components/MicFailureRecovery';
import { Button } from '@/components/ui/button';
import { RoundDoneAutoAdvance } from '@/components/RoundDoneAutoAdvance';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, BookOpen, ChevronRight, SkipForward, Keyboard, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { validateSpokenResponse } from '@/lib/evaluation/responseValidation';
import { gateResponse } from '@/lib/evaluation/gateResponse';
import { broadcastGateDecision } from '@/components/dev/VoiceGateHud';
import { voiceController } from '@/lib/voiceController';
import { useVoiceState } from '@/hooks/useVoiceState';
import { trackValidation, logValidationDetail } from '@/lib/evaluation/validationTelemetry';
import { speakMayaCoaching, resetCoachingState } from '@/lib/evaluation/mayaCoachingResponses';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { AdaptationBadge, useAdaptationShift } from '@/components/AdaptationBadge';

/** Map adaptive level (1-10) → content tier (1-3) */
function levelToTierLocal(level: number): number {
  if (level <= 3) return 1;
  if (level <= 7) return 2;
  return 3;
}

const RETELL_AUTO_SUBMIT_MS = 5000;
const RETELL_AUTO_SUBMIT_MIN_WORDS = 2;

function mergeTranscriptSegments(...segments: Array<string | null | undefined>) {
  return segments
    .map((segment) => (segment ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface NarrativeRetellGameProps {
  userId?: string;
  sessionId?: string | null;
  onTrialComplete: (result: NarrativeTrialResult) => void;
  onGameComplete: (results: NarrativeTrialResult[]) => void;
  roundCount?: number;
  tier?: number;
  /** Profile-recommended cue type — adapts retelling scaffolding */
  recommendedCueType?: 'semantic' | 'phonemic' | 'full_word' | 'none';
}

type Phase = 'reading' | 'retelling' | 'scored';

const STALL_PROMPTS = [
  "Take your time. Start with what happened first.",
  "Who was in the story?",
  "What happened next?",
  "How did the story end?",
];

function SectionStatusIcon({ status }: { status: SectionStatus }) {
  if (status === 'covered') return <span>✅</span>;
  if (status === 'partial') return <span>⚠️</span>;
  return <span className="text-muted-foreground">○</span>;
}

function SectionStatusLabel({ status }: { status: SectionStatus }) {
  if (status === 'covered') return <span className="text-green-700 dark:text-green-400">Covered</span>;
  if (status === 'partial') return <span className="text-amber-600 dark:text-amber-400">Partial</span>;
  return <span className="text-muted-foreground">Missed</span>;
}

/** Generate Maya's structured reflection based on retell result */
function buildMayaReflection(result: NarrativeTrialResult): string {
  const { structureBreakdown: sb, eventCoverage } = result;
  const coveredParts: string[] = [];
  const weakParts: string[] = [];
  for (const section of ['beginning', 'middle', 'end'] as const) {
    if (sb[section].status === 'covered') coveredParts.push(section);
    else weakParts.push(section);
  }

  if (eventCoverage >= 0.6 && weakParts.length === 0) {
    return 'You told the full story clearly, including the key events.';
  }
  if (coveredParts.length > 0 && weakParts.length > 0) {
    return `You got the ${coveredParts.join(' and ')} clearly. The ${weakParts[0]} was harder — that's what we'll focus on next.`;
  }
  if (eventCoverage >= 0.3) {
    return 'You started the story well. Next time, try adding what happened after.';
  }
  return "That's okay. Let's try starting with just the beginning next time.";
}

const REAL_LIFE_CONNECTIONS = [
  "This is the same skill you use when telling someone what happened during your day.",
  "This helps when you're explaining something to someone — step by step.",
  "Retelling stories strengthens the same skills you use in everyday conversations.",
];

export function NarrativeRetellGame({
  userId,
  sessionId,
  onTrialComplete,
  onGameComplete,
  roundCount = 3,
  tier = 1,
  recommendedCueType,
}: NarrativeRetellGameProps) {
  const { currentStory, currentIndex, totalStories, isComplete, results, submitRetell, nextStory, activeTier, setActiveTier } =
    useNarrativeRetellGame(roundCount, tier);

  // Visible adaptation cue
  const { direction: shiftDirection, reason: shiftReason, signal: signalShift } = useAdaptationShift();

  // Engagement monitor — surfaces fatigue / cue dependency for the safety gate.
  const engagement = useEngagementMonitor(sessionId ?? null);

  // In-game adaptation: shifts story tier mid-session based on retell coverage
  const adaptation = useInGameAdaptation({
    exerciseSlug: 'narrative-retell',
    sessionId: sessionId ?? null,
    initialDifficulty: Math.max(1, Math.min(10, tier * 3)),
    bounds: { floor: 1, ceiling: 10, suggestedStart: tier * 3 },
    enableDifficultyToasts: false,
    enableAutoHints: false,
    // Retell uses its own implicit cue model (replays/hints). Treat hesitations
    // and timeout-rate as a soft proxy for cue dependency.
    getCueDependencyScore: () => {
      const sig = engagement.getState().signals;
      const hesitationProxy = Math.min(1, sig.hesitationCount / 4);
      const timeoutProxy = Math.min(1, sig.timeoutRate);
      return Math.max(hesitationProxy, timeoutProxy);
    },
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.info('[NarrativeRetell] escalation blocked', {
        reason,
        cueDependencyScore,
        trialsAtLevel,
      });
    },
    onDifficultyChange: (newLevel, reason, dir) => {
      const newTier = levelToTierLocal(newLevel);
      if (newTier !== activeTier) {
        setActiveTier(newTier);
      }
      const narration = narrateAdaptation({
        direction: dir,
        reasonKind: classifyReason(reason),
      });
      signalShift(dir, narration || reason);
    },
  });

  const [phase, setPhase] = useState<Phase>('reading');
  const [lastResult, setLastResult] = useState<NarrativeTrialResult | null>(null);
  const [validationCoaching, setValidationCoaching] = useState<string | null>(null);
  const [collectedTranscript, setCollectedTranscript] = useState('');
  const [useTyping, setUseTyping] = useState(() => sessionStorage.getItem('preferTypingInput') === 'true');
  const [typedText, setTypedText] = useState('');
  const [stallPromptIndex, setStallPromptIndex] = useState(-1);
  const [micFailed, setMicFailed] = useState(false);
  const [storyReadComplete, setStoryReadComplete] = useState(false);
  const realLifeLineRef = useRef(REAL_LIFE_CONNECTIONS[Math.floor(Math.random() * REAL_LIFE_CONNECTIONS.length)]);
  const startTimeRef = useRef(Date.now());
  const latestTranscriptRef = useRef('');
  const hasProcessedRef = useRef(false);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retellStartRef = useRef(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceSequenceRef = useRef(0);
  const transcriptPrefixRef = useRef('');
  const handleDoneRetellingRef = useRef<() => void>(() => {});
  const autoStartedForIndexRef = useRef<number | null>(null);
  const [isRetellPlaybackActive, setIsRetellPlaybackActive] = useState(false);

  // Clinical pipeline hooks
  const { startAttempt, logFinalAnalysis, resetAttempt, currentAttemptId } = useUtteranceLogger();
  const { startRecording, stopRecording, uploadRecording, cancelRecording } = useAudioRecorder();
  const { speak: speakTTS, isSpeaking: isTTSSpeaking, stop: stopTTS } = useTextToSpeech();

  // Voice guidance for Full Coaching mode
  const vg = useVoiceGuidance('narrative-retell');
  const { interrupt: interruptVoiceGuidance } = vg;
  const { awaitMicSafe } = useVoiceState();

  const clearRetellTimers = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const invalidateVoiceSequence = useCallback(() => {
    voiceSequenceRef.current += 1;
    return voiceSequenceRef.current;
  }, []);

  const isVoiceSequenceCurrent = useCallback((sequenceId: number) => {
    return voiceSequenceRef.current === sequenceId;
  }, []);

  // Auto-read story when entering reading phase — only in Full Coaching mode
  // Guided/Games Only: user reads silently and can tap "Listen" manually
  const hasAutoReadRef = useRef(false);
  useEffect(() => {
    if (phase !== 'reading' || !currentStory || hasAutoReadRef.current) return;
    if (!vg.shouldAutoReadContent) return; // Only auto-read in Full Coaching
    hasAutoReadRef.current = true;

    const doAutoRead = async () => {
      await new Promise(r => setTimeout(r, 600));
      
      // Speak context-aware intro first
      if (vg.shouldAutoSpeak && currentIndex === 0) {
        try {
          await vg.speakIntro({ storyTitle: currentStory.title });
          voiceController.recordSpoken(`Listen to ${currentStory.title}`);
        } catch (e) {
          console.warn('[NarrativeRetell] Intro TTS failed:', e);
        }
        await new Promise(r => setTimeout(r, 600));
      }
      
      // Read the full story aloud
      const fullText = currentStory.scenes.map(s => s.text).join(' ');
      console.log('[NarrativeRetell] Auto-reading story:', currentStory.title);
      try {
        await speakTTS(fullText);
        voiceController.recordSpoken(fullText);
        console.log('[NarrativeRetell] Auto-read complete');
        setStoryReadComplete(true);
      } catch (e) {
        console.warn('[NarrativeRetell] Story auto-read TTS failed:', e);
      }
    };
    doAutoRead();
  }, [phase, currentStory, currentIndex, vg, speakTTS]);

  const handleListenToStory = useCallback(async () => {
    if (!currentStory) return;
    const fullText = currentStory.scenes.map(s => s.text).join(' ');
    await speakTTS(fullText);
    voiceController.recordSpoken(fullText);
    setStoryReadComplete(true);
  }, [currentStory, speakTTS]);

  // Reset on story change — also clear voiceController spoken history
  // so previous story's narration can't echo into the new trial's gate.
  useEffect(() => {
    setPhase('reading');
    setLastResult(null);
    setCollectedTranscript('');
    setStallPromptIndex(-1);
    setMicFailed(false);
    hasProcessedRef.current = false;
    latestTranscriptRef.current = '';
    hasAutoReadRef.current = false;
    setStoryReadComplete(false);
    autoStartedForIndexRef.current = null;
    voiceController.clearSpokenHistory();
  }, [currentIndex]);

  const completedRef = useRef(false);
  useEffect(() => {
    if (isComplete && results.length > 0 && !completedRef.current) {
      completedRef.current = true;
      onGameComplete(results);
    }
  }, [isComplete, results, onGameComplete]);

  const handleSpeechResult = useCallback((transcript: string) => {
    if (phase !== 'retelling' || hasProcessedRef.current || !transcript.trim()) return;
    setCollectedTranscript(transcript);
    latestTranscriptRef.current = mergeTranscriptSegments(transcriptPrefixRef.current, transcript);
  }, [phase]);

  const { isListening, fullTranscript, startListening, stopListening, isSupported, error: speechError } =
    useSpeechRecognition({ onResult: handleSpeechResult, patientMode: true, continuousListening: true, discourseMode: true });

  useEffect(() => {
    if (phase === 'reading' && isListening) {
      stopListening();
    }
  }, [phase, isListening, stopListening]);

  // Auto-response mic for Full Coaching: auto-start mic after Maya speaks retell prompt
  const { scheduleAutoListen, cancelAutoListen, isAutoResponseActive } = useAutoResponseMic({
    delayAfterTTS: 1000, // 1s pause after Maya finishes prompt
    enabled: phase === 'retelling' && !useTyping,
    isTTSSpeaking: isTTSSpeaking || vg.isSpeaking,
    startListening: () => {
      console.log('[NarrativeRetell] Auto-response: starting mic');
      setMicFailed(false);
      startRecording();
      startListening();
    },
    isListening,
  });

  const handleStopSpeech = useCallback(() => {
    invalidateVoiceSequence();
    clearRetellTimers();
    cancelAutoListen();
    setIsRetellPlaybackActive(false);
    stopTTS();
    interruptVoiceGuidance();
  }, [invalidateVoiceSequence, clearRetellTimers, cancelAutoListen, stopTTS, interruptVoiceGuidance]);

  const beginRetellPlayback = useCallback(() => {
    const sequenceId = invalidateVoiceSequence();
    clearRetellTimers();
    cancelAutoListen();

    const snapshot = mergeTranscriptSegments(transcriptPrefixRef.current, collectedTranscript, fullTranscript);
    transcriptPrefixRef.current = snapshot;
    latestTranscriptRef.current = snapshot;
    setCollectedTranscript('');
    setIsRetellPlaybackActive(true);

    if (!useTyping) {
      stopListening();
      cancelRecording();
    }

    return sequenceId;
  }, [invalidateVoiceSequence, clearRetellTimers, cancelAutoListen, collectedTranscript, fullTranscript, useTyping, stopListening, cancelRecording]);

  const resumeRetellingAfterPlayback = useCallback((sequenceId?: number) => {
    if (sequenceId != null && !isVoiceSequenceCurrent(sequenceId)) return;

    setIsRetellPlaybackActive(false);
    if (phase !== 'retelling' || hasProcessedRef.current || useTyping) return;

    if (vg.isVoiceLed) {
      scheduleAutoListen();
      return;
    }

    startRecording();
    startListening();
  }, [phase, useTyping, vg.isVoiceLed, isVoiceSequenceCurrent, scheduleAutoListen, startRecording, startListening]);

  const visibleTranscript = mergeTranscriptSegments(transcriptPrefixRef.current, fullTranscript || collectedTranscript);
  const retellPromptText = vg.guidance?.voiceTask ?? 'Now tell the story back in your own words.';

  useEffect(() => {
    return () => {
      handleStopSpeech();
      cancelRecording();
    };
  }, [handleStopSpeech, cancelRecording]);

  // Track mic failures for persistent UI
  useEffect(() => {
    if (speechError && phase === 'retelling' && !useTyping) {
      setMicFailed(true);
    }
  }, [speechError, phase, useTyping]);

  useEffect(() => {
    if (fullTranscript) {
      latestTranscriptRef.current = mergeTranscriptSegments(transcriptPrefixRef.current, fullTranscript);
    }
  }, [fullTranscript]);

  // Auto-submit after a longer pause so users have enough retell time
  // Stall support: show progressive prompts if user hasn't spoken much
  // In Full Coaching mode, speak the prompts aloud
  const lastSpokenStallRef = useRef(-1);
  useEffect(() => {
    if (phase !== 'retelling' || isRetellPlaybackActive || isTTSSpeaking || vg.isSpeaking) return;
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);

    const checkStall = () => {
      const transcript = latestTranscriptRef.current || visibleTranscript;
      const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
      const elapsed = Date.now() - retellStartRef.current;

      if (wordCount < 2) {
        let newIndex = stallPromptIndex;
        if (elapsed > 20000 && stallPromptIndex < 3) newIndex = 3;
        else if (elapsed > 15000 && stallPromptIndex < 2) newIndex = 2;
        else if (elapsed > 10000 && stallPromptIndex < 1) newIndex = 1;
        else if (elapsed > 6000 && stallPromptIndex < 0) newIndex = 0;
        
        if (newIndex > stallPromptIndex) {
          setStallPromptIndex(newIndex);
          // Speak the stall prompt in Full Coaching mode
          if (vg.isVoiceLed && newIndex > lastSpokenStallRef.current) {
            lastSpokenStallRef.current = newIndex;
            vg.speakIfVoiceLed(STALL_PROMPTS[newIndex]);
            voiceController.recordSpoken(STALL_PROMPTS[newIndex]);
          }
        }
      }
    };

    stallTimerRef.current = setTimeout(checkStall, 3000);
    const interval = setInterval(checkStall, 3000);
    return () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      clearInterval(interval);
    };
  }, [phase, visibleTranscript, stallPromptIndex, isRetellPlaybackActive, isTTSSpeaking, vg.isSpeaking, vg]);

  const handleStartRetelling = useCallback(() => {
    handleStopSpeech();
    setPhase('retelling');
    startTimeRef.current = Date.now();
    retellStartRef.current = Date.now();
    setTypedText('');
    setCollectedTranscript('');
    setStallPromptIndex(-1);
    setMicFailed(false);
    transcriptPrefixRef.current = '';
    latestTranscriptRef.current = '';
    lastSpokenStallRef.current = -1;

    if (currentStory && userId) {
      startAttempt({
        sessionId: sessionId || 'standalone',
        userId,
        exerciseSlug: 'narrative_retell',
        trialIndex: currentIndex,
        attemptNumber: 1,
        targetWord: currentStory.title,
        category: 'discourse',
      });
    }

    // Helper: actually open the mic + recorder, with a small retry safety net
    // because Web Speech API silently no-ops when called too soon after TTS.
    const openMic = async () => {
      if (useTyping) return;
      // Belt-and-braces: wait until any residual TTS is fully stopped.
      let waited = 0;
      while ((isTTSSpeaking || vg.isSpeaking) && waited < 3000) {
        await new Promise(r => setTimeout(r, 150));
        waited += 150;
      }
      // Tiny pad so the audio tail doesn't bleed into the recogniser.
      await new Promise(r => setTimeout(r, 200));
      try { startRecording(); } catch (e) { console.warn('[NarrativeRetell] startRecording failed', e); }
      try { startListening(); } catch (e) { console.warn('[NarrativeRetell] startListening failed', e); }
      // Verify mic actually opened; if not, surface the failure UI so the
      // user isn't talking into a dead mic (the "doesn't hear any audio" bug).
      setTimeout(() => {
        if (!isListening && phase === 'retelling' && !useTyping && !hasProcessedRef.current) {
          console.warn('[NarrativeRetell] mic did not open after start, retrying');
          try { startListening(); } catch {}
          setTimeout(() => {
            if (!isListening && phase === 'retelling' && !useTyping && !hasProcessedRef.current) {
              setMicFailed(true);
            }
          }, 1200);
        }
      }, 1500);
    };

    // Full Coaching: speak retell prompt, then open mic AFTER speech ends.
    if (vg.isVoiceLed && !useTyping) {
      (async () => {
        await new Promise(r => setTimeout(r, 300));
        try { await vg.speakTask(); } catch {}
        await openMic();
      })();
    } else if (!useTyping) {
      // Non voice-led: still wait for any auto-read tail before opening mic.
      void openMic();
    }
  }, [handleStopSpeech, startListening, startRecording, startAttempt, currentStory, currentIndex, userId, sessionId, useTyping, vg, isTTSSpeaking, isListening, phase]);

  // Auto-advance into retell phase as soon as the story finishes reading.
  // Removes the manual "Start retelling" gate — the user just hears the story
  // and starts talking. (autoStartedForIndexRef is declared higher up alongside
  // the other per-story refs.)
  useEffect(() => {
    if (phase !== 'reading') return;
    if (!storyReadComplete) return;
    if (autoStartedForIndexRef.current === currentIndex) return;
    autoStartedForIndexRef.current = currentIndex;
    // Small breath after audio so the tail-lock can settle.
    const t = setTimeout(() => {
      handleStartRetelling();
    }, 600);
    return () => clearTimeout(t);
  }, [phase, storyReadComplete, currentIndex, handleStartRetelling]);

  const handleDoneRetelling = useCallback(async () => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    clearRetellTimers();
    cancelAutoListen();
    setIsRetellPlaybackActive(false);
    stopListening();

    const recordingResult = useTyping ? null : await stopRecording();

    setTimeout(async () => {
      const transcript = useTyping ? typedText : (collectedTranscript || latestTranscriptRef.current || '');
      const validation = validateSpokenResponse({ transcript, expectedMode: 'retell' });
      trackValidation('narrative_retell', validation);
      logValidationDetail('narrative_retell', transcript, validation);
      const durationMs = Date.now() - startTimeRef.current;
      if (!validation.valid && validation.rejectionReason) {
        speakMayaCoaching(validation.rejectionReason, speakTTS, { exerciseKey: 'narrative_retell' }).then(line => setValidationCoaching(line));
      } else {
        setValidationCoaching(null);
        resetCoachingState('narrative_retell', speakTTS);
      }
      const result = submitRetell(validation.valid ? transcript : '', durationMs);

      let audioStoragePath: string | null = null;
      if (recordingResult?.audioBlob && userId && sessionId) {
        audioStoragePath = await uploadRecording(
          recordingResult.audioBlob, userId, sessionId, currentIndex, recordingResult.mimeType
        );
      }

      if (currentAttemptId) {
        await logFinalAnalysis({
          transcript: transcript || undefined,
          transcriptSource: 'browser',
          evaluationModel: 'flow',
          isCorrect: null,
          didSpeak: transcript.trim().length > 0,
          utteranceComplete: transcript.trim().length > 0,
          recordingDurationMs: durationMs,
          audioStoragePath: audioStoragePath || undefined,
          fluencyAvailable: false,
          fluencyUnavailableReason: 'discourse_task',
        });
        resetAttempt();
      }

      if (result) {
        setLastResult(result);
        setPhase('scored');
        // Feed adaptation engine: 60% event coverage = strong retell, drives tier shifts
        adaptation.recordTrial({
          correct: result.eventCoverage >= 0.6,
          reactionTimeMs: result.durationMs,
        });
        engagement.recordTrial({
          correct: result.eventCoverage >= 0.6,
          reactionTimeMs: result.durationMs,
          timeout: false,
          cueLevel: 0,
          timestamp: Date.now(),
        });
        onTrialComplete(result);
      }
    }, 150);
  }, [clearRetellTimers, cancelAutoListen, stopListening, stopRecording, collectedTranscript, submitRetell, onTrialComplete, uploadRecording, userId, sessionId, currentIndex, currentAttemptId, logFinalAnalysis, resetAttempt, useTyping, typedText, adaptation]);

  // Keep ref in sync on every render so auto-submit timer always calls latest version
  handleDoneRetellingRef.current = () => { void handleDoneRetelling(); };

  useEffect(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (phase !== 'retelling' || isRetellPlaybackActive || isTTSSpeaking || vg.isSpeaking) return;

    const transcript = latestTranscriptRef.current || visibleTranscript;
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

    if (wordCount >= RETELL_AUTO_SUBMIT_MIN_WORDS) {
      silenceTimerRef.current = setTimeout(() => {
        if (!hasProcessedRef.current) {
          handleDoneRetellingRef.current();
        }
      }, RETELL_AUTO_SUBMIT_MS);
    }

    return () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
  }, [phase, visibleTranscript, isRetellPlaybackActive, isTTSSpeaking, vg.isSpeaking]);

  const handleSkip = useCallback(async () => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    clearRetellTimers();
    cancelAutoListen();
    setIsRetellPlaybackActive(false);
    stopListening();
    await stopRecording();

    const durationMs = Date.now() - startTimeRef.current;
    const result = submitRetell('', durationMs);

    if (currentAttemptId) {
      await logFinalAnalysis({
        transcript: '',
        transcriptSource: 'browser',
        evaluationModel: 'flow',
        isCorrect: null,
        didSpeak: false,
        fluencyAvailable: false,
        fluencyUnavailableReason: 'no_recording',
      });
      resetAttempt();
    }

    if (result) {
      setLastResult(result);
      setPhase('scored');
      // Skipped retell = unsuccessful trial; engine should ease the next story.
      adaptation.recordTrial({
        correct: false,
        reactionTimeMs: durationMs,
      });
      engagement.recordTrial({
        correct: false,
        reactionTimeMs: durationMs,
        timeout: true,
        cueLevel: 0,
        timestamp: Date.now(),
      });
      onTrialComplete(result);
    }
  }, [clearRetellTimers, cancelAutoListen, stopListening, stopRecording, submitRetell, onTrialComplete, currentAttemptId, logFinalAnalysis, resetAttempt, adaptation]);

  const handleContinue = useCallback(() => {
    nextStory();
  }, [nextStory]);

  // Game complete screen
  if (!currentStory || isComplete) {
    const avgCoverage = results.length > 0
      ? results.reduce((sum, r) => sum + r.eventCoverage, 0) / results.length
      : 0;
    const bestSection = results.length > 0 ? (() => {
      const sectionHits = { beginning: 0, middle: 0, end: 0 };
      for (const r of results) {
        for (const s of ['beginning', 'middle', 'end'] as const) {
          if (r.structureBreakdown[s].status === 'covered') sectionHits[s]++;
        }
      }
      if (sectionHits.beginning >= sectionHits.middle && sectionHits.beginning >= sectionHits.end) return 'beginnings';
      if (sectionHits.end >= sectionHits.middle) return 'endings';
      return 'middle details';
    })() : null;

    return (
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <div className="text-6xl">📖</div>
        <h2 className="text-2xl font-bold">Stories Complete!</h2>

        {/* Maya session reflection */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-left space-y-1.5">
          <p className="text-sm text-foreground">
            {avgCoverage >= 0.6
              ? `You did well remembering key events across all stories${bestSection ? `, especially ${bestSection}` : ''}.`
              : avgCoverage >= 0.3
              ? `You're building your retelling skills. ${bestSection ? `Your ${bestSection} were strongest.` : ''}`
              : "Keep practicing — retelling gets easier with each session."}
          </p>
          <p className="text-xs text-muted-foreground italic">{realLifeLineRef.current}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{results.length}</div>
              <div className="text-xs text-muted-foreground">Stories Retold</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{Math.round(avgCoverage * 100)}%</div>
              <div className="text-xs text-muted-foreground">Avg Coverage</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-2 sm:space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="font-medium">Narrative Retell</span>
          <AdaptationBadge direction={shiftDirection} reason={shiftReason} />
        </div>
        <div className="text-muted-foreground">
          Story {currentIndex + 1} of {totalStories}
        </div>
      </div>

      <Progress value={((currentIndex) / totalStories) * 100} className="h-2" />

      <h2 className="text-lg font-bold flex items-center gap-2">
        📂 {currentStory.title}
      </h2>

      {/* ─── Reading phase: all cards visible at once ─── */}
      {phase === 'reading' && (
        <div className="space-y-3">
          {/* Clear, dynamic purpose banner */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-center">
            <p className="text-lg font-semibold text-foreground">
              {currentIndex === 0
                ? `📖 Listen to "${currentStory.title}" — then tell it back`
                : results.length > 0 && results[results.length - 1].eventCoverage >= 0.6
                ? `📖 Nice retelling. Here's your next story: "${currentStory.title}"`
                : results.length > 0 && results[results.length - 1].eventCoverage < 0.3
                ? `📖 Let's try a different story: "${currentStory.title}"`
                : `📖 Next story: "${currentStory.title}" — tell it back when ready`}
            </p>
            {isTTSSpeaking && (
              <p className="text-sm text-primary mt-1 animate-pulse">🔊 Reading aloud…</p>
            )}
            {!isTTSSpeaking && (
              <p className="text-sm text-muted-foreground mt-1">Read along below, then tell it back in your own words.</p>
            )}
          </div>

          {/* All scene cards visible */}
          {currentStory.scenes.map((scene, i) => (
            <Card key={i} className="border border-border/50">
              <CardContent className="pt-4 flex items-start gap-3">
                <span className="text-2xl">{scene.emoji}</span>
                <p className="text-base leading-relaxed">{scene.text}</p>
              </CardContent>
            </Card>
          ))}

          {/* Adaptive scaffolding */}
          {recommendedCueType === 'semantic' && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              <span className="font-medium">💡 Hint: </span>
              Think about: <em>who</em> was in the story, <em>where</em> it happened, and <em>what</em> went wrong.
            </div>
          )}
          {recommendedCueType === 'phonemic' && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              <span className="font-medium">💡 Start with: </span>
              "{currentStory.scenes[0].text.split(' ').slice(0, 3).join(' ')}..."
            </div>
          )}

          {/* Action area — story auto-advances into retell when audio ends.
              No manual "Start" gate. We still expose Listen-again and a
              fallback "Start now" link in case audio fails. */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={isTTSSpeaking ? stopTTS : handleListenToStory}
              >
                <Volume2 className="h-4 w-4 mr-1" />
                {isTTSSpeaking ? 'Stop' : 'Listen again'}
              </Button>
            </div>
            {!isTTSSpeaking && !storyReadComplete && (
              <button
                onClick={handleStartRetelling}
                className="text-xs text-muted-foreground hover:text-foreground mx-auto block"
              >
                Skip ahead and start retelling →
              </button>
            )}
            {isSupported && (
              <button
                onClick={() => { const next = !useTyping; setUseTyping(next); sessionStorage.setItem('preferTypingInput', String(next)); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
              >
                {useTyping ? <Mic className="w-3 h-3" /> : <Keyboard className="w-3 h-3" />}
                {useTyping ? 'Switch to speech' : 'Switch to typing'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Retelling phase with stall support ─── */}
      {phase === 'retelling' && (
        <Card className="border-2 border-primary/50">
          <CardContent className="pt-4 space-y-3">
            {/* Story text intentionally hidden during retell — retelling
                from memory is the clinical target. (Replay audio if needed
                via the "Listen again" path in the reading phase.) */}
            <div className="rounded-lg bg-muted/40 border border-border/50 px-3 py-2 text-xs text-muted-foreground text-center">
              Tell the story back in your own words.
            </div>

            {/* Mic failure recovery — persistent, not toast */}
            <MicFailureRecovery
              visible={micFailed && !useTyping}
              onRetry={() => {
                setMicFailed(false);
                startListening();
                startRecording();
              }}
              onSwitchToTyping={() => {
                setUseTyping(true);
                sessionStorage.setItem('preferTypingInput', 'true');
                setMicFailed(false);
              }}
              compact
            />

            <div className="flex items-center gap-2">
              <div className="relative">
                {useTyping ? <Keyboard className="h-5 w-5 text-primary" /> : <Mic className="h-5 w-5 text-primary" />}
                {!useTyping && isListening && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                  </span>
                )}
              </div>
              <span className="font-semibold text-sm">
                {!useTyping && isListening
                  ? '🎤 Listening…'
                  : !useTyping && vg.isSpeaking
                  ? '🔊 Maya is speaking…'
                  : 'Tell the story in your own words...'}
              </span>
              {!useTyping && isListening && (
                <span className="text-xs text-muted-foreground ml-auto">Auto-submits when you pause</span>
              )}
            </div>

            {/* Helper text */}
            <p className="text-xs text-muted-foreground">You can start with what happened first.</p>

            {/* Typing mode */}
            {useTyping && (
              <Textarea
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder="Type what happened in the story..."
                className="min-h-[100px] text-base"
                autoFocus
              />
            )}

            {/* Speech mode transcript */}
            {!useTyping && (fullTranscript || collectedTranscript) && (
              <div className="bg-muted/50 rounded-lg p-3 min-h-[3rem] max-h-[8rem] overflow-y-auto">
                <p className="text-sm text-foreground italic">
                  "{collectedTranscript || fullTranscript}"
                </p>
              </div>
            )}

            {/* Stall support prompts */}
            {stallPromptIndex >= 0 && (
              <div className="bg-accent/30 border border-accent/50 rounded-lg px-3 py-2 text-sm text-foreground animate-in fade-in duration-500">
                💬 {STALL_PROMPTS[stallPromptIndex]}
              </div>
            )}

            {/* Replay buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (!currentStory) return;
                  vg.interrupt();
                  const fullText = currentStory.scenes.map(s => s.text).join(' ');
                  vg.isVoiceLed ? vg.autoReadText(fullText) : speakTTS(fullText);
                }}
              >
                <Volume2 className="h-4 w-4 mr-1" />
                Read story again
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  vg.interrupt();
                  vg.speakTask();
                }}
              >
                <Volume2 className="h-4 w-4 mr-1" />
                Repeat instructions
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDoneRetelling} className="flex-1" variant="secondary" disabled={useTyping && !typedText.trim()}>
                {useTyping ? '✓' : <MicOff className="h-4 w-4 mr-2" />} I'm done
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Scored phase: structured feedback ─── */}
      {phase === 'scored' && lastResult && (() => {
        const ScoredCard = (
          <Card className={cn("border-2 w-full",
            lastResult.eventCoverage >= 0.6 ? "border-green-500 bg-green-50 dark:bg-green-950/20" :
            lastResult.eventCoverage >= 0.3 ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" :
            "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
          )}>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {lastResult.eventCoverage >= 0.6 ? '🧠' : lastResult.eventCoverage >= 0.3 ? '👍' : '💡'}
                </span>
                <span className="font-bold text-sm">Your retell</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {lastResult.eventsFound}/{lastResult.eventsTotal} key events
                </span>
               </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 space-y-1">
                <p className="text-sm text-foreground">{buildMayaReflection(lastResult)}</p>
                <p className="text-xs text-muted-foreground italic">{realLifeLineRef.current}</p>
              </div>
              {validationCoaching && lastResult.eventCoverage === 0 && (
                <p className="text-sm text-muted-foreground italic">💡 {validationCoaching}</p>
              )}

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Story structure:</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['beginning', 'middle', 'end'] as const).map(section => {
                    const data = lastResult.structureBreakdown[section];
                    return (
                      <div key={section} className={cn(
                        "rounded-lg p-2 text-center border",
                        data.status === 'covered' ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" :
                        data.status === 'partial' ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" :
                        "bg-muted/30 border-border"
                      )}>
                        <SectionStatusIcon status={data.status} />
                        <p className="text-xs font-medium capitalize mt-1">{section}</p>
                        <p className="text-[10px] text-muted-foreground">{data.hit}/{data.total} details</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">What you included:</p>
                {lastResult.allKeyEvents.map((event, i) => {
                  const matched = lastResult.matchedEvents.some(
                    m => m.toLowerCase() === event.toLowerCase()
                  );
                  return (
                    <div key={i} className={cn(
                      "flex items-center gap-2 text-sm rounded-md px-2 py-1",
                      matched ? "bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-300" : "bg-muted/40 text-muted-foreground"
                    )}>
                      <span>{matched ? '✅' : '○'}</span>
                      <span className={cn(!matched && "opacity-70")}>{event}</span>
                    </div>
                  );
                })}
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-primary mb-0.5">💡 Next step</p>
                <p className="text-sm text-foreground">{lastResult.nextStepHint}</p>
              </div>

              {lastResult.transcript && (
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground mb-1">You said:</p>
                  <p className="text-sm italic">"{lastResult.transcript}"</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

        // Pause auto-advance while user is replaying / typing
        const paused = isTTSSpeaking || vg.isSpeaking;

        return (
          <div className="space-y-3">
            {paused ? (
              <>
                {ScoredCard}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="lg" onClick={stopTTS}>
                    Stop reading
                  </Button>
                  <Button onClick={handleContinue} size="lg">
                    {currentIndex + 1 < totalStories ? 'Next Story' : 'Finish'} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            ) : (
              <RoundDoneAutoAdvance
                onAdvance={handleContinue}
                buttonLabel={currentIndex + 1 < totalStories ? 'Next Story' : 'Finish'}
                delayMs={10000}
              >
                {ScoredCard}
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={handleListenToStory}
                >
                  🔊 Read story again
                </Button>
              </RoundDoneAutoAdvance>
            )}
          </div>
        );
      })()}
    </div>
  );
}
