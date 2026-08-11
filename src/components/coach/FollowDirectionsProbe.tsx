/**
 * Follow Directions Probe — modal-capable
 * 
 * Tests: comprehension, working memory, sequencing
 * "Touch the red circle, then the blue square"
 * 
 * Scores: correctness, latency, step count completed
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

// Shape + color items for the board
type ShapeColor = { shape: 'circle' | 'square' | 'triangle' | 'star'; color: string; label: string };

const ITEMS: ShapeColor[] = [
  { shape: 'circle', color: 'hsl(var(--destructive))', label: 'red circle' },
  { shape: 'square', color: 'hsl(210, 80%, 55%)', label: 'blue square' },
  { shape: 'triangle', color: 'hsl(142, 70%, 45%)', label: 'green triangle' },
  { shape: 'star', color: 'hsl(45, 90%, 50%)', label: 'yellow star' },
  { shape: 'circle', color: 'hsl(210, 80%, 55%)', label: 'blue circle' },
  { shape: 'square', color: 'hsl(var(--destructive))', label: 'red square' },
];

interface DirectionStep {
  action: 'touch';
  targetLabel: string;
}

interface Direction {
  text: string;
  steps: DirectionStep[];
  complexity: number; // 1=single, 2=two-step, 3=three-step
}

const DIRECTIONS: Direction[] = [
  { text: 'Touch the red circle.', steps: [{ action: 'touch', targetLabel: 'red circle' }], complexity: 1 },
  { text: 'Touch the blue square.', steps: [{ action: 'touch', targetLabel: 'blue square' }], complexity: 1 },
  { text: 'Touch the green triangle.', steps: [{ action: 'touch', targetLabel: 'green triangle' }], complexity: 1 },
  { text: 'Touch the red circle, then the blue square.', steps: [{ action: 'touch', targetLabel: 'red circle' }, { action: 'touch', targetLabel: 'blue square' }], complexity: 2 },
  { text: 'Touch the yellow star, then the green triangle.', steps: [{ action: 'touch', targetLabel: 'yellow star' }, { action: 'touch', targetLabel: 'green triangle' }], complexity: 2 },
  { text: 'Touch the blue circle, then the red square.', steps: [{ action: 'touch', targetLabel: 'blue circle' }, { action: 'touch', targetLabel: 'red square' }], complexity: 2 },
  { text: 'Touch the green triangle, then the yellow star, then the red circle.', steps: [{ action: 'touch', targetLabel: 'green triangle' }, { action: 'touch', targetLabel: 'yellow star' }, { action: 'touch', targetLabel: 'red circle' }], complexity: 3 },
  { text: 'Touch the red square, then the blue circle, then the green triangle.', steps: [{ action: 'touch', targetLabel: 'red square' }, { action: 'touch', targetLabel: 'blue circle' }, { action: 'touch', targetLabel: 'green triangle' }], complexity: 3 },
];

interface FollowDirectionsProbeProps {
  totalTrials?: number;
  difficultyLevel?: number; // 1=single step, 2=two step, 3=mixed
  onComplete: (results: {
    correct: number;
    total: number;
    accuracy: number;
    avgLatencyMs: number;
    maxComplexity: number;
    stepsCompleted: number;
    stepsTotal: number;
    trials: Array<{ direction: string; correct: boolean; latencyMs: number; complexity: number }>;
  }) => void;
}

// Shape renderer
function ShapeIcon({ item, size = 48 }: { item: ShapeColor; size?: number }) {
  const s = size;
  switch (item.shape) {
    case 'circle':
      return <div className="rounded-full" style={{ width: s, height: s, backgroundColor: item.color }} />;
    case 'square':
      return <div className="rounded-md" style={{ width: s, height: s, backgroundColor: item.color }} />;
    case 'triangle':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48">
          <polygon points="24,4 44,44 4,44" fill={item.color} />
        </svg>
      );
    case 'star':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48">
          <polygon points="24,2 30,18 48,18 34,28 39,46 24,35 9,46 14,28 0,18 18,18" fill={item.color} />
        </svg>
      );
  }
}

export function FollowDirectionsProbe({ totalTrials = 5, difficultyLevel = 2, onComplete }: FollowDirectionsProbeProps) {
  // Filter directions by difficulty
  const trials = useMemo(() => {
    let pool: Direction[];
    if (difficultyLevel === 1) pool = DIRECTIONS.filter(d => d.complexity <= 1);
    else if (difficultyLevel === 2) pool = DIRECTIONS.filter(d => d.complexity <= 2);
    else pool = DIRECTIONS;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(totalTrials, shuffled.length));
  }, [totalTrials, difficultyLevel]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [results, setResults] = useState<Array<{ direction: string; correct: boolean; latencyMs: number; complexity: number }>>([]);
  const [trialCorrectSoFar, setTrialCorrectSoFar] = useState(true);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [completed, setCompleted] = useState(false);
  const [stepsCompleted, setStepsCompleted] = useState(0);
  const [stepsTotal, setStepsTotal] = useState(0);
  const trialStartRef = useRef(Date.now());
  const { speak } = useTextToSpeech();

  // Shuffled board items for display
  const boardItems = useMemo(() => [...ITEMS].sort(() => Math.random() - 0.5), [currentIndex]);

  useEffect(() => {
    trialStartRef.current = Date.now();
    setCurrentStepIndex(0);
    setTrialCorrectSoFar(true);
  }, [currentIndex]);

  // This is an AUDITORY comprehension probe — the direction must be heard,
  // not just read (text-only rendering silently turned it into a reading
  // task, passing text-readers and failing alexic patients for the wrong
  // reason). Auto-speak each new direction; the speaker button replays it.
  useEffect(() => {
    if (completed) return;
    const trial = trials[currentIndex];
    if (trial) void speak(trial.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- speak identity churns; re-run only per trial
  }, [currentIndex, completed]);

  const handleTap = useCallback((item: ShapeColor) => {
    if (feedback || completed) return;

    const trial = trials[currentIndex];
    const expectedStep = trial.steps[currentStepIndex];
    const isCorrect = item.label === expectedStep.targetLabel;

    setStepsTotal(prev => prev + 1);

    if (isCorrect) {
      setStepsCompleted(prev => prev + 1);
      // More steps remaining?
      if (currentStepIndex + 1 < trial.steps.length) {
        setCurrentStepIndex(prev => prev + 1);
        return; // Wait for next tap
      }
    }

    // Trial done (either all steps correct, or one wrong)
    const trialCorrect = isCorrect && trialCorrectSoFar;
    const latencyMs = Date.now() - trialStartRef.current;

    setFeedback(trialCorrect ? 'correct' : 'incorrect');

    const newResults = [...results, { direction: trial.text, correct: trialCorrect, latencyMs, complexity: trial.complexity }];
    setResults(newResults);

    setTimeout(() => {
      setFeedback(null);
      if (currentIndex + 1 >= trials.length) {
        setCompleted(true);
        const correctCount = newResults.filter(r => r.correct).length;
        const avgLatency = newResults.reduce((s, r) => s + r.latencyMs, 0) / newResults.length;
        const totalStepsExpected = trials.reduce((s, t) => s + t.steps.length, 0);
        onComplete({
          correct: correctCount,
          total: newResults.length,
          accuracy: correctCount / newResults.length,
          avgLatencyMs: Math.round(avgLatency),
          maxComplexity: Math.max(...newResults.map(r => r.complexity)),
          stepsCompleted: stepsCompleted + (isCorrect ? 1 : 0),
          stepsTotal: totalStepsExpected,
          trials: newResults,
        });
      } else {
        setCurrentIndex(i => i + 1);
      }
    }, 800);
  }, [currentIndex, currentStepIndex, trials, results, feedback, completed, trialCorrectSoFar, stepsCompleted, onComplete]);

  if (completed) {
    const correctCount = results.filter(r => r.correct).length;
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <ThumbsUp className="w-10 h-10 text-primary" />
        <p className="text-lg font-medium">{correctCount}/{results.length} correct</p>
        <p className="text-sm text-muted-foreground">Great listening!</p>
      </div>
    );
  }

  const trial = trials[currentIndex];

  return (
    <div className="flex flex-col items-center gap-5 p-4">
      <div className="text-xs text-muted-foreground">
        {currentIndex + 1} / {trials.length}
      </div>

      {/* Instruction — spoken aloud; text stays as support */}
      <div className={cn(
        "text-center p-4 rounded-xl min-h-[60px] flex items-center justify-center gap-3 w-full",
      feedback === 'correct' ? 'bg-primary/10' :
      feedback === 'incorrect' ? 'bg-destructive/10' :
      'bg-muted/30'
      )}>
        <p className="text-base font-medium">{trial.text}</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hear the direction again"
          onClick={() => void speak(trial.text)}
        >
          <Volume2 className="w-5 h-5 text-primary" />
        </Button>
      </div>

      {/* Step indicator for multi-step */}
      {trial.steps.length > 1 && !feedback && (
        <div className="flex gap-1">
          {trial.steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full",
                i < currentStepIndex ? 'bg-primary' : i === currentStepIndex ? 'bg-primary/50 animate-pulse' : 'bg-muted'
              )}
            />
          ))}
        </div>
      )}

      {/* Shape board */}
      <div className="grid grid-cols-3 gap-4">
        {boardItems.map((item, i) => (
          <button
            key={`${item.label}-${i}`}
            onClick={() => handleTap(item)}
            className={cn(
              "flex items-center justify-center p-3 rounded-xl border-2 transition-all",
              "hover:scale-105 active:scale-95",
              feedback ? 'pointer-events-none opacity-60' : 'border-border hover:border-primary cursor-pointer'
            )}
          >
            <ShapeIcon item={item} />
          </button>
        ))}
      </div>
    </div>
  );
}
