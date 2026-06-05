/**
 * ConversationCoachGame - Evidence-based conversation coach with UNIFIED INPUT ARCHITECTURE
 * 
 * KEY ARCHITECTURE:
 * - ONE authoritative InputMode determines who owns the microphone
 * - ONE SpeechRouter routes all transcripts to the correct destination
 * - NO competing pipelines — chat, card, and popup are true modes, not branch conditions
 * 
 * Features:
 * - Assistive Panel with word tiles, sentence frames, cue ladder
 * - Session phases (warmup → build → conversation → wrapup)
 * - Vocabulary priming and reuse
 * - Real-time cue engine integration
 * - Adaptive difficulty (70-85% success band)
 * - Anti-loop constraints from orchestrator
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useMayaState } from '@/hooks/useMayaState';
import { useInputMode } from '@/hooks/useInputMode';
import { useSpeechRouter } from '@/hooks/useSpeechRouter';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Loader2, MessageCircle, Sparkles, X, CheckCircle2, RefreshCw, Coffee, HelpCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useCoachSession, CoachSessionMetrics } from '@/hooks/useCoachSession';
import { useSpeechEndDetection } from '@/hooks/useSpeechEndDetection';
import { useUserSpeechProfile } from '@/hooks/useUserSpeechProfile';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { CoachChatFeed } from '@/components/coach/CoachChatFeed';
import { CoachSessionSummary } from '@/components/coach/CoachSessionSummary';
import { ConversationHelpers, getRandomIdea } from '@/components/coach/ConversationHelpers';
import { GamePickerDialog } from '@/components/coach/GamePickerDialog';
import { AssistivePanel } from '@/components/coach/AssistivePanel';
import { SessionPhaseIndicator } from '@/components/coach/SessionProgressBar';
import { CardType } from '@/lib/coachOrchestrator';
import { useExerciseModal } from '@/hooks/useExerciseModal';
import { ExerciseModalHost } from '@/components/coach/ExerciseModalHost';
import { cn } from '@/lib/utils';
import { getSilenceCue, resetSilenceCueTracking } from '@/lib/graduatedSilenceResponse';
import { generateSemanticCue, generatePhonologicalCue } from '@/lib/cueGenerator';
import { ScenarioOverlay } from '@/components/coach/ScenarioOverlay';
import { getScenarioById, type ScenarioScore } from '@/lib/scenarioEngine';

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
  const [cardTranscript, setCardTranscript] = useState('');
  const [micPermission, setMicPermission] = useState<'pending' | 'checking' | 'granted' | 'denied'>('pending');
  const [silenceSeconds, setSilenceSeconds] = useState(0);
  const [showSkipPrompt, setShowSkipPrompt] = useState(false);
  const [showBreakPrompt, setShowBreakPrompt] = useState(false);
  const [autoListenEnabled, setAutoListenEnabled] = useState(true);
  const [showHelpers, setShowHelpers] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [silenceCueText, setSilenceCueText] = useState<string | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  
  // ═══════════════════════════════════════════════════════════════
  // UNIFIED INPUT MODE — Single source of truth for mic ownership
  // ═══════════════════════════════════════════════════════════════
  const { mode: inputMode, modeRef: inputModeRef, setMode: setInputMode } = useInputMode('idle');

  const speechStartTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const turnStartTimeRef = useRef<number | null>(null);
  const lastAudioBlobRef = useRef<Blob | null>(null);
  const lastSilenceCueLevelRef = useRef<number>(-1);
  
  // Assistive panel state
  const [showAssistivePanel, setShowAssistivePanel] = useState(true);
  const [inputBuffer, setInputBuffer] = useState('');

  // Unified Maya intelligence
  const { state: mayaState } = useMayaState({ userId, profileId });

  // Fetch user speech profile for personalization
  const { profile: speechProfile } = useUserSpeechProfile(userId, { profileId });
  
  // Audio recorder for capturing audio blobs
  const { 
    isRecording, 
    startRecording, 
    stopRecording: stopAudioRecording,
    uploadRecording,
  } = useAudioRecorder();
  
  // Utterance logger for persisted clinical data
  const {
    startAttempt,
    logFinalAnalysis,
    resetAttempt,
    currentAttemptId,
  } = useUtteranceLogger();
  
  const turnCountRef = useRef(0);
  
  // Map speech profile to session props
  const userSpeechProfileForSession = speechProfile ? {
    primaryChallenge: speechProfile.most_challenging_categories?.[0]?.category,
    bestCueType: speechProfile.cue_efficacy_by_type 
      ? Object.entries(speechProfile.cue_efficacy_by_type as Record<string, { successRate?: number }>)
          .sort(([,a], [,b]) => (b?.successRate ?? 0) - (a?.successRate ?? 0))[0]?.[0]
      : undefined,
    typicalPace: speechProfile.baseline_wpm 
      ? (speechProfile.baseline_wpm < 60 ? 'slow' : speechProfile.baseline_wpm < 100 ? 'moderate' : 'normal')
      : undefined,
    errorTypeDistribution: speechProfile.error_type_distribution,
    phonemeDifficultyMap: speechProfile.phoneme_difficulty_map,
    avgStallDurationMs: speechProfile.avg_stall_duration_ms,
    effortfulSpeechRate: speechProfile.effortful_speech_rate,
    commonSubstitutions: speechProfile.common_substitutions,
  } : null;

  const { speak, speakStream, isLoading: ttsLoading, isSpeaking } = useTextToSpeech();
  
  const {
    messages,
    isComplete,
    isProcessing,
    metrics,
    currentPhase,
    hasPendingCard,
    engagementState,
    currentTopic,
    sessionPhase,
    assistivePanelState,
    lastAction,
    startSession,
    processUserTurn,
    insertPendingCard,
    handleCardComplete,
    clearPendingAI,
    reset,
    requestCard,
    endSession,
    handleWordTileTap,
    handleFrameTap,
    requestCue,
    currentSupportLevel,
    pendingPopupExercise,
    ingestExerciseResult,
    activeInlinePhoto,
    activeInlineMinimalPair,
    handleMinimalPairSelect,
    addMessage,
  } = useCoachSession({
    userId,
    profileId,
    sessionId,
    mayaState,
    userSpeechProfile: userSpeechProfileForSession,
  });

  // Keep activeInlinePhoto accessible in setInterval closures
  const activeInlinePhotoLocalRef = useRef(activeInlinePhoto);
  useEffect(() => {
    activeInlinePhotoLocalRef.current = activeInlinePhoto;
  }, [activeInlinePhoto]);

  // Exercise modal controller
  const exerciseModal = useExerciseModal();
  const popupLaunchedSlugRef = useRef<string | null>(null);

  // Launch popup when coach session requests one
  useEffect(() => {
    if (
      pendingPopupExercise &&
      !exerciseModal.isOpen &&
      popupLaunchedSlugRef.current !== pendingPopupExercise.slug
    ) {
      popupLaunchedSlugRef.current = pendingPopupExercise.slug;
      exerciseModal.launchExerciseModal(pendingPopupExercise.slug, {
        targetDomain: pendingPopupExercise.targetDomain,
        targetPhonemes: pendingPopupExercise.targetPhonemes,
        difficultyTier: pendingPopupExercise.difficultyHint === 'easier' ? 1 : 2,
        sessionId: sessionId ?? undefined,
        totalTrials: 5,
      });
    }
    if (!pendingPopupExercise) {
      popupLaunchedSlugRef.current = null;
    }
  }, [pendingPopupExercise, exerciseModal.isOpen]);

  // Break prompts from engagement state
  useEffect(() => {
    if (engagementState?.recommendedAction === 'break_prompt' && !showBreakPrompt) {
      setShowBreakPrompt(true);
    }
  }, [engagementState?.recommendedAction, showBreakPrompt]);

  // Request microphone permission
  const requestMicPermission = useCallback(async () => {
    setMicPermission('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicPermission('granted');
      return true;
    } catch (err) {
      console.error('Mic permission denied:', err);
      setMicPermission('denied');
      return false;
    }
  }, []);

  // Check mic permission on mount
  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;
    const handlePermissionChange = () => {
      if (permissionStatus) {
        if (permissionStatus.state === 'granted') setMicPermission('granted');
        else if (permissionStatus.state === 'denied') setMicPermission('denied');
        else setMicPermission('pending');
      }
    };
    const checkPermission = async () => {
      try {
        if (navigator.permissions) {
          permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (permissionStatus.state === 'granted') setMicPermission('granted');
          else if (permissionStatus.state === 'denied') setMicPermission('denied');
          permissionStatus.addEventListener('change', handlePermissionChange);
        }
      } catch { /* Permissions API not supported */ }
    };
    checkPermission();
    return () => {
      if (permissionStatus) permissionStatus.removeEventListener('change', handlePermissionChange);
    };
  }, []);

  const processTurnAndRespondRef = useRef<(transcript: string) => Promise<void>>();
  const startConversationTurnRef = useRef<() => void>();
  
  // ═══════════════════════════════════════════════════════════════
  // SPEECH END DETECTION — Only fires when inputMode === chat_listening
  // Uses ref-based enabled check — no stale closure risk
  // ═══════════════════════════════════════════════════════════════
  const speechEndDetection = useSpeechEndDetection({
    onSpeechEnd: (transcript) => {
      // Double-check: only process for chat mode
      if (inputModeRef.current !== 'chat_listening') {
        console.log('[SpeechEnd] Blocked — not in chat_listening mode:', inputModeRef.current);
        return;
      }
      console.log('🎯 Speech end detected:', transcript.slice(0, 50));
      processTurnAndRespondRef.current?.(transcript);
    },
    incompletesilenceMs: 1000,
    completesilenceMs: 400,
    enabled: inputMode === 'chat_listening',
  });

  // ═══════════════════════════════════════════════════════════════
  // UNIFIED SPEECH ROUTER — One place where transcript destination is decided
  // ═══════════════════════════════════════════════════════════════
  const speechRouter = useSpeechRouter({
    modeRef: inputModeRef,
    onChatTranscript: useCallback((transcript: string, isFinal: boolean) => {
      if (!firstWordTimeRef.current && transcript.trim().length > 0) {
        firstWordTimeRef.current = Date.now();
      }
      setUserTranscript(transcript);
      speechEndDetection.onTranscriptUpdate(transcript, isFinal);
    }, [speechEndDetection]),
    onCardTranscript: useCallback((transcript: string, _isFinal: boolean) => {
      setCardTranscript(transcript);
    }, []),
    onPopupTranscript: useCallback((_transcript: string, _isFinal: boolean) => {
      // Popup exercises handle their own speech — this is a safety catch
      console.log('[SpeechRouter] Popup transcript received — popup handles its own mic');
    }, []),
  });

  // ═══════════════════════════════════════════════════════════════
  // SPEECH RECOGNITION — One mic, routed through the unified router
  // ═══════════════════════════════════════════════════════════════
  const { isListening, transcript: liveTranscript, startListening, stopListening, isSupported, error: speechError } = useSpeechRecognition({
    onResult: (transcript) => {
      console.log('🎤 Received final transcript:', transcript);
      // Route through unified router — it reads inputModeRef to decide destination
      speechRouter.routeFinal(transcript);
    },
    patientMode: true,
    continuousListening: false,
    enabled: micPermission === 'granted',
  });
  
  // Track live (interim) transcript — route through unified router
  useEffect(() => {
    if (liveTranscript) {
      speechRouter.route(liveTranscript, false);
    }
  }, [liveTranscript, speechRouter]);

  // ═══════════════════════════════════════════════════════════════
  // PROCESS TURN AND RESPOND — Chat pipeline (only when mode = chat_listening)
  // ═══════════════════════════════════════════════════════════════
  const processTurnAndRespond = useCallback(async (transcript: string) => {
    if (isProcessingRef.current) return;
    
    // Guard: only process in chat mode
    if (inputModeRef.current !== 'chat_listening' && inputModeRef.current !== 'idle') {
      console.log('[processTurnAndRespond] Blocked — mode is:', inputModeRef.current);
      return;
    }
    
    isProcessingRef.current = true;
    setInputMode('processing');
    stopListening();
    
    const recordingResult = await stopAudioRecording();
    const audioBlob = recordingResult?.audioBlob || lastAudioBlobRef.current;
    lastAudioBlobRef.current = null;

    const latencyMs = firstWordTimeRef.current && speechStartTimeRef.current
      ? firstWordTimeRef.current - speechStartTimeRef.current
      : null;
    const totalDurationMs = turnStartTimeRef.current 
      ? Date.now() - turnStartTimeRef.current 
      : null;

    let audioStoragePath: string | null = null;
    if (audioBlob && sessionId && userId) {
      audioStoragePath = await uploadRecording(
        audioBlob, userId, sessionId, turnCountRef.current,
        recordingResult?.mimeType || audioBlob.type
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
        latencyToFirstWordMs: latencyMs || undefined,
        recordingDurationMs: totalDurationMs || undefined,
        audioStoragePath: audioStoragePath || undefined,
        fluencyAvailable: false,
        fluencyUnavailableReason: 'discourse_task',
      });
      resetAttempt();
    }

    const aiResponse = await processUserTurn(transcript, latencyMs, totalDurationMs, audioBlob || undefined);
    
    if (aiResponse) {
      setInputMode('tts_playing');
      
      try {
        await speakStream(aiResponse);
      } catch (err) {
        console.warn('TTS failed, continuing:', err);
      }
      
      clearPendingAI();
      
      if (hasPendingCard) {
        await new Promise(resolve => setTimeout(resolve, 600));
        // ATOMIC: Set mode to card_listening BEFORE inserting card and starting mic
        setInputMode('card_listening');
        insertPendingCard();
        setCardTranscript('');
        startListening();
      } else if (!isComplete) {
        if (autoListenEnabled) {
          // Will be set to chat_listening by startConversationTurn
          startConversationTurnRef.current?.();
        } else {
          setInputMode('idle');
        }
      } else {
        setInputMode('idle');
      }
    } else {
      setInputMode('idle');
    }

    setUserTranscript('');
    setShowHelpers(false);
    isProcessingRef.current = false;
  }, [processUserTurn, clearPendingAI, hasPendingCard, insertPendingCard, isComplete, stopListening, startListening, stopAudioRecording, autoListenEnabled, currentAttemptId, logFinalAnalysis, resetAttempt, uploadRecording, userId, sessionId, setInputMode, speakStream]);

  useEffect(() => {
    processTurnAndRespondRef.current = processTurnAndRespond;
  }, [processTurnAndRespond]);

  // ═══════════════════════════════════════════════════════════════
  // START CONVERSATION TURN — Transitions to chat_listening mode
  // ═══════════════════════════════════════════════════════════════
  const startConversationTurn = useCallback(async () => {
    console.log('[Coach] Starting conversation turn');
    setUserTranscript('');
    firstWordTimeRef.current = null;
    speechStartTimeRef.current = Date.now();
    turnStartTimeRef.current = Date.now();
    isProcessingRef.current = false;
    setSilenceSeconds(0);
    setShowSkipPrompt(false);
    lastAudioBlobRef.current = null;
    
    turnCountRef.current += 1;
    startAttempt({
      sessionId: sessionId || 'standalone',
      userId,
      exerciseSlug: 'conversation_coach',
      trialIndex: turnCountRef.current - 1,
      attemptNumber: 1,
      targetWord: currentTopic || 'conversation',
      category: 'conversation',
    });
    
    await startRecording();
    
    // ATOMIC: Set mode, start detection, start listening
    setInputMode('chat_listening');
    speechEndDetection.onStart();
    setShowHelpers(false);
    startListening();
    
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
    }
    lastSilenceCueLevelRef.current = -1;
    setSilenceCueText(null);
    silenceTimerRef.current = setInterval(() => {
      setSilenceSeconds(prev => {
        const newVal = prev + 1;
        if (newVal >= 6) setShowHelpers(true);
        if (newVal >= 12) setShowSkipPrompt(true);
        
        // Graduated silence response — only when user hasn't spoken
        if (!firstWordTimeRef.current) {
          // When inline photo is active, use photo-specific cues instead of generic
          const photo = activeInlinePhotoLocalRef.current;
          if (photo && newVal >= 5) {
            // Photo-specific cueing ladder (slightly slower for photo naming)
            if (newVal === 5) {
              const cueText = "Take your time...";
              setSilenceCueText(cueText);
            } else if (newVal === 8) {
              // Semantic cue about the photo
              const cueText = generateSemanticCue(photo.category, photo.target, photo.features);
              setSilenceCueText(cueText);
              speakStream(cueText).catch(() => {});
            } else if (newVal === 12) {
              // Phonemic cue
              const cueText = generatePhonologicalCue(photo.target, photo.features);
              setSilenceCueText(cueText);
              speakStream(cueText).catch(() => {});
            } else if (newVal === 17) {
              // Model the word
              const cueText = `The word is "${photo.target}."`;
              setSilenceCueText(cueText);
              speakStream(cueText).catch(() => {});
            }
          } else {
            const cue = getSilenceCue(newVal, currentTopic, lastSilenceCueLevelRef.current);
            if (cue) {
              lastSilenceCueLevelRef.current = cue.levelIndex;
              setSilenceCueText(cue.text);
              
              // Speak the cue aloud if it's a spoken level (semantic/narrowing)
              if (cue.level.spoken) {
                speakStream(cue.text).catch(() => {});
              }
            }
          }
        }
        
        return newVal;
      });
    }, 1000);
  }, [speechEndDetection, startListening, startRecording, startAttempt, sessionId, userId, currentTopic, setInputMode]);
  
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    };
  }, []);
  
  // Clear silence timer when not listening
  useEffect(() => {
    if (inputMode !== 'chat_listening' && silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
      setSilenceSeconds(0);
      setShowSkipPrompt(false);
      setShowHelpers(false);
    }
  }, [inputMode]);
  
  useEffect(() => {
    startConversationTurnRef.current = startConversationTurn;
  }, [startConversationTurn]);

  // Start conversation
  const handleStart = async () => {
    resetSilenceCueTracking();
    lastSilenceCueLevelRef.current = -1;
    setSilenceCueText(null);
    const hasPermission = micPermission === 'granted' || await requestMicPermission();
    if (!hasPermission) return;
    
    const opener = startSession();
    setInputMode('tts_playing');
    
    try {
      await speakStream(opener);
    } catch (err) {
      console.warn('TTS failed:', err);
    }
    
    clearPendingAI();
    startConversationTurn();
  };

  // Sync speech-end detection with listening state during chat mode
  // CRITICAL: When browser speech recognition briefly stops and auto-restarts (patient mode),
  // we must restart speech-end detection too, otherwise the conversation flow dies
  useEffect(() => {
    if (inputMode === 'chat_listening') {
      if (isListening) {
        // Mic is active — ensure speech-end detection is running
        speechEndDetection.onStart();
      } else {
        // Mic briefly stopped — pause detection (will restart when mic comes back)
        speechEndDetection.onStop();
      }
    }
  }, [isListening, inputMode, speechEndDetection]);

  // ═══════════════════════════════════════════════════════════════
  // CARD COMPLETION — Transitions back from card_listening
  // ═══════════════════════════════════════════════════════════════
  const handleCardDone = async (messageId: string, result: unknown) => {
    // ATOMIC: Exit card mode immediately
    setInputMode('idle');
    stopListening();
    setCardTranscript('');
    
    const outroText = handleCardComplete(messageId, result);
    
    if (outroText) {
      setInputMode('tts_playing');
      
      try {
        await speakStream(outroText);
      } catch (err) {
        console.warn('TTS failed:', err);
      }
      
      clearPendingAI();
    } else {
      console.warn('[handleCardDone] No outro text returned — continuing anyway');
    }
    
    // Always continue the conversation after card completion
    if (!isComplete) {
      startConversationTurn();
    } else {
      setInputMode('idle');
    }
  };

  // Card fallback: force-submit if user is stuck (called from UI button or timeout)
  const handleCardForceSubmit = useCallback(() => {
    const activeCard = messages.find(m => m.type === 'card' && !m.completed);
    if (activeCard) {
      console.log('[CardTimeout] Force-submitting card:', activeCard.id, 'transcript:', cardTranscript?.slice(0, 30));
      handleCardDone(activeCard.id, {
        success: false,
        spokenWord: cardTranscript || '(no answer)',
        targetWord: 'unknown',
        usedFallback: true,
      });
    }
  }, [messages, cardTranscript, handleCardDone]);

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL CARD TIMEOUT — Auto-submit after 25s to prevent stuck state
  // ═══════════════════════════════════════════════════════════════
  const cardTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [cardCountdown, setCardCountdown] = useState<number | null>(null);
  const cardCountdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (inputMode === 'card_listening') {
      // Start countdown display at 20s, auto-submit at 25s
      cardCountdownRef.current = setTimeout(() => {
        setCardCountdown(5);
        const tick = setInterval(() => {
          setCardCountdown(prev => {
            if (prev !== null && prev <= 1) {
              clearInterval(tick);
              return null;
            }
            return prev !== null ? prev - 1 : null;
          });
        }, 1000);
        cardTimeoutRef.current = setTimeout(() => {
          clearInterval(tick);
          setCardCountdown(null);
          if (inputModeRef.current === 'card_listening') {
            console.log('[CardTimeout] 25s elapsed — auto-submitting');
            handleCardForceSubmit();
          }
        }, 5000);
      }, 20000);

      return () => {
        if (cardCountdownRef.current) clearTimeout(cardCountdownRef.current);
        if (cardTimeoutRef.current) clearTimeout(cardTimeoutRef.current);
        setCardCountdown(null);
      };
    }
  }, [inputMode, handleCardForceSubmit]);

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

  const handleManualDone = useCallback(() => {
    if (userTranscript.trim()) {
      processTurnAndRespond(userTranscript);
    }
  }, [userTranscript, processTurnAndRespond]);

  const handleSkipTurn = useCallback(() => {
    processTurnAndRespond('');
  }, [processTurnAndRespond]);

  const handleRetryPermission = async () => {
    setMicPermission('pending');
    await requestMicPermission();
  };

  const handleDismissBreak = () => setShowBreakPrompt(false);

  const handleTopicSelect = useCallback(async (prompt: string) => {
    setShowHelpers(false);
    await processTurnAndRespond(`(Topic request: ${prompt})`);
  }, [processTurnAndRespond]);

  const handleGiveIdea = useCallback(async () => {
    const idea = getRandomIdea();
    setShowHelpers(false);
    setInputMode('tts_playing');
    try {
      await speakStream(idea);
    } catch (err) {
      console.warn('TTS failed:', err);
    }
    startConversationTurn();
  }, [speakStream, startConversationTurn, setInputMode]);

  const handlePlayGame = useCallback(() => {
    setShowGamePicker(true);
  }, []);

  const handleGameSelect = useCallback(async (cardType: CardType) => {
    setShowHelpers(false);
    stopListening();
    await stopAudioRecording();
    
    const intro = requestCard(cardType);
    
    setInputMode('tts_playing');
    try {
      await speakStream(intro);
    } catch (err) {
      console.warn('TTS failed:', err);
    }
    
    // ATOMIC: Mode → card_listening, then insert and start mic
    setInputMode('card_listening');
    insertPendingCard();
    setCardTranscript('');
    startListening();
  }, [stopListening, stopAudioRecording, requestCard, speakStream, insertPendingCard, startListening, setInputMode]);

  // ═══════════════════════════════════════════════════════════════
  // DERIVED UI STATES — For rendering, derived from inputMode + currentPhase
  // These are NOT used for routing decisions
  // ═══════════════════════════════════════════════════════════════
  const isAISpeaking = inputMode === 'tts_playing';
  const isChatListening = inputMode === 'chat_listening';
  const isCardActive = inputMode === 'card_listening';
  const isIdle = inputMode === 'idle';

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
            <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </Button>
            <Button onClick={handleRetryPermission} className="gap-2">
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
      {/* Game picker dialog */}
      <GamePickerDialog
        open={showGamePicker}
        onOpenChange={setShowGamePicker}
        onSelectGame={handleGameSelect}
      />
      {/* Break prompt overlay */}
      {showBreakPrompt && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-card rounded-3xl shadow-2xl p-8 max-w-sm text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
              <Coffee className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Take a breather?</h3>
            <p className="text-muted-foreground mb-6">
              You're doing great. A short break can help.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleDismissBreak}>
                Keep Going
              </Button>
              <Button onClick={() => { handleDismissBreak(); onExit?.(); }}>
                Take Break
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-card/80 backdrop-blur-md border-b shadow-soft sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            {isAISpeaking && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-card animate-pulse" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-lg">Conversation Coach</h2>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Turn {metrics.turnsCompleted + 1}
              </p>
              {metrics.turnsCompleted === 5 && (metrics.avgFluency ?? 0) >= 60 && (
                <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">
                  Great flow
                </span>
              )}
              {metrics.turnsCompleted === 10 && (metrics.avgFluency ?? 0) >= 50 && (
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                  Nice session
                </span>
              )}
              {metrics.avgFluency !== undefined && metrics.turnsCompleted >= 2 && (
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  metrics.avgFluency >= 70 ? "bg-success/20 text-success" :
                  metrics.avgFluency >= 50 ? "bg-warning/20 text-warning" :
                  "bg-muted text-muted-foreground"
                )}>
                  {metrics.fluencyTrend === 'improving' ? '↑' : 
                   metrics.fluencyTrend === 'declining' ? '↓' : ''} 
                  {metrics.avgFluency}%
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {currentPhase !== 'ready' && currentPhase !== 'complete' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { endSession(); setInputMode('idle'); }}
              className="h-9 px-4 rounded-xl"
            >
              End Chat
            </Button>
          )}
          {isChatListening && (
            <Button 
              variant="ghost" 
              size="icon" 
              aria-label="Toggle helpers"
              onClick={() => setShowHelpers(!showHelpers)} 
              className="h-10 w-10 rounded-xl"
            >
              <HelpCircle className={cn("w-5 h-5", showHelpers && "text-primary")} />
            </Button>
          )}
          {onExit && currentPhase !== 'complete' && (
            <Button variant="ghost" size="icon" aria-label="Exit session" onClick={onExit} className="h-10 w-10 rounded-xl">
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
          onMinimalPairSelect={handleMinimalPairSelect}
          onScenarioStart={(scenarioId) => setActiveScenarioId(scenarioId)}
          isProcessing={isProcessing}
          cardTranscript={cardTranscript}
          isCardListening={isCardActive && isListening}
          isAISpeaking={isAISpeaking}
          liveTranscript={userTranscript}
          isListening={isChatListening || isListening}
        />
      </div>

      {/* Assistive Panel */}
      {(isChatListening || currentPhase === 'user_turn') && 
       (assistivePanelState.showTiles || assistivePanelState.showFrames || assistivePanelState.cueText) && (
        <AssistivePanel
          wordTiles={assistivePanelState.wordTiles}
          primedVocabulary={assistivePanelState.primedVocabulary}
          usedWords={[]}
          onWordSelect={(word) => {
            const selectedWord = handleWordTileTap(word);
            processTurnAndRespond(selectedWord);
          }}
          sentenceFrames={assistivePanelState.sentenceFrames}
          onFrameSelect={(frame) => {
            const template = handleFrameTap(frame);
            setInputBuffer(template);
          }}
          cueLevel={assistivePanelState.cueLevel}
          cueText={assistivePanelState.cueText || undefined}
          onRequestCue={(level) => requestCue(level)}
          supportLevel={currentSupportLevel}
          isExpanded={showAssistivePanel}
          onToggleExpand={() => setShowAssistivePanel(!showAssistivePanel)}
          isVisible={true}
          showTilesOverride={assistivePanelState.showTiles}
          showFramesOverride={assistivePanelState.showFrames}
          currentTopic={assistivePanelState.currentTopic}
        />
      )}

      {/* Control panel */}
      <div className="border-t bg-card/95 backdrop-blur-md p-6 pb-8 shadow-soft">
        {/* Ready state */}
        {currentPhase === 'ready' && (
          <div className="text-center space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span className="px-3 py-1 bg-muted rounded-full">Chat as long as you like</span>
              </div>
            </div>
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
              I'll ask questions and you respond. End when you're ready!
            </p>
          </div>
        )}

        {/* AI Speaking */}
        {isAISpeaking && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
                <Volume2 className="w-12 h-12 text-primary-foreground" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-primary/40 animate-ping" />
              <div className="absolute inset-[-4px] rounded-full border-4 border-primary/20 animate-ping" style={{ animationDelay: '0.3s' }} />
              <div className="absolute inset-[-8px] rounded-full border-4 border-primary/10 animate-ping" style={{ animationDelay: '0.6s' }} />
            </div>
            <span className="text-lg font-medium text-primary">Speaking...</span>
            <p className="text-sm text-muted-foreground">Your turn next</p>
          </div>
        )}

        {/* User turn idle */}
        {currentPhase === 'user_turn' && isIdle && !isProcessing && (
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

        {/* Chat Listening */}
        {(isChatListening || (isListening && !isCardActive)) && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-destructive/15 flex items-center justify-center border-4 border-destructive/60 shadow-lg">
                <div className="w-5 h-5 rounded-full bg-destructive animate-pulse" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-end gap-1 h-14">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-destructive/70 rounded-full animate-pulse"
                      style={{
                        height: `${14 + Math.sin(i * 0.8) * 16 + 8}px`,
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
                "text-lg min-h-[28px] transition-all",
                userTranscript ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {userTranscript || (
                  silenceCueText 
                    ? silenceCueText 
                    : silenceSeconds < 3 
                      ? "Your turn to speak..." 
                      : "Take your time..."
                )}
              </p>
            </div>

            {showHelpers && !userTranscript.trim() && (
              <ConversationHelpers
                silenceSeconds={silenceSeconds}
                onTopicSelect={handleTopicSelect}
                onGiveIdea={handleGiveIdea}
                onSkip={handleSkipTurn}
                onPlayGame={handlePlayGame}
                className="mt-2"
              />
            )}

            <div className="flex flex-col items-center gap-3 mt-2">
              {userTranscript.trim() && (
                <Button
                  size="lg"
                  onClick={handleManualDone}
                  className="px-8 py-3 rounded-xl bg-success hover:bg-success/90 text-success-foreground gap-2 min-h-[48px]"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Done Speaking
                </Button>
              )}
              
              {showSkipPrompt && !userTranscript.trim() && !showHelpers && (
                <div className="animate-fade-in text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Need more time?</p>
                  <Button variant="outline" size="sm" onClick={handleSkipTurn} className="gap-2 min-h-[44px]">
                    Skip this turn
                  </Button>
                </div>
              )}
              
              {!showSkipPrompt && !userTranscript.trim() && !showHelpers && (
                <p className="text-sm text-muted-foreground">
                  Pause when done — I'll respond
                </p>
              )}
            </div>
          </div>
        )}

        {/* Card active — with FALLBACK SUBMIT BUTTON + TIMEOUT */}
        {isCardActive && (
          <div className="text-center space-y-3">
            <p className="text-base text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Complete the activity above
            </p>
            {cardCountdown !== null && (
              <p className="text-sm text-warning animate-pulse">
                Auto-skipping in {cardCountdown}s...
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCardForceSubmit}
              className="gap-2 min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              {cardTranscript.trim() ? "Submit Answer" : "Skip Activity"}
            </Button>
          </div>
        )}

        {/* Processing */}
        {inputMode === 'processing' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
            <span className="text-base text-muted-foreground">Thinking...</span>
          </div>
        )}

        {/* Completion */}
        {currentPhase === 'complete' && (
          <CoachSessionSummary
            metrics={metrics}
            onPlayAgain={() => { reset(); setInputMode('idle'); }}
            onFinish={() => { handleFinish(); onExit?.(); }}
          />
        )}
      </div>

      {/* Exercise popup modal */}
      <ExerciseModalHost
        activeExercise={exerciseModal.activeExercise}
        isOpen={exerciseModal.isOpen}
        onClose={exerciseModal.closeExerciseModal}
        onComplete={async (result) => {
          setInputMode('processing');
          const followup = await ingestExerciseResult(result);
          if (followup) {
            setInputMode('tts_playing');
            try {
              await speakStream(followup);
            } catch (err) {
              console.warn('TTS failed after popup:', err);
            }
            clearPendingAI();
            if (!isComplete) {
              startConversationTurn();
            } else {
              setInputMode('idle');
            }
          } else {
            setInputMode('idle');
          }
        }}
        userId={userId}
        sessionId={sessionId}
      />

      {/* Real-World Scenario Overlay */}
      {activeScenarioId && (() => {
        const scenarioDef = getScenarioById(activeScenarioId);
        if (!scenarioDef) return null;
        return (
          <ScenarioOverlay
            scenario={scenarioDef}
            onClose={() => setActiveScenarioId(null)}
            onComplete={(score) => {
              // Return-to-chat: scenario-specific warm summary
              const scenarioName = scenarioDef.title.toLowerCase();
              const readinessLine = score.overall >= 70
                ? `Your real-world readiness is at ${score.overall}% — you're getting there.`
                : score.overall >= 40
                ? `Real-world readiness: ${score.overall}%. Every practice counts.`
                : `You showed up and tried — that's what matters. Readiness: ${score.overall}%.`;
              
              const mayaReturn = [
                score.emotionalFeedback,
                `You practiced ${scenarioName} — and that takes courage.`,
                readinessLine,
                '',
                `💡 ${score.nextImprovement}`,
              ].join('\n');

              addMessage({
                type: 'ai',
                text: mayaReturn,
                id: `scenario_return_${Date.now()}`,
              });
              setActiveScenarioId(null);
            }}
            isListening={isListening}
            liveTranscript={userTranscript}
            onStartListening={startListening}
            onStopListening={stopListening}
            onSpeak={async (text) => { await speakStream(text); }}
            isSpeaking={isSpeaking}
          />
        );
      })()}
    </div>
  );
}
