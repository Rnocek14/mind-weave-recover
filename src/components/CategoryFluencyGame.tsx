/**
 * Category Fluency Game v2 — Clinical verbal fluency exercise
 * 
 * "Name as many [category] as you can"
 * PRIMARY INPUT: Speech (microphone) — words are added as you say them
 * FALLBACK: Text input for accessibility
 * 
 * v2 enhancements:
 * - Purpose framing via ExercisePurposeBanner
 * - Clustering/switching analysis
 * - Gentler timer (progress bar, not countdown)
 * - Structured summary with Maya reflection
 * - StructuredFeedbackSummary integration
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Timer, Plus, RotateCcw, TrendingUp, TrendingDown, Mic, MicOff, Keyboard, Check, X, Volume2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { RoundDoneAutoAdvance } from '@/components/RoundDoneAutoAdvance';
import { ExercisePurposeBanner } from '@/components/ExercisePurposeBanner';
import { StructuredFeedbackSummary } from '@/components/StructuredFeedbackSummary';
import { cn } from '@/lib/utils';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { AdaptationBadge, useAdaptationShift } from '@/components/AdaptationBadge';
import { LevelBadge } from '@/components/exercise/LevelBadge';
import { AdaptationNarrationCard } from '@/components/AdaptationNarrationCard';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { validateCategoryWord, isExactCategoryMatch, type WordValidation } from '@/data/categoryWordLists';
import { analyzeFluency, buildFluencyFeedback, type FluencyAnalysis } from '@/lib/categoryFluencyAnalysis';
import { pickExamples, pickIdeasForNextTime } from '@/data/categoryExamplePools';
import { useMayaExerciseFrame } from '@/hooks/useMayaExerciseFrame';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import { pickEncouragement } from '@/lib/feedbackPolicy';

// Categories ordered by difficulty
const CATEGORY_TIERS: Array<Array<{ category: string; label: string }>> = [
  // Tier 1 (Easy) — concrete, high-frequency
  [
    { category: 'animals', label: 'Animals' },
    { category: 'foods', label: 'Foods' },
    { category: 'colors', label: 'Colors' },
  ],
  // Tier 2 (Medium) — concrete but narrower
  [
    { category: 'clothes', label: 'Clothing' },
    { category: 'kitchen', label: 'Kitchen Items' },
    { category: 'tools', label: 'Tools' },
    { category: 'vehicles', label: 'Vehicles' },
  ],
  // Tier 3 (Hard) — abstract or narrow
  [
    { category: 'professions', label: 'Jobs' },
    { category: 'emotions', label: 'Emotions' },
    { category: 'sports', label: 'Sports' },
  ],
];

// Timer decreases with difficulty
function getTimerForDifficulty(difficulty: number): number {
  if (difficulty <= 1) return 45;
  if (difficulty <= 2) return 35;
  if (difficulty <= 3) return 30;
  if (difficulty <= 4) return 25;
  return 20;
}

// Cross-session category recency: remember the last N categories the user got
// so we don't open every warmup with "animals". Soft window — once it fills up,
// the oldest entry rolls off and that category becomes eligible again.
const RECENT_CATEGORY_KEY = 'categoryFluency_recentCategories';
const RECENT_WINDOW = 7;

function loadRecentCategories(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CATEGORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(-RECENT_WINDOW) : [];
  } catch { return []; }
}

function rememberCategory(category: string) {
  try {
    const recent = loadRecentCategories().filter(c => c !== category);
    recent.push(category);
    const trimmed = recent.slice(-RECENT_WINDOW);
    localStorage.setItem(RECENT_CATEGORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

function pickCategory(difficulty: number, usedCategories: Set<string> = new Set()) {
  const tierIndex = Math.min(Math.floor((difficulty - 1) / 2), CATEGORY_TIERS.length - 1);
  const tier = CATEGORY_TIERS[Math.max(0, tierIndex)];
  // Combine in-session used + cross-session recent for full freshness gate.
  const recent = new Set([...loadRecentCategories(), ...usedCategories]);
  const unused = tier.filter(c => !recent.has(c.category));
  if (unused.length > 0) return unused[Math.floor(Math.random() * unused.length)];
  // Tier exhausted: try any non-recent category from any tier (still avoiding repeats)
  const allCategories = CATEGORY_TIERS.flat();
  const allUnused = allCategories.filter(c => !recent.has(c.category));
  if (allUnused.length > 0) return allUnused[Math.floor(Math.random() * allUnused.length)];
  // Everything's been seen recently → fall back to in-session-only filter (soft recovery)
  const sessionUnused = tier.filter(c => !usedCategories.has(c.category));
  if (sessionUnused.length > 0) return sessionUnused[Math.floor(Math.random() * sessionUnused.length)];
  usedCategories.clear();
  return tier[Math.floor(Math.random() * tier.length)];
}

function getSuccessThreshold(difficulty: number): number {
  if (difficulty <= 2) return 3;
  if (difficulty <= 4) return 5;
  return 7;
}

export interface CategoryFluencyResult {
  category: string;
  words: string[];
  uniqueWordCount: number;
  wordsPerSecond: number;
  durationSec: number;
  timeLimitSec: number;
  difficulty: number;
  difficultyChanged?: 'up' | 'down' | null;
  analysis?: FluencyAnalysis;
}

interface CategoryFluencyGameProps {
  difficulty?: number;
  onRoundComplete?: (result: CategoryFluencyResult) => void;
  onGameComplete?: (results: CategoryFluencyResult[]) => void;
  onDifficultyChange?: (newLevel: number, direction: 'up' | 'down') => void;
  onFinish?: () => void;
  roundCount?: number;
  bounds?: DifficultyBounds;
  autoStartFirst?: boolean;
  userId?: string;
  sessionId?: string | null;
}

const DEFAULT_BOUNDS: DifficultyBounds = { floor: 1, ceiling: 5, suggestedStart: 1 };

export function CategoryFluencyGame({
  difficulty = 1,
  onRoundComplete,
  onGameComplete,
  onDifficultyChange,
  onFinish,
  roundCount = 3,
  bounds = DEFAULT_BOUNDS,
  autoStartFirst = false,
  userId,
  sessionId,
}: CategoryFluencyGameProps) {
  // Visible adaptation cue + narration
  const { direction: shiftDirection, reason: shiftReason, signal: signalShift } = useAdaptationShift();

  // Engagement monitor — feeds the cue-dependency safety gate.
  // For verbal fluency, "cue dependency" maps to a hesitation/stall signal:
  // long pauses or low output despite time remaining.
  const engagement = useEngagementMonitor(sessionId ?? null);

  const adaptation = useInGameAdaptation({
    exerciseSlug: 'category-fluency',
    sessionId: sessionId ?? null,
    initialDifficulty: difficulty,
    bounds,
    windowSize: 3,
    targetSuccessRate: 0.80,
    adjustmentThreshold: 0.15,
    enableDifficultyToasts: false,
    enableAutoHints: false,
    // Page (CategoryFluencyExercise) now owns the trial logger via
    // useTrialSubmission and tags every row with trialMode:'production'.
    // Disable the auto-logger to prevent duplicate untagged rows.
    autoLog: false,
    getCueDependencyScore: () => {
      const sig = engagement.getState().signals;
      // Use hesitation count as a proxy for needing more support.
      return Math.min(1, sig.hesitationCount / 4);
    },
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.info('[CategoryFluency] escalation blocked', {
        reason,
        cueDependencyScore,
        trialsAtLevel,
      });
    },
    onDifficultyChange: (newLevel, reason, dir) => {
      onDifficultyChange?.(newLevel, dir);
      const narration = narrateAdaptation({
        direction: dir,
        reasonKind: classifyReason(reason),
      });
      signalShift(dir, narration || reason);
    },
  });
  const currentDifficulty = adaptation.currentDifficulty;

  const { buildReflection } = useMayaExerciseFrame({ exerciseSlug: 'category-fluency' });
  const vg = useVoiceGuidance('category-fluency');
  
  // Countdown state for smooth ready → active transition
  // Ref to hold latest beginCountdown — prevents effect cleanup from killing the timeout
  const beginCountdownRef = useRef<() => void>(() => {});
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [results, setResults] = useState<CategoryFluencyResult[]>([]);
  const [phase, setPhase] = useState<'ready' | 'countdown' | 'active' | 'round-done' | 'done'>('ready');
  const usedCategoriesRef = useRef(new Set<string>());
  const [config, setConfig] = useState(() => {
    const cat = pickCategory(currentDifficulty);
    usedCategoriesRef.current.add(cat.category);
    rememberCategory(cat.category);
    return cat;
  });
  const [words, setWords] = useState<Array<{ text: string; status: WordValidation }>>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [difficultyShift, setDifficultyShift] = useState<'up' | 'down' | null>(null);
  const [showTextInput, setShowTextInput] = useState(() => sessionStorage.getItem('preferTypingInput') === 'true');
  const [lastAddedWord, setLastAddedWord] = useState<string | null>(null);

  // Rotating example chips for the current round (3 at a time, drawn from
  // a 12–15 word pool; localStorage avoids repeats across sessions).
  const [exampleChips, setExampleChips] = useState<string[]>(() =>
    pickExamples(config.category, 3),
  );
  // Number of times the user requested fresh examples this round (counted
  // as a cue / support).
  const [exampleSwapCount, setExampleSwapCount] = useState(0);
  const exampleSwapCountRef = useRef(0);
  useEffect(() => { exampleSwapCountRef.current = exampleSwapCount; }, [exampleSwapCount]);

  const [totalTime, setTotalTime] = useState(() => getTimerForDifficulty(currentDifficulty));
  const [timeLeft, setTimeLeft] = useState(totalTime);
  const startTimeRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const wordsRef = useRef<Array<{ text: string; status: WordValidation }>>([]);
  const timerExpiredRef = useRef(false);

  useEffect(() => { wordsRef.current = words; }, [words]);
  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  // === Speech Recognition ===
  const processedRef = useRef(new Set<string>());
  const pendingWordRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const flushPending = useCallback(() => {
    const word = pendingWordRef.current;
    if (!word || processedRef.current.has(word)) {
      pendingWordRef.current = null;
      return;
    }
    processedRef.current.add(word);
    const status = validateCategoryWord(word, config.category);
    if (status !== 'filler') {
      const next = [...wordsRef.current, { text: word, status }];
      wordsRef.current = next;
      setWords(next);
      if (status === 'valid') {
        setLastAddedWord(word);
        setTimeout(() => setLastAddedWord(null), 800);
      }
    }
    pendingWordRef.current = null;
  }, [config.category]);

  // Clean up pending timer on unmount
  useEffect(() => {
    return () => { if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); };
  }, []);

  const handleSpeechResult = useCallback((transcript: string) => {
    if (phase !== 'active') return;

    // Extract all words from transcript
    const allWords = transcript
      .toLowerCase()
      .replace(/[^a-zA-Z' -]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 2);

    const newEntries: Array<{ text: string; status: WordValidation }> = [];

    for (const word of allWords) {
      if (processedRef.current.has(word)) continue;

      // Check if pending + current form a valid compound word
      if (pendingWordRef.current) {
        const bigram = `${pendingWordRef.current} ${word}`;
        if (isExactCategoryMatch(bigram, config.category) && !processedRef.current.has(bigram)) {
          // Clear pending timer — we're consuming the pending word
          if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
          processedRef.current.add(bigram);
          processedRef.current.add(pendingWordRef.current);
          processedRef.current.add(word);
          pendingWordRef.current = null;
          newEntries.push({ text: bigram, status: 'valid' });
          continue;
        }
        // Pending word didn't form a bigram — flush it now
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        flushPending();
      }

      // Hold this word as pending briefly, in case the next word forms a compound
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingWordRef.current = word;
      pendingTimerRef.current = setTimeout(() => flushPending(), 600);
    }

    // Show any fully resolved entries immediately
    if (newEntries.length > 0) {
      const next = [...wordsRef.current, ...newEntries];
      wordsRef.current = next;
      setWords(next);
      const lastValid = newEntries.filter(e => e.status === 'valid').pop();
      if (lastValid) {
        setLastAddedWord(lastValid.text);
        setTimeout(() => setLastAddedWord(null), 800);
      }
    }
  }, [phase, config.category, flushPending]);

  const {
    isListening,
    transcript: liveTranscript,
    startListening,
    stopListening,
    isSupported: speechSupported,
    error: speechError,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    patientMode: true,
    continuousListening: true,
    discourseMode: true,
    autoStart: false,
  });

  // Auto-flip to typing if mic permission is denied — prevents the
  // muted-mic + "Listening…" contradiction.
  useEffect(() => {
    if (speechError && /denied|not-allowed|permission/i.test(speechError) && !showTextInput) {
      setShowTextInput(true);
      sessionStorage.setItem('preferTypingInput', 'true');
    }
  }, [speechError, showTextInput]);

  const finishRound = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    // Flush any pending word before scoring
    if (pendingWordRef.current && !processedRef.current.has(pendingWordRef.current)) {
      const pw = pendingWordRef.current;
      processedRef.current.add(pw);
      const status = validateCategoryWord(pw, config.category);
      if (status !== 'filler') {
        wordsRef.current = [...wordsRef.current, { text: pw, status }];
        setWords(wordsRef.current);
      }
      pendingWordRef.current = null;
    }
    stopListening();

    const durationSec = (Date.now() - startTimeRef.current) / 1000;
    const seen = new Set<string>();
    const validWords: string[] = [];
    for (const entry of wordsRef.current) {
      const normalized = entry.text.toLowerCase().trim();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      if (entry.status === 'valid') validWords.push(normalized);
    }

    const allWordTexts = wordsRef.current.map(w => w.text.toLowerCase().trim());
    const analysis = analyzeFluency(allWordTexts, config.category);

    const threshold = getSuccessThreshold(currentDifficulty);
    const wasSuccessful = validWords.length >= threshold;

    // Cue level for fluency: examples chip strip is always shown (cueLevel: 1).
    // Each "Show different examples" swap is treated as additional support,
    // capped at cueLevel 3.
    const fluencyCueLevel = Math.min(3, 1 + exampleSwapCountRef.current);

    // Feed adaptive engine
    const prevDiff = currentDifficulty;
    adaptation.recordTrial({
      correct: wasSuccessful,
      reactionTimeMs: Math.round(durationSec * 1000),
      cueWasShown: true,
    });

    // Feed engagement monitor for cue dependency / fatigue tracking
    engagement.recordTrial({
      correct: wasSuccessful,
      reactionTimeMs: Math.round(durationSec * 1000),
      cueLevel: fluencyCueLevel,
      timeout: validWords.length === 0,
      timestamp: Date.now(),
    });

    const newLevel = adaptation.currentDifficulty;
    const shift = newLevel > prevDiff ? 'up' : newLevel < prevDiff ? 'down' : null;
    setDifficultyShift(shift);

    const result: CategoryFluencyResult = {
      category: config.category,
      words: validWords,
      uniqueWordCount: validWords.length,
      wordsPerSecond: durationSec > 0 ? validWords.length / durationSec : 0,
      durationSec: Math.round(durationSec),
      timeLimitSec: totalTime,
      difficulty: currentDifficulty,
      difficultyChanged: shift,
      analysis,
    };

    const newResults = [...results, result];
    setResults(newResults);
    onRoundComplete?.(result);

    if (currentRound + 1 >= roundCount) {
      setPhase('done');
      onGameComplete?.(newResults);
      // No spoken feedback on final round — the transition card handles reflection
    } else {
      setPhase('round-done');
      // Spoken feedback between rounds — routed through pickEncouragement so we
      // NEVER praise an empty/near-empty round (clinical safety).
      if (vg.shouldAutoSpeak) {
        const enc = pickEncouragement({
          count: validWords.length,
          empty: validWords.length === 0,
          unit: config.label.toLowerCase(),
        });
        vg.speakIfVoiceLed(enc.text);
      }
    }
  }, [config, totalTime, currentDifficulty, results, currentRound, roundCount, onRoundComplete, onGameComplete, adaptation, engagement, stopListening, vg]);

  // Handle timer expiry outside of setState updater to avoid progress bar glitch
  useEffect(() => {
    if (timeLeft <= 0 && phase === 'active' && timerExpiredRef.current) {
      timerExpiredRef.current = false;
      finishRound();
    }
  }, [timeLeft, phase, finishRound]);

  const startRound = useCallback(() => {
    vg.interrupt(); // Stop any active speech
    const cat = pickCategory(currentDifficulty, usedCategoriesRef.current);
    usedCategoriesRef.current.add(cat.category);
    rememberCategory(cat.category);
    setConfig(cat);
    setWords([]);
    setCurrentInput('');
    setExampleChips(pickExamples(cat.category, 3));
    setExampleSwapCount(0);
    exampleSwapCountRef.current = 0;
    setPhase('active');
    setDifficultyShift(null);
    processedRef.current.clear();
    wordsRef.current = [];
    const newTime = getTimerForDifficulty(currentDifficulty);
    setTotalTime(newTime);
    setTimeLeft(newTime);
    startTimeRef.current = Date.now();
    timerExpiredRef.current = false;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerExpiredRef.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (speechSupported) {
      setTimeout(() => startListening(), 300);
    } else {
      setShowTextInput(true);
    }
  }, [currentDifficulty, speechSupported, startListening, vg]);

  /** Begin the countdown → then auto-start the round */
  const beginCountdown = useCallback(async () => {
    const cat = pickCategory(currentDifficulty, usedCategoriesRef.current);
    // Pre-set config so the category label shows during countdown
    usedCategoriesRef.current.add(cat.category);
    rememberCategory(cat.category);
    setConfig(cat);
    setPhase('countdown');

    // Sync-Wait protocol — await TTS completion before starting the
    // visual countdown so audio never overlaps the 3-2-1 ticks. Falls
    // back to a tiny grace period if TTS fails or is unavailable.
    if (vg.shouldAutoSpeak) {
      try {
        await vg.speakIfVoiceLed(`Name as many ${cat.label.toLowerCase()} as you can.`);
      } catch (err) {
        console.warn('[CategoryFluency] TTS failed before countdown — proceeding silently', err);
      }
    }

    setCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        startRoundWithConfig(cat);
      } else {
        setCountdown(count);
      }
    }, 800);
  }, [currentDifficulty, vg]);

  // Keep ref updated so the auto-start timeout always calls the latest version
  useEffect(() => { beginCountdownRef.current = beginCountdown; }, [beginCountdown]);

  /** Start round with an already-picked config (used after countdown) */
  const startRoundWithConfig = useCallback((cat: { category: string; label: string }) => {
    // Speech already finished before countdown — no need to interrupt
    setWords([]);
    setCurrentInput('');
    setExampleChips(pickExamples(cat.category, 3));
    setExampleSwapCount(0);
    exampleSwapCountRef.current = 0;
    setPhase('active');
    setDifficultyShift(null);
    processedRef.current.clear();
    wordsRef.current = [];
    const newTime = getTimerForDifficulty(currentDifficulty);
    setTotalTime(newTime);
    setTimeLeft(newTime);
    startTimeRef.current = Date.now();
    timerExpiredRef.current = false;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerExpiredRef.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (speechSupported) {
      setTimeout(() => startListening(), 300);
    } else {
      setShowTextInput(true);
    }
  }, [currentDifficulty, speechSupported, startListening, vg]);

  // Auto-start on first mount — ONLY in Full Coaching (voice-led) where Maya
  // narrates the start. In Guided/lesson mode, the patient MUST tap Start so
  // the timer never begins before they're ready (clinical-safety standard).
  // IMPORTANT: beginCountdown is NOT in the dep array — we use a ref instead.
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (!hasStartedRef.current && phase === 'ready' && currentRound === 0 && vg.isVoiceLed) {
      hasStartedRef.current = true;
      const delay = setTimeout(() => beginCountdownRef.current(), 400);
      return () => { clearTimeout(delay); hasStartedRef.current = false; };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentRound, vg.isVoiceLed]);

  const nextRound = useCallback(() => {
    setCurrentRound(prev => prev + 1);
    setWords([]);
    setCurrentInput('');
    const preferTyping = sessionStorage.getItem('preferTypingInput') === 'true';
    setShowTextInput(preferTyping);
    setTimeout(() => beginCountdown(), 300);
  }, [beginCountdown]);

  const addWord = useCallback(() => {
    const word = currentInput.trim().toLowerCase();
    if (!word) return;
    // Dedupe against words already processed (speech or typing)
    if (processedRef.current.has(word)) {
      setCurrentInput('');
      inputRef.current?.focus();
      return;
    }
    const status = validateCategoryWord(word, config.category);
    if (status !== 'filler') {
      processedRef.current.add(word);
      // Sync ref immediately so finishRound (timer) can't miss this entry
      const next = [...wordsRef.current, { text: word, status }];
      wordsRef.current = next;
      setWords(next);
      if (status === 'valid') {
        setLastAddedWord(word);
        setTimeout(() => setLastAddedWord(null), 800);
      }
    }
    setCurrentInput('');
    inputRef.current?.focus();
  }, [currentInput, config.category]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWord();
    }
  }, [addWord]);

  const validWords = words.filter(w => w.status === 'valid');
  const uniqueValidCount = new Set(validWords.map(w => w.text.toLowerCase())).size;

  // Summary data for done phase
  const summaryData = useMemo(() => {
    if (results.length === 0) return null;
    const totalWords = results.reduce((sum, r) => sum + r.uniqueWordCount, 0);
    const allWords = results.flatMap(r => r.words);
    const combinedAnalysis = analyzeFluency(allWords, results[0].category);

    // Merge analyses from all rounds
    const allClusters = results.flatMap(r => r.analysis?.clusters ?? []);
    const totalSwitches = results.reduce((sum, r) => sum + (r.analysis?.switchCount ?? 0), 0);
    const totalPerseverations = results.reduce((sum, r) => sum + (r.analysis?.perseverations ?? 0), 0);

    const accuracy = Math.min(totalWords / (results.length * 5), 1);
    const maya = buildReflection(accuracy);
    const feedback = buildFluencyFeedback(combinedAnalysis, results[0].category);

    return {
      totalWords,
      allClusters,
      totalSwitches,
      totalPerseverations,
      accuracy,
      maya,
      feedback,
      combinedAnalysis,
    };
  }, [results, buildReflection]);

  // Timer progress percentage — clamp to avoid flashing 0% on expiry
  const timerProgress = phase === 'active' && totalTime > 0 ? Math.max((timeLeft / totalTime) * 100, 0) : 100;

  // === COUNTDOWN — smooth speech → 3-2-1 transition ===
  if (phase === 'countdown' || countdown !== null) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12 max-w-sm mx-auto text-center animate-in fade-in duration-300">
        <p className="text-lg font-semibold text-foreground">
          Name as many <strong>{config.label.toLowerCase()}</strong> as you can
        </p>
        {countdown !== null ? (
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-4xl font-bold text-primary animate-in zoom-in duration-300" key={countdown}>
              {countdown}
            </span>
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Volume2 className="w-10 h-10 text-primary animate-pulse" />
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {countdown !== null ? 'Get ready…' : 'Maya is speaking…'}
        </p>
      </div>
    );
  }

  // === READY (manual start — standalone mode only) ===
  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 max-w-sm mx-auto text-center">
        {currentRound === 0 && (
          <ExercisePurposeBanner
            exerciseSlug="category-fluency"
            adaptiveMessage="This helps you practice finding words in a group — like foods, animals, or things around you."
          />
        )}
        <div>
          <p className="text-xl font-bold mb-2">
            Name as many <strong>{config.label.toLowerCase()}</strong> as you can
          </p>
          <p className="text-sm text-muted-foreground">
            {getTimerForDifficulty(currentDifficulty)} seconds • e.g. {exampleChips.join(', ')}…
          </p>
        </div>
        {currentRound > 0 && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm text-muted-foreground">Round {currentRound + 1} of {roundCount}</p>
            {difficultyShift && (
              <Badge variant={difficultyShift === 'up' ? 'default' : 'secondary'} className="text-xs">
                {difficultyShift === 'up' ? (
                  <><TrendingUp className="w-3 h-3 mr-1" /> Getting harder</>
                ) : (
                  <><TrendingDown className="w-3 h-3 mr-1" /> Easing up</>
                )}
              </Badge>
            )}
          </div>
        )}
        <Button size="lg" onClick={beginCountdown} className="min-h-[56px] min-w-[200px] text-base">
          <Mic className="w-5 h-5 mr-2" />
          {currentRound === 0 ? "Start when you're ready" : 'Next Round'}
        </Button>
        {currentRound === 0 && (
          <p className="text-xs text-muted-foreground -mt-3">
            The timer starts after a 3-2-1 countdown.
          </p>
        )}
      </div>
    );
  }

  // === ROUND DONE ===
  if (phase === 'round-done') {
    const lastResult = results[results.length - 1];
    const roundAnalysis = lastResult.analysis;
    const isEmptyRound = lastResult.uniqueWordCount === 0;
    const ideasForNextTime = pickIdeasForNextTime(
      lastResult.category,
      lastResult.words,
      6,
    );
    return (
      <RoundDoneAutoAdvance
        onAdvance={nextRound}
        delayMs={isEmptyRound ? 6000 : 3000}
        buttonLabel={isEmptyRound ? 'Try a different one' : 'Next Round'}
      >
        {isEmptyRound ? (
          <>
            <p className="text-base font-medium text-foreground">That one was tough.</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              No problem — we'll switch to an easier category and give you more time.
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold">{lastResult.uniqueWordCount} {lastResult.uniqueWordCount === 1 ? 'word' : 'words'}</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {lastResult.words.map((w, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{w}</Badge>
              ))}
            </div>
          </>
        )}

        {/* Ideas for next time — surfaces 5–8 unsaid pool words so the user
            takes new vocabulary into the next round. NOT framed as a score
            penalty; this is a learning loop, not "things you missed". */}
        {!isEmptyRound && ideasForNextTime.length > 0 && (
          <div className="w-full max-w-xs space-y-1.5 pt-2">
            <p className="text-xs font-medium text-muted-foreground">
              💡 Ideas for next time
            </p>
            <div className="flex flex-wrap gap-1 justify-center">
              {ideasForNextTime.map((w) => (
                <Badge
                  key={w}
                  variant="outline"
                  className="text-xs font-normal capitalize border-dashed text-muted-foreground"
                >
                  {w}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {roundAnalysis && roundAnalysis.clusterCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {roundAnalysis.clusterCount} group{roundAnalysis.clusterCount > 1 ? 's' : ''} found
            {roundAnalysis.switchCount > 0 && ` • ${roundAnalysis.switchCount} switch${roundAnalysis.switchCount > 1 ? 'es' : ''}`}
          </p>
        )}
        {difficultyShift && (
          <Badge variant={difficultyShift === 'up' ? 'default' : 'secondary'} className="text-xs">
            {difficultyShift === 'up' ? (
              <><TrendingUp className="w-3 h-3 mr-1" /> Next: harder category + less time</>
            ) : (
              <><TrendingDown className="w-3 h-3 mr-1" /> Next: easier category + more time</>
            )}
          </Badge>
        )}
        {shiftDirection && shiftReason && (
          <AdaptationNarrationCard
            direction={shiftDirection}
            message={shiftReason}
            className="mx-auto max-w-xs"
          />
        )}
      </RoundDoneAutoAdvance>
    );
  }

  // === DONE — Structured Summary ===
  if (phase === 'done' && summaryData) {
    return (
      <div className="flex flex-col gap-4 py-4 max-w-md mx-auto">
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold">{summaryData.totalWords} total words</p>
          <p className="text-sm text-muted-foreground">across {results.length} rounds</p>
        </div>

        {/* Per-round breakdown */}
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-muted/50">
              <div>
                <span className="font-medium capitalize">{r.category}</span>
                {r.analysis && r.analysis.clusterCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {r.analysis.clusterCount} group{r.analysis.clusterCount > 1 ? 's' : ''}
                    {r.analysis.switchCount > 0 && ` • ${r.analysis.switchCount} switch${r.analysis.switchCount > 1 ? 'es' : ''}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{r.uniqueWordCount} words</Badge>
                {r.difficultyChanged && (
                  r.difficultyChanged === 'up'
                    ? <TrendingUp className="w-3 h-3 text-primary" />
                    : <TrendingDown className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Clustering insight */}
        {summaryData.allClusters.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
            <p className="text-sm font-medium">Word Groups Found</p>
            <div className="flex flex-wrap gap-1.5">
              {summaryData.allClusters
                .filter((c, i, arr) => arr.findIndex(a => a.subcategory === c.subcategory) === i)
                .slice(0, 6)
                .map((cluster, i) => (
                  <Badge key={i} variant="outline" className="text-xs capitalize">
                    {cluster.subcategory.replace(/_/g, ' ')} ({cluster.words.length})
                  </Badge>
                ))}
            </div>
            {summaryData.totalPerseverations > 0 && (
              <p className="text-xs text-muted-foreground">
                {summaryData.totalPerseverations} repeated word{summaryData.totalPerseverations > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Structured feedback */}
        <StructuredFeedbackSummary
          strengths={summaryData.feedback.strengths}
          weaknesses={summaryData.feedback.weaknesses}
          nextStep={summaryData.feedback.nextStep}
          mayaReflection={summaryData.maya.reflection}
          realLifeLine={summaryData.maya.realLifeLine}
        />

        {onFinish && (
          <Button size="lg" onClick={onFinish} className="min-h-[48px] w-full mt-2">
            Continue
          </Button>
        )}
      </div>
    );
  }

  // === ACTIVE — speech-first with gentler timer ===
  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto">
      {/* Round progress + Category label */}
      <div className="text-center mb-1 space-y-2">
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: roundCount }, (_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i < currentRound ? "bg-primary" :
                i === currentRound ? "bg-primary w-4" :
                "bg-muted-foreground/25"
              )}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            Round {currentRound + 1}/{roundCount}
          </span>
          <LevelBadge descriptor={adaptation.levelDescriptor} compact className="ml-1" />
        </div>
        <p className="text-lg font-semibold text-foreground">Name as many {config.label.toLowerCase()} as you can</p>
        {/* Coaching hint — visible early or when stuck */}
        {timeLeft > totalTime - 6 && (
          <p className="text-xs text-muted-foreground animate-in fade-in duration-500">
            💡 Tip: Think in groups — {
              config.category === 'animals' ? 'pets, farm, ocean…' :
              config.category === 'foods' ? 'fruits, vegetables, meats…' :
              config.category === 'clothes' ? 'tops, shoes, accessories…' :
              config.category === 'kitchen' ? 'utensils, pots, appliances…' :
              config.category === 'tools' ? 'hand tools, power tools, garden…' :
              config.category === 'vehicles' ? 'road, water, air…' :
              config.category === 'professions' ? 'medical, trades, service…' :
              config.category === 'emotions' ? 'happy feelings, sad feelings…' :
              config.category === 'sports' ? 'ball sports, water sports…' :
              'one type, then another…'
            } then jump to the next group
          </p>
        )}
      </div>

      {/* Gentler timer: progress bar + count */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Words:</span>
            <Badge variant="outline" className={cn(
              "transition-all",
              lastAddedWord && "ring-2 ring-primary scale-110"
            )}>
              {uniqueValidCount}
            </Badge>
          </div>
          <div className={cn(
            "flex items-center gap-1 text-sm font-mono tabular-nums",
            timeLeft <= 5 ? 'text-destructive' : 'text-muted-foreground'
          )}>
            <Timer className="w-3.5 h-3.5" />
            {timeLeft}s
          </div>
        </div>
        <Progress
          value={timerProgress}
          className={cn(
            "h-2 transition-all",
            timeLeft <= 5 && "[&>div]:bg-destructive"
          )}
        />
      </div>

      {/* Rotating example chips — 3 at a time, drawn from a 12–15 word pool.
          The user can request a fresh draw via "Show different examples";
          that swap is counted as a cue. Examples are intentionally small
          and unobtrusive so retrieval still comes from the user. */}
      {exampleChips.length > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex flex-wrap gap-1.5 justify-center items-center">
            <span className="text-xs text-muted-foreground mr-1">e.g.</span>
            {exampleChips.map((ex) => (
              <Badge
                key={ex}
                variant="secondary"
                className="text-xs font-normal capitalize bg-muted/60 text-muted-foreground"
              >
                {ex}
              </Badge>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setExampleChips(pickExamples(config.category, 3, exampleChips));
              setExampleSwapCount((n) => n + 1);
              exampleSwapCountRef.current += 1;
            }}
            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Show different examples
          </button>
        </div>
      )}

      {/* Mic status + live transcript */}
      {speechSupported && !showTextInput && (
        <div className="flex flex-col items-center gap-3 py-4">
          <button
            onClick={isListening ? stopListening : startListening}
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center transition-all",
              "border-2 shadow-lg",
              isListening
                ? "bg-primary/10 border-primary animate-pulse shadow-primary/20"
                : "bg-muted border-border hover:border-primary/50"
            )}
            aria-label={isListening ? "Microphone active" : "Start microphone"}
          >
            {isListening ? (
              <Mic className="w-8 h-8 text-primary" />
            ) : (
              <MicOff className="w-8 h-8 text-muted-foreground" />
            )}
          </button>

          {isListening && (
            <p className="text-sm text-muted-foreground animate-pulse">
              {liveTranscript || "Listening \u2014 say words aloud\u2026"}
            </p>
          )}

          {lastAddedWord && (
            <Badge className="animate-in fade-in zoom-in text-sm bg-primary text-primary-foreground">
              \u2713 {lastAddedWord}
            </Badge>
          )}
        </div>
      )}

      {/* Text input fallback */}
      {(showTextInput || !speechSupported) && (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a word + Enter"
            className="min-h-[48px] text-base"
            autoFocus
          />
          <Button size="icon" onClick={addWord} disabled={!currentInput.trim()} className="min-h-[48px] min-w-[48px]">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Toggle between speech and text */}
      {speechSupported && (
        <button
          onClick={() => { const next = !showTextInput; setShowTextInput(next); sessionStorage.setItem('preferTypingInput', String(next)); }}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 self-center"
        >
          {showTextInput ? <Mic className="w-3 h-3" /> : <Keyboard className="w-3 h-3" />}
          {showTextInput ? 'Switch to speech' : 'Switch to typing'}
        </button>
      )}

      {/* Words entered */}
      <div className="flex flex-wrap gap-1.5 min-h-[48px]">
        {words.map((w, i) => (
          <Badge
            key={i}
            variant="outline"
            className={cn(
              "text-sm transition-all flex items-center gap-1",
              w.status === 'valid' && "border-primary/40 bg-primary/5 text-foreground",
              w.status === 'invalid' && "border-muted-foreground/30 bg-muted/30 text-muted-foreground line-through",
              w.text === lastAddedWord && w.status === 'valid' && "ring-1 ring-primary bg-primary/10"
            )}
          >
            {w.status === 'valid' && <Check className="w-3 h-3 text-primary" />}
            {w.status === 'invalid' && <X className="w-3 h-3 text-muted-foreground" />}
            {w.text}
          </Badge>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={finishRound} className="self-end min-h-[44px]">
        Done early
      </Button>
    </div>
  );
}
