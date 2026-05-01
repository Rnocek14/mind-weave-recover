/**
 * /dev/gate-harness — pre-scoring gate validator.
 *
 * Drives the EXACT same `gateResponse()` pipeline used by Describe & Guess
 * (and soon every game) so we can verify gate decisions deterministically
 * without needing a microphone.
 *
 * Five canonical tests are pre-loaded; you can also paste any transcript and
 * any "Maya recently said" lines to simulate echo conditions.
 */

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { gateResponse, type GateResult } from '@/lib/evaluation/gateResponse';
import { voiceController } from '@/lib/voiceController';
import { cn } from '@/lib/utils';

interface CannedTest {
  id: string;
  label: string;
  transcript: string;
  expected: 'reject' | 'pass';
  expectedClassification?: string;
  notes: string;
}

const PROMPT_TEXT = 'Describe what you see without saying the word';
const CHIP_QUESTIONS = [
  'What do you use it for?',
  'Where do you see it?',
  'What does it look like?',
  'What is it made of?',
  'What kind of thing is it?',
];

const CANNED_TESTS: CannedTest[] = [
  {
    id: 'echo_short',
    label: '1. Instruction echo (short mimic)',
    transcript: 'say what you see',
    expected: 'reject',
    expectedClassification: 'echo_short_mimic',
    notes: 'Hard-coded short-phrase regex — must reject regardless of history.',
  },
  {
    id: 'prompt_repeat',
    label: '2. Prompt repeat',
    transcript: 'describe what you see without saying the word',
    expected: 'reject',
    expectedClassification: 'prompt_repeat | echo_of_maya',
    notes: 'Should be caught by either prompt-repeat validator or echo filter.',
  },
  {
    id: 'chip_echo',
    label: '3. Chip echo (extraSpokenContext)',
    transcript: 'what do you use it for',
    expected: 'reject',
    expectedClassification: 'echo_of_maya',
    notes: 'User parrots a visible chip prompt — caught via extraSpokenContext.',
  },
  {
    id: 'wrong_answer',
    label: '4. Wrong description (2+ words)',
    transcript: 'yellow fruit',
    expected: 'pass',
    expectedClassification: 'valid_to_score',
    notes: 'D&G is a circumlocution exercise — single-word answers are blocked by design. A 2+ word wrong description must reach the scorer so it can be classified as wrong.',
  },
  {
    id: 'real_description',
    label: '5. Real description',
    transcript: 'it is a striped orange animal that lives in the jungle and is very large',
    expected: 'pass',
    expectedClassification: 'valid_to_score',
    notes: 'Normal patient discourse — must pass cleanly.',
  },
];

interface RunResult {
  test: CannedTest;
  gate: GateResult;
  passed: boolean;
}

