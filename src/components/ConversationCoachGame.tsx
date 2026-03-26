/**
 * ConversationCoachGame - Revolutionary evidence-based conversation coach
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

type ConversationState = 'idle' | 'ai_speaking' | 'listening' | 'processing';

export function ConversationCoachGame({
  userId,
  profileId,
  sessionId,
  onComplete,
  onExit,
}: ConversationCoachGameProps) {
  const [userTranscript, setUserTranscript] = useState('');
  const [cardTranscript, setCardTranscript] = useState('');
  const [isCardListening, setIsCardListening] = useState(false);
  const [micPermission, setMicPermission] = useState<'pending' | 'checking' | 'granted' | 'denied'>('pending');
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [silenceSeconds, setSilenceSeconds] = useState(0);
  const [showSkipPrompt, setShowSkipPrompt] = useState(false);
  const [showBreakPrompt, setShowBreakPrompt] = useState(false);
  const [autoListenEnabled, setAutoListenEnabled] = useState(true); // Auto-listen after AI speaks
  const [showHelpers, setShowHelpers] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);
  
  const speechStartTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const turnStartTimeRef = useRef<number | null>(null);
  const lastAudioBlobRef = useRef<Blob | null>(null);
  
  // NEW: Assistive panel state
  const [showAssistivePanel, setShowAssistivePanel] = useState(true);
  const [inputBuffer, setInputBuffer] = useState('');

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
  
  // Map speech profile to session props - include full profile data for AI
  const userSpeechProfileForSession = speechProfile ? {
    primaryChallenge: speechProfile.most_challenging_categories?.[0]?.category,
    bestCueType: speechProfile.cue_efficacy_by_type 
      ? Object.entries(speechProfile.cue_efficacy_by_type as Record<string, { successRate?: number }>)
          .sort(([,a], [,b]) => (b?.successRate ?? 0) - (a?.successRate ?? 0))[0]?.[0]
      : undefined,
    typicalPace: speechProfile.baseline_wpm 
      ? (speechProfile.baseline_wpm < 60 ? 'slow' : speechProfile.baseline_wpm < 100 ? 'moderate' : 'normal')
      : undefined,
    // Enhanced profile data for better AI context
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
    // NEW: Session phase and assistive panel
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
  } = useCoachSession({
    userId,
    profileId,
    sessionId,
    userSpeechProfile: userSpeechProfileForSession,
  });

  // Exercise modal controller
  const exerciseModal = useExerciseModal();
  const popupLaunchedSlugRef = useRef<string | null>(null);

  // Launch popup when coach session requests one (with dedup guard)
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
    // Reset guard when popup is consumed
    if (!pendingPopupExercise) {
      popupLaunchedSlugRef.current = null;
    }
  }, [pendingPopupExercise, exerciseModal.isOpen]);

  // Check for break prompts from engagement state
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
        if (permissionStatus.state === 'granted') {
          setMicPermission('granted');
        } else if (permissionStatus.state === 'denied') {
          setMicPermission('denied');
        } else {
          setMicPermission('pending');
        }
      }
    };
    
    const checkPermission = async () => {
      try {
        if (navigator.permissions) {
          permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (permissionStatus.state === 'granted') {
            setMicPermission('granted');
          } else if (permissionStatus.state === 'denied') {
            setMicPermission('denied');
          }
          permissionStatus.addEventListener('change', handlePermissionChange);
        }
      } catch {
        // Permissions API not supported
      }
    };
    checkPermission();
    
    return () => {
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', handlePermissionChange);
      }
    };
  }, []);

  const processTurnAndRespondRef = useRef<(transcript: string) => Promise<void>>();
  const startConversationTurnRef = useRef<() => void>();
  
  // Smart speech end detection - faster thresholds for responsive feel
  const speechEndDetection = useSpeechEndDetection({
    onSpeechEnd: (transcript) => {
      console.log('🎯 Speech end detected:', transcript.slice(0, 50));
      processTurnAndRespondRef.current?.(transcript);
    },
    incompletesilenceMs: 1000, // Reduced from 1500ms
    completesilenceMs: 400,    // Reduced from 800ms
    enabled: conversationState === 'listening',
  });

  // Speech recognition
  const { isListening, transcript: liveTranscript, startListening, stopListening, isSupported, error: speechError } = useSpeechRecognition({
    onResult: (transcript) => {
      console.log('🎤 Received final transcript:', transcript);
      if (!firstWordTimeRef.current && transcript.trim().length > 0) {
        firstWordTimeRef.current = Date.now();
      }
      setUserTranscript(transcript);
      speechEndDetection.onTranscriptUpdate(transcript, true);
    },
    patientMode: true,
    continuousListening: false,
    enabled: micPermission === 'granted',
  });
  
  // Track live transcript
  // Track live transcript - route to card or conversation appropriately
  useEffect(() => {
    if (liveTranscript) {
      if (currentPhase === 'card_active' && isCardListening) {
        // Route to card's transcript - do NOT trigger conversation flow
        setCardTranscript(liveTranscript);
      } else if (conversationState === 'listening' && currentPhase !== 'card_active') {
        // Only route to conversation if we're NOT in card_active phase
        setUserTranscript(liveTranscript);
        if (!firstWordTimeRef.current && liveTranscript.trim().length > 0) {
          firstWordTimeRef.current = Date.now();
        }
        speechEndDetection.onTranscriptUpdate(liveTranscript, false);
      }
    }
  }, [liveTranscript, conversationState, currentPhase, isCardListening, speechEndDetection]);

  // Process turn and speak AI response
  const processTurnAndRespond = useCallback(async (transcript: string) => {
    if (isProcessingRef.current) return;
    
    // FIX: Don't process conversation turns while a card is active
    // Card speech should go through handleCardDone instead
    if (currentPhase === 'card_active' || hasPendingCard) {
      console.log('[processTurnAndRespond] Skipping - card active or pending:', { currentPhase, hasPendingCard });
      return;
    }
    
    isProcessingRef.current = true;
    
    stopListening();
    
    // Stop audio recording and capture the blob
    const recordingResult = await stopAudioRecording();
    const audioBlob = recordingResult?.audioBlob || lastAudioBlobRef.current;
    lastAudioBlobRef.current = null;
    
    setConversationState('processing');

    const latencyMs = firstWordTimeRef.current && speechStartTimeRef.current
      ? firstWordTimeRef.current - speechStartTimeRef.current
      : null;
    
    // Calculate total duration for speech analysis
    const totalDurationMs = turnStartTimeRef.current 
      ? Date.now() - turnStartTimeRef.current 
      : null;

    // Upload audio recording for clinical persistence
    let audioStoragePath: string | null = null;
    if (audioBlob && sessionId && userId) {
      audioStoragePath = await uploadRecording(
        audioBlob,
        userId,
        sessionId,
        turnCountRef.current,
        recordingResult?.mimeType || audioBlob.type
      );
    }

    // Log utterance to utterance_analyses for clinical data persistence
    if (currentAttemptId) {
      await logFinalAnalysis({
        transcript: transcript || undefined,
        transcriptSource: 'browser',
        evaluationModel: 'flow',
        isCorrect: null, // Conversation doesn't have correctness
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

    // Pass audio blob for pronunciation analysis
    const aiResponse = await processUserTurn(transcript, latencyMs, totalDurationMs, audioBlob || undefined);
    
    if (aiResponse) {
      setConversationState('ai_speaking');
      
      try {
        // Use streaming TTS for faster response time
        await speakStream(aiResponse);
      } catch (err) {
        console.warn('TTS failed, continuing:', err);
      }
      
      clearPendingAI();
      
      if (hasPendingCard) {
        await new Promise(resolve => setTimeout(resolve, 600));
        insertPendingCard();
        setConversationState('idle');
        setCardTranscript('');
        setIsCardListening(true);
        startListening();
      } else if (!isComplete) {
        // AUTO-LISTEN: Automatically start listening after AI finishes speaking
        if (autoListenEnabled) {
          setConversationState('listening');
          startConversationTurnRef.current?.();
        } else {
          setConversationState('idle');
        }
      } else {
        setConversationState('idle');
      }
    } else {
      setConversationState('idle');
    }

    setUserTranscript('');
    setShowHelpers(false);
    isProcessingRef.current = false;
  }, [processUserTurn, speak, clearPendingAI, hasPendingCard, insertPendingCard, isComplete, stopListening, startListening, stopAudioRecording, autoListenEnabled, currentPhase, currentAttemptId, logFinalAnalysis, resetAttempt, uploadRecording, userId, sessionId]);

  useEffect(() => {
    processTurnAndRespondRef.current = processTurnAndRespond;
  }, [processTurnAndRespond]);

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
    
    // Start a new utterance attempt for clinical logging
    turnCountRef.current += 1;
    startAttempt({
      sessionId: sessionId || 'standalone',
      userId,
      exerciseSlug: 'conversation-coach',
      trialIndex: turnCountRef.current - 1,
      attemptNumber: 1,
      targetWord: currentTopic || 'conversation',
      category: 'conversation',
    });
    
    // Start audio recording for pronunciation analysis
    await startRecording();
    
    speechEndDetection.onStart();
    setConversationState('listening');
    setShowHelpers(false);
    startListening();
    
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
    }
    silenceTimerRef.current = setInterval(() => {
      setSilenceSeconds(prev => {
        const newVal = prev + 1;
        if (newVal >= 6) {
          setShowHelpers(true);
        }
        if (newVal >= 12) {
          setShowSkipPrompt(true);
        }
        return newVal;
      });
    }, 1000);
  }, [speechEndDetection, startListening, startRecording, startAttempt, sessionId, userId, currentTopic]);
  
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearInterval(silenceTimerRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    if (conversationState !== 'listening' && silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
      setSilenceSeconds(0);
      setShowSkipPrompt(false);
      setShowHelpers(false);
    }
  }, [conversationState]);
  
  useEffect(() => {
    startConversationTurnRef.current = startConversationTurn;
  }, [startConversationTurn]);

  // Start conversation
  const handleStart = async () => {
    const hasPermission = micPermission === 'granted' || await requestMicPermission();
    if (!hasPermission) return;
    
    const opener = startSession();
    setConversationState('ai_speaking');
    
    try {
      await speakStream(opener);
    } catch (err) {
      console.warn('TTS failed:', err);
    }
    
    clearPendingAI();
    setConversationState('listening');
    startConversationTurn();
  };

  useEffect(() => {
    if (!isListening && conversationState === 'listening') {
      speechEndDetection.onStop();
    }
  }, [isListening, conversationState, speechEndDetection]);

  // Handle card completion
  const handleCardDone = async (messageId: string, result: unknown) => {
    setIsCardListening(false);
    stopListening();
    setCardTranscript('');
    
    const outroText = handleCardComplete(messageId, result);
    
    if (outroText) {
      setConversationState('ai_speaking');
      
      try {
        await speakStream(outroText);
      } catch (err) {
        console.warn('TTS failed:', err);
      }
      
      clearPendingAI();
      
      if (!isComplete) {
        setConversationState('listening');
        startConversationTurn();
      } else {
        setConversationState('idle');
      }
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

  const handleDismissBreak = () => {
    setShowBreakPrompt(false);
  };

  // Handle topic selection from helpers
  const handleTopicSelect = useCallback(async (prompt: string) => {
    setShowHelpers(false);
    // AI will use this prompt for next response
    await processTurnAndRespond(`(Topic request: ${prompt})`);
  }, [processTurnAndRespond]);

  // Handle "give me an idea" button
  const handleGiveIdea = useCallback(async () => {
    const idea = getRandomIdea();
    setShowHelpers(false);
    // Speak the idea and then listen
    setConversationState('ai_speaking');
    try {
      await speakStream(idea);
    } catch (err) {
      console.warn('TTS failed:', err);
    }
    setConversationState('listening');
    startConversationTurn();
  }, [speakStream, startConversationTurn]);

  // Handle "play a game" button - open game picker
  const handlePlayGame = useCallback(() => {
    setShowGamePicker(true);
  }, []);

  // Handle game selection from picker
  const handleGameSelect = useCallback(async (cardType: CardType) => {
    setShowHelpers(false);
    stopListening();
    
    // Stop audio recording
    await stopAudioRecording();
    
    // Insert the user-requested card
    const intro = requestCard(cardType);
    
    // Speak the intro
    setConversationState('ai_speaking');
    try {
      await speakStream(intro);
    } catch (err) {
      console.warn('TTS failed:', err);
    }
    
    // Insert the card
    insertPendingCard();
    setConversationState('idle');
    setCardTranscript('');
    setIsCardListening(true);
    startListening();
  }, [stopListening, stopAudioRecording, requestCard, speak, insertPendingCard, startListening]);

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

      {/* Header with progress and engagement indicator */}
      <div className="flex items-center justify-between px-6 py-4 bg-card/80 backdrop-blur-md border-b shadow-soft sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            {conversationState === 'ai_speaking' && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-card animate-pulse" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-lg">Conversation Coach</h2>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Turn {metrics.turnsCompleted + 1}
              </p>
              {/* Milestone encouragement */}
              {metrics.turnsCompleted === 5 && (
                <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">
                  Great flow! 🔥
                </span>
              )}
              {metrics.turnsCompleted === 10 && (
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                  Nice session! 🎉
                </span>
              )}
              {/* Fluency indicator */}
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
        
        {/* Controls - removed fixed progress bar */}
        <div className="flex items-center gap-3">
          {/* End conversation button */}
          {currentPhase !== 'ready' && currentPhase !== 'complete' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { endSession(); setConversationState('idle'); }}
              className="h-9 px-4 rounded-xl"
            >
              End Chat
            </Button>
          )}
          {/* Help toggle button */}
          {conversationState === 'listening' && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowHelpers(!showHelpers)} 
              className="h-10 w-10 rounded-xl"
            >
              <HelpCircle className={cn("w-5 h-5", showHelpers && "text-primary")} />
            </Button>
          )}
          {onExit && currentPhase !== 'complete' && (
            <Button variant="ghost" size="icon" onClick={onExit} className="h-10 w-10 rounded-xl">
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
          isProcessing={isProcessing}
          cardTranscript={cardTranscript}
          isCardListening={isCardListening && isListening}
          isAISpeaking={conversationState === 'ai_speaking'}
          liveTranscript={userTranscript}
          isListening={conversationState === 'listening' || isListening}
        />
      </div>

      {/* NEW: Assistive Panel - shows during listening/speaking phases */}
      {/* FIX #6: Gate on showTiles/showFrames/cueText, not just wordTiles.length */}
      {(conversationState === 'listening' || currentPhase === 'user_turn') && 
       (assistivePanelState.showTiles || assistivePanelState.showFrames || assistivePanelState.cueText) && (
        <AssistivePanel
          wordTiles={assistivePanelState.wordTiles}
          primedVocabulary={assistivePanelState.primedVocabulary}
          usedWords={[]}
          onWordSelect={(word) => {
            // FIX #1: Tile tap is input-only - just get the word and submit it
            // handleWordTileTap returns the word (no scoring)
            // processTurnAndRespond handles submission + scoring in one place
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
          // FIX #2: Pass overrides from assistivePanelState (cue engine/orchestrator)
          showTilesOverride={assistivePanelState.showTiles}
          showFramesOverride={assistivePanelState.showFrames}
          currentTopic={assistivePanelState.currentTopic}
        />
      )}

      {/* Control panel */}
      <div className="border-t bg-card/95 backdrop-blur-md p-6 pb-8 shadow-soft">
        {/* Ready state - Enhanced with clear expectations */}
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

        {/* AI Speaking - with enhanced animation */}
        {conversationState === 'ai_speaking' && (
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

        {/* User turn idle - simplified (shows less often with auto-listen) */}
        {currentPhase === 'user_turn' && conversationState === 'idle' && !isProcessing && (
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

        {/* Listening - with helpers integration */}
        {(conversationState === 'listening' || isListening) && (
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
            
            {/* Live transcript or listening prompt */}
            <div className="text-center max-w-sm">
              <p className={cn(
                "text-lg min-h-[28px] transition-all",
                userTranscript ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {userTranscript || (silenceSeconds < 3 ? "Your turn to speak..." : "Take your time...")}
              </p>
            </div>

            {/* Conversation helpers - shows when stuck */}
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

            {/* Action buttons */}
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
              
              {/* Simple skip for extended silence (without full helpers) */}
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

        {/* Card active */}
        {currentPhase === 'card_active' && (
          <div className="text-center">
            <p className="text-base text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Complete the activity above
            </p>
          </div>
        )}

        {/* Processing */}
        {conversationState === 'processing' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
            <span className="text-base text-muted-foreground">Thinking...</span>
          </div>
        )}

      {/* Completion - use new summary component */}
        {currentPhase === 'complete' && (
          <CoachSessionSummary
            metrics={metrics}
            onPlayAgain={() => { reset(); setConversationState('idle'); }}
            onFinish={() => { handleFinish(); onExit?.(); }}
          />
        )}
      </div>

      {/* Exercise popup modal */}
      <ExerciseModalHost
        activeExercise={exerciseModal.activeExercise}
        isOpen={exerciseModal.isOpen}
        onClose={exerciseModal.closeExerciseModal}
        onComplete={(result) => {
          ingestExerciseResult(result);
        }}
        userId={userId}
        sessionId={sessionId}
      />
    </div>
  );
}
