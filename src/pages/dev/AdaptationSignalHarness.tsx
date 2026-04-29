/**
 * AdaptationSignalHarness — deterministic validation page
 *
 * Drives `useInGameAdaptation` directly (no UI game) with three scripted
 * trial streams per exercise slug:
 *   1. CLIMB:    8 correct      → expect at least one UP move
 *   2. FALL:     6 incorrect    → expect at least one DOWN move (when starting > floor)
 *   3. OSCILLATE: 12 mixed      → expect at least one UP and one DOWN
 *
 * For each script we assert:
 *   - The controller emitted the expected `onDifficultyChange` direction
 *   - At least one trial was logged via `onTrialLogged`
 *   - Final difficulty is within bounds [floor, ceiling]
 *
 * Output: a PASS / PARTIAL / FAIL table — the artifact you give clinicians.
 *
 * Replaces "I played it and it felt right" with reproducible signal.
 *
 * Route: /dev/signal-harness
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import type { DifficultyBounds } from '@/lib/difficultyBounds';

// ── Test rig: scripted trial streams ────────────────────────────────────────
type ScriptName = 'CLIMB' | 'FALL' | 'OSCILLATE';

interface Script {
  name: ScriptName;
  trials: boolean[];                  // true = correct, false = incorrect
  startDifficulty: number;
  expects: { up?: boolean; down?: boolean };
}

const SCRIPTS: Script[] = [
  {
    name: 'CLIMB',
    trials: Array(8).fill(true),
    startDifficulty: 2,
    expects: { up: true },
  },
  {
    name: 'FALL',
    trials: Array(6).fill(false),
    startDifficulty: 5,
    expects: { down: true },
  },
  {
    name: 'OSCILLATE',
    trials: [true, true, true, true, true, true, false, false, false, false, false, false],
    startDifficulty: 5,
    expects: { up: true, down: true },
  },
];

const EXERCISES = [
  'phrase_practice',
  'fix_sentence',
  'describe_guess',
  'sentence_construction',
  'thought_continuation',
  'synonym_generator',
];

const BOUNDS: DifficultyBounds = { floor: 1, ceiling: 10, suggestedStart: 5 };

// ── Single-script runner: mounts the hook with one script and reports moves
interface RunResult {
  script: ScriptName;
  exercise: string;
  ups: number;
  downs: number;
  trialsLogged: number;
  finalDifficulty: number;
  pass: 'PASS' | 'PARTIAL' | 'FAIL';
  notes: string[];
}

function ScriptRunner({
  exerciseSlug,
  script,
  onComplete,
}: {
  exerciseSlug: string;
  script: Script;
  onComplete: (r: RunResult) => void;
}) {
  const upsRef = useRef(0);
  const downsRef = useRef(0);
  const trialsLoggedRef = useRef(0);
  const finalDifficultyRef = useRef(script.startDifficulty);
  const completedRef = useRef(false);

  const { recordTrial } = useInGameAdaptation({
    exerciseSlug,
    sessionId: null,                // harness runs in-memory only — no DB writes
    initialDifficulty: script.startDifficulty,
    bounds: BOUNDS,
    windowSize: 4,
    targetSuccessRate: 0.75,
    enableDifficultyAutoStepDown: true,
    enableDifficultyToasts: false,
    enableAutoHints: false,
    autoLog: false,                 // never write to adaptation_trial_logs from harness
    onDifficultyChange: (newLvl, _reason, dir) => {
      if (dir === 'up') upsRef.current += 1;
      if (dir === 'down') downsRef.current += 1;
      finalDifficultyRef.current = newLvl;
    },
    onTrialLogged: () => { trialsLoggedRef.current += 1; },
  });

  useEffect(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    // Drive the script trial-by-trial. Synchronous within an effect is fine —
    // recordTrial uses refs internally so no React batching issues.
    for (const wasCorrect of script.trials) {
      recordTrial({ correct: wasCorrect, reactionTimeMs: 1000 });
    }
    // Compute pass/fail
    const notes: string[] = [];
    let pass: 'PASS' | 'PARTIAL' | 'FAIL' = 'PASS';

    if (script.expects.up && upsRef.current === 0) {
      pass = 'FAIL';
      notes.push('Expected at least one UP move; saw none.');
    }
    if (script.expects.down && downsRef.current === 0) {
      pass = 'FAIL';
      notes.push('Expected at least one DOWN move; saw none.');
    }
    if (trialsLoggedRef.current !== script.trials.length) {
      pass = pass === 'FAIL' ? 'FAIL' : 'PARTIAL';
      notes.push(`Trials logged ${trialsLoggedRef.current}/${script.trials.length}.`);
    }
    const fd = finalDifficultyRef.current;
    if (fd < BOUNDS.floor || fd > BOUNDS.ceiling) {
      pass = 'FAIL';
      notes.push(`Final difficulty ${fd} out of bounds.`);
    }

    onComplete({
      script: script.name,
      exercise: exerciseSlug,
      ups: upsRef.current,
      downs: downsRef.current,
      trialsLogged: trialsLoggedRef.current,
      finalDifficulty: fd,
      pass,
      notes,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ── Main harness page ───────────────────────────────────────────────────────
export default function AdaptationSignalHarness() {
  const [running, setRunning] = useState<{ exercise: string; script: Script } | null>(null);
  const [results, setResults] = useState<RunResult[]>([]);
  const queueRef = useRef<Array<{ exercise: string; script: Script }>>([]);

  const advance = useCallback(() => {
    const next = queueRef.current.shift();
    setRunning(next ?? null);
  }, []);

  const startAll = useCallback(() => {
    setResults([]);
    queueRef.current = [];
    for (const ex of EXERCISES) {
      for (const sc of SCRIPTS) queueRef.current.push({ exercise: ex, script: sc });
    }
    advance();
  }, [advance]);

  const handleComplete = useCallback((r: RunResult) => {
    setResults(prev => [...prev, r]);
    // Defer the next mount so React fully unmounts the previous runner first.
    setTimeout(advance, 10);
  }, [advance]);

  const summary = React.useMemo(() => {
    const byExercise: Record<string, RunResult[]> = {};
    for (const r of results) {
      (byExercise[r.exercise] ??= []).push(r);
    }
    return Object.entries(byExercise).map(([ex, rs]) => {
      const fails = rs.filter(r => r.pass === 'FAIL').length;
      const partials = rs.filter(r => r.pass === 'PARTIAL').length;
      const overall: 'PASS' | 'PARTIAL' | 'FAIL' =
        fails > 0 ? 'FAIL' : partials > 0 ? 'PARTIAL' : 'PASS';
      return { exercise: ex, runs: rs, overall };
    });
  }, [results]);

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Adaptation Signal Harness</h1>
        <p className="text-sm text-muted-foreground">
          Drives the real <code>useInGameAdaptation</code> hook against three scripted trial streams
          (CLIMB / FALL / OSCILLATE) for each exercise. No DB writes. Produces a deterministic
          PASS / PARTIAL / FAIL table that should be re-run after any scorer or controller change.
        </p>
        <div className="flex gap-2">
          <Button onClick={startAll} disabled={!!running}>
            {running ? `Running ${running.exercise} / ${running.script.name}…` : 'Run all scripts'}
          </Button>
          <Button variant="ghost" onClick={() => { setResults([]); }} disabled={!!running}>
            Clear
          </Button>
        </div>
      </header>

      {running && (
        <ScriptRunner
          key={`${running.exercise}::${running.script.name}`}
          exerciseSlug={running.exercise}
          script={running.script}
          onComplete={handleComplete}
        />
      )}

      <div className="space-y-4">
        {summary.map(({ exercise, runs, overall }) => (
          <Card key={exercise}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-mono">{exercise}</CardTitle>
              <Badge
                variant={overall === 'PASS' ? 'default' : overall === 'PARTIAL' ? 'secondary' : 'destructive'}
              >
                {overall}
              </Badge>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left">
                  <tr>
                    <th className="py-1">Script</th>
                    <th>Trials</th>
                    <th>Ups</th>
                    <th>Downs</th>
                    <th>Final L</th>
                    <th>Result</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.script} className="border-t">
                      <td className="py-1 font-medium">{r.script}</td>
                      <td>{r.trialsLogged}</td>
                      <td>{r.ups}</td>
                      <td>{r.downs}</td>
                      <td>{r.finalDifficulty}</td>
                      <td>
                        <Badge
                          variant={r.pass === 'PASS' ? 'default' : r.pass === 'PARTIAL' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {r.pass}
                        </Badge>
                      </td>
                      <td className="text-xs text-muted-foreground">{r.notes.join(' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>

      {results.length > 0 && !running && (
        <Card>
          <CardHeader><CardTitle>Overall</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {results.filter(r => r.pass === 'PASS').length} passed,{' '}
            {results.filter(r => r.pass === 'PARTIAL').length} partial,{' '}
            {results.filter(r => r.pass === 'FAIL').length} failed
            {' '}out of {results.length} runs.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
