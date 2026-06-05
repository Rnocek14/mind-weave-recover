/**
 * Sequence Builder Probe — modal-capable
 * 
 * Shows 3-4 shuffled images/sentences → user orders them
 * Tests: narrative ability, sequencing, memory, logic
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SequenceItem {
  id: string;
  text: string;
}

interface SequenceTrial {
  title: string;
  items: SequenceItem[]; // in correct order
}

const TRIALS: SequenceTrial[] = [
  {
    title: 'Making breakfast',
    items: [
      { id: 'a', text: 'Get eggs from the fridge' },
      { id: 'b', text: 'Crack eggs into a pan' },
      { id: 'c', text: 'Cook until done' },
      { id: 'd', text: 'Put eggs on a plate' },
    ],
  },
  {
    title: 'Going to the store',
    items: [
      { id: 'a', text: 'Make a shopping list' },
      { id: 'b', text: 'Drive to the store' },
      { id: 'c', text: 'Pick items from the shelves' },
      { id: 'd', text: 'Pay at the register' },
    ],
  },
  {
    title: 'Getting ready for bed',
    items: [
      { id: 'a', text: 'Brush your teeth' },
      { id: 'b', text: 'Put on pajamas' },
      { id: 'c', text: 'Get into bed' },
      { id: 'd', text: 'Turn off the light' },
    ],
  },
  {
    title: 'Planting a flower',
    items: [
      { id: 'a', text: 'Dig a hole in the soil' },
      { id: 'b', text: 'Put the seed in the hole' },
      { id: 'c', text: 'Cover with soil' },
      { id: 'd', text: 'Water the plant' },
    ],
  },
  {
    title: 'Sending a letter',
    items: [
      { id: 'a', text: 'Write the letter' },
      { id: 'b', text: 'Put it in an envelope' },
      { id: 'c', text: 'Write the address' },
      { id: 'd', text: 'Take it to the mailbox' },
    ],
  },
];

interface SequenceBuilderProbeProps {
  totalTrials?: number;
  onComplete: (results: {
    correct: number;
    total: number;
    accuracy: number;
    avgPositionAccuracy: number;
    trials: Array<{ title: string; correct: boolean; positionAccuracy: number }>;
  }) => void;
}

export function SequenceBuilderProbe({ totalTrials = 3, onComplete }: SequenceBuilderProbeProps) {
  const selectedTrials = useMemo(() => {
    const shuffled = [...TRIALS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(totalTrials, TRIALS.length));
  }, [totalTrials]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Array<{ title: string; correct: boolean; positionAccuracy: number }>>([]);
  const [completed, setCompleted] = useState(false);

  // Shuffled order for current trial
  const [userOrder, setUserOrder] = useState<SequenceItem[]>(() =>
    [...selectedTrials[0].items].sort(() => Math.random() - 0.5)
  );
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const moveItem = useCallback((fromIndex: number, direction: 'up' | 'down') => {
    if (feedback) return;
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= userOrder.length) return;
    const newOrder = [...userOrder];
    [newOrder[fromIndex], newOrder[toIndex]] = [newOrder[toIndex], newOrder[fromIndex]];
    setUserOrder(newOrder);
  }, [userOrder, feedback]);

  const submitOrder = useCallback(() => {
    const trial = selectedTrials[currentIndex];
    const correctOrder = trial.items.map(i => i.id);
    const userIds = userOrder.map(i => i.id);

    // Position accuracy: how many items are in the right position
    let correctPositions = 0;
    for (let i = 0; i < correctOrder.length; i++) {
      if (correctOrder[i] === userIds[i]) correctPositions++;
    }
    const positionAccuracy = correctPositions / correctOrder.length;
    const isCorrect = positionAccuracy === 1;

    setFeedback(isCorrect ? 'correct' : 'incorrect');

    const newResults = [...results, { title: trial.title, correct: isCorrect, positionAccuracy }];
    setResults(newResults);

    setTimeout(() => {
      setFeedback(null);
      if (currentIndex + 1 >= selectedTrials.length) {
        setCompleted(true);
        const correctCount = newResults.filter(r => r.correct).length;
        const avgPosAcc = newResults.reduce((s, r) => s + r.positionAccuracy, 0) / newResults.length;
        onComplete({
          correct: correctCount,
          total: newResults.length,
          accuracy: correctCount / newResults.length,
          avgPositionAccuracy: avgPosAcc,
          trials: newResults,
        });
      } else {
        setCurrentIndex(i => i + 1);
        setUserOrder([...selectedTrials[currentIndex + 1].items].sort(() => Math.random() - 0.5));
      }
    }, 1200);
  }, [currentIndex, selectedTrials, userOrder, results, onComplete]);

  if (completed) {
    const correctCount = results.filter(r => r.correct).length;
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <ThumbsUp className="w-10 h-10 text-primary" />
        <p className="text-lg font-medium">{correctCount}/{results.length} correct</p>
        <p className="text-sm text-muted-foreground">Great sequencing!</p>
      </div>
    );
  }

  const trial = selectedTrials[currentIndex];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-xs text-muted-foreground text-center">
        {currentIndex + 1} / {selectedTrials.length}
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-1">Put these in the right order:</p>
        <p className="font-medium">{trial.title}</p>
      </div>

      {/* Sortable list */}
      <div className="flex flex-col gap-2">
        {userOrder.map((item, i) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg border transition-colors",
              feedback === 'correct' ? 'border-primary bg-primary/10' :
              feedback === 'incorrect' ? 'border-destructive bg-destructive/10' :
              'border-border bg-card'
            )}
          >
            <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
            <span className="flex-1 text-sm">{item.text}</span>
            {!feedback && (
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost" size="icon"
                  aria-label="Move up"
                  className="h-6 w-6"
                  onClick={() => moveItem(i, 'up')}
                  disabled={i === 0}
                >
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  aria-label="Move down"
                  className="h-6 w-6"
                  onClick={() => moveItem(i, 'down')}
                  disabled={i === userOrder.length - 1}
                >
                  <ArrowDown className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {!feedback && (
        <Button onClick={submitOrder} className="self-center">
          <Check className="w-4 h-4 mr-1" />
          Check Order
        </Button>
      )}
    </div>
  );
}
