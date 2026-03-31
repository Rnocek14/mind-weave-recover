/**
 * Fix the Sentence Game Component
 * 
 * Displays a sentence with a wrong word highlighted.
 * User speaks a replacement word. Accepts multiple valid answers
 * via local match + semantic similarity fallback.
 * 
 * Self-correction bonus: if user says wrong word first, then corrects.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useFixSentenceGame, FixSentenceTrialResult } from '@/hooks/useFixSentenceGame';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { usePronunciationAnalysis } from '@/hooks/usePronunciationAnalysis';
import { getCapabilityDifficultyBounds } from '@/lib/difficultyBounds';
import { extractAnswerFromTranscript, isMostlyFiller } from '@/lib/speechNormalizer';
import { Mic, MicOff, SkipForward, Volume2, RotateCcw, Check, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const SCORING_DEBOUNCE_MS = 1000;
const AUTO_ADVANCE_DELAY_MS = 2500;

interface FixSentenceGameProps {
  onTrialComplete?: (result: FixSentenceTrialResult) => void;
  onGameComplete?: (results: FixSentenceTrialResult[]) => void;
  trialCount?: number;
  focusPhonemes?: string[];
  sessionId?: string | null;
  userId?: string;
  profileId?: string;
}

export function FixSentenceGame({
  onTrialComplete,
  onGameComplete,
  trialCount = 5,
  focusPhonemes = [],
  sessionId,
  userId,
  profileId,
}: FixSentenceGameProps) {
  const [isListening, setIsListening] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayTranscript, setDisplayTranscript] = useState('');
  const [prevWrongAttempt, setPrevWrongAttempt] = useState<string | null>(null);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScoredRef = useRef<string>('');
  const rawTranscriptRef = useRef<string>('');
  const processingRef = useRef(false);
  const stopListeningRef = useRef<() => void>(() => {});
  const cancelRecordingRef = useRef<() => void>(() => {});

  const { speak } = useTextToSpeech();
  const { analyzePronunciation } = usePronunciationAnalysis();

  const bounds = getCapabilityDifficultyBounds('fix_sentence', null);

  const {
    currentDifficulty,
    recordTrial: recordAdaptiveTrial,
  } = useInGameAdaptation({
    exerciseSlug: 'fix_sentence',
    sessionId: sessionId || null,
    initialDifficulty: bounds.suggestedStart,
    bounds,
    windowSize: 5,
    targetSuccessRate: 0.75,
    enableDifficultyAutoStepDown: true,
    enableDifficultyToasts: true,
    enableAutoHints: false,
  });

  const {
    startAttempt,
    logBrowserTranscript,
    logFinalAnalysis,
    resetAttempt,
    currentAttemptId,
    isFinalized,
  } = useUtteranceLogger();

  const {
    isRecording,
    isSupported: isRecordingSupported,
    startRecording,
    stopRecording,
    uploadRecording,
    cancelRecording,
  } = useAudioRecorder();

  const game = useFixSentenceGame({
    trialCount,
    difficulty: Math.min(3, Math.max(1, Math.ceil(currentDifficulty / 3.5))) as 1 | 2 | 3,
    focusPhonemes,
    onTrialComplete,
    onGameComplete,
  });

  const currentTrialRef = useRef(game.currentTrial);
  const currentIndexRef = useRef(game.currentIndex);
  useEffect(() => { currentTrialRef.current = game.currentTrial; }, [game.currentTrial]);
  useEffect(() => { currentIndexRef.current = game.currentIndex; }, [game.currentIndex]);

  const handleSpeechResult = useCallback((result: string) => {
    logBrowserTranscript(result);
  }, [logBrowserTranscript]);

  const {
    transcript,
    isListening: speechIsListening,
    startListening,
    stopListening,
    isSupported,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    autoStart: false,
    continuousListening: true,
    patientMode: true,
  });

  useEffect(() => { stopListeningRef.current = stopListening; }, [stopListening]);
  useEffect(() => { cancelRecordingRef.current = cancelRecording; }, [cancelRecording]);
  useEffect(() => { setIsListening(speechIsListening); }, [speechIsListening]);

  // Speak the sentence when trial changes
  useEffect(() => {
    if (game.currentTrial && !game.isComplete) {
      speak(game.currentTrial.sentence);
      game.startRound();

      // Begin attempt
      if (sessionId && userId) {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        lastScoredRef.current = '';
        rawTranscriptRef.current = '';
        setDisplayTranscript('');
        setShowFeedback(false);
        setPrevWrongAttempt(null);
        processingRef.current = false;

        startAttempt({
          sessionId,
          userId,
          exerciseSlug: 'fix_sentence',
          trialIndex: game.currentIndex,
          attemptNumber: game.currentAttempt,
          targetWord: game.currentTrial.acceptedFixes[0] || game.currentTrial.wrongWord,
          category: game.currentTrial.category,
        });

        // Start listening after brief delay for TTS
        setTimeout(() => {
          startListening();
          setIsListening(true);
          if (isRecordingSupported) startRecording();
        }, 500);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentTrial?.id, game.isComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      cancelRecordingRef.current();
      stopListeningRef.current();
    };
  }, []);

  // Update display transcript
  useEffect(() => {
    if (transcript) {
      setDisplayTranscript(transcript);
      rawTranscriptRef.current = transcript;
    }
  }, [transcript]);

  // Debounced scoring
  useEffect(() => {
    const trial = currentTrialRef.current;
    if (!transcript || !trial || processingRef.current || showFeedback) return;

    const candidate = extractAnswerFromTranscript(transcript);
    if (candidate === lastScoredRef.current && candidate.length > 0) return;
    if (isMostlyFiller(candidate) || candidate.length < 2) return;

    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

    debounceTimeoutRef.current = setTimeout(async () => {
      if (processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);
      lastScoredRef.current = candidate;

      try {
        const selfCorrected = !!prevWrongAttempt;
        const result = await game.scoreAnswer(candidate, selfCorrected);
        
        if (!result) {
          processingRef.current = false;
          setIsProcessing(false);
          return;
        }

        // Stop mic + recording
        stopListening();
        setIsListening(false);

        let audioStoragePath: string | undefined;
        let recordingDurationMs: number | undefined;
        let pronunciationData: any = null;

        if (isRecording) {
          const recResult = await stopRecording();
          if (recResult && sessionId && userId) {
            recordingDurationMs = recResult.duration;
            const [uploaded, pronResult] = await Promise.all([
              uploadRecording(recResult.audioBlob, userId, sessionId, currentIndexRef.current + 1, recResult.mimeType),
              analyzePronunciation(recResult.audioBlob, result.matchedFix || candidate).catch(() => null),
            ]);
            if (uploaded) audioStoragePath = uploaded;
            if (pronResult?.ok) pronunciationData = pronResult.data;
          }
        }

        // Log to utterance_analyses
        await logFinalAnalysis({
          transcript: rawTranscriptRef.current,
          transcriptSource: 'browser',
          isCorrect: result.isCorrect,
          errorType: result.isCorrect ? 'correct' : (result.isPartialCredit ? 'partial_credit' : 'incorrect_fix'),
          semanticSimilarity: result.semanticSimilarity,
          audioStoragePath,
          recordingDurationMs,
          ...(pronunciationData ? {
            pronunciationScore: pronunciationData.pronunciationScore,
            accuracyScore: pronunciationData.accuracyScore,
            fluencyScore: pronunciationData.fluencyScore,
            completenessScore: pronunciationData.completenessScore,
            prosodyScore: pronunciationData.prosodyScore,
            gopData: pronunciationData,
          } : {}),
        });

        // Record for adaptive difficulty
        recordAdaptiveTrial({ correct: result.isCorrect, reactionTimeMs: result.reactionTimeMs });

        // Submit to game state
        game.submitResult(result);

        // Show feedback
        setShowFeedback(true);

        if (!result.isCorrect && !result.isPartialCredit) {
          setPrevWrongAttempt(candidate);
        }

        // Auto-advance on correct/partial
        if (result.isCorrect || result.isPartialCredit) {
          setTimeout(() => {
            resetAttempt();
            game.nextTrial();
            setShowFeedback(false);
          }, AUTO_ADVANCE_DELAY_MS);
        }
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    }, SCORING_DEBOUNCE_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, showFeedback]);

  // Render sentence with highlighted wrong word
  const renderSentence = () => {
    if (!game.currentTrial) return null;
    const words = game.currentTrial.sentence.split(' ');
    return (
      <p className="text-2xl md:text-3xl font-medium leading-relaxed text-center">
        {words.map((word, i) => {
          const cleanWord = word.replace(/[.,!?]/g, '');
          const isWrong = cleanWord.toLowerCase() === game.currentTrial!.wrongWord.toLowerCase();
          const punctuation = word.match(/[.,!?]/)?.[0] || '';
          return (
            <span key={i}>
              {i > 0 && ' '}
              <span className={cn(
                isWrong && 'bg-destructive/20 text-destructive font-bold px-1 py-0.5 rounded underline decoration-wavy decoration-destructive'
              )}>
                {cleanWord}
              </span>
              {punctuation}
            </span>
          );
        })}
      </p>
    );
  };

  const handleSkip = useCallback(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    stopListening();
    setIsListening(false);
    if (isRecording) stopRecording();
    resetAttempt();
    game.nextTrial();
    setShowFeedback(false);
  }, [stopListening, isRecording, stopRecording, resetAttempt, game]);

  const handleTryAgain = useCallback(() => {
    setShowFeedback(false);
    lastScoredRef.current = '';
    rawTranscriptRef.current = '';
    setDisplayTranscript('');
    processingRef.current = false;
    resetAttempt();

    if (sessionId && userId && game.currentTrial) {
      startAttempt({
        sessionId,
        userId,
        exerciseSlug: 'fix_sentence',
        trialIndex: game.currentIndex,
        attemptNumber: game.currentAttempt + 1,
        targetWord: game.currentTrial.acceptedFixes[0],
        category: game.currentTrial.category,
      });
    }

    startListening();
    setIsListening(true);
    if (isRecordingSupported) startRecording();
  }, [sessionId, userId, game, startAttempt, startListening, isRecordingSupported, startRecording, resetAttempt]);

  const handleSpeakSentence = useCallback(() => {
    if (game.currentTrial) speak(game.currentTrial.sentence);
  }, [game.currentTrial, speak]);

  if (game.isComplete) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-8">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold">Great job!</h2>
        <div className="flex justify-center gap-6 text-lg">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{game.correctCount}</div>
            <div className="text-sm text-muted-foreground">Correct</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600">{game.partialCount}</div>
            <div className="text-sm text-muted-foreground">Close</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-muted-foreground">{game.totalTrials}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-2 sm:space-y-6">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
          <span>{game.currentIndex + 1}/{game.totalTrials}</span>
          <span>{game.correctCount} correct</span>
        </div>
        <Progress value={game.progress} className="h-1.5" />
      </div>

      {/* Instruction */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          🔧 Find the wrong word and say a better one
        </p>
      </div>

      {/* Sentence Card */}
      <Card className="border-2">
        <CardContent className="pt-4 pb-4 sm:pt-8 sm:pb-8 px-4 sm:px-6">
          <div className="space-y-4">
            {renderSentence()}
            
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSpeakSentence}
                className="text-muted-foreground"
              >
                <Volume2 className="h-4 w-4 mr-1" /> Hear it again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transcript display */}
      {displayTranscript && (
        <div className="text-center text-lg text-muted-foreground">
          Heard: "<span className="font-medium text-foreground">{displayTranscript}</span>"
        </div>
      )}

      {/* Feedback */}
      {showFeedback && game.lastResult && (
        <Card className={cn(
          'border-2',
          game.lastResult.isCorrect && 'border-green-500 bg-green-50 dark:bg-green-950/20',
          game.lastResult.isPartialCredit && !game.lastResult.isCorrect && 'border-amber-500 bg-amber-50 dark:bg-amber-950/20',
          !game.lastResult.isCorrect && !game.lastResult.isPartialCredit && 'border-destructive bg-destructive/10',
        )}>
          <CardContent className="pt-4 pb-4 text-center space-y-2">
            {game.lastResult.isCorrect ? (
              <>
                <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
                  <Check className="h-5 w-5" />
                  <span className="font-semibold text-lg">
                    {game.lastResult.selfCorrected ? 'Great self-correction!' : 'Perfect!'}
                  </span>
                </div>
                {game.lastResult.matchedFix && (
                  <p className="text-muted-foreground">
                    "{game.lastResult.matchedFix}" — that fixes it!
                  </p>
                )}
              </>
            ) : game.lastResult.isPartialCredit ? (
              <>
                <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400">
                  <Minus className="h-5 w-5" />
                  <span className="font-semibold text-lg">Close!</span>
                </div>
                <p className="text-muted-foreground">
                  Good thinking! One answer could be: <strong>{game.currentTrial?.acceptedFixes[0]}</strong>
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 text-destructive">
                  <X className="h-5 w-5" />
                  <span className="font-semibold text-lg">Not quite</span>
                </div>
                <p className="text-muted-foreground">
                  Try again! Think about what would make the sentence correct.
                </p>
                <Button variant="outline" size="sm" onClick={handleTryAgain} className="mt-2">
                  <RotateCcw className="h-4 w-4 mr-1" /> Try Again
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex justify-center gap-3">
        {isProcessing ? (
          <Badge variant="secondary" className="text-base px-4 py-2 animate-pulse">
            Checking...
          </Badge>
        ) : (
          <>
            <div className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm',
              isListening ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'
            )}>
              {isListening ? <Mic className="h-4 w-4 animate-pulse" /> : <MicOff className="h-4 w-4" />}
              {isListening ? 'Listening...' : 'Mic off'}
            </div>
          </>
        )}

        <Button variant="ghost" size="sm" onClick={handleSkip}>
          <SkipForward className="h-4 w-4 mr-1" /> Skip
        </Button>
      </div>
    </div>
  );
}
