/**
 * No write to the database may cast past the type checker.
 *
 * WHAT THIS IS FOR. For an unknown length of time, every single trial this app
 * recorded was thrown away. exercise_events inserts carried `engine_version`
 * and utterance_analyses upserts carried seven "Voice Engine v2 Phase 1" fields
 * — and not one of those columns existed. PostgREST rejects the whole statement
 * on the first unknown column (PGRST204), so nothing was written: no clinical
 * record, no history, nothing for the session summary to report. The end screen
 * saying "Session complete!" and nothing else was the visible end of it.
 *
 * Every one of those fields sat in a payload typed `any` or `Record<string,
 * any>`, or was handed to `.insert(x as any)`. The generated types were correct
 * and matched the live database exactly — all 1096 columns across 81 tables.
 * The only thing wrong was that nobody let TypeScript look.
 *
 * So the rule is not "remember to check the schema". The rule is that the
 * checker is never switched off on a write path, and this test keeps it on. A
 * bare `.insert(payload)` against a typed table cannot compile with a column
 * that does not exist.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Find every supabase write and report the ones whose TABLE or whole PAYLOAD
 * is cast to `any`, because those are what stop the schema being checked:
 *
 *   .from('exercise_events' as any)     table name — defeats the row type
 *   .insert(payload as any)             whole payload — defeats every column
 *   .insert({ ... } as any)             same, inline
 *
 * A cast on ONE property value (`{ summary: merged as any }`) is deliberately
 * not reported. jsonb columns are typed `Json`, and narrowing a value into one
 * is ordinary; it cannot introduce a column that does not exist, which is the
 * failure this test exists to prevent.
 *
 * The argument is extracted by balancing parentheses rather than by matching a
 * line, so a multi-line payload ending in `} as any,` is caught and an
 * unrelated call that merely ends the same way is not.
 */
function writeCastOffences(text: string): number[] {
  const offences: number[] = [];
  const lineOf = (idx: number) => text.slice(0, idx).split('\n').length;

  for (const m of text.matchAll(/\.from\s*\(\s*['"][^'"]+['"]\s+as\s+any\s*\)/g)) {
    offences.push(lineOf(m.index ?? 0));
  }

  for (const m of text.matchAll(/\.(insert|upsert|update)\s*\(/g)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    let depth = 0;
    let i = open;
    for (; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    // First argument only: stop at the top-level comma (upsert's options object
    // is a second argument and is not the payload).
    const inner = text.slice(open + 1, i);
    let d = 0;
    let firstArg = inner;
    for (let j = 0; j < inner.length; j++) {
      const c = inner[j];
      if (c === '(' || c === '{' || c === '[') d++;
      else if (c === ')' || c === '}' || c === ']') d--;
      else if (c === ',' && d === 0) {
        firstArg = inner.slice(0, j);
        break;
      }
    }
    if (/\bas\s+any\s*$/.test(firstArg.trim())) offences.push(lineOf(m.index ?? 0));
  }
  return offences;
}

describe('database writes are type-checked', () => {
  const files = sourceFiles(SRC);

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no insert, upsert or update casts its table or payload to any', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const lines = text.split('\n');
      for (const lineNo of writeCastOffences(text)) {
        offenders.push(`${path.relative(SRC, file)}:${lineNo}  ${(lines[lineNo - 1] ?? '').trim().slice(0, 110)}`);
      }
    }
    expect(
      offenders,
      'A write that casts to `any` cannot be checked against the schema. That is ' +
        'exactly how engine_version and seven utterance_analyses columns shipped ' +
        'against tables that never had them, dropping every trial. Type the ' +
        'payload as TablesInsert<"table"> instead.\n' +
        offenders.join('\n')
    ).toEqual([]);
  });

  it('the two payloads that caused this are typed, not any', () => {
    const telemetry = readFileSync(path.join(SRC, 'hooks/useExerciseTelemetry.ts'), 'utf8');
    expect(telemetry).toContain("TablesInsert<'exercise_events'>");
    expect(telemetry).not.toContain('const eventData: any');

    const utterance = readFileSync(path.join(SRC, 'hooks/useUtteranceLogger.ts'), 'utf8');
    expect(utterance).toContain("TablesInsert<'utterance_analyses'>");
    expect(utterance).not.toContain('const payload: Record<string, any>');
  });
});
