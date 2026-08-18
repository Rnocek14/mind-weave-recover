/**
 * DemoDetective — public, no-signup, 3-case "short session" of Detective Mind.
 *
 * Self-contained on purpose: no auth, no telemetry, no clinical hooks, no
 * Maya voice stack. Reuses only the content bank + UI primitives so nothing
 * here can affect (or depend on) the real clinical game.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, Volume2, RotateCcw, ArrowRight } from 'lucide-react';
import { DETECTIVE_CASES, type DetectiveCase } from '@/data/detectiveMindCases';
import { demoSpeak, isDemoTtsSupported } from './demoTts';
import { cn } from '@/lib/utils';

const SESSION_LENGTH = 3;

function pickCases(): DetectiveCase[] {
  const tier1 = DETECTIVE_CASES.filter((c) => c.tier === 1);
  const shuffled = [...tier1];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, SESSION_LENGTH);
}

export function DemoDetective({ onFinished }: { onFinished?: (correct: number, total: number) => void }) {
  const [cases, setCases] = useState<DetectiveCase[]>(() => pickCases());
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const current = cases[index];
  const answered = selected !== null;

  const restart = () => {
    setCases(pickCases());
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setDone(false);
  };

  const choose = (i: number) => {
    if (answered) return;
    setSelected(i);
    if (i === current.correctIndex) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (index + 1 >= cases.length) {
      setDone(true);
      onFinished?.(correctCount, cases.length);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  };

  const readAloud = useMemo(
    () => () => {
      void demoSpeak(
        `${current.story.join(' ')} ${current.question} ` +
          current.options.map((o, i) => `Option ${String.fromCharCode(65 + i)}: ${o}.`).join(' ')
      );
    },
    [current]
  );

  if (done) {
    return (
      <div className="text-center space-y-3 py-4">
        <p className="text-3xl">🕵️</p>
        <p className="text-lg font-semibold">
          {correctCount} of {cases.length} cases solved
        </p>
        <p className="text-sm text-muted-foreground">
          The full version reads every story aloud, adjusts the difficulty to the
          person playing, and tracks progress over time.
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
        <span>Case {index + 1} of {cases.length}</span>
        {isDemoTtsSupported() && (
          <button
            type="button"
            onClick={readAloud}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <Volume2 className="h-3.5 w-3.5" /> Read aloud
          </button>
        )}
      </div>

      <Card className="border">
        <CardContent className="pt-3 pb-3 space-y-1.5">
          {current.story.map((s, i) => (
            <p key={i} className="text-sm leading-snug">{s}</p>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm font-semibold">{current.question}</p>

      <div className="grid gap-2">
        {current.options.map((opt, i) => {
          const isCorrect = i === current.correctIndex;
          const isPicked = selected === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={answered}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                !answered && 'hover:border-primary/60 hover:bg-accent/40',
                answered && isCorrect && 'border-green-500 bg-green-50 dark:bg-green-950/20',
                answered && isPicked && !isCorrect && 'border-red-400 bg-red-50 dark:bg-red-950/20',
                answered && !isPicked && !isCorrect && 'opacity-50'
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
              {answered && isCorrect && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
              {answered && isPicked && !isCorrect && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground flex-1">
            {selected === current.correctIndex ? '✔ Case solved. ' : ''}
            {current.explanation}
          </p>
          <Button size="sm" onClick={next} className="shrink-0">
            {index + 1 >= cases.length ? 'Finish' : 'Next case'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
