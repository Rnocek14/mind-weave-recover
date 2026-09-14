/**
 * Minimal Pairs — every answer the patient gives is recorded.
 *
 * Until recently a correct answer here was never reported (the say-it
 * microphone was torn down within a frame of opening, and correct trials
 * waited on it), so a flawless session persisted nothing and a mixed session
 * was booked as pure failure. This drives the real component: every tap must
 * produce an exercise_events row and an adaptation log, the session must close
 * with a participation count, and the ladder row must be written.
 *
 * Headless Chromium has no working speech recognition, so the say-it step
 * resolves to "skipped" — exactly the path most home devices take.
 */
import { test, expect } from '../fixtures/fakeSupabase';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.DEMO_SHOTS_DIR ?? 'test-results/demo-shots';
mkdirSync(SHOTS, { recursive: true });

const tiles = (page: Page) => page.locator('button:has(img[alt^="Option"])');

test.describe('Minimal Pairs records what the patient does', () => {
  test('each tapped answer reaches telemetry, adaptation and the ladder', async ({ offlinePage: page, backend }) => {
    test.setTimeout(240_000);
    await page.goto('/exercise/minimal-pairs');
    await page.waitForLoadState('networkidle');
    expect(new URL(page.url()).pathname).toBe('/exercise/minimal-pairs');
    const start = page.getByRole('button', { name: /start|begin|let'?s go/i }).first();
    if (await start.isVisible({ timeout: 2000 }).catch(() => false)) await start.click();
    await expect(tiles(page).first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/minimal-pairs-01-trial.png` });

    let answered = 0;
    for (let i = 0; i < 10; i++) {
      const t = tiles(page);
      if (!(await t.first().isVisible().catch(() => false))) break;
      const srcBefore = await t.first().locator('img').getAttribute('src');
      await t.nth(i % 2).click();
      answered++;
      // Feedback → (say-it step, skipped without a mic) → next trial or completion.
      await Promise.race([
        page.waitForFunction(
          (prev) => {
            const img = document.querySelector('button img[alt^="Option"]');
            return !img || img.getAttribute('src') !== prev;
          },
          srcBefore,
          { timeout: 25_000 },
        ),
        page.getByRole('dialog', { name: /session progression summary/i }).waitFor({ timeout: 25_000 }),
      ]).catch(() => {});
    }
    expect(answered).toBeGreaterThanOrEqual(3);

    const wait = async (table: string, min: number) => {
      const started = Date.now();
      while (backend.rows(table).length < min && Date.now() - started < 25_000) {
        await new Promise((r) => setTimeout(r, 250));
      }
      return backend.rows(table);
    };
    const events = (await wait('exercise_events', answered)).filter((e) => e.exercise_slug === 'minimal_pairs');
    expect(events.length, 'every answered trial must be recorded — correct ones included').toBeGreaterThanOrEqual(answered);
    const scores = events.map((e) => Number(e.score));
    expect(scores.every((s) => s === 0 || s === 100)).toBe(true);

    const logs = (await wait('adaptation_trial_logs', answered)).filter((l) => l.exercise_slug === 'minimal_pairs');
    expect(logs.length).toBeGreaterThanOrEqual(answered);

    const rows = await wait('clinical_progression_state', 1);
    expect(rows.find((r) => r.exercise_slug === 'minimal-pairs')).toBeTruthy();

    await expect.poll(() => backend.rows('sessions')[0]?.ended_at ?? null, { timeout: 25_000 }).not.toBeNull();
    const summary = backend.rows('sessions')[0]?.summary as Record<string, unknown>;
    expect(Number(summary?.participation_trials ?? 0)).toBeGreaterThanOrEqual(answered);

    console.log('MINIMAL PAIRS scores:', scores.join(' '), '| difficulties:', logs.map((l) => l.difficulty).join(' '));
    console.log('MP SUMMARY:', JSON.stringify(summary));
    console.log('UNMATCHED:', backend.unmatched.map((u) => `${u.method} ${u.path}`));
    expect(backend.pageErrors).toEqual([]);
    expect(backend.rejected).toEqual([]);
  });
});
