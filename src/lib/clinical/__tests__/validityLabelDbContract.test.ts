/**
 * Every validity label the client can write must be accepted by the database.
 *
 * exercise_events.validity_label and utterance_analyses.validity_label carry
 * CHECK constraints. A label the client emits that the constraint does not
 * list is rejected on insert; the telemetry hook retries, logs and returns, so
 * the patient sees nothing and the trial silently never lands. That is how
 * `recognition_response` shipped: the offline fake accepted it and the proof
 * passed for the wrong reason. This test reads the constraints from the
 * migrations (last definition wins) and holds the client to them.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VALIDITY_LABELS } from '@/lib/clinical/classifyUtteranceValidity';

const TABLES = ['exercise_events', 'utterance_analyses'] as const;

function allowedLabels(table: string): Set<string> {
  const dir = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const constraint = `${table}_validity_label_chk`;
  let labels: Set<string> | null = null;
  for (const f of files) {
    const sql = readFileSync(resolve(dir, f), 'utf8');
    const re = new RegExp(`ADD CONSTRAINT\\s+${constraint}[\\s\\S]*?;`, 'g');
    for (const m of sql.matchAll(re)) {
      labels = new Set([...m[0].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
    }
  }
  if (!labels) throw new Error(`no ${constraint} definition found in migrations`);
  return labels;
}

describe('validity_label CHECK constraints accept every client label', () => {
  for (const table of TABLES) {
    it(`${table}: every ValidityLabel is in the constraint`, () => {
      const allowed = allowedLabels(table);
      expect(allowed.size).toBeGreaterThanOrEqual(7);
      for (const label of VALIDITY_LABELS) {
        expect(allowed.has(label), `${label} is not accepted by ${table}_validity_label_chk`).toBe(true);
      }
    });
  }

  it('the client label list is exhaustive (recognition_response is a client label)', () => {
    expect(VALIDITY_LABELS).toContain('recognition_response');
    expect(VALIDITY_LABELS).toContain('manual_confirmed');
  });
});
