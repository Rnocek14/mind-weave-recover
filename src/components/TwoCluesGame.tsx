/**
 * Two Clues Word Association Game - Main Game Component
 * 
 * Shows 2-3 clue words and accepts multiple valid spoken answers
 * with tiered scoring (strong/related/creative/uncertain).
 * 
 * Key design decisions for stroke survivors:
 * - 1500ms debounce (more thinking time than Photo Naming's 750ms)
 * - Clue words filtered from transcript before scoring
 * - Continuous listening with unlimited restarts (thinking time is essential)
 * - Processing guard with 10s failsafe to prevent mic deadlock
 * - All exit paths use try/finally to guarantee processingRef reset
 * - 2s cooldown after scoring to prevent re-scoring loops
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTwoCluesGame, TwoCluesTrialResult } from '@/hooks/useTwoCluesGame';
import { getTierColor, getTierBgColor, getTierEmoji, getTierMessage, scoreAnswer } from '@/lib/twoCluesScorer';
import { extractAnswerFromTranscript, isMostlyFiller, getContentWordCount, removeClueWords } from '@/lib/speechNormalizer';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { Mic, MicOff, SkipForward, Volume2, RotateCcw, Loader2 } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────
const SCORING_DEBOUNCE_MS = 1500; // Longer than Photo Naming (750ms) - thinking game
const SCORING_COOLDOWN_MS = 2000; // Don't re-score for 2s after a score
const PROCESSING_FAILSAFE_MS = 10000; // Auto-reset processingRef after 10s
const AUTO_ADVANCE_DELAY_MS = 2000;

interface TwoCluesGameProps {
  onTrialComplete?: (result: TwoCluesTrialResult) => void;
  onGameComplete?: (results: TwoCluesTrialResult[]) => void;
  roundCount?: number;
  sessionId?: string | null;
  userId?: string;
  profileId?: string;
}

/**
 * Quick local match check - no async, instant feedback for obvious matches
 */
function quickLocalMatch(
  spoken: string,
  anchors: string[],
  cluster: string[],
  anchorAliases?: Record<string, string[]>,
  clusterAliases?: Record<string, string[]>
): { tier: 'strong' | 'related'; matchedWord: string } | null {
  const normalized = spoken.toLowerCase().trim().replace(/[^\w\s]/g, '');
  if (!normalized || normalized.length < 2) return null;

  // Check anchors (exact + plurals)
  for (const anchor of anchors) {
    const a = anchor.toLowerCase();
    if (normalized === a || normalized === a + 's' || normalized + 's' === a) {
      return { tier: 'strong', matchedWord: anchor };
    }
  }
  
  // Check anchor aliases
  if (anchorAliases) {
    for (const [canonical, aliases] of Object.entries(anchorAliases)) {
      for (const alias of aliases) {
        const al = alias.toLowerCase();
        if (normalized === al || normalized === al + 's' || normalized + 's' === al) {
          return { tier: 'strong', matchedWord: canonical };
        }
      }
    }
  }

  // Check cluster
  for (const word of cluster) {
    const w = word.toLowerCase();
    if (normalized === w || normalized === w + 's' || normalized + 's' === w) {
      return { tier: 'related', matchedWord: word };
    }
  }
  
  // Check cluster aliases
  if (clusterAliases) {
    for (const [canonical, aliases] of Object.entries(clusterAliases)) {
      for (const alias of aliases) {
        const al = alias.toLowerCase();
        if (normalized === al || normalized === al + 's' || normalized + 's' === al) {
          return { tier: 'related', matchedWord: canonical };
        }
      }
    }
  }

  return null;
}

