/**
 * DemoWordFinding — public, no-signup, 45-second word-finding "short session".
 *
 * Type as many words in the category as you can. Uses the real category
 * word lists for scoring; no mic, no auth, no telemetry.
 */

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RotateCcw, Timer } from 'lucide-react';
import { validateCategoryWord } from '@/data/categoryWordLists';
import { cn } from '@/lib/utils';

const ROUND_SECONDS = 45;
const DEMO_CATEGORIES = [
  { slug: 'animals', label: 'Animals', hint: 'pets, farm, ocean, wild…' },
  { slug: 'foods', label: 'Foods', hint: 'fruits, meals, snacks…' },
  { slug: 'kitchen', label: 'Things in a kitchen', hint: 'utensils, appliances…' },
];

interface Entry { text: string; valid: boolean }

export function DemoWordFinding({ onFinished }: { onFinished?: (count: number) => void }) {
  const [category] = useState(() => DEMO_CATEGORIES[Math.floor(Math.random() * DEMO_CATEGORIES.length)]);
  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready');
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const validCount = entries.filter((e) => e.valid).length;

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const start = () => {
    setPhase('running');
    setSecondsLeft(ROUND_SECONDS);
    setEntries([]);
    setValue('');
    setTimeout(() => inputRef.current?.focus(), 50);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase('done');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (phase === 'done') onFinished?.(validCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const submit = () => {
    const word = value.trim().toLowerCase();
    setValue('');
    if (!word || phase !== 'running') return;
    if (entries.some((e) => e.text === word)) return;
    const status = validateCategoryWord(word, category.slug);
    if (status === 'filler') return;
    setEntries((prev) => [...prev, { text: word, valid: status === 'valid' }]);
  };

  if (phase === 'ready') {
    return (
      <div className="text-center space-y-3 py-4">
        <p className="text-sm">
          Name as many <strong>{category.label.toLowerCase()}</strong> as you can in {ROUND_SECONDS} seconds.
        </p>
        <p className="text-xs text-muted-foreground">({category.hint})</p>
        <Button size="sm" onClick={start}>
          <Timer className="h-4 w-4 mr-1.5" /> Start the clock
        </Button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="text-center space-y-3 py-4">
        <p className="text-3xl">⏱️</p>
        <p className="text-lg font-semibold">{validCount} {category.label.toLowerCase()} in {ROUND_SECONDS} seconds</p>
        <p className="text-sm text-muted-foreground">
          In the full version you can speak instead of type, the app accepts the
          words you were reaching for, and categories rotate so it never gets stale.
        </p>
        <Button variant="outline" size="sm" onClick={start}>
          <RotateCcw className="h-4 w-4 mr-1.5" /> Try another round
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{category.label}</span>
        <span className={cn('font-mono', secondsLeft <= 10 && 'text-red-600 font-bold')}>
          0:{String(secondsLeft).padStart(2, '0')}
        </span>
      </div>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="Type a word + Enter"
          autoComplete="off"
          className="h-10"
        />
        <Button size="sm" className="h-10" onClick={submit}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {entries.map((e, i) => (
          <span
            key={i}
            className={cn(
              'px-2 py-0.5 rounded-full text-xs border',
              e.valid
                ? 'bg-green-50 border-green-300 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                : 'bg-muted border-border text-muted-foreground line-through'
            )}
          >
            {e.text}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-right">{validCount} valid so far</p>
    </div>
  );
}
