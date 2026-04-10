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
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { validateCategoryWord, isExactCategoryMatch, type WordValidation } from '@/data/categoryWordLists';
import { analyzeFluency, buildFluencyFeedback, type FluencyAnalysis } from '@/lib/categoryFluencyAnalysis';
import { useMayaExerciseFrame } from '@/hooks/useMayaExerciseFrame';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import type { DifficultyBounds } from '@/lib/difficultyBounds';

// Categories ordered by difficulty
const CATEGORY_TIERS = [
  // Tier 1 (Easy) — concrete, high-frequency
  [
    { category: 'animals', label: 'Animals', examples: 'dog, cat, horse…' },
    { category: 'foods', label: 'Foods', examples: 'bread, apple, rice…' },
    { category: 'colors', label: 'Colors', examples: 'red, blue, green…' },
  ],
  // Tier 2 (Medium) — concrete but narrower
  [
    { category: 'clothes', label: 'Clothing', examples: 'shirt, hat, shoes…' },
    { category: 'kitchen', label: 'Kitchen Items', examples: 'cup, fork, pan…' },
    { category: 'tools', label: 'Tools', examples: 'hammer, saw, drill…' },
    { category: 'vehicles', label: 'Vehicles', examples: 'car, bus, bike…' },
  ],
  // Tier 3 (Hard) — abstract or narrow
  [
    { category: 'professions', label: 'Jobs', examples: 'doctor, teacher, driver…' },
    { category: 'emotions', label: 'Emotions', examples: 'happy, sad, angry…' },
    { category: 'sports', label: 'Sports', examples: 'soccer, tennis, swimming…' },
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

function pickCategory(difficulty: number, usedCategories: Set<string> = new Set()) {
  const tierIndex = Math.min(Math.floor((difficulty - 1) / 2), CATEGORY_TIERS.length - 1);
  const tier = CATEGORY_TIERS[Math.max(0, tierIndex)];
  const unused = tier.filter(c => !usedCategories.has(c.category));
  if (unused.length > 0) return unused[Math.floor(Math.random() * unused.length)];
  const allCategories = CATEGORY_TIERS.flat();
  const allUnused = allCategories.filter(c => !usedCategories.has(c.category));
  if (allUnused.length > 0) return allUnused[Math.floor(Math.random() * allUnused.length)];
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
  roundCount?: number;
  bounds?: DifficultyBounds;
  autoStartFirst?: boolean;
}

const DEFAULT_BOUNDS: DifficultyBounds = { floor: 1, ceiling: 5, suggestedStart: 1 };

export function CategoryFluencyGame({
  difficulty = 1,
  onRoundComplete,
  onGameComplete,
  onDifficultyChange,
  roundCount = 3,
  bounds = DEFAULT_BOUNDS,
  autoStartFirst = false,
}: CategoryFluencyGameProps) {
  const {
    currentDifficulty,
    updateTrial,
    checkAndAdjust,
  } = useAdaptiveDifficulty({
    initialDifficulty: difficulty,
    bounds,
    windowSize: 3,
    targetSuccessRate: 0.80,
    adjustmentThreshold: 0.15,
    onDifficultyChange: (newLevel) => {
      const dir = newLevel > currentDifficulty ? 'up' : 'down';
      onDifficultyChange?.(newLevel, dir);
    },
  });

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
    return cat;
  });
  const [words, setWords] = useState<Array<{ text: string; status: WordValidation }>>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [difficultyShift, setDifficultyShift] = useState<'up' | 'down' | null>(null);
  const [showTextInput, setShowTextInput] = useState(() => sessionStorage.getItem('preferTypingInput') === 'true');
  const [lastAddedWord, setLastAddedWord] = useState<string | null>(null);

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
      setWords(prev => [...prev, { text: word, status }]);
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
      setWords(prev => [...prev, ...newEntries]);
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
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    patientMode: true,
    continuousListening: true,
    discourseMode: true,
    autoStart: false,
  });

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
    updateTrial(wasSuccessful);

    const prevDiff = currentDifficulty;
    const { newLevel } = checkAndAdjust();
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
      // Spoken feedback between rounds
      if (vg.shouldAutoSpeak) {
        vg.speakIfVoiceLed(`Good — you named ${validWords.length} ${config.label.toLowerCase()}.`);
      }
    }
  }, [config, totalTime, currentDifficulty, results, currentRound, roundCount, onRoundComplete, onGameComplete, updateTrial, checkAndAdjust, stopListening]);

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
    setConfig(cat);
    setWords([]);
    setCurrentInput('');
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
  const beginCountdown = useCallback(() => {
    const cat = pickCategory(currentDifficulty, usedCategoriesRef.current);
    // Pre-set config so the category label shows during countdown
    usedCategoriesRef.current.add(cat.category);
    setConfig(cat);
    setPhase('countdown');
    
    // Speak the category-specific intro in Full Coaching mode (fire-and-forget)
    // Don't await — TTS may fail without gesture context on auto-start,
    // and we don't want to block the countdown
    if (vg.shouldAutoSpeak) {
      vg.speakIfVoiceLed(`Name as many ${cat.label.toLowerCase()} as you can.`);
    }

    // Start 3-2-1 countdown after a brief pause (gives speech time to begin)
    const speechDelay = vg.shouldAutoSpeak ? 2200 : 0;
    setTimeout(() => {
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
    }, speechDelay);
  }, [currentDifficulty, vg]);

  // Keep ref updated so the auto-start timeout always calls the latest version
  useEffect(() => { beginCountdownRef.current = beginCountdown; }, [beginCountdown]);

  /** Start round with an already-picked config (used after countdown) */
  const startRoundWithConfig = useCallback((cat: { category: string; label: string; examples: string }) => {
    // Speech already finished before countdown — no need to interrupt
    setWords([]);
    setCurrentInput('');
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

  // Auto-start on first mount — Full Coaching OR when coming from lesson flow.
  // IMPORTANT: beginCountdown is NOT in the dep array — we use a ref instead.
  // This prevents React cleanup from clearing the timeout when TTS state changes
  // cause useVoiceGuidance to re-render and give beginCountdown a new reference.
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (!hasStartedRef.current && phase === 'ready' && currentRound === 0 && (vg.isVoiceLed || autoStartFirst)) {
      hasStartedRef.current = true;
      const delay = setTimeout(() => beginCountdownRef.current(), 400);
      return () => { clearTimeout(delay); hasStartedRef.current = false; };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentRound, vg.isVoiceLed, autoStartFirst]);

  const nextRound = useCallback(() => {
    setCurrentRound(prev => prev + 1);
    setWords([]);
    setCurrentInput('');
    const preferTyping = sessionStorage.getItem('preferTypingInput') === 'true';
    setShowTextInput(preferTyping);
    setTimeout(() => beginCountdown(), 300);
  }, [beginCountdown]);

  const addWord = useCallback(() => {
    const word = currentInput.trim();
    if (!word) return;
    const status = validateCategoryWord(word, config.category);
    if (status !== 'filler') {
      setWords(prev => [...prev, { text: word, status }]);
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
            {getTimerForDifficulty(currentDifficulty)} seconds • e.g. {config.examples}
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
        <Button size="lg" onClick={beginCountdown} className="min-h-[48px] min-w-[140px]">
          <Mic className="w-4 h-4 mr-2" />
          {currentRound === 0 ? 'Start' : 'Next Round'}
        </Button>
      </div>
    );
  }

  // === ROUND DONE ===
  if (phase === 'round-done') {
    const lastResult = results[results.length - 1];
    const roundAnalysis = lastResult.analysis;
    return (
      <RoundDoneAutoAdvance onAdvance={nextRound}>
        <p className="text-2xl font-bold">{lastResult.uniqueWordCount} {lastResult.uniqueWordCount === 1 ? 'word' : 'words'}</p>
        <div className="flex flex-wrap gap-1 justify-center">
          {lastResult.words.map((w, i) => (
            <Badge key={i} variant="secondary" className="text-xs">{w}</Badge>
          ))}
        </div>
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
        </div>
        <p className="text-lg font-semibold text-foreground">Name as many {config.label.toLowerCase()} as you can</p>
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
