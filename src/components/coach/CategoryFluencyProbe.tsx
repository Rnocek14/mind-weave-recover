/**
 * Category Fluency Probe — modal-capable
 * 
 * "Name as many animals as you can in 30 seconds"
 * Tests: lexical access, semantic network, fluency
 * Scores: word count, rate (words/sec), clusters
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Timer, Plus, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryConfig {
  category: string;
  label: string;
  examples: string;
  timeLimitSec: number;
}

const CATEGORIES: CategoryConfig[] = [
  { category: 'animals', label: 'Animals', examples: 'dog, cat, horse...', timeLimitSec: 30 },
  { category: 'foods', label: 'Foods', examples: 'bread, apple, rice...', timeLimitSec: 30 },
  { category: 'clothes', label: 'Clothing', examples: 'shirt, hat, shoes...', timeLimitSec: 30 },
  { category: 'kitchen', label: 'Kitchen Items', examples: 'cup, fork, pan...', timeLimitSec: 30 },
];

interface CategoryFluencyProbeProps {
  timeLimitSec?: number;
  onComplete: (results: {
    category: string;
    words: string[];
    wordCount: number;
    uniqueWordCount: number;
    wordsPerSecond: number;
    durationSec: number;
  }) => void;
}

export function CategoryFluencyProbe({ timeLimitSec, onComplete }: CategoryFluencyProbeProps) {
  const [config] = useState(() => CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]);
  const [phase, setPhase] = useState<'ready' | 'active' | 'done'>('ready');
  const [words, setWords] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(timeLimitSec ?? config.timeLimitSec);
  const startTimeRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const totalTime = timeLimitSec ?? config.timeLimitSec;

  const finishRound = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const durationSec = (Date.now() - startTimeRef.current) / 1000;
    const unique = [...new Set(words.map(w => w.toLowerCase().trim()))].filter(Boolean);
    setPhase('done');
    onComplete({
      category: config.category,
      words: unique,
      wordCount: words.length,
      uniqueWordCount: unique.length,
      wordsPerSecond: durationSec > 0 ? unique.length / durationSec : 0,
      durationSec: Math.round(durationSec),
    });
  }, [words, config, onComplete]);

  const startRound = useCallback(() => {
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
  }, [totalTime, finishRound]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

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

  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-5 p-6">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Category: {config.label}</p>
          <p className="text-sm text-muted-foreground">
            Name as many <strong>{config.label.toLowerCase()}</strong> as you can in {totalTime} seconds.
          </p>
          <p className="text-xs text-muted-foreground mt-1">e.g. {config.examples}</p>
        </div>
        <Button size="lg" onClick={startRound}>
          <Timer className="w-4 h-4 mr-2" />
          Start
        </Button>
      </div>
    );
  }

  if (phase === 'done') {
    const unique = [...new Set(words.map(w => w.toLowerCase().trim()))].filter(Boolean);
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <ThumbsUp className="w-10 h-10 text-primary" />
        <p className="text-lg font-medium">{unique.length} unique words</p>
        <div className="flex flex-wrap gap-1 justify-center max-w-xs">
          {unique.map((w, i) => (
            <Badge key={i} variant="secondary" className="text-xs">{w}</Badge>
          ))}
        </div>
      </div>
    );
  }

  // Active phase
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Timer */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Name {config.label.toLowerCase()}:</p>
        <div className={cn(
          "flex items-center gap-1 text-sm font-mono font-bold",
          timeLeft <= 5 ? 'text-destructive animate-pulse' : 'text-muted-foreground'
        )}>
          <Timer className="w-3 h-3" />
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
          placeholder="Type a word..."
          autoFocus
        />
        <Button size="icon" aria-label="Add word" onClick={addWord} disabled={!currentInput.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Words entered */}
      <div className="flex flex-wrap gap-1 min-h-[40px]">
        {words.map((w, i) => (
          <Badge key={i} variant="outline" className="text-xs">{w}</Badge>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={finishRound} className="self-end">
        Done early
      </Button>
    </div>
  );
}
