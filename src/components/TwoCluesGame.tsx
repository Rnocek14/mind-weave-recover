/**
 * Two Clues Word Association Game - Main Game Component
 * 
 * Key design decisions for stroke survivors:
 * - 1500ms debounce (more thinking time than Photo Naming's 750ms)
 * - Clue words filtered from transcript before scoring
 * - Patient mode listening: unlimited restarts, no auto-end on silence
 * - Processing guard with 10s failsafe to prevent mic deadlock
 * - All exit paths use try/finally with local shouldHoldProcessing flag
 * - 2s cooldown after scoring to prevent re-scoring loops
 * - Pre-computed result passed to submitAnswer (no double-scoring)
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTwoCluesGame, TwoCluesTrialResult } from '@/hooks/useTwoCluesGame';
import { getTierColor, getTierBgColor, getTierEmoji, getTierMessage, scoreAnswer, ScoringResult } from '@/lib/twoCluesScorer';
import { extractAnswerFromTranscript, isMostlyFiller, getContentWordCount, removeClueWords } from '@/lib/speechNormalizer';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { usePronunciationAnalysis } from '@/hooks/usePronunciationAnalysis';
import { getCapabilityDifficultyBounds } from '@/lib/difficultyBounds';
import { Mic, MicOff, SkipForward, Volume2, RotateCcw, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────
const SCORING_DEBOUNCE_MS = 1500;
const SCORING_COOLDOWN_MS = 2000;
const PROCESSING_FAILSAFE_MS = 10000;
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
  const normalized = spoken.toLowerCase().trim().replace(/[^a-z\s]/g, '');
  if (!normalized || normalized.length < 2) return null;

  for (const anchor of anchors) {
    const a = anchor.toLowerCase();
    if (normalized === a || normalized === a + 's' || normalized + 's' === a) {
      return { tier: 'strong', matchedWord: anchor };
    }
  }
  
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

  for (const word of cluster) {
    const w = word.toLowerCase();
    if (normalized === w || normalized === w + 's' || normalized + 's' === w) {
      return { tier: 'related', matchedWord: word };
    }
  }
  
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
  const [filteredDisplay, setFilteredDisplay] = useState('');
  const [scoringPhase, setScoringPhase] = useState<'idle' | 'checking' | 'scoring'>('idle');
  const [showThinkingHint, setShowThinkingHint] = useState(false);
  const [difficultyChanged, setDifficultyChanged] = useState<'up' | 'down' | null>(null);
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScoredCandidateRef = useRef<string>('');
  const rawTranscriptRef = useRef<string>('');
  const finalizingRef = useRef(false);
  const processingRef = useRef(false);
  const processingSetAtRef = useRef<number>(0);
  const lastScoredAtRef = useRef<number>(0);
  const thinkingHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const stopListeningRef = useRef<() => void>(() => {});
  const cancelRecordingRef = useRef<() => void>(() => {});
  const finalizeAttemptRef = useRef<(errorType: 'cancelled' | 'skipped' | 'abandoned') => Promise<void>>(async () => {});
  
  const { speak } = useTextToSpeech();

  // Capability-based difficulty bounds (null scores = safe defaults)
  const bounds = useMemo(() => getCapabilityDifficultyBounds('two_clues', null), []);

  // Layer 2: In-Game Adaptation (replaces basic useAdaptiveDifficulty)
  const {
    currentDifficulty,
    recordTrial: recordAdaptiveTrial,
    frustrationLevel,
    consecutiveErrors: adaptiveConsecutiveErrors,
    startStallTimer,
    clearStallTimer,
    reset: resetAdaptation,
  } = useInGameAdaptation({
    exerciseSlug: 'two_clues',
    sessionId: sessionId || null,
    initialDifficulty: bounds.suggestedStart,
    bounds,
    windowSize: 5,
    targetSuccessRate: 0.75,
    enableDifficultyAutoStepDown: true,
    enableDifficultyToasts: true,
    enableAutoHints: false, // Two Clues has its own thinking hint
    onDifficultyChange: (_level, _reason, direction) => {
      setDifficultyChanged(direction);
      setTimeout(() => setDifficultyChanged(null), 2500);
    },
  });

  // Azure Pronunciation Assessment (shared hook)
  const { analyzePronunciation } = usePronunciationAnalysis();

  const {
    currentAttemptId,
    isFinalized,
    startAttempt,
    logBrowserTranscript,
    logFinalAnalysis,
    resetAttempt,
  } = useUtteranceLogger();

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

  // Stable refs for game values used in effects (avoids re-triggering on game object identity)
  const currentPuzzleRef = useRef(game.currentPuzzle);
  const currentIndexRef = useRef(game.currentIndex);
  const currentAttemptNumRef = useRef(game.currentAttempt);
  useEffect(() => { currentPuzzleRef.current = game.currentPuzzle; }, [game.currentPuzzle]);
  useEffect(() => { currentIndexRef.current = game.currentIndex; }, [game.currentIndex]);
  useEffect(() => { currentAttemptNumRef.current = game.currentAttempt; }, [game.currentAttempt]);

  // Speech result callback
  const handleSpeechResult = useCallback((result: string) => {
    console.log('[TwoClues] Speech result:', result);
    logBrowserTranscript(result);
  }, [logBrowserTranscript]);

  // Use PATIENT MODE: unlimited restarts, no auto-end on silence
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
    patientMode: true, // Unlimited restarts, no restart cap
  });

  useEffect(() => { stopListeningRef.current = stopListening; }, [stopListening]);
  useEffect(() => { cancelRecordingRef.current = cancelRecording; }, [cancelRecording]);

  useEffect(() => {
    setIsListening(speechIsListening);
  }, [speechIsListening]);

  // ── Processing guard failsafe (10s auto-reset) ────────────────────
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

  // ── Thinking hint (10s with no content) ────────────────────────────
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

  const setProcessingGuard = useCallback((value: boolean) => {
    processingRef.current = value;
    processingSetAtRef.current = value ? Date.now() : 0;
  }, []);

  const beginAttempt = useCallback((attemptNumber: number = 1) => {
    if (!sessionId || !userId || !currentPuzzleRef.current) return;
    
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    lastScoredCandidateRef.current = '';
    rawTranscriptRef.current = '';
    setDisplayTranscript('');
    setFilteredDisplay('');
    setScoringPhase('idle');
    setProcessingGuard(false);
    
    const targetWord = currentPuzzleRef.current.anchors[0] || 'unknown';
    startAttempt({
      sessionId,
      userId,
      exerciseSlug: 'two_clues',
      trialIndex: currentIndexRef.current,
      attemptNumber,
      targetWord,
      category: currentPuzzleRef.current.category,
    });
    
    setIsListening(true);
    startListening();
    if (isRecordingSupported) {
      startRecording();
    }
  }, [sessionId, userId, startAttempt, startListening, isRecordingSupported, startRecording, setProcessingGuard]);

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

  const clearTranscriptState = useCallback(() => {
    setDisplayTranscript('');
    setFilteredDisplay('');
    lastScoredCandidateRef.current = '';
    rawTranscriptRef.current = '';
    setScoringPhase('idle');
  }, []);

  // Auto-start listening when puzzle changes
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
    if (transcript && currentPuzzleRef.current) {
      setDisplayTranscript(transcript);
      rawTranscriptRef.current = transcript;
      
      const withoutClues = removeClueWords(transcript, currentPuzzleRef.current.clues);
      const answer = extractAnswerFromTranscript(withoutClues);
      setFilteredDisplay(answer);
    }
  }, [transcript]);

  // ==========================================================================
  // CRITICAL: Debounced scoring pipeline
  // Uses currentPuzzleRef for stability — does NOT depend on `game` object
  // ==========================================================================
  useEffect(() => {
    const puzzle = currentPuzzleRef.current;
    if (!transcript || !puzzle) return;
    
    // Step 1: Remove clue words from transcript
    const withoutClues = removeClueWords(transcript, puzzle.clues);
    
    // Step 2: Extract answer candidate
    const candidate = extractAnswerFromTranscript(withoutClues);
    
    // Guard: same candidate as last scored
    if (candidate === lastScoredCandidateRef.current && candidate.length > 0) return;
    
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

    debounceTimeoutRef.current = setTimeout(async () => {
      // Re-read refs inside timeout (may have changed during debounce)
      const currentPuzzle = currentPuzzleRef.current;
      if (!currentPuzzle) return;
      
      // GUARD 1: Already processing or showing feedback
      if (processingRef.current) {
        console.log('[TwoClues] Skipping score - already processing');
        return;
      }
      
      // GUARD 2: Filler-only or too short
      if (isMostlyFiller(withoutClues) || candidate.length < 2) {
        console.log('[TwoClues] Skipping score - filler/clue-only:', JSON.stringify(candidate));
        return;
      }
      
      // GUARD 3: Cooldown
      const timeSinceLastScore = Date.now() - lastScoredAtRef.current;
      if (timeSinceLastScore < SCORING_COOLDOWN_MS && lastScoredCandidateRef.current) {
        console.log('[TwoClues] Skipping score - in cooldown');
        return;
      }
      
      // Lock processing
      setProcessingGuard(true);
      setIsProcessing(true);
      setScoringPhase('checking');
      
      const rawTranscript = rawTranscriptRef.current;
      
      // Local flag: should we keep processingRef locked after try/finally?
      // (for creative/uncertain where user must click Try Again / Continue)
      let shouldHoldProcessing = false;
      
      try {
        // Quick local match first (instant)
        const quickMatch = quickLocalMatch(
          candidate,
          currentPuzzle.anchors,
          currentPuzzle.cluster,
          currentPuzzle.anchorAliases,
          currentPuzzle.clusterAliases
        );
        
        let result: ScoringResult;
        
        if (quickMatch) {
          console.log('[TwoClues] Quick match:', quickMatch);
          result = {
            tier: quickMatch.tier,
            score: quickMatch.tier === 'strong' ? 100 : 75,
            matchedWord: quickMatch.matchedWord,
            reachedAnchor: quickMatch.tier === 'strong',
            semanticSimilarity: quickMatch.tier === 'strong' ? 1.0 : 0.85,
            reasoning: quickMatch.tier === 'strong' ? 'Perfect match!' : 'Great related word!',
          };
        } else {
          console.log('[TwoClues] Semantic scoring for:', candidate);
          setScoringPhase('scoring');
          result = await scoreAnswer(candidate, currentPuzzle);
        }
        
        // Mark scored
        lastScoredCandidateRef.current = candidate;
        lastScoredAtRef.current = Date.now();
        
        // Stop mic + recording
        stopListening();
        setIsListening(false);
        
        let recordingDurationMs: number | undefined;
        let audioStoragePath: string | undefined;
        let pronunciationData: any = null;
        
        if (isRecording) {
          const recordingResult = await stopRecording();
          if (recordingResult && sessionId && userId) {
            recordingDurationMs = recordingResult.duration;
            
            // Run upload and Azure pronunciation analysis in parallel
            const [uploadedPath, pronResult] = await Promise.all([
              uploadRecording(
                recordingResult.audioBlob,
                userId,
                sessionId,
                currentIndexRef.current + 1,
                recordingResult.mimeType
              ),
              analyzePronunciation(recordingResult.audioBlob, candidate).catch(err => {
                console.warn('[TwoClues] Pronunciation analysis failed (non-blocking):', err);
                return null;
              }),
            ]);
            
            if (uploadedPath) audioStoragePath = uploadedPath;
            if (pronResult?.ok) {
              pronunciationData = pronResult.data;
              console.log('[TwoClues] Pronunciation scores:', {
                pronunciation: pronResult.data.pronunciationScore,
                accuracy: pronResult.data.accuracyScore,
                fluency: pronResult.data.fluencyScore,
              });
            }
          }
        }
        
        // Pass pre-computed result to game state (NO re-scoring)
        game.submitAnswer(candidate, result);
        
        // Layer 2 In-Game Adaptation (replaces old updateTrial + checkAndAdjust)
        const isSuccess = result.tier === 'strong' || result.tier === 'related';
        recordAdaptiveTrial({
          correct: isSuccess,
          reactionTimeMs: Date.now() - (lastScoredAtRef.current || Date.now()),
          errorType: result.tier === 'uncertain' ? 'no_match' : 
                     result.tier === 'creative' ? 'creative_link' : undefined,
        });
        
        // Log utterance with pronunciation data
        if (sessionId && currentAttemptId) {
          const contentWordCount = getContentWordCount(rawTranscript);
          
          await logFinalAnalysis({
            transcript: rawTranscript,
            transcriptSource: 'browser',
            isCorrect: isSuccess,
            errorType: result.tier === 'uncertain' ? 'no_match' : 
                       result.tier === 'creative' ? 'creative_link' : 
                       result.tier === 'related' ? 'semantic_paraphasia' : undefined,
            semanticSimilarity: result.semanticSimilarity ?? undefined,
            recordingDurationMs,
            audioStoragePath,
            // Azure pronunciation metrics
            ...(pronunciationData ? {
              pronunciationScore: pronunciationData.pronunciationScore,
              accuracyScore: pronunciationData.accuracyScore,
              fluencyScore: pronunciationData.fluencyScore,
              completenessScore: pronunciationData.completenessScore,
              prosodyScore: pronunciationData.prosodyScore,
            } : {}),
            reasoning: JSON.stringify({
              rawTranscript,
              cluesFiltered: currentPuzzle.clues,
              afterClueRemoval: withoutClues,
              cleanedAnswer: candidate,
              matchedWord: result.matchedWord,
              tier: result.tier,
              score: result.score,
              reachedAnchor: result.reachedAnchor,
              puzzleId: currentPuzzle.id,
              contentWordCount,
              pronunciationScore: pronunciationData?.pronunciationScore,
              accuracyScore: pronunciationData?.accuracyScore,
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

        if (result.tier === 'strong' || result.tier === 'related') {
          // Auto-advance — processing guard released in timeout
          shouldHoldProcessing = true;
          setTimeout(() => {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
            setShowFeedback(false);
            resetAttempt();
            setProcessingGuard(false);
            game.nextRound();
          }, AUTO_ADVANCE_DELAY_MS);
        } else {
          // Creative/uncertain — user clicks Try Again / Continue
          shouldHoldProcessing = false;
        }
      } catch (error) {
        console.error('[TwoClues] Scoring error:', error);
        shouldHoldProcessing = false;
      } finally {
        setIsProcessing(false);
        setScoringPhase('idle');
        if (!shouldHoldProcessing) {
          setProcessingGuard(false);
        }
      }
    }, SCORING_DEBOUNCE_MS);
  }, [transcript, stopListening, sessionId, userId, currentAttemptId, logFinalAnalysis, isRecording, stopRecording, uploadRecording, resetAttempt, clearTranscriptState, recordAdaptiveTrial, setProcessingGuard, game, analyzePronunciation]);

  const handleToggleMic = useCallback(async () => {
    if (isListening) {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      stopListening();
      setIsListening(false);
      cancelRecording();
      clearTranscriptState();
      await finalizeAttempt('cancelled');
    } else {
      beginAttempt((currentAttemptNumRef.current || 0) + 1);
    }
  }, [isListening, stopListening, cancelRecording, clearTranscriptState, finalizeAttempt, beginAttempt]);

  const handleReadClues = useCallback(() => {
    if (currentPuzzleRef.current) {
      speak(currentPuzzleRef.current.clues.join(' and '));
    }
  }, [speak]);

  const handleTryAgain = useCallback(() => {
    setShowFeedback(false);
    setProcessingGuard(false);
    resetAttempt();
    setTimeout(() => {
      beginAttempt((currentAttemptNumRef.current || 0) + 1);
    }, 100);
  }, [resetAttempt, beginAttempt, setProcessingGuard]);

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

  const handleContinue = useCallback(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    clearTranscriptState();
    setShowFeedback(false);
    setProcessingGuard(false);
    resetAttempt();
    game.nextRound();
  }, [game, resetAttempt, clearTranscriptState, setProcessingGuard]);

  // ── Render ─────────────────────────────────────────────────────────

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

  // Build token-level display: dim clue tokens, bold answer candidate
  const renderTranscriptTokens = () => {
    if (!displayTranscript || !currentPuzzle) return null;
    
    const clueSet = new Set<string>();
    for (const clue of currentPuzzle.clues) {
      for (const token of clue.toLowerCase().split(/\s+/)) {
        const clean = token.replace(/[^a-z']/g, '');
        if (clean.length >= 2) {
          clueSet.add(clean);
          clueSet.add(clean + 's');
          const canStripS = clean.length > 3 && clean.endsWith('s') &&
            !clean.endsWith('ss') && !clean.endsWith('us') &&
            !clean.endsWith('is') && !clean.endsWith('as');
          if (canStripS) clueSet.add(clean.slice(0, -1));
        }
      }
    }
    
    // Build answer token set for bolding (with safe plural variants)
    const answerTokens = new Set<string>();
    if (filteredDisplay) {
      for (const t of filteredDisplay.toLowerCase().split(/\s+/)) {
        const c = t.replace(/[^a-z']/g, '');
        if (c.length >= 2) {
          answerTokens.add(c);
          answerTokens.add(c + 's');
          const canStripS = c.length > 3 && c.endsWith('s') &&
            !c.endsWith('ss') && !c.endsWith('us') &&
            !c.endsWith('is') && !c.endsWith('as');
          if (canStripS) answerTokens.add(c.slice(0, -1));
        }
      }
    }
    
    const FILLER_SET = new Set(['um', 'uh', 'umm', 'uhh', 'er', 'erm', 'ah', 'hmm', 'mm', 'like', 'well', 'so', 'okay', 'ok']);
    
    const tokens = displayTranscript.split(/\s+/);
    return (
      <span>
        {tokens.map((token, i) => {
          const clean = token.toLowerCase().replace(/[^a-z']/g, '');
          const isClue = clueSet.has(clean);
          const isFiller = FILLER_SET.has(clean);
          const isAnswer = answerTokens.has(clean);
          
          return (
            <span key={i}>
              {i > 0 && ' '}
              <span className={cn(
                isClue && 'text-muted-foreground/50 line-through',
                isFiller && 'text-muted-foreground/40 italic',
                isAnswer && !isClue && 'font-bold text-primary',
                !isClue && !isFiller && !isAnswer && 'text-foreground'
              )}>
                {token}
              </span>
            </span>
          );
        })}
      </span>
    );
  };

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
                      <span className="text-sm">Heard: "</span>
                      {renderTranscriptTokens()}
                      <span className="text-sm">"</span>
                      {filteredDisplay && (
                        <span className="block mt-1 text-sm text-muted-foreground">
                          Answer: <span className="font-bold text-foreground">{filteredDisplay}</span>
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground animate-pulse">Listening...</span>
                  )}
                </p>
                {showThinkingHint && !filteredDisplay && (
                  <p className="text-sm text-muted-foreground italic animate-in fade-in duration-500">
                    Take your time. What connects these clues?
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Feedback */}
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
                  <><MicOff className="h-5 w-5" /> Stop</>
                ) : (
                  <><Mic className="h-5 w-5" /> Speak</>
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

        {/* Mic recovery button */}
        {!isListening && !isProcessing && !showFeedback && !speechIsListening && isSupported && (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => beginAttempt((currentAttemptNumRef.current || 0) + 1)}
              className="text-muted-foreground gap-2"
            >
              <Mic className="h-4 w-4" />
              Tap to restart microphone
            </Button>
          </div>
        )}

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
