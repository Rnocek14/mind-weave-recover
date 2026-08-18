/**
 * DemoMinimalPairs — public, no-signup, 5-round listening "short session".
 *
 * Hear a word (free on-device voice), tap the matching picture. Fully
 * self-contained: content bank + UI primitives only — no auth, telemetry,
 * mic, or in-app voice stack.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Volume2, RotateCcw } from 'lucide-react';
import { getMinimalPairTrials, type MinimalPairTrial } from '@/data/minimalPairsBank';
import { demoSpeak, isDemoTtsSupported } from './demoTts';
import { cn } from '@/lib/utils';

const SESSION_LENGTH = 5;

function pickTrials(): MinimalPairTrial[] {
  const easy = getMinimalPairTrials().filter((t) => t.pair.difficulty === 1);
  const shuffled = [...easy];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, SESSION_LENGTH);
}

export function DemoMinimalPairs({ onFinished }: { onFinished?: (correct: number, total: number) => void }) {
  const [trials, setTrials] = useState<MinimalPairTrial[]>(() => pickTrials());
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<0 | 1 | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  const current = trials[index];
  const answered = selected !== null;
  const ttsOk = isDemoTtsSupported();

  const restart = () => {
    setTrials(pickTrials());
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setDone(false);
    setHasPlayed(false);
  };

  const play = () => {
    setHasPlayed(true);
    void demoSpeak(current.targetWord, 0.85);
  };

  const choose = (i: 0 | 1) => {
    if (answered || !hasPlayed) return;
    setSelected(i);
    if (i === current.targetIndex) setCorrectCount((c) => c + 1);
    // Brief beat to see the result, then advance.
    setTimeout(() => {
      if (index + 1 >= trials.length) {
        setDone(true);
        onFinished?.(
          (i === current.targetIndex ? 1 : 0) + correctCount,
          trials.length
        );
      } else {
        setIndex((n) => n + 1);
        setSelected(null);
        setHasPlayed(false);
      }
    }, 1600);
  };

  if (!ttsOk) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        This demo needs a browser with speech output (Chrome, Safari, or Edge).
      </p>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-3 py-4">
        <p className="text-3xl">👂</p>
        <p className="text-lg font-semibold">
          {correctCount} of {trials.length} correct
        </p>
        <p className="text-sm text-muted-foreground">
          The full version uses a natural therapy voice, adds a say-it-back
          step, and focuses on the exact sounds each person finds hardest.
        </p>
        <Button variant="outline" size="sm" onClick={restart}>
          <RotateCcw className="h-4 w-4 mr-1.5" /> Play again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Round {index + 1} of {trials.length}</span>
        <span>{correctCount} correct</span>
      </div>

      <div className="flex items-center justify-center gap-3 py-1">
        <Button size="sm" variant={hasPlayed ? 'outline' : 'default'} onClick={play}>
          <Volume2 className="h-4 w-4 mr-1.5" />
          {hasPlayed ? 'Hear it again' : 'Play the word'}
        </Button>
        <span className="text-xs text-muted-foreground">then tap the matching picture</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mx-auto w-full max-w-[420px]">
        {([0, 1] as const).map((i) => {
          const trial = i === 0 ? current.trial1 : current.trial2;
          const isTarget = current.targetIndex === i;
          const isPicked = selected === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={answered || !hasPlayed}
              className={cn(
                'relative rounded-xl overflow-hidden border-2 transition-all',
                !answered && hasPlayed && 'hover:border-primary/60 cursor-pointer',
                !hasPlayed && 'opacity-60',
                answered && isTarget && 'border-green-500',
                answered && isPicked && !isTarget && 'border-red-400',
                !answered && 'border-border'
              )}
            >
              <div className="aspect-square bg-muted">
                <img src={trial.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
              {answered && (
                <div className={cn(
                  'absolute inset-0 flex items-center justify-center',
                  isTarget ? 'bg-green-500/20' : isPicked ? 'bg-red-500/20' : 'bg-black/25'
                )}>
                  {isTarget && <span className="bg-green-500 text-white rounded-full p-1.5"><Check className="h-4 w-4" /></span>}
                  {isPicked && !isTarget && <span className="bg-red-500 text-white rounded-full p-1.5"><X className="h-4 w-4" /></span>}
                </div>
              )}
              {answered && (
                <div className={cn(
                  'absolute bottom-0 inset-x-0 py-1 text-center text-xs font-bold',
                  isTarget ? 'bg-green-500 text-white' : 'bg-muted text-foreground'
                )}>
                  {i === 0 ? current.pair.word1 : current.pair.word2}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
