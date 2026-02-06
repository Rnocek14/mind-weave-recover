/**
 * Two Clues Word Association Game - Main Game Component
 * 
 * Shows 2-3 clue words and accepts multiple valid spoken answers
 * with tiered scoring (strong/related/creative/uncertain).
 * 
 * Uses the full speech analysis pipeline:
 * - Audio recording per attempt
 * - Utterance analysis logging
 * - Transcript cleanup (filler removal)
 * 
 * Speech handling matches PhotoNaming pattern:
 * - Immediate local matching for instant feedback
 * - Processing ref guard prevents duplicate scoring
 * - Visual "Processing..." state during async scoring
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTwoCluesGame, TwoCluesTrialResult } from '@/hooks/useTwoCluesGame';
import { getTierColor, getTierBgColor, getTierEmoji, getTierMessage, scoreAnswer } from '@/lib/twoCluesScorer';
import { extractAnswerFromTranscript, isMostlyFiller, getContentWordCount } from '@/lib/speechNormalizer';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { Mic, MicOff, SkipForward, Volume2, RotateCcw, Loader2 } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { cn } from '@/lib/utils';

interface TwoCluesGameProps {
  onTrialComplete?: (result: TwoCluesTrialResult) => void;
  onGameComplete?: (results: TwoCluesTrialResult[]) => void;
  roundCount?: number;
  // Session context for utterance logging
  sessionId?: string | null;
  userId?: string;
  profileId?: string;
}

/**
 * Quick local match check - no async, instant feedback for obvious matches
 * Returns tier if matched, null if needs async scoring
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

  return null; // Need async semantic scoring
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
  const [scoringPhase, setScoringPhase] = useState<'idle' | 'checking' | 'scoring'>('idle');
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptRef = useRef<string>('');
  const rawTranscriptRef = useRef<string>('');
  const finalizingRef = useRef(false);
  const processingRef = useRef(false); // CRITICAL: Prevents re-entry during async scoring
  
  // Refs for cleanup functions
  const stopListeningRef = useRef<() => void>(() => {});
  const cancelRecordingRef = useRef<() => void>(() => {});
  const finalizeAttemptRef = useRef<(errorType: 'cancelled' | 'skipped' | 'abandoned') => Promise<void>>(async () => {});
  
  const { speak } = useTextToSpeech();

  // Adaptive difficulty with logging
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

  // Helper: begin new attempt with audio recording
  const beginAttempt = useCallback((attemptNumber: number = 1) => {
    if (!sessionId || !userId || !game.currentPuzzle) return;
    
    // Clear pending debounce
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    lastTranscriptRef.current = '';
    rawTranscriptRef.current = '';
    setDisplayTranscript('');
    setScoringPhase('idle');
    processingRef.current = false;
    
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
  }, [sessionId, userId, game.currentPuzzle, game.currentIndex, startAttempt, startListening, isRecordingSupported, startRecording]);

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
    lastTranscriptRef.current = '';
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
      cancelRecordingRef.current();
      stopListeningRef.current();
      void finalizeAttemptRef.current('abandoned');
    };
  }, []);

  // Update display transcript
  useEffect(() => {
    if (transcript) {
      setDisplayTranscript(transcript);
      rawTranscriptRef.current = transcript;
    }
  }, [transcript]);

  // ==========================================================================
  // CRITICAL: Debounced scoring with processing guard (matches PhotoNaming)
  // ==========================================================================
  useEffect(() => {
    if (!transcript || !game.currentPuzzle) return;
    
    const candidate = extractAnswerFromTranscript(transcript);
    
    // Only re-score if candidate changed
    if (candidate === lastTranscriptRef.current) return;
    lastTranscriptRef.current = candidate;
    
    // Clear existing timeout
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

    // Debounce: wait 750ms of stable candidate before scoring
    debounceTimeoutRef.current = setTimeout(async () => {
      // GUARD 1: Already processing or showing feedback
      if (processingRef.current || showFeedback) {
        console.log('[TwoClues] Skipping score - already processing or feedback showing');
        return;
      }
      
      // GUARD 2: Filler-only or too short
      if (isMostlyFiller(transcript) || candidate.length < 2) {
        console.log('[TwoClues] Skipping score - filler or too short');
        return;
      }
      
      // CRITICAL: Set processing flag BEFORE any async work
      processingRef.current = true;
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
          // Instant match! No need for semantic API
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
          // STEP 2: Needs async semantic scoring
          console.log('[TwoClues] No quick match, calling semantic scorer...');
          setScoringPhase('scoring');
          result = await scoreAnswer(candidate, puzzle);
        }
        
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
        
        // Submit to game state (updates scores, etc.)
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
              cleanedAnswer: candidate,
              matchedWord: result.matchedWord,
              tier: result.tier,
              score: result.score,
              reachedAnchor: result.reachedAnchor,
              puzzleId: puzzle.id,
              clues: puzzle.clues,
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
            processingRef.current = false;
            game.nextRound();
          }, 2000);
        } else {
          // Creative/uncertain - user decides
          processingRef.current = false;
        }
      } catch (error) {
        console.error('[TwoClues] Scoring error:', error);
        processingRef.current = false;
      } finally {
        setIsProcessing(false);
        setScoringPhase('idle');
      }
    }, 750);
  }, [transcript, game, stopListening, showFeedback, sessionId, userId, currentAttemptId, logFinalAnalysis, isRecording, stopRecording, uploadRecording, resetAttempt, clearTranscriptState, updateTrial, checkAndAdjust]);

  // Toggle microphone
  const handleToggleMic = useCallback(async () => {
    if (isListening) {
      // Clear pending debounce when stopping mic
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      stopListening();
      setIsListening(false);
      cancelRecording();
      clearTranscriptState(); // Clear transcript refs on mic-off
      
      // Use centralized finalizeAttempt (handles guard + reset)
      await finalizeAttempt('cancelled');
    } else {
      // Use centralized beginAttempt for proper tracking
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
    resetAttempt();
    // Use centralized beginAttempt
    beginAttempt((game.currentAttempt || 0) + 1);
  }, [resetAttempt, beginAttempt, game.currentAttempt]);

  // Skip to next
  const handleSkip = useCallback(async () => {
    // Clear pending debounce before skip
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    cancelRecording();
    stopListening();
    setIsListening(false);
    clearTranscriptState();
    setShowFeedback(false);
    
    // Use centralized finalizeAttempt (handles guard + reset)
    await finalizeAttempt('skipped');
    game.skipRound();
  }, [game, cancelRecording, stopListening, clearTranscriptState, finalizeAttempt]);

  // Continue to next after feedback
  const handleContinue = useCallback(() => {
    // Clear pending debounce before continue
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    setDisplayTranscript('');
    lastTranscriptRef.current = '';
    rawTranscriptRef.current = '';
    setShowFeedback(false);
    resetAttempt();
    game.nextRound();
  }, [game, resetAttempt]);

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
          <div className="text-center p-4 bg-muted/50 rounded-lg min-h-[60px] flex items-center justify-center">
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
              <p className="text-lg">
                {displayTranscript ? (
                  <>Heard: "<span className="font-medium">{displayTranscript}</span>"</>
                ) : (
                  <span className="text-muted-foreground animate-pulse">Listening...</span>
                )}
              </p>
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
