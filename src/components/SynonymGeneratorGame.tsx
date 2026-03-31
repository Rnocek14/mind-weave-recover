/**
 * Synonym Generator Game
 * 
 * "Give as many synonyms for [word] as you can"
 * PRIMARY INPUT: Speech (microphone) — say synonyms aloud
 * FALLBACK: Text input for accessibility
 * Adaptive: harder words + shrinking timer with difficulty
 * Trial-by-trial adaptation via useAdaptiveDifficulty
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Timer, Plus, ThumbsUp, RotateCcw, Check, X, TrendingUp, TrendingDown, Mic, MicOff, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import type { DifficultyBounds } from '@/lib/difficultyBounds';

// Word banks by difficulty tier with accepted synonyms
interface SynonymPrompt {
  word: string;
  acceptedSynonyms: string[];
}

const SYNONYM_TIERS: SynonymPrompt[][] = [
  // Tier 1 (Easy) — common, concrete
  [
    { word: 'happy', acceptedSynonyms: ['glad', 'joyful', 'cheerful', 'pleased', 'delighted', 'content', 'merry', 'thrilled', 'excited', 'elated', 'joyous', 'blissful'] },
    { word: 'big', acceptedSynonyms: ['large', 'huge', 'enormous', 'giant', 'massive', 'great', 'vast', 'immense', 'tall', 'grand', 'broad', 'wide'] },
    { word: 'fast', acceptedSynonyms: ['quick', 'rapid', 'speedy', 'swift', 'hasty', 'brisk', 'fleet', 'zippy', 'snappy', 'hurried'] },
    { word: 'cold', acceptedSynonyms: ['cool', 'chilly', 'freezing', 'icy', 'frigid', 'frosty', 'frozen', 'bitter', 'nippy', 'wintry'] },
    { word: 'small', acceptedSynonyms: ['little', 'tiny', 'mini', 'petite', 'minute', 'miniature', 'compact', 'slim', 'slight', 'wee'] },
    { word: 'nice', acceptedSynonyms: ['kind', 'pleasant', 'friendly', 'lovely', 'good', 'agreeable', 'warm', 'sweet', 'caring', 'gentle'] },
  ],
  // Tier 2 (Medium) — common but more abstract
  [
    { word: 'smart', acceptedSynonyms: ['clever', 'intelligent', 'bright', 'sharp', 'wise', 'brilliant', 'brainy', 'gifted', 'knowledgeable', 'astute'] },
    { word: 'angry', acceptedSynonyms: ['mad', 'furious', 'upset', 'irate', 'cross', 'annoyed', 'enraged', 'irritated', 'livid', 'outraged'] },
    { word: 'scared', acceptedSynonyms: ['afraid', 'frightened', 'terrified', 'fearful', 'startled', 'nervous', 'alarmed', 'anxious', 'panicked', 'worried'] },
    { word: 'beautiful', acceptedSynonyms: ['pretty', 'lovely', 'gorgeous', 'stunning', 'attractive', 'elegant', 'handsome', 'striking', 'charming', 'radiant'] },
    { word: 'strong', acceptedSynonyms: ['powerful', 'mighty', 'tough', 'sturdy', 'firm', 'solid', 'robust', 'muscular', 'hardy', 'forceful'] },
    { word: 'quiet', acceptedSynonyms: ['silent', 'still', 'hushed', 'calm', 'peaceful', 'soft', 'muted', 'gentle', 'tranquil', 'noiseless'] },
  ],
  // Tier 3 (Hard) — abstract, nuanced
  [
    { word: 'important', acceptedSynonyms: ['significant', 'crucial', 'vital', 'essential', 'critical', 'key', 'major', 'meaningful', 'valuable', 'serious'] },
    { word: 'difficult', acceptedSynonyms: ['hard', 'tough', 'challenging', 'demanding', 'complex', 'tricky', 'arduous', 'complicated', 'strenuous', 'grueling'] },
    { word: 'strange', acceptedSynonyms: ['weird', 'odd', 'unusual', 'peculiar', 'bizarre', 'curious', 'uncommon', 'rare', 'mysterious', 'abnormal'] },
    { word: 'generous', acceptedSynonyms: ['kind', 'giving', 'charitable', 'selfless', 'liberal', 'benevolent', 'unselfish', 'big-hearted', 'magnanimous', 'bountiful'] },
    { word: 'cautious', acceptedSynonyms: ['careful', 'wary', 'guarded', 'prudent', 'watchful', 'alert', 'mindful', 'attentive', 'hesitant', 'vigilant'] },
    { word: 'create', acceptedSynonyms: ['make', 'build', 'design', 'produce', 'construct', 'develop', 'form', 'invent', 'craft', 'generate'] },
  ],
];

function getTimerForDifficulty(difficulty: number): number {
  if (difficulty <= 1) return 40;
  if (difficulty <= 2) return 35;
  if (difficulty <= 3) return 30;
  if (difficulty <= 4) return 25;
  return 20;
}

function pickPrompt(difficulty: number, usedWords: Set<string>): SynonymPrompt {
  const tierIndex = Math.min(Math.floor((difficulty - 1) / 2), SYNONYM_TIERS.length - 1);
  const tier = SYNONYM_TIERS[Math.max(0, tierIndex)];
  const available = tier.filter(p => !usedWords.has(p.word));
  const pool = available.length > 0 ? available : tier;
  return pool[Math.floor(Math.random() * pool.length)];
}

function checkSynonym(input: string, prompt: SynonymPrompt): boolean {
  const normalized = input.toLowerCase().trim().replace(/[-_]/g, ' ');
  if (normalized === prompt.word.toLowerCase()) return false;
  return prompt.acceptedSynonyms.some(s =>
    s.toLowerCase().replace(/[-_]/g, ' ') === normalized
  );
}

/** Success threshold scales with difficulty */
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
}

