/**
 * The type-check has to check something.
 *
 * CI ran `bunx tsc --noEmit` for the whole life of this project. That reads the
 * ROOT tsconfig.json, which is a solution-style config — `"files": []` plus two
 * project references — so it checked ZERO files and passed unconditionally.
 *
 * What went through that green step today: six phantom columns on
 * exercise_events, seven more on utterance_analyses, a duplicate key in an
 * object literal, and a const referenced ~170 lines before its declaration
 * which white-screened a whole game. Every one of them is something the
 * compiler catches in a second, when it is pointed at the source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');

describe('the CI type-check is pointed at the source', () => {
  it('the root tsconfig really does check nothing, which is why this matters', () => {
    const root = JSON.parse(
      readFileSync(path.join(ROOT, 'tsconfig.json'), 'utf8').replace(/\/\/.*$/gm, '')
    );
    // If this ever stops being true the guard below can be relaxed — but until
    // then, a bare `tsc --noEmit` is a no-op and must not be trusted.
    expect(root.files).toEqual([]);
    expect(Array.isArray(root.references)).toBe(true);
  });

  it('CI type-checks the app project explicitly, not the empty root', () => {
    const ci = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    const step = ci.slice(ci.indexOf('Type-check'));
    const run = step.slice(0, step.indexOf('\n\n'));
    expect(run, 'the Type-check step must name tsconfig.app.json').toContain('tsconfig.app.json');
    expect(
      /run:\s*bunx tsc --noEmit\s*$/m.test(run),
      'a bare `tsc --noEmit` checks zero files'
    ).toBe(false);
  });

  it('the typecheck script does the same, so local runs match CI', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.typecheck).toContain('tsconfig.app.json');
    expect(pkg.scripts.qa).toContain('typecheck');
  });
});
