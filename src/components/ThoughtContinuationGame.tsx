/**
 * Thought Continuation Game
 * 
 * A "flow-shaped" game with NO wrong answers.
 * The goal is to help users finish thoughts, not test vocabulary.
 * 
 * Key principles:
 * - Never say "wrong" or "incorrect"
 * - Always provide forward motion
 * - Scaffold silently with narrowing hints
 * - Reward continuation, not precision
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Lightbulb, ArrowRight, Volume2, ChevronRight } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { deriveMicroFluency } from '@/lib/microFluencyAnalyzer';
import { calculateMomentumScore } from '@/lib/momentumScorer';
import { detectUtteranceComplete } from '@/lib/completionDetector';
import { 
  selectRandomPrompts, 
  getRandomNudge, 
  getRandomStarterNudge,
  THOUGHT_PROMPTS 
} from '@/data/thoughtPromptBank';
import { 
  ThoughtPrompt, 
  ThoughtGamePhase, 
  selectFeedback, 
  determineFeedbackTypes 
} from '@/types/thoughtContinuation';
import type { FlowMetrics, MomentumComponents } from '@/types/thoughtContinuation';

// =============================================================================
// Configuration
// =============================================================================

const PROMPTS_PER_SESSION = 8;
const SILENCE_NUDGE_DELAY_MS = 8000;   // 8 seconds before first nudge
const SILENCE_NARROW_DELAY_MS = 15000; // 15 seconds before narrowing hint
const MIN_SPEECH_FOR_COMPLETE_MS = 1500; // Minimum speech duration to count

// =============================================================================
// Props
// =============================================================================

interface ThoughtContinuationGameProps {
  userId: string;
  profileId: string;
  sessionId: string | null;
  onComplete?: (summary: {
    totalPrompts: number;
    promptsSpoken: number;
    avgMomentumScore: number;
    completedThoughts: number;
  }) => void;
  onExit?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function ThoughtContinuationGame({
  userId,
  profileId,
  sessionId,
  onComplete,
  onExit,
}: ThoughtContinuationGameProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  
  const [phase, setPhase] = useState<ThoughtGamePhase>('idle');
  const [prompts, setPrompts] = useState<ThoughtPrompt[]>([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [narrowingLevel, setNarrowingLevel] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [sessionResults, setSessionResults] = useState<{
    momentumScore: number;
    complete: boolean;
    hintUsed: boolean;
  }[]>([]);
  
  // Refs
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechStartTimeRef = useRef<number | null>(null);
  const latencyStartRef = useRef<number | null>(null);
  const latencyToFirstWordRef = useRef<number | null>(null);
  
  // Hooks
  const { speak } = useTextToSpeech();
  const { 
    startAttempt, 
    logFinalAnalysis, 
    resetAttempt,
    currentAttemptId 
  } = useUtteranceLogger();
  
  // Speech recognition with callback
  const handleSpeechResult = useCallback((text: string) => {
    setTranscript(text);
  }, []);
  
  const {
    isListening,
    transcript: liveTranscript,
    startListening,
    stopListening,
    isSupported,
  } = useSpeechRecognition(handleSpeechResult, false, true);

  // Current prompt
  const currentPrompt = prompts[promptIndex] || null;

  // ---------------------------------------------------------------------------
  // Initialize prompts
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    const selected = selectRandomPrompts(PROMPTS_PER_SESSION, {
      maxDifficulty: 2, // Start with easier prompts
    });
    setPrompts(selected);
  }, []);

  // ---------------------------------------------------------------------------
  // Track live transcript
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    if (liveTranscript && liveTranscript.trim().length > 0) {
      setTranscript(liveTranscript);
      
      // Record latency to first word
      if (latencyToFirstWordRef.current === null && latencyStartRef.current) {
        latencyToFirstWordRef.current = Date.now() - latencyStartRef.current;
      }
      
      // Record speech start time
      if (speechStartTimeRef.current === null) {
        speechStartTimeRef.current = Date.now();
      }
      
      // User is speaking - reset silence timers
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      
      // Move to listening phase if not already
      if (phase === 'idle' || phase === 'narrowing') {
        setPhase('listening');
      }
    }
  }, [liveTranscript, phase]);

  // ---------------------------------------------------------------------------
  // Silence detection for auto-nudges
  // ---------------------------------------------------------------------------
  
  const startSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    
    const delay = narrowingLevel === 0 ? SILENCE_NUDGE_DELAY_MS : SILENCE_NARROW_DELAY_MS;
    
    silenceTimerRef.current = setTimeout(() => {
      // Only trigger if still idle and no transcript
      if (phase === 'idle' && transcript.trim().length === 0) {
        if (narrowingLevel === 0) {
          // First nudge: gentle encouragement
          setFeedbackMessage(getRandomStarterNudge());
          setPhase('narrowing');
        } else if (currentPrompt && narrowingLevel <= currentPrompt.narrowingSteps.length) {
          // Progressive narrowing
          const step = currentPrompt.narrowingSteps[narrowingLevel - 1];
          if (step) {
            setFeedbackMessage(step.text);
            setNarrowingLevel(prev => prev + 1);
          }
        }
      }
    }, delay);
  }, [narrowingLevel, phase, transcript, currentPrompt]);

  // ---------------------------------------------------------------------------
  // Start listening when prompt is shown
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    if (currentPrompt && phase === 'idle') {
      // Reset state for new prompt
      setTranscript('');
      setNarrowingLevel(0);
      setFeedbackMessage(null);
      speechStartTimeRef.current = null;
      latencyToFirstWordRef.current = null;
      latencyStartRef.current = Date.now();
      
      // Start a new attempt
      startAttempt({
        sessionId: sessionId || 'standalone',
        userId,
        exerciseSlug: 'thought-continuation',
        trialIndex: promptIndex,
        attemptNumber: 1,
        targetWord: currentPrompt.promptText.slice(0, 50), // Use prompt as "target"
        category: currentPrompt.theme,
      });
      
      // Start listening
      startListening();
      
      // Start silence timer
      startSilenceTimer();
    }
  }, [currentPrompt, phase, promptIndex, sessionId, userId, startAttempt, startListening, startSilenceTimer]);

  // ---------------------------------------------------------------------------
  // Process completed speech
  // ---------------------------------------------------------------------------
  
  const processUtterance = useCallback(async () => {
    if (!currentPrompt) return;
    
    setPhase('processing');
    stopListening();
    
    // Clear timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    const speechDuration = speechStartTimeRef.current 
      ? Date.now() - speechStartTimeRef.current 
      : 0;
    
    // Calculate flow metrics
    const didSpeak = transcript.trim().length > 0 && speechDuration > MIN_SPEECH_FOR_COMPLETE_MS;
    
    // For now, use simplified momentum calculation (no Azure alignment data)
    const completionResult = detectUtteranceComplete(transcript, null);
    
    // Simple momentum score based on completion and length
    const wordCount = transcript.trim().split(/\s+/).length;
    let momentumScore = 0;
    if (didSpeak) {
      momentumScore = 0.4; // Base score for speaking
      if (completionResult.isComplete) {
        momentumScore += 0.3;
      }
      if (wordCount >= 5) {
        momentumScore += 0.15;
      }
      if (wordCount >= 10) {
        momentumScore += 0.15;
      }
    }
    
    const momentumComponents: MomentumComponents = {
      pauseRatio: 0,
      prewordPauseAvgMs: 0,
      filledPauseRate: 0,
      burstCount: 1,
      longestPauseMs: 0,
      trailingOffDetected: !completionResult.isComplete,
    };
    
    const flowMetrics: FlowMetrics = {
      didSpeak,
      utteranceComplete: completionResult.isComplete,
      momentumScore,
      momentumComponents,
      latencyToFirstWordMs: latencyToFirstWordRef.current || 0,
      narrowingLevelUsed: narrowingLevel,
      narrowingTrigger: narrowingLevel > 0 ? 'auto_silence' : undefined,
    };
    
    // Log to database
    await logFinalAnalysis({
      transcript,
      transcriptSource: 'browser',
      evaluationModel: 'flow',
      isCorrect: null, // Flow games don't have correctness
      errorType: undefined,
      didSpeak: flowMetrics.didSpeak,
      utteranceComplete: flowMetrics.utteranceComplete,
      momentumScore: flowMetrics.momentumScore,
      momentumComponents: flowMetrics.momentumComponents,
      latencyToFirstWordMs: flowMetrics.latencyToFirstWordMs,
      narrowingLevelUsed: flowMetrics.narrowingLevelUsed,
      narrowingTrigger: flowMetrics.narrowingTrigger,
      promptIntentType: currentPrompt.intentType,
      promptTheme: currentPrompt.theme,
      recordingDurationMs: speechDuration,
    });
    
    // Store result
    setSessionResults(prev => [...prev, {
      momentumScore: flowMetrics.momentumScore,
      complete: flowMetrics.utteranceComplete,
      hintUsed: narrowingLevel > 0,
    }]);
    
    // Determine and show feedback
    const feedbackTypes = determineFeedbackTypes(flowMetrics);
    const feedback = selectFeedback(feedbackTypes);
    setFeedbackMessage(feedback);
    
    // Update streak
    if (didSpeak) {
      setStreak(prev => prev + 1);
    }
    
    setPhase('celebrated');
    
    // Auto-advance after showing feedback
    setTimeout(() => {
      moveToNextPrompt();
    }, 2000);
  }, [currentPrompt, transcript, narrowingLevel, logFinalAnalysis, stopListening]);

  // ---------------------------------------------------------------------------
  // Handle speech end detection
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    // If we have some transcript and user stopped speaking, process after a delay
    if (phase === 'listening' && transcript.trim().length > 0) {
      // Set a timeout for end of speech
      const endTimer = setTimeout(() => {
        if (!isListening || liveTranscript === transcript) {
          // Speech seems to have ended
          processUtterance();
        }
      }, 2000); // 2 second pause = speech ended
      
      return () => clearTimeout(endTimer);
    }
  }, [phase, transcript, isListening, liveTranscript, processUtterance]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  
  const moveToNextPrompt = useCallback(() => {
    resetAttempt();
    
    if (promptIndex + 1 >= prompts.length) {
      // Session complete
      const avgMomentum = sessionResults.length > 0
        ? sessionResults.reduce((sum, r) => sum + r.momentumScore, 0) / sessionResults.length
        : 0;
      
      onComplete?.({
        totalPrompts: prompts.length,
        promptsSpoken: sessionResults.filter(r => r.momentumScore > 0).length,
        avgMomentumScore: avgMomentum,
        completedThoughts: sessionResults.filter(r => r.complete).length,
      });
      return;
    }
    
    setPromptIndex(prev => prev + 1);
    setPhase('idle');
    setTranscript('');
    setFeedbackMessage(null);
    setNarrowingLevel(0);
  }, [promptIndex, prompts.length, sessionResults, resetAttempt, onComplete]);

  const handleSkipPrompt = useCallback(() => {
    // Log skip (with didSpeak = false)
    logFinalAnalysis({
      transcript: '',
      transcriptSource: 'browser',
      evaluationModel: 'flow',
      isCorrect: null,
      didSpeak: false,
      utteranceComplete: false,
      momentumScore: 0,
      narrowingLevelUsed: narrowingLevel,
      promptIntentType: currentPrompt?.intentType,
      promptTheme: currentPrompt?.theme,
    });
    
    moveToNextPrompt();
  }, [narrowingLevel, currentPrompt, logFinalAnalysis, moveToNextPrompt]);

  const handleHintRequest = useCallback(() => {
    if (!currentPrompt) return;
    
    const nextLevel = narrowingLevel + 1;
    if (nextLevel <= currentPrompt.narrowingSteps.length) {
      const step = currentPrompt.narrowingSteps[nextLevel - 1];
      setFeedbackMessage(step.text);
      setNarrowingLevel(nextLevel);
      setPhase('narrowing');
    } else {
      // No more hints, just encourage
      setFeedbackMessage("Take your time. Any thought is fine.");
    }
  }, [currentPrompt, narrowingLevel]);

  const handleNudge = useCallback(() => {
    setFeedbackMessage(getRandomNudge());
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  if (prompts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading prompts...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto p-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{promptIndex + 1} of {prompts.length}</span>
        {streak > 0 && (
          <span className="text-primary font-medium">
            🔥 {streak} in a row
          </span>
        )}
      </div>

      {/* Main prompt card */}
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardContent className="p-6 space-y-6">
          {/* Prompt text */}
          <div className="text-center">
            <p className="text-xl md:text-2xl font-medium text-foreground leading-relaxed">
              {currentPrompt?.promptText}
            </p>
          </div>

          {/* Listening indicator */}
          <div className="flex justify-center">
            <div className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
              ${phase === 'listening' 
                ? 'bg-primary/20 animate-pulse' 
                : phase === 'processing'
                  ? 'bg-yellow-500/20'
                  : 'bg-muted'
              }
            `}>
              {phase === 'processing' ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              ) : isListening ? (
                <Mic className="w-10 h-10 text-primary" />
              ) : (
                <MicOff className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Live transcript display */}
          {transcript && (
            <div className="bg-muted/50 rounded-lg p-4 min-h-[60px]">
              <p className="text-sm text-muted-foreground mb-1">You said:</p>
              <p className="text-foreground">{transcript}</p>
            </div>
          )}

          {/* Feedback/hint message */}
          {feedbackMessage && (
            <div className={`
              text-center p-4 rounded-lg
              ${phase === 'celebrated' 
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
              }
            `}>
              <p className="text-lg font-medium">{feedbackMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-3 justify-center">
        <Button
          variant="outline"
          onClick={handleNudge}
          disabled={phase === 'processing' || phase === 'celebrated'}
          className="gap-2"
        >
          <ChevronRight className="w-4 h-4" />
          Go on...
        </Button>
        
        <Button
          variant="outline"
          onClick={handleHintRequest}
          disabled={phase === 'processing' || phase === 'celebrated'}
          className="gap-2"
        >
          <Lightbulb className="w-4 h-4" />
          Give me a hint
        </Button>
      </div>

      {/* Skip/done button */}
      <div className="flex justify-center">
        {phase === 'celebrated' ? (
          <Button onClick={moveToNextPrompt} className="gap-2">
            Next Thought <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button 
            variant="ghost" 
            onClick={handleSkipPrompt}
            className="text-muted-foreground"
          >
            Skip this one
          </Button>
        )}
      </div>

      {/* Exit button */}
      {onExit && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onExit}>
            End session
          </Button>
        </div>
      )}
    </div>
  );
}
