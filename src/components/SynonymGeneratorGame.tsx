/**
 * Synonym Generator v2
 * 
 * Semantic flexibility exercise with:
 * - Purpose framing + Maya integration
 * - Gentler timer (progress bar, not countdown)
 * - Fuzzy + expanded synonym acceptance
 * - Structured per-round and session feedback
 * - Speech-first with text fallback
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Check, X, TrendingUp, TrendingDown, Mic, MicOff, Keyboard, ChevronRight, HelpCircle } from 'lucide-react';
import { ExercisePurposeBanner } from '@/components/ExercisePurposeBanner';
import { StructuredFeedbackSummary } from '@/components/StructuredFeedbackSummary';
import { useMayaExerciseFrame } from '@/hooks/useMayaExerciseFrame';
import { cn } from '@/lib/utils';
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';

// ── Word bank ──
interface SynonymPrompt {
  word: string;
  partOfSpeech: 'adjective' | 'verb' | 'noun' | 'adverb';
  acceptedSynonyms: string[];
  /** Short explanation of why these are synonyms */
  meaningNote: string;
}

const SYNONYM_TIERS: SynonymPrompt[][] = [
  // Tier 1 — concrete, common
  [
    { word: 'happy', partOfSpeech: 'adjective', meaningNote: 'Feeling good or pleased',
      acceptedSynonyms: ['glad', 'joyful', 'cheerful', 'pleased', 'delighted', 'content', 'merry', 'thrilled', 'excited', 'elated', 'joyous', 'blissful', 'satisfied', 'upbeat', 'overjoyed'] },
    { word: 'big', partOfSpeech: 'adjective', meaningNote: 'Large in size',
      acceptedSynonyms: ['large', 'huge', 'enormous', 'giant', 'massive', 'great', 'vast', 'immense', 'tall', 'grand', 'broad', 'wide', 'sizable', 'hefty', 'bulky'] },
    { word: 'fast', partOfSpeech: 'adjective', meaningNote: 'Moving quickly',
      acceptedSynonyms: ['quick', 'rapid', 'speedy', 'swift', 'hasty', 'brisk', 'fleet', 'zippy', 'snappy', 'hurried', 'prompt', 'express', 'nimble'] },
    { word: 'cold', partOfSpeech: 'adjective', meaningNote: 'Low temperature',
      acceptedSynonyms: ['cool', 'chilly', 'freezing', 'icy', 'frigid', 'frosty', 'frozen', 'bitter', 'nippy', 'wintry', 'brisk', 'crisp'] },
    { word: 'small', partOfSpeech: 'adjective', meaningNote: 'Little in size',
      acceptedSynonyms: ['little', 'tiny', 'mini', 'petite', 'minute', 'miniature', 'compact', 'slim', 'slight', 'wee', 'short', 'modest'] },
    { word: 'nice', partOfSpeech: 'adjective', meaningNote: 'Pleasant or kind',
      acceptedSynonyms: ['kind', 'pleasant', 'friendly', 'lovely', 'good', 'agreeable', 'warm', 'sweet', 'caring', 'gentle', 'polite', 'decent', 'gracious'] },
  ],
  // Tier 2 — common but more abstract
  [
    { word: 'smart', partOfSpeech: 'adjective', meaningNote: 'Having intelligence',
      acceptedSynonyms: ['clever', 'intelligent', 'bright', 'sharp', 'wise', 'brilliant', 'brainy', 'gifted', 'knowledgeable', 'astute', 'savvy', 'quick-witted'] },
    { word: 'angry', partOfSpeech: 'adjective', meaningNote: 'Feeling upset or mad',
      acceptedSynonyms: ['mad', 'furious', 'upset', 'irate', 'cross', 'annoyed', 'enraged', 'irritated', 'livid', 'outraged', 'frustrated', 'heated', 'hostile'] },
    { word: 'scared', partOfSpeech: 'adjective', meaningNote: 'Feeling fear',
      acceptedSynonyms: ['afraid', 'frightened', 'terrified', 'fearful', 'startled', 'nervous', 'alarmed', 'anxious', 'panicked', 'worried', 'uneasy', 'spooked'] },
    { word: 'beautiful', partOfSpeech: 'adjective', meaningNote: 'Very pleasing to look at',
      acceptedSynonyms: ['pretty', 'lovely', 'gorgeous', 'stunning', 'attractive', 'elegant', 'handsome', 'striking', 'charming', 'radiant', 'graceful', 'fine'] },
    { word: 'strong', partOfSpeech: 'adjective', meaningNote: 'Having power or strength',
      acceptedSynonyms: ['powerful', 'mighty', 'tough', 'sturdy', 'firm', 'solid', 'robust', 'muscular', 'hardy', 'forceful', 'durable', 'rugged'] },
    { word: 'quiet', partOfSpeech: 'adjective', meaningNote: 'Making little or no noise',
      acceptedSynonyms: ['silent', 'still', 'hushed', 'calm', 'peaceful', 'soft', 'muted', 'gentle', 'tranquil', 'noiseless', 'subdued', 'serene'] },
  ],
  // Tier 3 — abstract, nuanced
  [
    { word: 'important', partOfSpeech: 'adjective', meaningNote: 'Having great value or significance',
      acceptedSynonyms: ['significant', 'crucial', 'vital', 'essential', 'critical', 'key', 'major', 'meaningful', 'valuable', 'serious', 'notable', 'central'] },
    { word: 'difficult', partOfSpeech: 'adjective', meaningNote: 'Hard to do or understand',
      acceptedSynonyms: ['hard', 'tough', 'challenging', 'demanding', 'complex', 'tricky', 'arduous', 'complicated', 'strenuous', 'grueling', 'taxing', 'rough'] },
    { word: 'strange', partOfSpeech: 'adjective', meaningNote: 'Unusual or unexpected',
      acceptedSynonyms: ['weird', 'odd', 'unusual', 'peculiar', 'bizarre', 'curious', 'uncommon', 'rare', 'mysterious', 'abnormal', 'quirky', 'funny', 'different'] },
    { word: 'generous', partOfSpeech: 'adjective', meaningNote: 'Willing to give or share',
      acceptedSynonyms: ['kind', 'giving', 'charitable', 'selfless', 'liberal', 'benevolent', 'unselfish', 'big-hearted', 'magnanimous', 'bountiful', 'gracious', 'open-handed'] },
    { word: 'cautious', partOfSpeech: 'adjective', meaningNote: 'Being careful to avoid risk',
      acceptedSynonyms: ['careful', 'wary', 'guarded', 'prudent', 'watchful', 'alert', 'mindful', 'attentive', 'hesitant', 'vigilant', 'safe', 'deliberate'] },
    { word: 'create', partOfSpeech: 'verb', meaningNote: 'To bring something into existence',
      acceptedSynonyms: ['make', 'build', 'design', 'produce', 'construct', 'develop', 'form', 'invent', 'craft', 'generate', 'compose', 'establish'] },
  ],
];

