/**
 * Yes/No Comprehension Probe — modal-capable
 * 
 * Simple comprehension checks: "Is a dog an animal?" → Yes/No
 * Scores correctness + latency.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, ThumbsUp, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

interface Trial {
  question: string;
  answer: boolean;
  category: string;
}

const TRIALS: Trial[] = [
  { question: 'Is a dog an animal?', answer: true, category: 'semantic' },
  { question: 'Can you eat a chair?', answer: false, category: 'semantic' },
  { question: 'Does the sun come out at night?', answer: false, category: 'world_knowledge' },
  { question: 'Is water wet?', answer: true, category: 'world_knowledge' },
  { question: 'Can a fish fly?', answer: false, category: 'semantic' },
  { question: 'Do you sleep in a bed?', answer: true, category: 'routine' },
  { question: 'Is ice cream hot?', answer: false, category: 'semantic' },
  { question: 'Can you read a book?', answer: true, category: 'functional' },
  { question: 'Does a car have wings?', answer: false, category: 'semantic' },
  { question: 'Do you brush your teeth?', answer: true, category: 'routine' },
];

interface YesNoComprehensionProbeProps {
  totalTrials?: number;
  onComplete: (results: {
    correct: number;
    total: number;
    accuracy: number;
    avgLatencyMs: number;
    trials: Array<{ question: string; correct: boolean; latencyMs: number }>;
  }) => void;
}

export function YesNoComprehensionProbe({ totalTrials = 5, onComplete }: YesNoComprehensionProbeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Array<{ question: string; correct: boolean; latencyMs: number }>>([]);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [completed, setCompleted] = useState(false);
  const trialStartRef = useRef(Date.now());

  // Shuffle and limit trials
  const [trials] = useState(() => {
    const shuffled = [...TRIALS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(totalTrials, TRIALS.length));
  });

  const { speak } = useTextToSpeech();

  useEffect(() => {
    trialStartRef.current = Date.now();
  }, [currentIndex]);

  // This is an AUDITORY comprehension probe — speak each question so it
  // measures listening, not reading. Text stays visible as support.
  useEffect(() => {
    if (completed) return;
    const trial = trials[currentIndex];
    if (trial) void speak(trial.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- speak identity churns; re-run only per trial
  }, [currentIndex, completed]);

  const handleAnswer = useCallback((userAnswer: boolean) => {
    if (feedback) return;
    
    const trial = trials[currentIndex];
    const latencyMs = Date.now() - trialStartRef.current;
    const correct = userAnswer === trial.answer;

    setFeedback(correct ? 'correct' : 'incorrect');
    
    const newResults = [...results, { question: trial.question, correct, latencyMs }];
    setResults(newResults);

    setTimeout(() => {
      setFeedback(null);
      if (currentIndex + 1 >= trials.length) {
        setCompleted(true);
        const correctCount = newResults.filter(r => r.correct).length;
        const avgLatency = newResults.reduce((sum, r) => sum + r.latencyMs, 0) / newResults.length;
        onComplete({
          correct: correctCount,
          total: newResults.length,
          accuracy: correctCount / newResults.length,
          avgLatencyMs: Math.round(avgLatency),
          trials: newResults,
        });
      } else {
        setCurrentIndex(i => i + 1);
      }
    }, 800);
  }, [currentIndex, feedback, trials, results, onComplete]);

  if (completed) {
    const correctCount = results.filter(r => r.correct).length;
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <ThumbsUp className="w-10 h-10 text-primary" />
        <p className="text-lg font-medium">{correctCount}/{results.length} correct</p>
        <p className="text-sm text-muted-foreground">Great job!</p>
      </div>
    );
  }

  const trial = trials[currentIndex];

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div className="text-xs text-muted-foreground">
        {currentIndex + 1} / {trials.length}
      </div>
      
      <div className="text-center p-6 bg-muted/30 rounded-xl min-h-[80px] flex items-center justify-center gap-3">
        <p className="text-lg font-medium">{trial.question}</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hear the question again"
          onClick={() => void speak(trial.question)}
        >
          <Volume2 className="w-5 h-5 text-primary" />
        </Button>
      </div>

      <div className="flex gap-4 w-full max-w-xs">
        <Button
          size="lg"
          variant={feedback === 'correct' && trial.answer ? 'default' : feedback === 'incorrect' && !trial.answer ? 'destructive' : 'outline'}
          className={cn("flex-1 h-16 text-lg", feedback && 'pointer-events-none')}
          onClick={() => handleAnswer(true)}
        >
          <Check className="w-5 h-5 mr-2" />
          Yes
        </Button>
        <Button
          size="lg"
          variant={feedback === 'correct' && !trial.answer ? 'default' : feedback === 'incorrect' && trial.answer ? 'destructive' : 'outline'}
          className={cn("flex-1 h-16 text-lg", feedback && 'pointer-events-none')}
          onClick={() => handleAnswer(false)}
        >
          <X className="w-5 h-5 mr-2" />
          No
        </Button>
      </div>
    </div>
  );
}