const DEFAULT_BOUNDS: DifficultyBounds = { floor: 1, ceiling: 5, suggestedStart: 1 };

export function SynonymGeneratorGame({
  difficulty = 1,
  onRoundComplete,
  onGameComplete,
  onDifficultyChange,
  roundCount = 3,
  bounds = DEFAULT_BOUNDS,
}: SynonymGeneratorGameProps) {
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

  const [currentRound, setCurrentRound] = useState(0);
  const [results, setResults] = useState<SynonymRoundResult[]>([]);
  const [phase, setPhase] = useState<'ready' | 'active' | 'round-done' | 'done'>('ready');
  const usedWordsRef = useRef(new Set<string>());
  const [prompt, setPrompt] = useState(() => pickPrompt(currentDifficulty, usedWordsRef.current));
  const [words, setWords] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [difficultyShift, setDifficultyShift] = useState<'up' | 'down' | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
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

  // === Speech Recognition ===
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
    const matched = unique.filter(w => checkSynonym(w, prompt));
    const unmatched = unique.filter(w => !checkSynonym(w, prompt));

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
    updateTrial(wasSuccessful);

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
      setPhase('round-done');
    }
  }, [buildResult, results, currentRound, roundCount, onRoundComplete, onGameComplete, currentDifficulty, updateTrial, checkAndAdjust, stopListening]);

  const startRound = useCallback(() => {
    const newPrompt = pickPrompt(currentDifficulty, usedWordsRef.current);
    setPrompt(newPrompt);
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
        if (prev <= 1) {
          finishRound();
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
  }, [currentDifficulty, finishRound, speechSupported, startListening]);

  const nextRound = useCallback(() => {
    setCurrentRound(prev => prev + 1);
    usedWordsRef.current.add(prompt.word);
    setWords([]);
    setCurrentInput('');
    setPhase('ready');
    setShowTextInput(false);
  }, [prompt.word]);

  const addWord = useCallback(() => {
    const word = currentInput.trim();
    if (!word) return;
    setWords(prev => [...prev, word]);
    setCurrentInput('');
    inputRef.current?.focus();
  }, [currentInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWord();
    }
  }, [addWord]);

  const wordStatuses = useMemo(() => {
    return words.map(w => ({
      word: w,
      isMatch: checkSynonym(w, prompt),
    }));
  }, [words, prompt]);

  const matchCount = wordStatuses.filter(w => w.isMatch).length;

  // Ready
  if (phase === 'ready') {
    const nextPrompt = pickPrompt(currentDifficulty, usedWordsRef.current);
    const timer = getTimerForDifficulty(currentDifficulty);
    return (
      <div className="flex flex-col items-center gap-5 py-8 max-w-sm mx-auto text-center">
        <div className="text-5xl">🔄</div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Think of synonyms for:</p>
          <p className="text-3xl font-bold text-primary">{nextPrompt.word}</p>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>Say</strong> as many words with a similar meaning as you can in {timer} seconds
          </p>
        </div>
        {!speechSupported && (
          <p className="text-xs text-amber-600">
            Speech not available — you'll type instead
          </p>
        )}
        {currentRound > 0 && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm text-muted-foreground">Round {currentRound + 1} of {roundCount}</p>
            {difficultyShift && (
              <Badge variant={difficultyShift === 'up' ? 'default' : 'secondary'} className="text-xs">
                {difficultyShift === 'up' ? (
                  <><TrendingUp className="w-3 h-3 mr-1" /> Harder words + less time</>
                ) : (
                  <><TrendingDown className="w-3 h-3 mr-1" /> Easier words + more time</>
                )}
              </Badge>
            )}
          </div>
        )}
        <Button size="lg" onClick={startRound} className="min-h-[48px] min-w-[140px]">
          <Mic className="w-4 h-4 mr-2" />
          {currentRound === 0 ? 'Start' : 'Next Word'}
        </Button>
      </div>
    );
  }

  // Round done
  if (phase === 'round-done') {
    const lastResult = results[results.length - 1];
    return (
      <div className="flex flex-col items-center gap-4 py-8 max-w-sm mx-auto text-center">
        <ThumbsUp className="w-10 h-10 text-primary" />
        <p className="text-2xl font-bold">{lastResult.matchCount} synonyms found!</p>
        <p className="text-sm text-muted-foreground">for "{lastResult.targetWord}"</p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {lastResult.enteredWords.map((w, i) => {
            const isMatch = lastResult.matchedSynonyms.includes(w);
            return (
              <Badge key={i} variant={isMatch ? 'default' : 'outline'} className={cn("text-xs", !isMatch && "opacity-60")}>
                {isMatch ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                {w}
              </Badge>
            );
          })}
        </div>
        {difficultyShift && (
          <Badge variant={difficultyShift === 'up' ? 'default' : 'secondary'} className="text-xs">
            {difficultyShift === 'up' ? (
              <><TrendingUp className="w-3 h-3 mr-1" /> Next round: harder words</>
            ) : (
              <><TrendingDown className="w-3 h-3 mr-1" /> Next round: easier words</>
            )}
          </Badge>
        )}
        <Button onClick={nextRound} className="min-h-[48px]">
          <RotateCcw className="w-4 h-4 mr-2" />
          Next Word
        </Button>
      </div>
    );
  }

  // Done
  if (phase === 'done') {
    const totalMatched = results.reduce((sum, r) => sum + r.matchCount, 0);
    return (
      <div className="flex flex-col items-center gap-4 py-8 max-w-sm mx-auto text-center">
        <div className="text-5xl">🏆</div>
        <p className="text-2xl font-bold">{totalMatched} synonyms total</p>
        <div className="space-y-3 w-full">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2 rounded-lg bg-muted/50">
              <span className="font-medium">"{r.targetWord}"</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{r.matchCount} found</Badge>
                {r.difficultyChanged && (
                  r.difficultyChanged === 'up'
                    ? <TrendingUp className="w-3 h-3 text-primary" />
                    : <TrendingDown className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Active — speech-first with text fallback
  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto">
      {/* Prompt word */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Synonyms for:</p>
        <p className="text-2xl font-bold text-primary">{prompt.word}</p>
      </div>

      {/* Timer + count */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={cn(
          "transition-all",
          lastAddedWord && "ring-2 ring-primary scale-110"
        )}>
          {matchCount} matched
        </Badge>
        <div className={cn(
          "flex items-center gap-1 text-lg font-mono font-bold tabular-nums",
          timeLeft <= 5 ? 'text-destructive animate-pulse' : 'text-muted-foreground'
        )}>
          <Timer className="w-4 h-4" />
          {timeLeft}s
        </div>
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
              {liveTranscript || "Listening — say synonyms aloud…"}
            </p>
          )}

          {lastAddedWord && (
            <Badge className={cn(
              "animate-in fade-in zoom-in text-sm",
              checkSynonym(lastAddedWord, prompt)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              {checkSynonym(lastAddedWord, prompt) ? '✓' : '○'} {lastAddedWord}
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
            placeholder="Type a synonym + Enter"
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
          onClick={() => setShowTextInput(!showTextInput)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 self-center"
        >
          {showTextInput ? <Mic className="w-3 h-3" /> : <Keyboard className="w-3 h-3" />}
          {showTextInput ? 'Switch to speech' : 'Switch to typing'}
        </button>
      )}

      {/* Words entered with live match feedback */}
      <div className="flex flex-wrap gap-1.5 min-h-[48px]">
        {wordStatuses.map((ws, i) => (
          <Badge
            key={i}
            variant={ws.isMatch ? 'default' : 'outline'}
            className={cn(
              "text-sm transition-all",
              ws.isMatch && "bg-primary/90",
              ws.word === lastAddedWord && "ring-1 ring-primary"
            )}
          >
            {ws.isMatch && <Check className="w-3 h-3 mr-1" />}
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
