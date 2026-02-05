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
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTwoCluesGame, TwoCluesTrialResult } from '@/hooks/useTwoCluesGame';
import { getTierColor, getTierBgColor, getTierEmoji, getTierMessage } from '@/lib/twoCluesScorer';
import { extractAnswerFromTranscript, isMostlyFiller, getContentWordCount } from '@/lib/speechNormalizer';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { Mic, MicOff, SkipForward, Volume2, RotateCcw } from 'lucide-react';
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
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptRef = useRef<string>('');
  const rawTranscriptRef = useRef<string>(''); // Keep raw transcript for logging
  const finalizingRef = useRef(false); // Prevent double-finalization
  
  // Refs for cleanup functions (to avoid cleanup effect firing on callback changes)
  const stopListeningRef = useRef<() => void>(() => {});
  const cancelRecordingRef = useRef<() => void>(() => {});
  const finalizeAttemptRef = useRef<(errorType: 'cancelled' | 'skipped' | 'abandoned') => Promise<void>>(async () => {});
  
  const { speak } = useTextToSpeech();

  // Utterance logging (same as PhotoNaming/PhrasePractice)
  const {
    currentAttemptId,
    isFinalized,
    startAttempt,
    logBrowserTranscript,
    logFinalAnalysis,
    resetAttempt,
  } = useUtteranceLogger();

  // Audio recording (same as PhotoNaming - includes upload)
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
    // Log browser transcript for utterance analysis
    logBrowserTranscript(result);
  }, [logBrowserTranscript]);

  const {
    transcript,
    isListening: speechIsListening,
    startListening,
    stopListening,
    isSupported,
   } = useSpeechRecognition(handleSpeechResult, false, true); // Enable continuous listening (same as PhotoNaming)

  // Keep refs updated for cleanup
  useEffect(() => { stopListeningRef.current = stopListening; }, [stopListening]);
  useEffect(() => { cancelRecordingRef.current = cancelRecording; }, [cancelRecording]);

  // Sync local isListening state with hook's state
  useEffect(() => {
    setIsListening(speechIsListening);
  }, [speechIsListening]);

  // Helper: begin new attempt with audio recording (centralized lifecycle)
  const beginAttempt = useCallback((attemptNumber: number = 1) => {
    if (!sessionId || !userId || !game.currentPuzzle) return;
    
    // Clear pending debounce
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    lastTranscriptRef.current = '';
    rawTranscriptRef.current = '';
    setDisplayTranscript('');
    
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

  // Centralized terminal logging helper (exactly-once finalization guard)
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

  // Keep finalizeAttempt ref updated
  useEffect(() => { finalizeAttemptRef.current = finalizeAttempt; }, [finalizeAttempt]);

  // Helper: clear all transcript state
  const clearTranscriptState = useCallback(() => {
    setDisplayTranscript('');
    lastTranscriptRef.current = '';
    rawTranscriptRef.current = '';
  }, []);

  // Start round timer, attempt tracking, and auto-start listening when puzzle changes
  useEffect(() => {
    if (!game.currentPuzzle || game.isComplete) return;
    
    game.startRound();

    // Auto-start attempt (match other speech games behavior)
    if (!showFeedback && sessionId && userId) {
      beginAttempt(1);
    }
  }, [game.currentPuzzle?.id, game.isComplete, showFeedback, sessionId, userId, beginAttempt]);

  // Cleanup on unmount - uses refs to avoid firing on callback changes
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      cancelRecordingRef.current();
      stopListeningRef.current();
      void finalizeAttemptRef.current('abandoned');
    };
  }, []); // Empty deps = unmount only

  // Update display transcript and store raw
  useEffect(() => {
    if (transcript) {
      setDisplayTranscript(transcript);
      rawTranscriptRef.current = transcript; // Keep raw for logging
    }
  }, [transcript]);

  // Handle transcript changes with debouncing and speech cleanup
  useEffect(() => {
    if (!transcript) return;
    
    // Extract the candidate answer (handles "I think it's a bird" → "bird")
    const candidate = extractAnswerFromTranscript(transcript);
    
    // Compare extracted candidate for stability (not raw transcript)
    // This reduces rescore spam while ASR changes "i think bird" → "i think it's bird"
    if (candidate === lastTranscriptRef.current) return;
    lastTranscriptRef.current = candidate;

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Capture current state at debounce setup time (not execution time)
    const wasListening = isListening || speechIsListening;

    // Debounce: wait for 750ms of stable extracted answer before scoring
    debounceTimeoutRef.current = setTimeout(async () => {
      // Guard: only score if was listening when debounce was set
      // (prevents scoring if user stopped mic before timeout)
      if (!wasListening) return;
      // Guard: don't score while feedback is showing (prevents scoring during auto-advance)
      if (showFeedback) return;
      // Guard: ignore filler-only transcripts ("um", "uh", "like")
      if (isMostlyFiller(transcript)) return;
      // Guard: need meaningful content
      if (candidate.length < 2) return;
      if (isProcessing) return;

      setIsProcessing(true);
      const rawTranscript = rawTranscriptRef.current;
      
      try {
        // Stop listening and recording first
        stopListening();
        setIsListening(false);
        
        // Stop recording and get audio data (same pattern as PhotoNaming)
        let recordingDurationMs: number | undefined;
        let audioStoragePath: string | undefined;
        if (isRecording) {
          const recordingResult = await stopRecording();
          if (recordingResult && sessionId && userId) {
            recordingDurationMs = recordingResult.duration;
            // Upload to storage (same as PhotoNaming)
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
        
        // Submit the cleaned candidate, not raw transcript
        const result = await game.submitAnswer(candidate);
        
        // Log utterance analysis (same full pattern as PhotoNaming)
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
            semanticSimilarity: result.semanticSimilarity,
            recordingDurationMs,
            audioStoragePath, // NOW INCLUDED - enables pronunciation/fluency analysis
            // Two Clues specific structured data
            reasoning: JSON.stringify({
              rawTranscript,
              cleanedAnswer: candidate,
              matchedWord: result.matchedWord,
              tier: result.tier,
              score: result.score,
              reachedAnchor: result.reachedAnchor,
              puzzleId: game.currentPuzzle?.id,
              clues: game.currentPuzzle?.clues,
              contentWordCount,
            }),
            cueTypeGiven: 'none', // Phase 1: no cueing
            fluencyAvailable: !!audioStoragePath,
            fluencyUnavailableReason: !audioStoragePath ? 'no_recording' : undefined,
          });
        }
        
        // Show feedback
        const message = getTierMessage(result.tier, result.matchedWord);
        setFeedbackMessage(result.coachResponse || message);
        setShowFeedback(true);
        setDisplayTranscript('');
        lastTranscriptRef.current = '';
        rawTranscriptRef.current = '';

        // Auto-advance after feedback for strong/related matches
        if (result.tier === 'strong' || result.tier === 'related') {
          setTimeout(() => {
            // Clear pending debounce before advancing
            if (debounceTimeoutRef.current) {
              clearTimeout(debounceTimeoutRef.current);
            }
            setShowFeedback(false);
            resetAttempt();
            game.nextRound();
          }, 2000);
        }
      } finally {
        setIsProcessing(false);
      }
    }, 750);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [transcript, game, stopListening, isProcessing, isListening, showFeedback, sessionId, userId, currentAttemptId, logFinalAnalysis, isRecording, stopRecording, uploadRecording, resetAttempt]);

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

        {/* Transcript display */}
        {(isListening || speechIsListening) && (
          <div className="text-center p-4 bg-muted/50 rounded-lg min-h-[60px] flex items-center justify-center">
            <p className="text-lg">
              {displayTranscript ? (
                <>Heard: "{displayTranscript}"</>
              ) : (
                <span className="text-muted-foreground animate-pulse">Listening...</span>
              )}
            </p>
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
