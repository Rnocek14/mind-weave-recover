/**
 * sweep-stale-sessions carries a hand-mirrored copy of reduceAccuracy. When
 * the client learned recognition (tap) responses, the mirror did not, so a
 * chip-only session ended by the sweep (tab closed on iOS) stamped
 * participation 0 / practice null while the same session ended by the client
 * stamped 10 / 90. This extracts the Deno reducer and runs it beside the
 * client's on identical rows.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { reduceAccuracy, accuracySummaryToSummaryFields, type ScoredRow } from '@/lib/sessionAccuracySummary';

function loadSweepReducer(): (rows: ScoredRow[]) => Record<string, number | null> {
  const src = readFileSync('supabase/functions/sweep-stale-sessions/index.ts', 'utf8');
  const slugs = src.match(/const ACCURACY_EXCLUDED_SLUGS = new Set\(\[[\s\S]*?\]\);/);
  const start = src.indexOf('function accuracySummaryFields(');
  const end = src.indexOf('\n}\n', start) + 3;
  if (!slugs || start < 0) throw new Error('could not extract the sweep reducer');
  const tsCode = `${slugs[0]}\n${src.slice(start, end)}\nreturn accuracySummaryFields;`;
  const js = ts.transpileModule(tsCode, {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(js)() as (rows: ScoredRow[]) => Record<string, number | null>;
}

const row = (over: Partial<ScoredRow>): ScoredRow => ({
  score: 100,
  cue_level: 0,
  counts_toward_score: true,
  validity_label: 'valid_attempt',
  exercise_slug: 'photo_naming',
  ...over,
});

const FIXTURES: Record<string, ScoredRow[]> = {
  'tap-only session': Array.from({ length: 10 }, (_, i) =>
    row({ score: i === 0 ? 0 : 100, counts_toward_score: false, validity_label: 'recognition_response' }),
  ),
  'mixed speech + taps + manual + gated': [
    row({ score: 100 }),
    row({ score: 0, cue_level: 1 }),
    row({ score: 100, counts_toward_score: false, validity_label: 'recognition_response' }),
    row({ score: 100, counts_toward_score: false, validity_label: 'recognition_response' }),
    row({ score: 100, counts_toward_score: false, validity_label: 'manual_confirmed' }),
    row({ score: 0, counts_toward_score: false, validity_label: 'no_response' }),
    row({ score: 100, exercise_slug: 'voice_practice' }),
    row({ score: 50, exercise_slug: 'conversation_turn' }),
  ],
  'speech only': [row({ score: 100 }), row({ score: 0 }), row({ score: 100, cue_level: 2 })],
  'empty': [],
};

describe('sweep-stale-sessions reducer equals the client reducer', () => {
  const sweep = loadSweepReducer();
  for (const [name, rows] of Object.entries(FIXTURES)) {
    it(name, () => {
      expect(sweep(rows)).toEqual(accuracySummaryToSummaryFields(reduceAccuracy(rows)));
    });
  }

  it('a tap-only session counts toward participation and practice on both paths', () => {
    const out = sweep(FIXTURES['tap-only session']);
    expect(out.participation_trials).toBe(10);
    expect(out.recognition_trials).toBe(10);
    expect(out.practice_accuracy).toBe(90);
    expect(out.scored_trials).toBe(0);
    expect(out.accuracy).toBeUndefined();
  });
});
