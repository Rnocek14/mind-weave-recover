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
import { Input } from '@/components/ui/input';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useFixSentenceGame, FixSentenceTrialResult } from '@/hooks/useFixSentenceGame';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTextToSpeech, stopGlobalTTS } from '@/hooks/useTextToSpeech';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { AdaptationBadge, useAdaptationShift } from '@/components/AdaptationBadge';
import { LevelBadge } from '@/components/exercise/LevelBadge';
import { usePronunciationAnalysis } from '@/hooks/usePronunciationAnalysis';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { getCapabilityDifficultyBounds } from '@/lib/difficultyBounds';
import { extractAnswerFromTranscript } from '@/lib/speechNormalizer';
import { buildFixSentenceChoices } from '@/lib/fixSentenceChoices';
import { validateSpokenResponse } from '@/lib/evaluation/responseValidation';
import { gateResponse } from '@/lib/evaluation/gateResponse';
import { trackValidation, logValidationDetail } from '@/lib/evaluation/validationTelemetry';
import { speakMayaCoaching, resetCoachingState, cancelPendingMayaCoaching } from '@/lib/evaluation/mayaCoachingResponses';
import { Mic, MicOff, SkipForward, Volume2, RotateCcw, Check, X, Minus, Keyboard, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { voiceController } from '@/lib/voiceController';

const SCORING_DEBOUNCE_MS = 2500; // Wait for user to finish speaking before scoring
const AUTO_ADVANCE_DELAY_MS = 2500;
const WRONG_ANSWER_DISPLAY_MS = 6000; // Show "not quite" feedback before auto-retry

// L5 two-error trials: acknowledgement shown between the two repairs.
const TWO_ERROR_PROMPT_TEXT = "Good — there's one more mistake in this sentence.";
const PHASE_PROMPT_MS = 2600;

interface FixSentenceGameProps {
  onTrialComplete?: (result: FixSentenceTrialResult) => void;
  onGameComplete?: (results: FixSentenceTrialResult[]) => void;
  trialCount?: number;
  focusPhonemes?: string[];
  sessionId?: string | null;
  userId?: string;
  profileId?: string;
  /** Clinical-progression engine floor (1–10). Raises the initial difficulty
   *  but does NOT cap session adaptation (engine can still escalate above). */
  initialDifficultyFloor?: number;
  /** Persistent Clinical Level (1–8). Routes the content selector: L4 serves
   *  the common-verb cohort, L5 the two-error bank, L6 the morphology bank.
   *  Without it the hook only uses difficulty-banded baseline content. */
  clinicalLevel?: number;
  /** Page-level callback to register a force-flush for adaptation_trial_logs.
   *  The page awaits this on completion to avoid the final-trial flush race. */
  registerFlush?: (fn: () => Promise<void>) => void;
}

export function FixSentenceGame({
  onTrialComplete,
  onGameComplete,
  trialCount = 5,
  focusPhonemes = [],
  sessionId,
  userId,
  profileId,
  initialDifficultyFloor,
  clinicalLevel,
  registerFlush,
}: FixSentenceGameProps) {
  const [isListening, setIsListening] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  // L5: visible "one more mistake" acknowledgement between the two repairs.
  const [twoErrorPrompt, setTwoErrorPrompt] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayTranscript, setDisplayTranscript] = useState('');
  const [validationHint, setValidationHint] = useState<string | null>(null);
  const [prevWrongAttempt, setPrevWrongAttempt] = useState<string | null>(null);
  const [showTextInput, setShowTextInput] = useState(() =>
    typeof window !== 'undefined' && sessionStorage.getItem('preferTypingInput') === 'true'
  );
  const [typedAnswer, setTypedAnswer] = useState('');

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScoredRef = useRef<string>('');
  const rawTranscriptRef = useRef<string>('');
  const processingRef = useRef(false);
  const stopListeningRef = useRef<() => void>(() => {});
  const cancelRecordingRef = useRef<() => void>(() => {});
  const autoRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ttsAbortRef = useRef(false);
  // Re-runs the scoring effect once the VoiceController mic-lock clears, so
  // an answer spoken during Maya's tail-lock is scored instead of dropped.
  const [micLockRetryTick, setMicLockRetryTick] = useState(0);
  const micLockRetryRef = useRef<NodeJS.Timeout | null>(null);

  const { speak } = useTextToSpeech();
  const { analyzePronunciation } = usePronunciationAnalysis();
  const vg = useVoiceGuidance('fix-sentence');

  // Speak intro on first mount in Full Coaching mode
  const hasSpokenIntroRef = useRef(false);
  const introCompleteRef = useRef(false);
  useEffect(() => {
    if (!hasSpokenIntroRef.current && vg.shouldAutoSpeak) {
      hasSpokenIntroRef.current = true;
      // Speak intro, then mark complete so sentence read waits
      vg.speakIntro().then(() => {
        introCompleteRef.current = true;
      }).catch(() => {
        introCompleteRef.current = true;
      });
    } else if (!vg.shouldAutoSpeak) {
      introCompleteRef.current = true;
    }
  }, [vg.shouldAutoSpeak]);

  const baseBounds = getCapabilityDifficultyBounds('fix_sentence', null);
  // Clinical Progression v1: raise the suggested start (and floor) to honor
  // the patient's persistent Clinical Level. Adaptive engine can still
  // escalate above this floor in-session.
  const bounds = initialDifficultyFloor && initialDifficultyFloor > baseBounds.suggestedStart
    ? {
        ...baseBounds,
        floor: Math.max(baseBounds.floor, initialDifficultyFloor),
        suggestedStart: Math.min(baseBounds.ceiling, initialDifficultyFloor),
      }
    : baseBounds;
  const { direction: shiftDirection, reason: shiftReason, signal: signalShift } = useAdaptationShift();

  // Phase 2: engagement monitor for cue dependency / fatigue signals.
  const engagement = useEngagementMonitor(sessionId || null);

  // Forward-ref so onDifficultyChange can call game.setActiveDifficulty
  // (which is declared below this hook).
  const setActiveDifficultyRef = useRef<((lvl: number) => void) | null>(null);
  const currentDifficultyForLogRef = useRef<number>(bounds.suggestedStart);

  const {
    currentDifficulty,
    recordTrial: recordAdaptiveTrial,
    levelDescriptor,
    recentSuccessRate: adaptiveSuccessRate,
    flushAutoLog,
  } = useInGameAdaptation({
    exerciseSlug: 'fix_sentence',
    sessionId: sessionId || null,
    initialDifficulty: bounds.suggestedStart,
    bounds,
    windowSize: 5,
    targetSuccessRate: 0.75,
    enableDifficultyAutoStepDown: true,
    enableDifficultyToasts: false,
    enableAutoHints: false,
    // This hook is the single writer for adaptation_trial_logs / adaptation_events.
    // (The useTrialSubmission adaptation logger is a dead no-op — it only fires on
    // a taskParameters flag no game sets — so autoLog:false previously meant NO
    // adaptation telemetry was written for Fix Sentence at all.) defaultTrialMode
    // tags the rows as 'production' so they are not dropped as untagged.
    autoLog: true,
    defaultTrialMode: 'production',
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.debug('[fix_sentence] escalation blocked', { reason, cueDependencyScore, trialsAtLevel });
      void engagement.logIntervention('cue_dependency_gate', 'hold_difficulty', 'auto');
    },
    onDifficultyChange: (newLvl, reason, dir) => {
      const narration = narrateAdaptation({ direction: dir, reasonKind: classifyReason(reason) });
      signalShift(dir, narration || reason);
      // Repool upcoming trials at the new level (real adaptation, not cosmetic)
      setActiveDifficultyRef.current?.(newLvl);
      if (import.meta.env.DEV) {
        const prev = currentDifficultyForLogRef.current;
        console.log(`[FixSentence] L${prev} → L${newLvl}, reason: ${reason}`);
        currentDifficultyForLogRef.current = newLvl;
      }
    },
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
    clinicalLevel,
    onTrialComplete,
    onGameComplete,
  });

  // Bind ref so onDifficultyChange (declared above) can repool trials.
  useEffect(() => {
    setActiveDifficultyRef.current = game.setActiveDifficulty;
  }, [game.setActiveDifficulty]);

  // Expose the auto-wired adaptation_trial_logs flush to the page so it can
  // await the final-trial flush before navigating (mirrors PhotoNamingGame).
  useEffect(() => {
    if (registerFlush && flushAutoLog) {
      registerFlush(async () => { await flushAutoLog(); });
    }
  }, [registerFlush, flushAutoLog]);

  const currentTrialRef = useRef(game.currentTrial);
  const currentIndexRef = useRef(game.currentIndex);
  useEffect(() => { currentTrialRef.current = game.currentTrial; }, [game.currentTrial]);
  useEffect(() => { currentIndexRef.current = game.currentIndex; }, [game.currentIndex]);
  // Live mirror for timer callbacks — the 12s stall reminder otherwise reads
  // showFeedback from a stale closure and can speak over visible feedback.
  const showFeedbackRef = useRef(showFeedback);
  useEffect(() => { showFeedbackRef.current = showFeedback; }, [showFeedback]);

  // L1/L2 scaffolded response mode (ladder targetSupport). L1 keeps the
  // wrong-word highlight (highlight_plus_choice); L2 drops it
  // (choice_based). L3+ is open response — the existing speech/typed UI.
  const choiceMode = typeof clinicalLevel === 'number' && clinicalLevel <= 2;
  const showHighlight = !choiceMode || clinicalLevel === 1;
  const choiceTiles = React.useMemo(
    () => (choiceMode && game.currentTrial ? buildFixSentenceChoices(game.currentTrial) : null),
    [choiceMode, game.currentTrial],
  );

  // Typed-input fallback: bypasses speech/mic/recording and routes through the same scoring + adaptation pipeline.
  const handleTypedSubmit = useCallback(async () => {
    const text = typedAnswer.trim();
    if (!text || processingRef.current || showFeedback) return;
    if (!game.currentTrial) return;

    processingRef.current = true;
    setIsProcessing(true);
    lastScoredRef.current = text;
    setDisplayTranscript(text);

    try {
      const selfCorrected = !!prevWrongAttempt;
      const result = await game.scoreAnswer(text, selfCorrected);
      if (!result) {
        processingRef.current = false;
        setIsProcessing(false);
        return;
      }

      // L5 interim: first of two errors repaired. NOT submitted — prompt
      // for the remaining error and let them type again.
      if (result.phaseAdvance) {
        if (sessionId && userId) {
          try {
            await logFinalAnalysis({
              transcript: text,
              transcriptSource: 'typed' as any,
              isCorrect: true,
              errorType: 'correct',
              semanticSimilarity: result.semanticSimilarity,
            });
          } catch { /* parity log only */ }
        }
        setTwoErrorPrompt(true);
        void speak(TWO_ERROR_PROMPT_TEXT);
        setTypedAnswer('');
        lastScoredRef.current = '';
        setDisplayTranscript('');
        resetAttempt();
        if (sessionId && userId && game.currentTrial) {
          startAttempt({
            sessionId,
            userId,
            exerciseSlug: 'fix_sentence',
            trialIndex: game.currentIndex,
            attemptNumber: game.currentAttempt + 1,
            targetWord: game.phase2TargetFixes?.[0] ?? game.currentTrial.acceptedFixes[0],
            category: game.currentTrial.category,
          });
        }
        setTimeout(() => setTwoErrorPrompt(false), PHASE_PROMPT_MS * 2);
        return;
      }
      setTwoErrorPrompt(false);

      // No mic/audio in typed mode — log a text-source utterance for parity.
      if (sessionId && userId) {
        try {
          await logFinalAnalysis({
            transcript: text,
            transcriptSource: 'typed' as any,
            isCorrect: result.isCorrect,
            errorType: result.isCorrect ? 'correct' : (result.isPartialCredit ? 'incorrect_close' : 'incorrect_fix'),
            semanticSimilarity: result.semanticSimilarity,
          });
        } catch (e) {
          console.debug('[fix_sentence] typed logFinalAnalysis skipped', e);
        }
      }

      // Adaptive engine — same as speech path.
      recordAdaptiveTrial({ correct: result.isCorrect, reactionTimeMs: result.reactionTimeMs });
      engagement.recordTrial({ correct: result.isCorrect, reactionTimeMs: result.reactionTimeMs, timeout: false, cueLevel: 0, timestamp: Date.now() });

      game.submitResult(result);
      setShowFeedback(true);
      setTypedAnswer('');

      if (!result.isCorrect && !result.isPartialCredit) {
        setPrevWrongAttempt(text);
        if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = setTimeout(() => {
          // Reset for typed retry — don't re-open mic.
          setShowFeedback(false);
          lastScoredRef.current = '';
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
        }, WRONG_ANSWER_DISPLAY_MS);
      }

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
  }, [typedAnswer, showFeedback, game, prevWrongAttempt, sessionId, userId, logFinalAnalysis, recordAdaptiveTrial, engagement, resetAttempt, startAttempt]);

  const handleSpeechResult = useCallback((result: string) => {
    logBrowserTranscript(result);
  }, [logBrowserTranscript]);

  const {
    transcript,
    isListening: speechIsListening,
    startListening,
    stopListening,
    resetTranscript,
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

  // Choice-tile tap: speak the word (model), score locally, submit through
  // the same result pipeline as speech/typed — support level rides on the
  // result so ladder evidence sees the true (scaffolded) task.
  const handleChoiceTap = useCallback((word: string) => {
    if (processingRef.current || showFeedback || !game.currentTrial) return;
    processingRef.current = true;
    setIsProcessing(true);
    try {
      // Close the mic before Maya models the word — otherwise her own speech
      // is transcribed and can re-trigger the spoken-tile matcher.
      stopListening();
      setIsListening(false);
      void speak(word);
      const result = game.scoreChoice(word);
      if (!result) return;
      setDisplayTranscript(word);
      recordAdaptiveTrial({ correct: result.isCorrect, reactionTimeMs: result.reactionTimeMs });
      engagement.recordTrial({ correct: result.isCorrect, reactionTimeMs: result.reactionTimeMs, timeout: false, cueLevel: 1, timestamp: Date.now() });
      game.submitResult(result);
      setShowFeedback(true);
      if (result.isCorrect) {
        setTimeout(() => {
          game.nextTrial();
          setShowFeedback(false);
          setDisplayTranscript('');
        }, AUTO_ADVANCE_DELAY_MS);
      } else {
        // Gentle retry: same tiles (deterministic). Re-open the mic once
        // Maya's feedback finishes so a spoken retry works too.
        setTimeout(() => {
          setShowFeedback(false);
          setDisplayTranscript('');
          resetTranscript();
          void voiceController.awaitMicSafe().then(() => {
            if (!showFeedbackRef.current && !processingRef.current) {
              startListening();
              setIsListening(true);
            }
          });
        }, WRONG_ANSWER_DISPLAY_MS);
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [game, showFeedback, speak, recordAdaptiveTrial, engagement, resetTranscript, startListening, stopListening]);

  // Choice-mode voice input: saying a tile word answers exactly like tapping
  // it. Matches the latest transcript against the visible tiles and routes
  // through handleChoiceTap so scoring/adaptation stay identical. (L1/L2
  // previously had NO way to speak the answer at all.)
  useEffect(() => {
    if (!choiceMode || !choiceTiles || !game.currentTrial) return;
    if (!transcript || processingRef.current || showFeedback) return;
    if (!speechIsListening) return;
    const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '');
    const tokens = transcript.toLowerCase().split(/\s+/).map(norm).filter(Boolean);
    const candidate = norm(extractAnswerFromTranscript(transcript));
    // Echo guard: never match a tile word Maya herself said recently — the
    // sentence can contain a distractor tile word (the error word may be
    // another trial's fix). The correct tile is never in the sentence.
    const mayaTokens = new Set(
      voiceController.getRecentSpoken().flatMap(line =>
        line.toLowerCase().split(/\s+/).map(norm).filter(Boolean)
      )
    );
    const match = choiceTiles.find(t => {
      const nt = norm(t);
      if (mayaTokens.has(nt)) return false;
      return nt === candidate || tokens.includes(nt);
    });
    if (match) {
      stopListening();
      setIsListening(false);
      resetTranscript();
      handleChoiceTap(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, choiceMode, choiceTiles, showFeedback, speechIsListening]);

  // Stall timer for voice reminder
  const stallTimerFixRef = useRef<NodeJS.Timeout | null>(null);

  // Speak the sentence when trial changes
  useEffect(() => {
    if (game.currentTrial && !game.isComplete) {
      ttsAbortRef.current = false;

      // CRITICAL: hard-reset all transcript/scoring state before the next trial begins,
      // independent of session/user gating. Without this, the previous trial's
      // transcript/lastScored/displayTranscript leaks into the next trial and the
      // scoring effect re-fires with the old answer (the "all correct, same word"
      // bug from daily session report).
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
      if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
      if (micLockRetryRef.current) clearTimeout(micLockRetryRef.current);
      // A coaching line queued for the PREVIOUS trial must not play into this one.
      cancelPendingMayaCoaching();
      // Clear the recognizer's dedupe state too: it suppresses a transcript
      // identical to the last processed one, so without this a patient who
      // repeats the previous trial's (or attempt's) exact words gets NO
      // callback at all — the answer silently never registers.
      resetTranscript();
      lastScoredRef.current = '';
      rawTranscriptRef.current = '';
      stableTranscriptRef.current = '';
      processingRef.current = false;
      setDisplayTranscript('');
      setShowFeedback(false);
      setPrevWrongAttempt(null);
      setValidationHint(null);

      // Wait for intro speech to complete, then speak sentence, THEN start mic
      const startTrialFlow = async () => {
        // Wait for intro if needed
        while (!introCompleteRef.current) {
          await new Promise(r => setTimeout(r, 200));
        }
        if (!game.currentTrial || ttsAbortRef.current) return;

        // Speak the sentence and WAIT for it to finish
        await speak(game.currentTrial.sentence);

        // Only start mic AFTER TTS completes
        if (ttsAbortRef.current) return;

        if (sessionId && userId && !showTextInput) {
          startListening();
          setIsListening(true);
          // Audio upload only matters for open response; choice mode scores
          // a tile word, so skip the recorder there.
          if (isRecordingSupported && !choiceMode) startRecording();
        }

        // Start the stall reminder ONLY after the sentence has actually been
        // spoken. Previously this was set unconditionally at trial-mount, so
        // on the first trial it fired during the intro — before the sentence
        // ever played — producing the "Listen to the sentence again" prompt
        // BEFORE the sentence itself.
        if (stallTimerFixRef.current) clearTimeout(stallTimerFixRef.current);
        stallTimerFixRef.current = setTimeout(() => {
          if (!showFeedbackRef.current && !processingRef.current && !ttsAbortRef.current) {
            vg.speakReminder();
          }
        }, 12000);
      };

      game.startRound();

      // Begin attempt tracking
      if (sessionId && userId) {
        startAttempt({
          sessionId,
          userId,
          exerciseSlug: 'fix_sentence',
          trialIndex: game.currentIndex,
          attemptNumber: game.currentAttempt,
          targetWord: game.currentTrial.acceptedFixes[0] || game.currentTrial.wrongWord,
          category: game.currentTrial.category,
        });
      }

      startTrialFlow();
    }
    return () => {
      ttsAbortRef.current = true;
      if (stallTimerFixRef.current) clearTimeout(stallTimerFixRef.current);
      if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentTrial?.id, game.isComplete]);

  // Silence any in-flight/queued speech the moment the game completes so a
  // delayed coaching line or feedback can't play over the completion screen
  // (or the next exercise in a lesson).
  useEffect(() => {
    if (game.isComplete) {
      cancelPendingMayaCoaching();
      stopGlobalTTS();
    }
  }, [game.isComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
      if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
      if (micLockRetryRef.current) clearTimeout(micLockRetryRef.current);
      cancelPendingMayaCoaching();
      stopGlobalTTS();
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

  // Debounced scoring — only score after transcript is stable (user stopped speaking)
  const stableTranscriptRef = useRef<string>('');
  const stabilityTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track when transcript stabilises (no new results for SCORING_DEBOUNCE_MS)
  useEffect(() => {
    const trial = currentTrialRef.current;
    if (!transcript || !trial || processingRef.current || showFeedback) return;
    // Choice mode has its own spoken-tile matcher below — the open-response
    // scorer must not also fire on the same transcript.
    if (choiceMode) return;
    // Gate: only score when the mic is actually open for THIS trial.
    // Prevents stale transcripts from a previous trial leaking in (the
    // "same answer reused for every trial" bug).
    if (!speechIsListening) return;
    // Sync-Wait: never SCORE while Maya is speaking (or within the post-speech
    // tail lock) — but do NOT throw the transcript away. Patients often answer
    // the instant the sentence ends, inside the tail lock; discarding here
    // silently swallowed those answers ("it's not even showing he said that").
    // Re-run once the lock clears; the echo gate below still rejects anything
    // that is actually Maya's own voice.
    if (voiceController.isMicLocked) {
      if (micLockRetryRef.current) clearTimeout(micLockRetryRef.current);
      micLockRetryRef.current = setTimeout(() => setMicLockRetryTick(t => t + 1), 450);
      return;
    }
    // Verbatim read-back of the trial sentence is never an answer — it is
    // Maya's own "Hear it again" audio (or the patient echoing it). The gate's
    // echo filter would catch this, except its expectedAnswers bypass admits
    // sentences that happen to contain one of their own fixes (fs_53, fs_88).
    const normEq = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
    if (trial.sentence && normEq(transcript) === normEq(trial.sentence)) {
      rawTranscriptRef.current = '';
      return;
    }

    const candidate = extractAnswerFromTranscript(transcript);
    if (candidate === lastScoredRef.current && candidate.length > 0) return;
    // Full pre-scoring gate: echo filter (rejects Maya's own voice) + validation.
    const gate = gateResponse({
      transcript,
      expectedMode: 'sentence_fix',
      promptText: trial?.sentence,
      extraSpokenContext: trial?.sentence ? [trial.sentence] : [],
      expectedAnswers: trial?.acceptedFixes ?? [],
    });
    if (gate.validation) {
      trackValidation('fix_sentence', gate.validation);
      logValidationDetail('fix_sentence', transcript, gate.validation);
    }
    if (!gate.ok || candidate.length < 2) {
      const isEcho = gate.classification === 'echo_of_maya' || gate.classification === 'echo_short_mimic';
      // Echo of Maya's own voice: silently drop — do NOT coach (avoids a feedback loop).
      if (!isEcho && gate.rejectionReason) {
        speakMayaCoaching(gate.rejectionReason as any, speak, { exerciseKey: 'fix_sentence' }).then(line => setValidationHint(line));
      }
      return;
    }
    setValidationHint(null);
    // Reset coaching WITHOUT speaking reinforcement. Passing `speak` here made
    // Maya say "That fixes it." the moment a transcript merely passed
    // validation — before scoring, even for wrong answers — and TTS latency
    // landed it seconds later, mid-next-trial. The feedback card (and success
    // sound) already confirm correct answers.
    resetCoachingState('fix_sentence');

    // Reset stability timer on every new transcript (user still speaking)
    if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

    stableTranscriptRef.current = candidate;

    // Wait for transcript to stabilise before scoring
    stabilityTimerRef.current = setTimeout(async () => {
      // Double-check the candidate hasn't changed during the wait
      const finalCandidate = stableTranscriptRef.current;
      if (!finalCandidate || finalCandidate.length < 2 || processingRef.current) return;
      
      processingRef.current = true;
      setIsProcessing(true);
      lastScoredRef.current = finalCandidate;

      try {
        const selfCorrected = !!prevWrongAttempt;
        // Score the FULL utterance, not the extracted tail. The matcher now
        // accepts fixes embedded in longer answers ("the dentist cleaned my
        // teeth" for fix "teeth"), which the 1-2-token extraction destroyed.
        // scoreAnswer still extracts a compact candidate itself for the
        // semantic-embedding fallback.
        const rawFull = rawTranscriptRef.current || finalCandidate;
        const result = await game.scoreAnswer(rawFull, selfCorrected);

        if (!result) {
          processingRef.current = false;
          setIsProcessing(false);
          return;
        }

        // L5 interim: first of two errors repaired. NOT submitted — stop
        // the mic, log the (correct) utterance, prompt for the remaining
        // error, then reopen via handleTryAgain's sync-wait path.
        if (result.phaseAdvance) {
          stopListening();
          setIsListening(false);
          let interimAudioPath: string | undefined;
          let interimDurationMs: number | undefined;
          if (isRecording) {
            const recResult = await stopRecording();
            if (recResult && sessionId && userId) {
              interimDurationMs = recResult.duration;
              const uploaded = await uploadRecording(
                recResult.audioBlob, userId, sessionId, currentIndexRef.current + 1, recResult.mimeType
              ).catch(() => null);
              if (uploaded) interimAudioPath = uploaded;
            }
          }
          await logFinalAnalysis({
            transcript: rawTranscriptRef.current,
            transcriptSource: 'browser',
            isCorrect: true,
            errorType: 'correct',
            semanticSimilarity: result.semanticSimilarity,
            audioStoragePath: interimAudioPath,
            recordingDurationMs: interimDurationMs,
          }).catch(() => {});
          setTwoErrorPrompt(true);
          void speak(TWO_ERROR_PROMPT_TEXT);
          setTimeout(() => {
            setTwoErrorPrompt(false);
            handleTryAgain(); // resets attempt + reopens mic after TTS
          }, PHASE_PROMPT_MS);
          return;
        }
        setTwoErrorPrompt(false);

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
              analyzePronunciation(recResult.audioBlob, result.matchedFix || finalCandidate).catch(() => null),
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
          errorType: result.isCorrect ? 'correct' : (result.isPartialCredit ? 'incorrect_close' : 'incorrect_fix'),
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
        engagement.recordTrial({ correct: result.isCorrect, reactionTimeMs: result.reactionTimeMs, timeout: false, cueLevel: 0, timestamp: Date.now() });

        // Submit to game state
        game.submitResult(result);

        // Show feedback
        setShowFeedback(true);

        if (!result.isCorrect && !result.isPartialCredit) {
          setPrevWrongAttempt(finalCandidate);
          
          // Auto-retry after wrong answer (with dismiss option in UI)
          if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
          autoRetryTimerRef.current = setTimeout(() => {
            handleTryAgain();
          }, WRONG_ANSWER_DISPLAY_MS);
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

    return () => {
      if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, micLockRetryTick]);

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
                isWrong && showHighlight && 'bg-destructive/20 text-destructive font-bold px-1 py-0.5 rounded underline decoration-wavy decoration-destructive'
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
    if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    stopListening();
    setIsListening(false);
    if (isRecording) stopRecording();
    resetAttempt();
    game.nextTrial();
    setShowFeedback(false);
  }, [stopListening, isRecording, stopRecording, resetAttempt, game]);

  const handleTryAgain = useCallback(() => {
    if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
    setShowFeedback(false);
    setTwoErrorPrompt(false);
    lastScoredRef.current = '';
    rawTranscriptRef.current = '';
    // Without this, repeating the exact same words on the retry is deduped
    // by the recognizer and never delivered.
    resetTranscript();
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

    // Sync-Wait: wait until Maya's feedback finishes before re-opening the mic,
    // so the retry doesn't immediately capture her voice as the answer.
    void voiceController.awaitMicSafe().then(() => {
      if (showTextInput || choiceMode) return;
      startListening();
      setIsListening(true);
      if (isRecordingSupported) startRecording();
    });
  }, [sessionId, userId, game, startAttempt, startListening, isRecordingSupported, startRecording, resetAttempt, resetTranscript, showTextInput, choiceMode]);

  const handleSpeakSentence = useCallback(() => {
    if (game.currentTrial) speak(game.currentTrial.sentence);
  }, [game.currentTrial, speak]);

  if (game.isComplete) {
    const accuracy = game.totalTrials > 0 ? game.correctCount / game.totalTrials : 0;
    const headline = accuracy >= 0.7
      ? 'Nice work!'
      : accuracy >= 0.4
      ? 'Session complete'
      : 'Good effort — keep practicing';
    const emoji = accuracy >= 0.7 ? '🎉' : '';
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-8">
        {emoji && <div className="text-6xl">{emoji}</div>}
        <h2 className="text-2xl font-bold">{headline}</h2>
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
    <div className="max-w-2xl mx-auto w-full my-auto space-y-2 sm:space-y-5">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs sm:text-sm text-muted-foreground">
          <span>{game.currentIndex + 1}/{game.totalTrials}</span>
          <div className="flex items-center gap-2">
            <LevelBadge descriptor={levelDescriptor} compact successRate={adaptiveSuccessRate ?? null} />
            <AdaptationBadge direction={shiftDirection} reason={shiftReason} />
            <span>{game.correctCount} correct</span>
          </div>
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
            {twoErrorPrompt && (
              <div
                role="status"
                className="rounded-lg bg-primary/10 border border-primary/30 px-4 py-3 text-center text-base font-medium text-primary"
              >
                ✓ {TWO_ERROR_PROMPT_TEXT}
              </div>
            )}
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
      {validationHint && !showFeedback && (
        <div className="text-center text-sm text-muted-foreground italic">
          💡 {validationHint}
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
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={handleTryAgain}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Try Again
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleSkip}>
                    <SkipForward className="h-4 w-4 mr-1" /> Skip
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* L1/L2 choice tiles — the ladder's scaffolded response mode.
          Tap OR say a tile word to answer; both route through handleChoiceTap. */}
      {choiceMode && choiceTiles && !showFeedback && (
        <div className="space-y-2">
          {isListening && (
            <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-1.5">
              <Mic className="h-3.5 w-3.5" /> Say the word — or tap it below
            </p>
          )}
        <div className="grid grid-cols-2 gap-3" data-testid="choice-tiles">
          {choiceTiles.map((word) => (
            <Button
              key={word}
              variant="secondary"
              size="lg"
              className="h-16 text-lg capitalize"
              disabled={isProcessing}
              onClick={() => handleChoiceTap(word)}
            >
              {word}
            </Button>
          ))}
        </div>
        </div>
      )}

      {/* Typing fallback input */}
      {!choiceMode && showTextInput && !showFeedback && (
        <div className="flex gap-2">
          <Input
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTypedSubmit();
              }
            }}
            placeholder="Type the replacement word + Enter"
            className="min-h-[48px] text-base"
            disabled={isProcessing}
            autoFocus
          />
          <Button
            size="icon"
            aria-label="Submit answer"
            onClick={handleTypedSubmit}
            disabled={!typedAnswer.trim() || isProcessing}
            className="min-h-[48px] min-w-[48px]"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center items-center gap-3 flex-wrap">
        {isProcessing ? (
          <Badge variant="secondary" className="text-base px-4 py-2 animate-pulse">
            Checking...
          </Badge>
        ) : choiceMode ? null : !showTextInput ? (
          <div className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm',
            isListening ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'
          )}>
            {isListening ? <Mic className="h-4 w-4 animate-pulse" /> : <MicOff className="h-4 w-4" />}
            {isListening ? 'Listening...' : 'Mic off'}
          </div>
        ) : null}

        {!choiceMode && <button
          type="button"
          onClick={() => {
            const next = !showTextInput;
            setShowTextInput(next);
            sessionStorage.setItem('preferTypingInput', String(next));
            if (next) {
              // Stop mic when switching to typing
              if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
              if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
              stopListening();
              setIsListening(false);
              if (isRecording) cancelRecording();
            } else {
              // Switching back to speech: open mic if session is active
              if (sessionId && userId) {
                startListening();
                setIsListening(true);
                if (isRecordingSupported) startRecording();
              }
            }
          }}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {showTextInput ? <Mic className="w-3 h-3" /> : <Keyboard className="w-3 h-3" />}
          {showTextInput ? 'Switch to speech' : 'Switch to typing'}
        </button>}

        <Button variant="ghost" size="sm" onClick={handleSkip}>
          <SkipForward className="h-4 w-4 mr-1" /> Skip
        </Button>
      </div>

    </div>
  );
}