export default function GateHarness() {
  const [transcript, setTranscript] = useState('');
  const [promptText, setPromptText] = useState(PROMPT_TEXT);
  const [extraContext, setExtraContext] = useState(CHIP_QUESTIONS.join('\n'));
  const [mayaHistory, setMayaHistory] = useState(
    'Describe what you see without saying the word.\nTell me what it looks like, where you find it, or what it is used for.'
  );
  const [singleResult, setSingleResult] = useState<GateResult | null>(null);
  const [batchResults, setBatchResults] = useState<RunResult[] | null>(null);

  const seedHistory = () => {
    voiceController.clearSpokenHistory();
    mayaHistory.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => voiceController.recordSpoken(l));
  };

  const runOne = () => {
    seedHistory();
    const result = gateResponse({
      transcript,
      promptText,
      expectedMode: 'description',
      extraSpokenContext: extraContext.split('\n').map(l => l.trim()).filter(Boolean),
    });
    setSingleResult(result);
  };

  const runAll = () => {
    seedHistory();
    const results: RunResult[] = CANNED_TESTS.map(t => {
      const gate = gateResponse({
        transcript: t.transcript,
        promptText,
        expectedMode: 'description',
        extraSpokenContext: extraContext.split('\n').map(l => l.trim()).filter(Boolean),
      });
      const wasRejected = !gate.ok;
      const passed =
        (t.expected === 'reject' && wasRejected) ||
        (t.expected === 'pass' && !wasRejected);
      return { test: t, gate, passed };
    });
    setBatchResults(results);
  };

  const summary = useMemo(() => {
    if (!batchResults) return null;
    const pass = batchResults.filter(r => r.passed).length;
    return { pass, total: batchResults.length };
  }, [batchResults]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Gate Harness</h1>
        <p className="text-sm text-muted-foreground">
          Validates <code>gateResponse()</code> — the mandatory pre-scoring gate. Same pipeline used by Describe & Guess.
        </p>
      </div>

      {/* ── Canned tests ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Canned tests</CardTitle>
          <div className="flex items-center gap-3">
            {summary && (
              <Badge variant={summary.pass === summary.total ? 'default' : 'destructive'}>
                {summary.pass}/{summary.total} passed
              </Badge>
            )}
            <Button size="sm" onClick={runAll}>Run all 5</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(batchResults ?? CANNED_TESTS.map(t => ({ test: t, gate: null as unknown as GateResult, passed: false }))).map((row) => {
            const t = row.test;
            const g = row.gate;
            const hasResult = !!g;
            return (
              <div
                key={t.id}
                className={cn(
                  'border rounded-lg p-3 space-y-1 text-sm',
                  hasResult && (row.passed ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5')
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{t.label}</div>
                  {hasResult && (
                    <Badge variant={row.passed ? 'default' : 'destructive'}>
                      {row.passed ? 'PASS' : 'FAIL'}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground">
                  Input: <code className="text-foreground">"{t.transcript}"</code>
                </div>
                <div className="text-muted-foreground">
                  Expected: <strong className="text-foreground">{t.expected}</strong>
                  {t.expectedClassification && <> → <code>{t.expectedClassification}</code></>}
                </div>
                <div className="text-xs italic text-muted-foreground">{t.notes}</div>
                {hasResult && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs bg-muted/40 rounded p-2">
                    <div><span className="text-muted-foreground">ok:</span> <code>{String(g.ok)}</code></div>
                    <div><span className="text-muted-foreground">classification:</span> <code>{g.classification}</code></div>
                    <div><span className="text-muted-foreground">rejectionReason:</span> <code>{g.rejectionReason ?? '—'}</code></div>
                    <div><span className="text-muted-foreground">echoScore:</span> <code>{g.echoScore.toFixed(2)}</code></div>
                    <div className="col-span-2"><span className="text-muted-foreground">echoMatched:</span> <code>{g.echoMatched ?? '—'}</code></div>
                    {g.coachingText && (
                      <div className="col-span-2"><span className="text-muted-foreground">coachingText:</span> "{g.coachingText}"</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Free-form ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Free-form transcript</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Transcript</label>
            <Textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={2} placeholder="Type any candidate transcript…" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Prompt text</label>
            <Input value={promptText} onChange={e => setPromptText(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">extraSpokenContext (one per line)</label>
              <Textarea value={extraContext} onChange={e => setExtraContext(e.target.value)} rows={5} className="font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Maya recently spoke (one per line)</label>
              <Textarea value={mayaHistory} onChange={e => setMayaHistory(e.target.value)} rows={5} className="font-mono text-xs" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={runOne} disabled={!transcript.trim()}>Run gate</Button>
            <Button variant="outline" onClick={() => { voiceController.clearSpokenHistory(); setSingleResult(null); }}>Clear</Button>
          </div>

          {singleResult && (
            <div className={cn(
              'border rounded-lg p-3 text-sm space-y-1',
              singleResult.ok ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'
            )}>
              <div className="flex items-center gap-2">
                <Badge variant={singleResult.ok ? 'default' : 'destructive'}>
                  {singleResult.ok ? 'PASS' : 'REJECT'}
                </Badge>
                <code className="text-xs">{singleResult.classification}</code>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-muted-foreground">rejectionReason:</span> <code>{singleResult.rejectionReason ?? '—'}</code></div>
                <div><span className="text-muted-foreground">echoScore:</span> <code>{singleResult.echoScore.toFixed(2)}</code></div>
                <div className="col-span-2"><span className="text-muted-foreground">echoMatched:</span> <code>{singleResult.echoMatched ?? '—'}</code></div>
                {singleResult.coachingText && (
                  <div className="col-span-2"><span className="text-muted-foreground">coachingText:</span> "{singleResult.coachingText}"</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
