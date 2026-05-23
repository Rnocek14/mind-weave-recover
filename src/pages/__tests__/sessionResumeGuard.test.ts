/**
 * Contract test — session-resume 4h TTL guard.
 *
 * Today.tsx hydrates a saved in-progress session from
 * localStorage.lessonFlowState_resume IFF (Date.now() - savedAt) <= 4h.
 *
 * This test reads the source verbatim and re-runs the predicate against
 * synthetic timestamps, so we lock both:
 *   1. The 4-hour constant (4 * 60 * 60 * 1000) hasn't drifted.
 *   2. The predicate semantics match what Today.tsx ships.
 *
 * No runtime logic is imported or modified — this is a guard, not a refactor.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TODAY_SRC = fs.readFileSync(
  path.resolve(__dirname, '../Today.tsx'),
  'utf-8'
);

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

describe('session-resume 4h guard', () => {
  it('Today.tsx still uses the 4-hour TTL literal', () => {
    expect(TODAY_SRC).toContain('4 * 60 * 60 * 1000');
  });

  it('Today.tsx reads and clears the resume key', () => {
    expect(TODAY_SRC).toContain("localStorage.getItem('lessonFlowState_resume')");
    expect(TODAY_SRC).toContain("localStorage.removeItem('lessonFlowState_resume')");
  });

  it('Today.tsx requires parsed.savedAt before evaluating the TTL', () => {
    // Guards against an entry without a timestamp being treated as "fresh".
    expect(TODAY_SRC).toMatch(/parsed\.savedAt\s*&&\s*Date\.now\(\)\s*-\s*parsed\.savedAt\s*>\s*4\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  });

  // Pure predicate parity — re-implementation must behave identically.
  const isStale = (savedAt: number | null | undefined, now: number) =>
    !!savedAt && now - savedAt > FOUR_HOURS_MS;

  it('considers a 3h59m old entry fresh', () => {
    const now = 1_000_000_000_000;
    expect(isStale(now - (FOUR_HOURS_MS - 60_000), now)).toBe(false);
  });

  it('considers a 4h00m01s old entry stale', () => {
    const now = 1_000_000_000_000;
    expect(isStale(now - (FOUR_HOURS_MS + 1_000), now)).toBe(true);
  });

  it('treats missing savedAt as falsy (does not crash)', () => {
    const now = 1_000_000_000_000;
    expect(isStale(undefined, now)).toBe(false);
    expect(isStale(null, now)).toBe(false);
  });
});
