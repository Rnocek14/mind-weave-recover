/**
 * DemoFixSentence — public, no-signup sentence-completion practice.
 *
 * Deliberately runs answers through the REAL matcher (matchSpokenFix), so
 * the demo shows the thing that makes the app different: it accepts the
 * whole corrected sentence, the bare word, a phrase around it, or a
 * plural — instead of demanding one exact string.
 *
 * Self-contained: content bank + matcher + UI primitives. No auth, no
 * telemetry, no clinical hooks.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X, RotateCcw, ArrowRight, Lightbulb, Volume2 } from 'lucide-react';
import { FIX_SENTENCE_BANK, type FixSentenceTrial } from '@/data/fixSentenceBank';
import { matchSpokenFix } from '@/hooks/useFixSentenceGame';
import { buildFixSentenceChoices } from '@/lib/fixSentenceChoices';
import { demoSpeak, demoStopSpeaking, isDemoTtsSupported } from './demoTts';
import { cn } from '@/lib/utils';

const SESSION_LENGTH = 4;

function pickTrials(): FixSentenceTrial[] {
  const easy = FIX_SENTENCE_BANK.filter((t) => t.difficulty === 1 && !t.secondError && !t.morphology);
  const shuffled = [...easy];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, SESSION_LENGTH);
}

type Verdict = { correct: boolean; matched: string | null } | null;

export function DemoFixSentence() {

  // Navigating away must silence the demo voice — browser speech keeps
  // talking after the component is gone otherwise.
  useEffect(() => demoStopSpeaking, []);
  const [trials, setTrials] = useState<FixSentenceTrial[]>(() => pickTrials());
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [showChoices, setShowChoices] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const current = trials[index];
  const choices = useMemo(
    () => (current ? buildFixSentenceChoices(current) : []),
    [current]
  );

  const restart = () => {
    setTrials(pickTrials());
    setIndex(0);
    setAnswer('');
    setVerdict(null);
    setShowChoices(false);
    setCorrectCount(0);
    setDone(false);
  };

  const check = (raw: string) => {
    const text = raw.trim();
    if (!text || verdict) return;
    const matched = matchSpokenFix(
      text,
      current.acceptedFixes,
      current.fixAliases,
      current.sentence
    );
    setVerdict({ correct: matched != null, matched });
    if (matched) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (index + 1 >= trials.length) { setDone(true); return; }
    setIndex((i) => i + 1);
    setAnswer('');
    setVerdict(null);
    setShowChoices(false);
  };

  if (done) {
    return (
      <div className="text-center space-y-3 py-4">
        <p className="text-3xl">🔧</p>
        <p className="text-lg font-semibold">{correctCount} of {trials.length} sentences fixed</p>
        <p className="text-sm text-muted-foreground">
          In the full app you say the answer out loud instead of typing, and
          the sentences get longer and subtler as they get easier for you.
        </p>
        <Button variant="outline" size="sm" onClick={restart}>
          <RotateCcw className="h-4 w-4 mr-1.5" /> Try four more
        </Button>
      </div>
    );
  }

  // Render the sentence with the wrong word marked.
  const words = current.sentence.split(' ');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Sentence {index + 1} of {trials.length}</span>
        {isDemoTtsSupported() && (
          <button
            type="button"
            onClick={() => void demoSpeak(current.sentence)}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <Volume2 className="h-3.5 w-3.5" /> Hear it
          </button>
        )}
      </div>

      <Card className="border">
        <CardContent className="py-4">
          <p className="text-lg sm:text-xl text-center leading-relaxed">
            {words.map((w, i) => {
              const clean = w.replace(/[.,!?]/g, '');
              const punct = w.match(/[.,!?]/)?.[0] ?? '';
              const isWrong = clean.toLowerCase() === current.wrongWord.toLowerCase();
              return (
                <span key={i}>
                  {i > 0 && ' '}
                  <span className={cn(isWrong && 'font-bold text-destructive underline decoration-wavy')}>
                    {clean}
                  </span>
                  {punct}
                </span>
              );
            })}
          </p>
          <p className="text-center text-xs text-muted-foreground mt-2">
            One word is wrong. What should it be?
          </p>
        </CardContent>
      </Card>

      {!verdict && (
        <>
          <div className="flex gap-2">
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); check(answer); } }}
              placeholder="Type the right word — or the whole sentence"
              autoComplete="off"
              className="h-10"
            />
            <Button size="sm" className="h-10" onClick={() => check(answer)} disabled={!answer.trim()}>
              Check
            </Button>
          </div>

          {!showChoices ? (
            <button
              type="button"
              onClick={() => setShowChoices(true)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Lightbulb className="h-3.5 w-3.5" /> Show me some choices
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {choices.map((w) => (
                <Button key={w} variant="secondary" size="sm" className="capitalize" onClick={() => check(w)}>
                  {w}
                </Button>
              ))}
            </div>
          )}
        </>
      )}

      {verdict && (
        <div
          className={cn(
            'rounded-lg border p-3 flex items-start gap-2.5',
            verdict.correct
              ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
              : 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
          )}
        >
          {verdict.correct
            ? <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            : <X className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />}
          <div className="flex-1 text-sm">
            {verdict.correct ? (
              <p><strong>“{verdict.matched}”</strong> — that fixes it.</p>
            ) : (
              <p>
                Not this time. One answer that works:{' '}
                <strong className="capitalize">{current.acceptedFixes[0]}</strong>.
              </p>
            )}
          </div>
          <Button size="sm" onClick={next} className="shrink-0">
            {index + 1 >= trials.length ? 'Finish' : 'Next'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
