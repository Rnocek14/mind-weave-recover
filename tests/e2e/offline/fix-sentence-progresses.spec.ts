/**
 * Fix the Sentence — the ladder moves when the patient does what the level asks.
 *
 * Level 1 is the most scaffolded rung: the wrong word is highlighted and the
 * patient picks the repair from four tiles. That IS Level 1's target support,
 * so correct tiles earn progress — the session-end recap must show the bar
 * moving, and the persisted row must carry it. (Contrast Photo Naming, where a
 * tap is recognition and earns nothing by design.)
 */
import { test, expect, USER_ID, PROFILE_ID } from '../fixtures/fakeSupabase';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import {
  FIX_SENTENCE_BANK,
  FIX_SENTENCE_TWO_ERROR_BANK,
  FIX_SENTENCE_MORPHOLOGY_BANK,
} from '../../../src/data/fixSentenceBank';

const SHOTS = process.env.DEMO_SHOTS_DIR ?? 'test-results/demo-shots';
mkdirSync(SHOTS, { recursive: true });

const ALL = [...FIX_SENTENCE_BANK, ...FIX_SENTENCE_TWO_ERROR_BANK, ...FIX_SENTENCE_MORPHOLOGY_BANK];
const norm = (s: string) => s.toLowerCase().replace(/[.,!?'"]/g, ' ').replace(/\s+/g, ' ').trim();

async function openFixSentence(page: Page) {
  await page.goto('/exercise/fix-sentence');
  await page.waitForLoadState('networkidle');
  expect(new URL(page.url()).pathname).toBe('/exercise/fix-sentence');
  const start = page.getByRole('button', { name: /start|begin|let'?s go/i }).first();
  if (await start.isVisible({ timeout: 2000 }).catch(() => false)) await start.click();
}

/** The bank item on screen — sentence text is unique per item. */
async function trialOnScreen(page: Page) {
  const text = norm(await page.locator('body').innerText());
  const hit = ALL.find((t) => text.includes(norm(t.sentence)));
  if (!hit) throw new Error('no bank sentence found on screen');
  return hit;
}

async function tapCorrectTile(page: Page): Promise<boolean> {
  const tiles = page.getByTestId('choice-tiles');
  await expect(tiles).toBeVisible({ timeout: 20_000 });
  const trial = await trialOnScreen(page);
  const buttons = tiles.locator('button');
  const n = await buttons.count();
  for (let i = 0; i < n; i++) {
    const label = ((await buttons.nth(i).textContent()) ?? '').trim().toLowerCase();
    if (trial.acceptedFixes.some((f) => f.toLowerCase() === label)) {
      await buttons.nth(i).click();
      return true;
    }
  }
  await buttons.first().click();
  return false;
}

async function waitForNextTrialOrEnd(page: Page, previousSentence: string) {
  await Promise.race([
    page.waitForFunction(
      (prev) => !document.body.innerText.toLowerCase().includes(prev),
      previousSentence.toLowerCase(),
      { timeout: 20_000 },
    ),
    page.getByRole('dialog', { name: /session progression summary/i }).waitFor({ timeout: 20_000 }),
  ]).catch(() => {});
}

test.describe('Fix the Sentence at Level 1', () => {
  test('correct tiles bank progress and the recap shows the bar moving', async ({ offlinePage: page, backend }) => {
    test.setTimeout(240_000);
    await openFixSentence(page);

    // Level 1 scaffolding: tiles present, the wrong word highlighted.
    await expect(page.getByTestId('choice-tiles')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.decoration-wavy').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/fix-sentence-01-level1-tiles.png` });

    let honoured = 0;
    let answered = 0;
    for (let i = 0; i < 12; i++) {
      const tiles = page.getByTestId('choice-tiles');
      if (!(await tiles.isVisible().catch(() => false))) break;
      const trial = await trialOnScreen(page);
      if (await tapCorrectTile(page)) honoured++;
      answered++;
      await waitForNextTrialOrEnd(page, trial.sentence.slice(0, 24));
    }
    expect(answered).toBeGreaterThanOrEqual(3);
    expect(honoured, 'the harness must be able to pick the accepted fix').toBeGreaterThanOrEqual(answered - 1);

    // Recap: the bar moved.
    const recap = page.getByRole('dialog', { name: /session progression summary/i });
    await expect(recap).toBeVisible({ timeout: 20_000 });
    await expect(recap.getByText(/toward Level 2 this session/i)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/fix-sentence-02-recap-progress.png` });

    // Persisted: the ladder row carries the progress and the support level.
    const started = Date.now();
    while (backend.rows('clinical_progression_state').length < 1 && Date.now() - started < 20_000) {
      await new Promise((r) => setTimeout(r, 250));
    }
    const row = backend.rows('clinical_progression_state')[0];
    expect(row?.exercise_slug).toBe('fix-sentence');
    expect(Number(row?.progress_pct)).toBeGreaterThan(0);
    expect(row?.user_id).toBe(USER_ID);
    expect(row?.profile_id).toBe(PROFILE_ID);

    const events = backend.rows('exercise_events').filter((e) => e.exercise_slug === 'fix_sentence');
    expect(events.length).toBeGreaterThanOrEqual(answered);
    expect(events.filter((e) => Number(e.score) === 100).length).toBeGreaterThanOrEqual(honoured);
    console.log('FIX SENTENCE ROW:', JSON.stringify(row));
    console.log('UNMATCHED:', backend.unmatched.map((u) => `${u.method} ${u.path}`));
    expect(backend.pageErrors).toEqual([]);
  });
});
