/**
 * Category Fluency Game — Standalone exercise component
 * 
 * "Name as many [category] as you can before time runs out"
 * Adaptive: harder categories + shrinking timer as difficulty increases
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Timer, Plus, ThumbsUp, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function pickCategory(difficulty: number) {
  const tierIndex = Math.min(Math.floor((difficulty - 1) / 2), CATEGORY_TIERS.length - 1);
  const tier = CATEGORY_TIERS[Math.max(0, tierIndex)];
  return tier[Math.floor(Math.random() * tier.length)];
}

export interface CategoryFluencyResult {
  category: string;
  words: string[];
  uniqueWordCount: number;
  wordsPerSecond: number;
  durationSec: number;
  timeLimitSec: number;
  difficulty: number;
}

interface CategoryFluencyGameProps {
  difficulty?: number;
  onRoundComplete?: (result: CategoryFluencyResult) => void;
  onGameComplete?: (results: CategoryFluencyResult[]) => void;
  roundCount?: number;
}

export function CategoryFluencyGame({
  difficulty = 1,
  onRoundComplete,
  onGameComplete,
  roundCount = 3,
}: CategoryFluencyGameProps) {
  const [currentRound, setCurrentRound] = useState(0);
  const [results, setResults] = useState<CategoryFluencyResult[]>([]);
  const [phase, setPhase] = useState<'ready' | 'active' | 'round-done' | 'done'>('ready');
  const [config, setConfig] = useState(() => pickCategory(difficulty));
  const [words, setWords] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(getTimerForDifficulty(difficulty));
  const startTimeRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const totalTime = getTimerForDifficulty(difficulty);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const finishRound = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const durationSec = (Date.now() - startTimeRef.current) / 1000;
    const unique = [...new Set(words.map(w => w.toLowerCase().trim()))].filter(Boolean);

    const result: CategoryFluencyResult = {
      category: config.category,
      words: unique,
      uniqueWordCount: unique.length,
      wordsPerSecond: durationSec > 0 ? unique.length / durationSec : 0,
      durationSec: Math.round(durationSec),
      timeLimitSec: totalTime,
      difficulty,
    };

    const newResults = [...results, result];
    setResults(newResults);
    onRoundComplete?.(result);

    if (currentRound + 1 >= roundCount) {
      setPhase('done');
      onGameComplete?.(newResults);
    } else {
      setPhase('round-done');
    }
  }, [words, config, totalTime, difficulty, results, currentRound, roundCount, onRoundComplete, onGameComplete]);

  const startRound = useCallback(() => {
    const cat = currentRound === 0 ? config : pickCategory(difficulty);
    setConfig(cat);
    setWords([]);
    setCurrentInput('');
    setPhase('active');
    startTimeRef.current = Date.now();
    setTimeLeft(totalTime);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          finishRound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [totalTime, difficulty, currentRound, config, finishRound]);

  const nextRound = useCallback(() => {
    setCurrentRound(prev => prev + 1);
    const cat = pickCategory(difficulty);
    setConfig(cat);
    setWords([]);
    setCurrentInput('');
    setTimeLeft(totalTime);
    setPhase('ready');
  }, [difficulty, totalTime]);

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

  const uniqueWords = [...new Set(words.map(w => w.toLowerCase().trim()))].filter(Boolean);

  // Ready
  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-5 py-8 max-w-sm mx-auto text-center">
        <div className="text-5xl">🧠</div>
        <div>
          <p className="text-xl font-bold mb-1">Name: {config.label}</p>
          <p className="text-muted-foreground">
            Type as many <strong>{config.label.toLowerCase()}</strong> as you can in {totalTime} seconds
          </p>
          <p className="text-xs text-muted-foreground mt-1">e.g. {config.examples}</p>
        </div>
        {currentRound > 0 && (
          <p className="text-sm text-muted-foreground">Round {currentRound + 1} of {roundCount}</p>
        )}
        <Button size="lg" onClick={startRound} className="min-h-[48px] min-w-[140px]">
          <Timer className="w-4 h-4 mr-2" />
          {currentRound === 0 ? 'Start' : 'Next Round'}
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
        <p className="text-2xl font-bold">{lastResult.uniqueWordCount} words!</p>
        <div className="flex flex-wrap gap-1 justify-center">
          {lastResult.words.map((w, i) => (
            <Badge key={i} variant="secondary" className="text-xs">{w}</Badge>
          ))}
        </div>
        <Button onClick={nextRound} className="min-h-[48px]">
          <RotateCcw className="w-4 h-4 mr-2" />
          Next Category
        </Button>
      </div>
    );
  }

  // Done
  if (phase === 'done') {
    const totalWords = results.reduce((sum, r) => sum + r.uniqueWordCount, 0);
    return (
      <div className="flex flex-col items-center gap-4 py-8 max-w-sm mx-auto text-center">
        <div className="text-5xl">🏆</div>
        <p className="text-2xl font-bold">{totalWords} total words</p>
        <div className="space-y-3 w-full">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2 rounded-lg bg-muted/50">
              <span className="font-medium capitalize">{r.category}</span>
              <Badge variant="secondary">{r.uniqueWordCount} words</Badge>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Active
  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto">
      {/* Timer + count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Name {config.label.toLowerCase()}:</span>
          <Badge variant="outline">{uniqueWords.length}</Badge>
        </div>
        <div className={cn(
          "flex items-center gap-1 text-lg font-mono font-bold tabular-nums",
          timeLeft <= 5 ? 'text-destructive animate-pulse' : 'text-muted-foreground'
        )}>
          <Timer className="w-4 h-4" />
          {timeLeft}s
        </div>
      </div>

      {/* Input */}
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

      {/* Words entered */}
      <div className="flex flex-wrap gap-1.5 min-h-[48px]">
        {words.map((w, i) => (
          <Badge key={i} variant="outline" className="text-sm">{w}</Badge>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={finishRound} className="self-end min-h-[44px]">
        Done early
      </Button>
    </div>
  );
}