export function TwoCluesGame({
  onTrialComplete,
  onGameComplete,
  roundCount = 10,
  sessionId,
  userId,
  profileId,
}: TwoCluesGameProps) {
  const [isListening, setIsListening] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayTranscript, setDisplayTranscript] = useState('');
  const [filteredDisplay, setFilteredDisplay] = useState(''); // Answer candidate after clue removal
  const [scoringPhase, setScoringPhase] = useState<'idle' | 'checking' | 'scoring'>('idle');
  const [showThinkingHint, setShowThinkingHint] = useState(false);
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScoredCandidateRef = useRef<string>(''); // Track what was last scored (not just last transcript)
  const rawTranscriptRef = useRef<string>('');
  const finalizingRef = useRef(false);
  const processingRef = useRef(false);
  const processingSetAtRef = useRef<number>(0); // Timestamp for failsafe
  const lastScoredAtRef = useRef<number>(0); // Cooldown timer
  const thinkingHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs for cleanup functions
  const stopListeningRef = useRef<() => void>(() => {});
  const cancelRecordingRef = useRef<() => void>(() => {});
  const finalizeAttemptRef = useRef<(errorType: 'cancelled' | 'skipped' | 'abandoned') => Promise<void>>(async () => {});
  
  const { speak } = useTextToSpeech();

  // Adaptive difficulty
  const {
    currentDifficulty,
    updateTrial,
    checkAndAdjust,
  } = useAdaptiveDifficulty({
    initialDifficulty: 1,
    bounds: { floor: 1, ceiling: 5, suggestedStart: 1 },
    windowSize: 5,
    targetSuccessRate: 0.75,
    adjustmentThreshold: 0.15,
    userId,
    profileId,
    sessionId: sessionId || undefined,
    exerciseSlug: 'two_clues',
  });

  // Utterance logging
  const {
    currentAttemptId,
    isFinalized,
    startAttempt,
    logBrowserTranscript,
    logFinalAnalysis,
    resetAttempt,
  } = useUtteranceLogger();

  // Audio recording
  const {
    isRecording,
    isSupported: isRecordingSupported,
    startRecording,
    stopRecording,
    uploadRecording,
    cancelRecording,
  } = useAudioRecorder();

  const game = useTwoCluesGame({
    roundCount,
    onTrialComplete,
    onGameComplete,
  });

  // Handle speech result
  const handleSpeechResult = useCallback((result: string) => {
    console.log('[TwoClues] Speech result:', result);
    logBrowserTranscript(result);
  }, [logBrowserTranscript]);

  const {
    transcript,
    isListening: speechIsListening,
    startListening,
    stopListening,
    isSupported,
   } = useSpeechRecognition(handleSpeechResult, false, true);

  // Keep refs updated for cleanup
  useEffect(() => { stopListeningRef.current = stopListening; }, [stopListening]);
  useEffect(() => { cancelRecordingRef.current = cancelRecording; }, [cancelRecording]);

  // Sync local isListening state with hook's state
  useEffect(() => {
    setIsListening(speechIsListening);
  }, [speechIsListening]);

  // ── Processing guard failsafe ──────────────────────────────────────
  // If processingRef has been true for > 10s, something went wrong — auto-reset
  useEffect(() => {
    const interval = setInterval(() => {
      if (processingRef.current && processingSetAtRef.current > 0) {
        const elapsed = Date.now() - processingSetAtRef.current;
        if (elapsed > PROCESSING_FAILSAFE_MS) {
          console.warn('[TwoClues] Processing guard failsafe triggered after', elapsed, 'ms');
          processingRef.current = false;
          processingSetAtRef.current = 0;
          setIsProcessing(false);
          setScoringPhase('idle');
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Thinking hint timer ──────────────────────────────────────────
  // Show gentle coaching hint after 10s of listening with no content
  useEffect(() => {
    if (thinkingHintTimeoutRef.current) clearTimeout(thinkingHintTimeoutRef.current);
    
    if (isListening && !showFeedback && !isProcessing) {
      setShowThinkingHint(false);
      thinkingHintTimeoutRef.current = setTimeout(() => {
        setShowThinkingHint(true);
      }, 10000);
    } else {
      setShowThinkingHint(false);
    }

    return () => {
      if (thinkingHintTimeoutRef.current) clearTimeout(thinkingHintTimeoutRef.current);
    };
  }, [isListening, showFeedback, isProcessing, filteredDisplay]);

  // Helper: set processing with timestamp for failsafe
  const setProcessingGuard = useCallback((value: boolean) => {
    processingRef.current = value;
    processingSetAtRef.current = value ? Date.now() : 0;
  }, []);

  // Helper: begin new attempt with audio recording
  const beginAttempt = useCallback((attemptNumber: number = 1) => {
    if (!sessionId || !userId || !game.currentPuzzle) return;
    
    // Clear pending debounce
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    lastScoredCandidateRef.current = '';
    rawTranscriptRef.current = '';
    setDisplayTranscript('');
    setFilteredDisplay('');
    setScoringPhase('idle');
    setProcessingGuard(false);
    
    // Start utterance tracking
    const targetWord = game.currentPuzzle.anchors[0] || 'unknown';
    startAttempt({
      sessionId,
      userId,
      exerciseSlug: 'two_clues',
      trialIndex: game.currentIndex,
      attemptNumber,
      targetWord,
      category: game.currentPuzzle.category,
    });
    
    // Start listening + recording
    setIsListening(true);
    startListening();
    if (isRecordingSupported) {
      startRecording();
    }
  }, [sessionId, userId, game.currentPuzzle, game.currentIndex, startAttempt, startListening, isRecordingSupported, startRecording, setProcessingGuard]);

  // Centralized terminal logging helper
  const finalizeAttempt = useCallback(async (
    errorType: 'cancelled' | 'skipped' | 'abandoned',
    extra?: Record<string, any>
  ): Promise<void> => {
    if (!currentAttemptId || isFinalized) return;
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    try {
      await logFinalAnalysis({
        transcript: rawTranscriptRef.current || undefined,
        transcriptSource: 'browser',
        isCorrect: false,
        errorType,
        cueTypeGiven: 'none',
        ...extra,
      });
    } finally {
      finalizingRef.current = false;
      resetAttempt();
    }
  }, [currentAttemptId, isFinalized, logFinalAnalysis, resetAttempt]);

  useEffect(() => { finalizeAttemptRef.current = finalizeAttempt; }, [finalizeAttempt]);

  // Helper: clear all transcript state
  const clearTranscriptState = useCallback(() => {
    setDisplayTranscript('');
    setFilteredDisplay('');
    lastScoredCandidateRef.current = '';
    rawTranscriptRef.current = '';
    setScoringPhase('idle');
  }, []);

  // Start round timer and auto-start listening when puzzle changes
  useEffect(() => {
    if (!game.currentPuzzle || game.isComplete) return;
    
    game.startRound();

    if (!showFeedback && sessionId && userId) {
      beginAttempt(1);
    }
  }, [game.currentPuzzle?.id, game.isComplete, showFeedback, sessionId, userId, beginAttempt]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      if (thinkingHintTimeoutRef.current) clearTimeout(thinkingHintTimeoutRef.current);
      cancelRecordingRef.current();
      stopListeningRef.current();
      void finalizeAttemptRef.current('abandoned');
    };
  }, []);

  // Update display transcript with clue-word filtering
  useEffect(() => {
    if (transcript && game.currentPuzzle) {
      setDisplayTranscript(transcript);
      rawTranscriptRef.current = transcript;
      
      // Show the filtered version (clue words removed)
      const withoutClues = removeClueWords(transcript, game.currentPuzzle.clues);
      const answer = extractAnswerFromTranscript(withoutClues);
      setFilteredDisplay(answer);
    }
  }, [transcript, game.currentPuzzle]);

  // ==========================================================================
  // CRITICAL: Debounced scoring with clue-word filtering + processing guard
  // ==========================================================================
  useEffect(() => {
    if (!transcript || !game.currentPuzzle) return;
    
    // Step 1: Remove clue words from transcript
    const withoutClues = removeClueWords(transcript, game.currentPuzzle.clues);
    
    // Step 2: Extract answer candidate
    const candidate = extractAnswerFromTranscript(withoutClues);
    
    // Guard: same candidate as last scored — don't re-score
    if (candidate === lastScoredCandidateRef.current && candidate.length > 0) return;
    
    // Clear existing timeout
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

    // Debounce: wait 1500ms of stable candidate before scoring
    debounceTimeoutRef.current = setTimeout(async () => {
      // GUARD 1: Already processing or showing feedback
      if (processingRef.current || showFeedback) {
        console.log('[TwoClues] Skipping score - already processing or feedback showing');
        return;
      }
      
      // GUARD 2: Filler-only or too short after clue removal
      if (isMostlyFiller(withoutClues) || candidate.length < 2) {
        console.log('[TwoClues] Skipping score - filler/clue-only or too short:', JSON.stringify(candidate));
        return;
      }
      
      // GUARD 3: Cooldown — don't re-score too soon after last score
      const timeSinceLastScore = Date.now() - lastScoredAtRef.current;
      if (timeSinceLastScore < SCORING_COOLDOWN_MS && lastScoredCandidateRef.current) {
        console.log('[TwoClues] Skipping score - in cooldown period');
        return;
      }
      
      // CRITICAL: Set processing flag BEFORE any async work
      setProcessingGuard(true);
      setIsProcessing(true);
      setScoringPhase('checking');
      
      const rawTranscript = rawTranscriptRef.current;
      const puzzle = game.currentPuzzle!;
      
      try {
        // STEP 1: Quick local match (instant, no API call)
        const quickMatch = quickLocalMatch(
          candidate,
          puzzle.anchors,
          puzzle.cluster,
          puzzle.anchorAliases,
          puzzle.clusterAliases
        );
        
        let result;
        
        if (quickMatch) {
          console.log('[TwoClues] Quick match found:', quickMatch);
          result = {
            tier: quickMatch.tier,
            score: quickMatch.tier === 'strong' ? 100 : 75,
            matchedWord: quickMatch.matchedWord,
            reachedAnchor: quickMatch.tier === 'strong',
            semanticSimilarity: quickMatch.tier === 'strong' ? 1.0 : 0.85,
            reasoning: quickMatch.tier === 'strong' ? 'Perfect match!' : 'Great related word!',
          };
        } else {
          // STEP 2: Async semantic scoring (now works — uses supabase client)
          console.log('[TwoClues] No quick match, calling semantic scorer for:', candidate);
          setScoringPhase('scoring');
          result = await scoreAnswer(candidate, puzzle);
        }
        
        // Mark what we scored and when
        lastScoredCandidateRef.current = candidate;
        lastScoredAtRef.current = Date.now();
        
        // Stop listening and recording AFTER scoring completes
        stopListening();
        setIsListening(false);
        
        // Stop recording and upload
        let recordingDurationMs: number | undefined;
        let audioStoragePath: string | undefined;
        if (isRecording) {
          const recordingResult = await stopRecording();
          if (recordingResult && sessionId && userId) {
            recordingDurationMs = recordingResult.duration;
            const uploadedPath = await uploadRecording(
              recordingResult.audioBlob,
              userId,
              sessionId,
              game.currentIndex + 1,
              recordingResult.mimeType
            );
            if (uploadedPath) {
              audioStoragePath = uploadedPath;
            }
          }
        }
        
        // Submit to game state
        await game.submitAnswer(candidate);
        
        // Update adaptive difficulty
        const isSuccess = result.tier === 'strong' || result.tier === 'related';
        updateTrial(isSuccess);
        checkAndAdjust();
        
        // Log utterance analysis
        if (sessionId && currentAttemptId) {
          const isCorrect = result.tier === 'strong' || result.tier === 'related';
          const contentWordCount = getContentWordCount(rawTranscript);
          
          await logFinalAnalysis({
            transcript: rawTranscript,
            transcriptSource: 'browser',
            isCorrect,
            errorType: result.tier === 'uncertain' ? 'no_match' : 
                       result.tier === 'creative' ? 'creative_link' : 
                       result.tier === 'related' ? 'semantic_paraphasia' : undefined,
            semanticSimilarity: result.semanticSimilarity ?? undefined,
            recordingDurationMs,
            audioStoragePath,
            reasoning: JSON.stringify({
              rawTranscript,
              cluesFiltered: game.currentPuzzle?.clues,
              afterClueRemoval: withoutClues,
              cleanedAnswer: candidate,
              matchedWord: result.matchedWord,
              tier: result.tier,
              score: result.score,
              reachedAnchor: result.reachedAnchor,
              puzzleId: puzzle.id,
              contentWordCount,
            }),
            cueTypeGiven: 'none',
            fluencyAvailable: !!audioStoragePath,
            fluencyUnavailableReason: !audioStoragePath ? 'no_recording' : undefined,
          });
        }
        
        // Show feedback
        const message = getTierMessage(result.tier, result.matchedWord);
        setFeedbackMessage(result.coachResponse || message);
        setShowFeedback(true);
        clearTranscriptState();

        // Auto-advance for strong/related matches
        if (result.tier === 'strong' || result.tier === 'related') {
          setTimeout(() => {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
            setShowFeedback(false);
            resetAttempt();
            setProcessingGuard(false);
            game.nextRound();
          }, AUTO_ADVANCE_DELAY_MS);
        }
        // Creative/uncertain: processing guard stays until user clicks Try Again/Continue
      } catch (error) {
        console.error('[TwoClues] Scoring error:', error);
      } finally {
        // Always reset UI processing state (but NOT processingRef for auto-advance path)
        setIsProcessing(false);
        setScoringPhase('idle');
        // For creative/uncertain, we need processingRef to stay true until user acts
        // For strong/related, it's reset in the setTimeout above
        // For errors, reset it now
        if (!showFeedback) {
          setProcessingGuard(false);
        }
      }
    }, SCORING_DEBOUNCE_MS);
  }, [transcript, game, stopListening, showFeedback, sessionId, userId, currentAttemptId, logFinalAnalysis, isRecording, stopRecording, uploadRecording, resetAttempt, clearTranscriptState, updateTrial, checkAndAdjust, setProcessingGuard]);

  // Toggle microphone
  const handleToggleMic = useCallback(async () => {
    if (isListening) {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      stopListening();
      setIsListening(false);
      cancelRecording();
      clearTranscriptState();
      await finalizeAttempt('cancelled');
    } else {
      beginAttempt((game.currentAttempt || 0) + 1);
    }
  }, [isListening, stopListening, cancelRecording, clearTranscriptState, finalizeAttempt, beginAttempt, game.currentAttempt]);

  // Read clues aloud
  const handleReadClues = useCallback(() => {
    if (game.currentPuzzle) {
      const clueText = game.currentPuzzle.clues.join(' and ');
      speak(clueText);
    }
  }, [game.currentPuzzle, speak]);

  // Try again after uncertain/creative
  const handleTryAgain = useCallback(() => {
    setShowFeedback(false);
    setProcessingGuard(false); // Reset processing guard
    resetAttempt();
    setTimeout(() => {
      beginAttempt((game.currentAttempt || 0) + 1);
    }, 100);
  }, [resetAttempt, beginAttempt, game.currentAttempt, setProcessingGuard]);

  // Skip to next
  const handleSkip = useCallback(async () => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    cancelRecording();
    stopListening();
    setIsListening(false);
    clearTranscriptState();
    setShowFeedback(false);
    setProcessingGuard(false);
    await finalizeAttempt('skipped');
    game.skipRound();
  }, [game, cancelRecording, stopListening, clearTranscriptState, finalizeAttempt, setProcessingGuard]);

  // Continue to next after feedback
  const handleContinue = useCallback(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    clearTranscriptState();
    setShowFeedback(false);
    setProcessingGuard(false);
    resetAttempt();
    game.nextRound();
  }, [game, resetAttempt, clearTranscriptState, setProcessingGuard]);

  // Game complete screen
  if (game.isComplete) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-center space-y-4">
          <div className="text-4xl">🎉</div>
          <h2 className="text-2xl font-bold">Great Work!</h2>
          
          <div className="space-y-2 text-sm">
            <p className="text-lg font-semibold">
              Total Score: {game.totalScore} points
            </p>
            <div className="flex justify-center gap-4">
              <Badge className="bg-primary/10 text-primary">
                ✅ Strong: {game.strongCount}
              </Badge>
              <Badge className="bg-secondary text-secondary-foreground">
                🟨 Related: {game.relatedCount}
              </Badge>
              <Badge className="bg-accent text-accent-foreground">
                🟦 Creative: {game.creativeCount}
              </Badge>
            </div>
          </div>

          <Button onClick={game.resetGame} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Play Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { currentPuzzle, currentIndex, totalRounds, lastResult, progress } = game;

  if (!currentPuzzle) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Loading puzzle...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Badge variant="outline">
            Round {currentIndex + 1} / {totalRounds}
          </Badge>
          <Badge variant="secondary">
            {game.totalScore} pts
          </Badge>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-2" />

        {/* Clue words */}
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">What word connects these clues?</p>
          
          <div className="flex justify-center gap-3 flex-wrap">
            {currentPuzzle.clues.map((clue, i) => (
              <div
                key={i}
                className="px-4 py-3 bg-primary/10 rounded-xl border-2 border-primary/20 text-lg font-medium"
              >
                {clue}
              </div>
            ))}
          </div>

          {/* Read aloud button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReadClues}
            className="gap-2 text-muted-foreground"
          >
            <Volume2 className="h-4 w-4" />
            Hear clues
          </Button>
        </div>

        {/* Transcript display - show during listening OR processing */}
        {(isListening || speechIsListening || scoringPhase !== 'idle') && (
          <div className="text-center p-4 bg-muted/50 rounded-lg min-h-[60px] flex flex-col items-center justify-center gap-2">
            {scoringPhase === 'checking' ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Checking answer...</span>
              </div>
            ) : scoringPhase === 'scoring' ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Finding connections...</span>
              </div>
            ) : (
              <>
                <p className="text-lg">
                  {displayTranscript ? (
                    <>
                      {/* Show raw transcript dimmed, answer candidate bold */}
                      <span className="text-muted-foreground text-sm">Heard: "{displayTranscript}"</span>
                      {filteredDisplay && filteredDisplay !== displayTranscript && (
                        <span className="block mt-1 font-semibold text-foreground">
                          → {filteredDisplay}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground animate-pulse">Listening...</span>
                  )}
                </p>
                {/* Thinking hint after 10s of no answer */}
                {showThinkingHint && !filteredDisplay && (
                  <p className="text-sm text-muted-foreground italic animate-in fade-in duration-500">
                    Take your time. What connects these clues?
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Feedback display */}
        {showFeedback && lastResult && (
          <div className={cn(
            "p-4 rounded-lg text-center space-y-3",
            getTierBgColor(lastResult.tier)
          )}>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">{getTierEmoji(lastResult.tier)}</span>
              <span className={cn("font-medium", getTierColor(lastResult.tier))}>
                {lastResult.tier === 'strong' ? 'Perfect!' : 
                 lastResult.tier === 'related' ? 'Great!' :
                 lastResult.tier === 'creative' ? 'Interesting!' : 'Let me help...'}
              </span>
            </div>
            
            <p className="text-sm">{feedbackMessage}</p>

            {/* Action buttons based on tier */}
            <div className="flex justify-center gap-2 pt-2">
              {(lastResult.tier === 'creative' || lastResult.tier === 'uncertain') && (
                <>
                  <Button size="sm" variant="outline" onClick={handleTryAgain}>
                    Try Again
                  </Button>
                  <Button size="sm" onClick={handleContinue}>
                    Next
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        {!showFeedback && (
          <div className="flex justify-center gap-3">
            {isSupported ? (
              <Button
                size="lg"
                onClick={handleToggleMic}
                disabled={isProcessing}
                className={cn(
                  "gap-2 min-w-[140px]",
                  isListening && "bg-destructive hover:bg-destructive/90"
                )}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-5 w-5" />
                    Stop
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    {/* Recovery: if not listening and not processing, show "Tap to speak" */}
                    Speak
                  </>
                )}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Speech recognition not supported in this browser
              </p>
            )}

            <Button
              variant="outline"
              size="lg"
              onClick={handleSkip}
              disabled={isProcessing}
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Mic recovery button - shown if not listening, not processing, not showing feedback */}
        {!isListening && !isProcessing && !showFeedback && !speechIsListening && displayTranscript === '' && isSupported && (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => beginAttempt((game.currentAttempt || 0) + 1)}
              className="text-muted-foreground gap-2"
            >
              <Mic className="h-4 w-4" />
              Tap to restart microphone
            </Button>
          </div>
        )}

        {/* Unique answers bonus indicator */}
        {game.uniqueAnswersThisRound.size >= 3 && !showFeedback && (
          <div className="text-center">
            <Badge className="bg-primary text-primary-foreground">
              🌟 Bonus: {game.uniqueAnswersThisRound.size} unique answers!
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