function getTimerForDifficulty(difficulty: number): number {
  if (difficulty <= 1) return 45;
  if (difficulty <= 2) return 40;
  if (difficulty <= 3) return 35;
  if (difficulty <= 4) return 30;
  return 25;
}

function pickPrompt(difficulty: number, usedWords: Set<string>): SynonymPrompt {
  const tierIndex = Math.min(Math.floor((difficulty - 1) / 2), SYNONYM_TIERS.length - 1);
  const tier = SYNONYM_TIERS[Math.max(0, tierIndex)];
  const available = tier.filter(p => !usedWords.has(p.word));
  const pool = available.length > 0 ? available : tier;
  return pool[Math.floor(Math.random() * pool.length)];
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

interface MatchResult {
  matched: boolean;
  closestSynonym?: string;
  /** 'exact' | 'fuzzy' | 'close' (near-miss, shown as feedback) | 'no' */
  matchType: 'exact' | 'fuzzy' | 'close' | 'no';
}

function checkSynonymDetailed(input: string, prompt: SynonymPrompt): MatchResult {
  const normalized = input.toLowerCase().trim().replace(/[-_]/g, ' ');
  if (normalized.length < 2) return { matched: false, matchType: 'no' };
  if (normalized === prompt.word.toLowerCase()) return { matched: false, matchType: 'no' };

  // Exact match
  for (const s of prompt.acceptedSynonyms) {
    const syn = s.toLowerCase().replace(/[-_]/g, ' ');
    if (syn === normalized) return { matched: true, closestSynonym: s, matchType: 'exact' };
  }

  // Fuzzy match (edit distance)
  let bestDist = Infinity;
  let bestSyn = '';
  for (const s of prompt.acceptedSynonyms) {
    const syn = s.toLowerCase().replace(/[-_]/g, ' ');
    const dist = levenshtein(syn, normalized);
    if (dist < bestDist) { bestDist = dist; bestSyn = s; }
  }

  const maxDist = Math.max(bestSyn.length, normalized.length) >= 6 ? 2 : 1;
  if (bestDist <= maxDist) return { matched: true, closestSynonym: bestSyn, matchType: 'fuzzy' };

  // Close miss (dist 2-3) — not accepted but shown as "close"
  if (bestDist <= 3) return { matched: false, closestSynonym: bestSyn, matchType: 'close' };

  return { matched: false, matchType: 'no' };
}

function getSuccessThreshold(difficulty: number): number {
  if (difficulty <= 2) return 2;
  if (difficulty <= 4) return 3;
  return 4;
}

export interface SynonymRoundResult {
  targetWord: string;
  enteredWords: string[];
  matchedSynonyms: string[];
  unmatchedEntries: string[];
  matchCount: number;
  totalEntered: number;
  durationSec: number;
  timeLimitSec: number;
  difficulty: number;
  difficultyChanged?: 'up' | 'down' | null;
}

interface SynonymGeneratorGameProps {
  difficulty?: number;
  onRoundComplete?: (result: SynonymRoundResult) => void;
  onGameComplete?: (results: SynonymRoundResult[]) => void;
  onDifficultyChange?: (newLevel: number, direction: 'up' | 'down') => void;
  roundCount?: number;
  bounds?: DifficultyBounds;
  autoStartFirst?: boolean;
  userId?: string;
  sessionId?: string | null;
}

const DEFAULT_BOUNDS: DifficultyBounds = { floor: 1, ceiling: 10, suggestedStart: 1 };

export function SynonymGeneratorGame({
  difficulty = 1,
  onRoundComplete,
  onGameComplete,
  onDifficultyChange,
  roundCount = 3,
  bounds = DEFAULT_BOUNDS,
  autoStartFirst = false,
  userId,
  sessionId,
}: SynonymGeneratorGameProps) {
  const engagement = useEngagementMonitor(sessionId || null);
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
      if (import.meta.env.DEV) {
        console.log(`[SynonymGenerator] L${currentDifficulty} → L${newLevel}, reason: adaptive`);
      }
      onDifficultyChange?.(newLevel, dir);
    },
    userId,
    sessionId,
    exerciseSlug: 'synonym-generator',
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
  });

  const { buildReflection } = useMayaExerciseFrame({ exerciseSlug: 'synonym-generator' });
  const vg = useVoiceGuidance('synonym-generator');

  const [countdown, setCountdown] = useState<number | null>(null);
  // Ref to hold latest beginCountdown — prevents effect cleanup from killing the timeout
  const beginCountdownRef = useRef<() => void>(() => {});
  const [currentRound, setCurrentRound] = useState(0);
  const [results, setResults] = useState<SynonymRoundResult[]>([]);
  const [phase, setPhase] = useState<'ready' | 'active' | 'round-feedback' | 'done'>('ready');
  const usedWordsRef = useRef(new Set<string>());
  const [prompt, setPrompt] = useState(() => pickPrompt(currentDifficulty, usedWordsRef.current));
  const [words, setWords] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [difficultyShift, setDifficultyShift] = useState<'up' | 'down' | null>(null);
  const [showTextInput, setShowTextInput] = useState(() => sessionStorage.getItem('preferTypingInput') === 'true');
  const [lastAddedWord, setLastAddedWord] = useState<string | null>(null);

  const totalTime = getTimerForDifficulty(currentDifficulty);
  const [timeLeft, setTimeLeft] = useState(totalTime);
  const startTimeRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const wordsRef = useRef<string[]>([]);

  useEffect(() => { wordsRef.current = words; }, [words]);
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Speech
  const processedRef = useRef(new Set<string>());

  const handleSpeechResult = useCallback((transcript: string) => {
    if (phase !== 'active') return;
    const spokenWords = transcript
      .toLowerCase()
      .split(/[\s,]+/)
      .map(w => w.trim().replace(/[^a-zA-Z'-]/g, ''))
      .filter(w => w.length >= 2);

    const newWords: string[] = [];
    for (const word of spokenWords) {
      if (!processedRef.current.has(word)) {
        processedRef.current.add(word);
        newWords.push(word);
      }
    }

    if (newWords.length > 0) {
      setWords(prev => [...prev, ...newWords]);
      setLastAddedWord(newWords[newWords.length - 1]);
      setTimeout(() => setLastAddedWord(null), 800);
    }
  }, [phase]);

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

  const buildResult = useCallback((): SynonymRoundResult => {
    const durationSec = (Date.now() - startTimeRef.current) / 1000;
    const unique = [...new Set(wordsRef.current.map(w => w.toLowerCase().trim()))].filter(Boolean);
    const matched = unique.filter(w => checkSynonymDetailed(w, prompt).matched);
    const unmatched = unique.filter(w => !checkSynonymDetailed(w, prompt).matched);

    return {
      targetWord: prompt.word,
      enteredWords: unique,
      matchedSynonyms: matched,
      unmatchedEntries: unmatched,
      matchCount: matched.length,
      totalEntered: unique.length,
      durationSec: Math.round(durationSec),
      timeLimitSec: totalTime,
      difficulty: currentDifficulty,
    };
  }, [prompt, totalTime, currentDifficulty]);

  const finishRound = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopListening();
    const result = buildResult();

    const threshold = getSuccessThreshold(currentDifficulty);
    const wasSuccessful = result.matchCount >= threshold;
    const reactionMs = Math.round(result.durationSec * 1000);
    updateTrial(wasSuccessful, reactionMs);
    engagement.recordTrial({ correct: wasSuccessful, reactionTimeMs: reactionMs, timeout: false, cueLevel: 0, timestamp: Date.now() });

    const prevDiff = currentDifficulty;
    const { newLevel } = checkAndAdjust();
    const shift = newLevel > prevDiff ? 'up' : newLevel < prevDiff ? 'down' : null;
    setDifficultyShift(shift);
    result.difficultyChanged = shift;

    const newResults = [...results, result];
    setResults(newResults);
    onRoundComplete?.(result);

    if (currentRound + 1 >= roundCount) {
      setPhase('done');
      onGameComplete?.(newResults);
    } else {
      setPhase('round-feedback');
    }
  }, [buildResult, results, currentRound, roundCount, onRoundComplete, onGameComplete, currentDifficulty, updateTrial, checkAndAdjust, stopListening]);

  /** Start round with a given prompt (used after countdown) */
  const startRoundWithPrompt = useCallback((p: SynonymPrompt) => {
    vg.interrupt();
    setWords([]);
    setCurrentInput('');
    setPhase('active');
    setDifficultyShift(null);
    processedRef.current.clear();
    wordsRef.current = [];
    const newTime = getTimerForDifficulty(currentDifficulty);
    setTimeLeft(newTime);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { finishRound(); return 0; }
        return prev - 1;
      });
    }, 1000);

    if (speechSupported) {
      setTimeout(() => startListening(), 300);
    } else {
      setShowTextInput(true);
    }
  }, [currentDifficulty, finishRound, speechSupported, startListening, vg]);

  /** Begin the countdown → then auto-start the round */
  const beginCountdown = useCallback(() => {
    const newPrompt = pickPrompt(currentDifficulty, usedWordsRef.current);
    usedWordsRef.current.add(newPrompt.word);
    setPrompt(newPrompt);
    setPhase('countdown' as any);

    // Speak the word-specific intro
    if (vg.shouldAutoSpeak) {
      vg.speakIfVoiceLed(`Tell me words that mean the same as "${newPrompt.word}".`);
    }

    // 3-2-1 countdown
    setCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        startRoundWithPrompt(newPrompt);
      } else {
        setCountdown(count);
      }
    }, 800);
  }, [currentDifficulty, vg, startRoundWithPrompt]);

  // Keep ref updated so the auto-start timeout always calls the latest version
  useEffect(() => { beginCountdownRef.current = beginCountdown; }, [beginCountdown]);

  // Legacy startRound for manual start (falls through to countdown)
  const startRound = useCallback(() => {
    beginCountdown();
  }, [beginCountdown]);

  // Auto-start on first mount — only in Full Coaching mode.
  // IMPORTANT: beginCountdown is NOT in the dep array — we use a ref instead.
  // This prevents React cleanup from clearing the timeout when TTS state changes
  // cause useVoiceGuidance to re-render and give beginCountdown a new reference.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStartedRef.current && phase === 'ready' && currentRound === 0 && vg.isVoiceLed) {
      autoStartedRef.current = true;
      const delay = setTimeout(() => beginCountdownRef.current(), 400);
      return () => { clearTimeout(delay); autoStartedRef.current = false; };
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
    const word = currentInput.trim();
    if (!word) return;
    setWords(prev => [...prev, word]);
    setCurrentInput('');
    inputRef.current?.focus();
  }, [currentInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addWord(); }
  }, [addWord]);

  const wordStatuses = useMemo(() => {
    return words.map(w => {
      const result = checkSynonymDetailed(w, prompt);
      return { word: w, ...result };
    });
  }, [words, prompt]);

  const matchCount = wordStatuses.filter(w => w.matched).length;

  // === COUNTDOWN — smooth 3-2-1 transition ===
  if (countdown !== null) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12 max-w-sm mx-auto text-center animate-in fade-in duration-300">
        <p className="text-lg font-semibold text-foreground">
          Words that mean the same as <strong className="text-primary">{prompt.word}</strong>
        </p>
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-4xl font-bold text-primary animate-in zoom-in duration-300" key={countdown}>
            {countdown}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Get ready…</p>
      </div>
    );
  }

  // === READY (manual start — standalone mode only) ===
  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 max-w-sm mx-auto text-center">
        {currentRound === 0 && (
          <ExercisePurposeBanner exerciseSlug="synonym-generator" />
        )}
        <div>
          <p className="text-xl font-bold mb-2">
            Words that mean the same as <strong className="text-primary">{prompt.word}</strong>
          </p>
          <p className="text-xs text-muted-foreground italic">({prompt.partOfSpeech}) — {prompt.meaningNote}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Say or type as many similar words as you can
          </p>
        </div>
        {!speechSupported && (
          <p className="text-xs text-destructive/70">Speech not available — you'll type instead</p>
        )}
        <Button size="lg" onClick={beginCountdown} className="min-h-[48px] min-w-[140px]">
          <Mic className="w-4 h-4 mr-2" />
          {currentRound === 0 ? 'Start' : 'Next Word'}
        </Button>
      </div>
    );
  }

  // ── Round feedback ──
  if (phase === 'round-feedback') {
    const lastResult = results[results.length - 1];
    const threshold = getSuccessThreshold(currentDifficulty);
    const wasGood = lastResult.matchCount >= threshold;

    return (
      <div className="flex flex-col items-center gap-4 py-6 max-w-md mx-auto">
        <div className="text-center space-y-1">
          <p className="text-2xl font-bold">
            {lastResult.matchCount} synonym{lastResult.matchCount !== 1 ? 's' : ''} found
          </p>
          <p className="text-sm text-muted-foreground">for "{lastResult.targetWord}"</p>
        </div>

        {/* Word-by-word feedback */}
        <div className="w-full space-y-1.5">
          {lastResult.enteredWords.map((w, i) => {
            const result = checkSynonymDetailed(w, prompt);
            return (
              <div key={i} className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                result.matched ? 'bg-primary/5 border border-primary/20' : 
                result.matchType === 'close' ? 'bg-accent/50 border border-accent/30' :
                'bg-muted/30 border border-border/50'
              )}>
                {result.matched ? (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                ) : result.matchType === 'close' ? (
                  <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                )}
                <span className={cn("font-medium", !result.matched && "text-muted-foreground")}>{w}</span>
                {result.matchType === 'fuzzy' && result.closestSynonym && (
                  <span className="text-xs text-muted-foreground ml-auto">≈ {result.closestSynonym}</span>
                )}
                {result.matchType === 'close' && result.closestSynonym && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    Close to "{result.closestSynonym}"
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Show some accepted synonyms they missed */}
        {lastResult.matchCount < 4 && (
          <div className="w-full text-sm">
            <p className="text-muted-foreground mb-1">Other options:</p>
            <div className="flex flex-wrap gap-1.5">
              {prompt.acceptedSynonyms
                .filter(s => !lastResult.matchedSynonyms.includes(s.toLowerCase()))
                .slice(0, 4)
                .map(s => (
                  <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                ))}
            </div>
          </div>
        )}

        {difficultyShift && (
          <Badge variant={difficultyShift === 'up' ? 'default' : 'secondary'} className="text-xs">
            {difficultyShift === 'up' ? (
              <><TrendingUp className="w-3 h-3 mr-1" /> Next: harder words</>
            ) : (
              <><TrendingDown className="w-3 h-3 mr-1" /> Next: easier words</>
            )}
          </Badge>
        )}

        <Button size="lg" onClick={nextRound} className="min-h-[48px] min-w-[140px]">
          Next Word <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  // ── Done — structured summary ──
  if (phase === 'done') {
    const totalMatched = results.reduce((sum, r) => sum + r.matchCount, 0);
    const totalEntered = results.reduce((sum, r) => sum + r.totalEntered, 0);
    const accuracy = totalEntered > 0 ? totalMatched / totalEntered : 0;
    const maya = buildReflection(totalMatched >= results.length * 2 ? 0.8 : totalMatched >= results.length ? 0.5 : 0.3);

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (totalMatched >= results.length * 3) {
      strengths.push(`Strong vocabulary — ${totalMatched} synonyms across ${results.length} words`);
    } else if (totalMatched >= results.length * 2) {
      strengths.push(`Good synonym retrieval — ${totalMatched} total matches`);
    }

    if (accuracy >= 0.7) {
      strengths.push('High accuracy — most words you said were valid synonyms');
    }

    const bestRound = results.reduce((best, r) => r.matchCount > best.matchCount ? r : best, results[0]);
    if (bestRound.matchCount >= 3) {
      strengths.push(`Best round: "${bestRound.targetWord}" with ${bestRound.matchCount} synonyms`);
    }

    const worstRound = results.reduce((worst, r) => r.matchCount < worst.matchCount ? r : worst, results[0]);
    if (worstRound.matchCount <= 1) {
      weaknesses.push(`"${worstRound.targetWord}" was harder — try thinking of simpler alternatives`);
    }

    if (accuracy < 0.5 && totalEntered > 3) {
      weaknesses.push('Some words were not close enough — focus on meaning, not just association');
    }

    if (strengths.length === 0) strengths.push(`Completed ${results.length} rounds — each attempt builds flexibility`);

    return (
      <div className="space-y-4 max-w-md mx-auto py-4">
        <div className="text-center space-y-2">
          <div className="text-4xl">🔄</div>
          <h2 className="text-xl font-bold">Session Complete</h2>
          <p className="text-2xl font-bold text-primary">{totalMatched} synonyms found</p>
        </div>

        {/* Round breakdown */}
        <Card>
          <CardContent className="pt-4 space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground/80">"{r.targetWord}"</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.matchCount} found</span>
                  {r.difficultyChanged === 'up' && <TrendingUp className="w-3 h-3 text-primary" />}
                  {r.difficultyChanged === 'down' && <TrendingDown className="w-3 h-3 text-muted-foreground" />}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <StructuredFeedbackSummary
          strengths={strengths}
          weaknesses={weaknesses}
          nextStep={maya.nextStep}
          mayaReflection={maya.reflection}
          realLifeLine={maya.realLifeLine}
        />
      </div>
    );
  }

  // ── Active round ──
  const timerPct = (timeLeft / totalTime) * 100;

  return (
    <div className="flex flex-col gap-3 max-w-md mx-auto">
      {/* Target word */}
      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">Words that mean the same as:</p>
        <p className="text-3xl font-bold text-primary">{prompt.word}</p>
        <p className="text-xs text-muted-foreground italic">{prompt.meaningNote}</p>
      </div>

      {/* Gentle timer bar + match count */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>{matchCount} matched</span>
          <span>{timeLeft}s</span>
        </div>
        <Progress
          value={timerPct}
          className={cn("h-2 transition-all", timeLeft <= 5 && "animate-pulse")}
        />
      </div>

      {/* Speech mic */}
      {speechSupported && !showTextInput && (
        <div className="flex flex-col items-center gap-3 py-3">
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
              {liveTranscript || "Listening — say synonyms aloud…"}
            </p>
          )}
          {lastAddedWord && (
            <Badge className={cn(
              "animate-in fade-in zoom-in text-sm",
              checkSynonymDetailed(lastAddedWord, prompt).matched
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              {checkSynonymDetailed(lastAddedWord, prompt).matched ? '✓' : '○'} {lastAddedWord}
            </Badge>
          )}
        </div>
      )}

      {/* Text input */}
      {(showTextInput || !speechSupported) && (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a synonym + Enter"
            className="min-h-[48px] text-base"
            autoFocus
          />
          <Button size="icon" onClick={addWord} disabled={!currentInput.trim()} className="min-h-[48px] min-w-[48px]">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Toggle input mode */}
      {speechSupported && (
        <button
          onClick={() => { const next = !showTextInput; setShowTextInput(next); sessionStorage.setItem('preferTypingInput', String(next)); }}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 self-center"
        >
          {showTextInput ? <Mic className="w-3 h-3" /> : <Keyboard className="w-3 h-3" />}
          {showTextInput ? 'Switch to speech' : 'Switch to typing'}
        </button>
      )}

      {/* Words with live feedback */}
      <div className="flex flex-wrap gap-1.5 min-h-[40px]">
        {wordStatuses.map((ws, i) => (
          <Badge
            key={i}
            variant={ws.matched ? 'default' : 'outline'}
            className={cn(
              "text-sm transition-all",
              ws.matched && "bg-primary/90",
              ws.matchType === 'close' && "border-primary/40",
              ws.word === lastAddedWord && "ring-1 ring-primary"
            )}
          >
            {ws.matched && <Check className="w-3 h-3 mr-1" />}
            {ws.matchType === 'close' && <HelpCircle className="w-3 h-3 mr-1" />}
            {ws.word}
          </Badge>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={finishRound} className="self-end min-h-[44px]">
        Done early
      </Button>
    </div>
  );
}
