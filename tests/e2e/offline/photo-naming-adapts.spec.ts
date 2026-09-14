/**
 * Photo Naming — the adaptation promises, proven in a real browser.
 *
 * These are the three things a clinician is told about the exercise:
 *   1. Keep getting them right and it gets harder — and it says so.
 *   2. Struggle and it eases off with more support — and it says so.
 *   3. The level you earn is the level you come back to.
 *
 * Each is asserted two ways: what the PATIENT sees (badge, toast, number of
 * choices) and what the app WROTE (adaptation_trial_logs.difficulty,
 * exercise_events, sessions, clinical_progression_state), read back from the
 * in-memory backend. Unit tests already lock the engine maths; this proves the
 * wiring between the maths and the screen.
 */
import { test, expect, USER_ID, PROFILE_ID, type FakeBackend } from '../fixtures/fakeSupabase';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.DEMO_SHOTS_DIR ?? 'test-results/demo-shots';
mkdirSync(SHOTS, { recursive: true });

const TRIALS = 10;

async function openPhotoNaming(page: Page) {
  await page.goto('/exercise/photo-naming');
  await page.waitForLoadState('networkidle');
  expect(new URL(page.url()).pathname).toBe('/exercise/photo-naming');
  const start = page.getByRole('button', { name: /start|begin|let'?s go/i }).first();
  if (await start.isVisible({ timeout: 2000 }).catch(() => false)) await start.click();
  await expect(page.locator('button[aria-label^="Hear "]').first()).toBeVisible({ timeout: 30_000 });
}

/** The word the current photo shows — the built asset keeps its source name. */
async function currentTarget(page: Page): Promise<string> {
  const src = await page.locator('img[alt="Naming task"]').getAttribute('src');
  const file = (src ?? '').split('/').pop() ?? '';
  return file.replace(/-[A-Za-z0-9_-]{6,}\.(jpg|jpeg|png|webp)$/i, '').replace(/\.(jpg|jpeg|png|webp)$/i, '').toLowerCase();
}

async function chipWords(page: Page): Promise<string[]> {
  const labels = await page.locator('button[aria-label^="Hear "]').evaluateAll((els) =>
    els.map((e) => (e.getAttribute('aria-label') ?? '').replace(/^Hear /, '')),
  );
  return labels;
}

async function badge(page: Page): Promise<{ stars: number; aria: string }> {
  const el = page.locator('[role="status"][aria-label^="Today\'s Challenge"]').first();
  await expect(el).toBeVisible();
  const stars = await el.locator('svg.fill-current').count();
  const aria = (await el.getAttribute('aria-label')) ?? '';
  return { stars, aria };
}

/**
 * Answer the current trial. `correct` picks the chip matching the photo;
 * otherwise a chip that does not. Returns what was tapped and whether the
 * intended correctness could be honoured (a photo whose file name is not one
 * of the chips cannot be answered "correctly" on purpose).
 */
async function answer(page: Page, correct: boolean): Promise<{ word: string; honoured: boolean }> {
  const target = await currentTarget(page);
  const words = await chipWords(page);
  const match = words.find((w) => w.toLowerCase() === target);
  let pick: string | undefined;
  let honoured = true;
  if (correct) {
    pick = match;
    if (!pick) {
      pick = words[0];
      honoured = false;
    }
  } else {
    pick = words.find((w) => w.toLowerCase() !== target);
    if (!pick) {
      pick = words[0];
      honoured = false;
    }
  }
  const before = await page.locator('img[alt="Naming task"]').getAttribute('src');
  await page.getByRole('button', { name: pick!, exact: true }).click();
  // Feedback shows, then the game auto-advances or completes.
  await Promise.race([
    page.waitForFunction(
      (prev) => document.querySelector('img[alt="Naming task"]')?.getAttribute('src') !== prev,
      before,
      { timeout: 15_000 },
    ),
    page.getByText(/session complete|practice complete|great work|you did it|summary/i).first().waitFor({ timeout: 15_000 }),
  ]).catch(() => {});
  return { word: pick!, honoured };
}

async function playSession(page: Page, plan: boolean[], onEach?: (i: number) => Promise<void>) {
  const outcomes: Array<{ word: string; honoured: boolean }> = [];
  for (let i = 0; i < plan.length; i++) {
    const stillPlaying = await page.locator('button[aria-label^="Hear "]').first().isVisible().catch(() => false);
    if (!stillPlaying) break;
    outcomes.push(await answer(page, plan[i]));
    if (onEach) await onEach(i);
  }
  return outcomes;
}

function difficulties(backend: FakeBackend): number[] {
  return backend
    .rows('adaptation_trial_logs')
    .map((r) => Number(r.difficulty))
    .filter((n) => Number.isFinite(n));
}

async function waitForRows(backend: FakeBackend, table: string, min: number, timeoutMs = 20_000) {
  const started = Date.now();
  while (backend.rows(table).length < min && Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 250));
  }
  return backend.rows(table);
}

function level5Row() {
  const now = new Date().toISOString();
  return {
    user_id: USER_ID,
    profile_id: PROFILE_ID,
    exercise_slug: 'photo-naming',
    current_level: 5,
    progress_pct: 40,
    support_baseline: 0,
    stable_level: 5,
    consecutive_success_sessions: 2,
    consecutive_struggle_sessions: 0,
    last_session_id: null,
    last_updated_at: now,
    created_at: now,
  };
}

test.describe('Photo Naming adapts, visibly, and remembers', () => {
  test('sustained success steps difficulty up and the patient is told', async ({ offlinePage: page, backend }) => {
    test.setTimeout(180_000);
    await openPhotoNaming(page);
    await page.screenshot({ path: `${SHOTS}/photo-naming-01-new-patient-trial.png` });

    const start = await badge(page);
    let stepUpToastSeen = false;
    let toastShot = false;

    const outcomes = await playSession(page, Array(TRIALS).fill(true), async () => {
      const toast = page.getByText('Great progress!').first();
      if (await toast.isVisible().catch(() => false)) {
        stepUpToastSeen = true;
        if (!toastShot) {
          toastShot = true;
          await page.screenshot({ path: `${SHOTS}/photo-naming-02-step-up-toast.png` });
        }
      }
    });

    const honoured = outcomes.filter((o) => o.honoured).length;
    expect(honoured, 'the harness must be able to answer correctly on purpose').toBeGreaterThanOrEqual(TRIALS - 1);

    // The recap shows for ~8s on a no-level-up session, so read it now.
    // Recognition earns no EXPRESSIVE credit (progression spec §5.4): tapping
    // the right picture is diagnostic, not naming. The ladder does not move —
    // and the recap must say what would move it, not "your work still counts".
    const recap = page.getByRole('dialog', { name: /session progression summary/i });
    await expect(recap).toBeVisible({ timeout: 15_000 });
    await expect(recap.getByText(/saying each word out loud is what moves your level/i)).toBeVisible();
    await expect(recap.getByText(/your work still counts/i)).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/photo-naming-03b-recap-tap-only.png` });

    // What the app wrote.
    const events = await waitForRows(backend, 'exercise_events', TRIALS);
    expect(events.length).toBeGreaterThanOrEqual(TRIALS);
    console.log('EXERCISE_EVENT SAMPLE:', JSON.stringify(events[0]));
    const correct = events.filter((e) => Number(e.score) === 100).length;
    expect(correct, 'every honoured correct tap must be recorded as score 100').toBeGreaterThanOrEqual(honoured);
    // A tapped choice is a recognition response: recorded as such, scored on
    // the tap, kept out of speech accuracy. Before this, every tap was run
    // through the speech gate and stored as no_response.
    for (const e of events) {
      expect((e.task_parameters as Record<string, unknown>)?.trial_mode, 'taps must be recorded as recognition').toBe('recognition');
      expect(e.validity_label).toBe('recognition_response');
      expect(e.counts_toward_score, 'taps must stay out of the speech-accuracy series').toBe(false);
    }

    const logged = await waitForRows(backend, 'adaptation_trial_logs', TRIALS);
    const d = difficulties(backend);
    expect(logged.length).toBeGreaterThanOrEqual(TRIALS);
    expect(
      d[d.length - 1],
      `difficulty should have risen during an all-correct session: ${d.join(',')}`,
    ).toBeGreaterThan(d[0]);

    // What the patient was told.
    expect(stepUpToastSeen, 'the patient must be told when it gets harder').toBe(true);
    const end = await badge(page).catch(() => start);
    expect(end.stars, `badge stars must not fall on success (${start.aria} -> ${end.aria})`).toBeGreaterThanOrEqual(start.stars);

    // The session closed with a stamped accuracy summary and the ladder moved.
    const session = (await waitForRows(backend, 'sessions', 1))[0];
    await expect.poll(() => backend.rows('sessions')[0]?.ended_at ?? null, { timeout: 20_000 }).not.toBeNull();
    expect(session.ended_reason).toBe('completed');
    const summary = session.summary as Record<string, unknown>;
    console.log('SESSION SUMMARY:', JSON.stringify(summary));
    // Ten correct taps: ten recognition responses, all counted as participation,
    // none counted as speech.
    expect(summary.recognition_trials).toBe(TRIALS);
    expect(summary.recognition_accuracy).toBe(100);
    expect(summary.participation_trials).toBe(TRIALS);
    expect(summary.scored_trials).toBe(0);
    expect(summary.accuracy, 'speech accuracy must not be manufactured from taps').toBeUndefined();
    console.log('ADAPTATION LOGS:', JSON.stringify(backend.rows('adaptation_trial_logs').map((r) => ({
      difficulty: r.difficulty, correct: r.correct, cue_level: r.cue_level, trial_mode: r.trial_mode,
    }))));
    console.log('MASTERY ROWS:', JSON.stringify(backend.rows('user_skill_mastery')));

    const progression = await waitForRows(backend, 'clinical_progression_state', 1);
    expect(progression.length).toBe(1);
    expect(progression[0].exercise_slug).toBe('photo-naming');
    expect(Number(progression[0].progress_pct), 'recognition-only sessions bank no expressive progress').toBe(0);

    await page.screenshot({ path: `${SHOTS}/photo-naming-03-session-end.png`, fullPage: true });
    console.log('DIFFICULTY TRACE (all correct):', d.join(' '));
    console.log('PROGRESSION ROW:', JSON.stringify(progression[0]));
    console.log('UNMATCHED:', backend.unmatched.map((u) => `${u.method} ${u.path}`));
    expect(backend.pageErrors).toEqual([]);
    expect(backend.rejected).toEqual([]);
  });

  test('three misses step difficulty down and the patient is offered support', async ({ offlinePage: page, backend }) => {
    test.setTimeout(180_000);
    // A returning patient with room to come down from.
    backend.seed('clinical_progression_state', [level5Row()]);
    await openPhotoNaming(page);

    const start = await badge(page);
    let stepDownToastSeen = false;
    let shot = false;
    // Miss four, then recover — the recovery must not be punished further.
    const plan = [false, false, false, false, true, true, true, true, true, true];
    const outcomes = await playSession(page, plan, async () => {
      const toast = page.getByText('Adjusting difficulty').first();
      if (await toast.isVisible().catch(() => false)) {
        stepDownToastSeen = true;
        if (!shot) {
          shot = true;
          await page.screenshot({ path: `${SHOTS}/photo-naming-04-step-down-toast.png` });
        }
      }
    });
    expect(outcomes.slice(0, 4).every((o) => o.honoured), 'the harness must be able to miss on purpose').toBe(true);

    const d = difficulties(backend);
    await waitForRows(backend, 'adaptation_trial_logs', 4);
    expect(
      Math.min(...difficulties(backend)),
      `difficulty should have fallen after consecutive misses: ${difficulties(backend).join(',')}`,
    ).toBeLessThan(difficulties(backend)[0]);
    expect(stepDownToastSeen, 'the patient must be told when it eases off').toBe(true);

    const end = await badge(page).catch(() => start);
    expect(end.stars, `badge stars must not rise on struggle (${start.aria} -> ${end.aria})`).toBeLessThanOrEqual(start.stars);

    const events = await waitForRows(backend, 'exercise_events', 4);
    const wrong = events.filter((e) => Number(e.score) === 0).length;
    expect(wrong, 'misses must be recorded as score 0').toBeGreaterThanOrEqual(4);
    // A wrong tap is compared with the target (useful: which foil drew the
    // patient) but the record must say it was a tap, so no one reads a
    // paraphasia off a button press.
    for (const e of events.filter((ev) => Number(ev.score) === 0)) {
      expect((e.task_parameters as Record<string, unknown>)?.trial_mode).toBe('recognition');
      expect(String((e.error_classification as Record<string, unknown>)?.reasoning ?? '')).toMatch(/^Tap response/);
    }

    console.log('DIFFICULTY TRACE (4 misses then correct):', difficulties(backend).join(' '), '(first snapshot', d.join(' '), ')');
    console.log('UNMATCHED:', backend.unmatched.map((u) => `${u.method} ${u.path}`));
    expect(backend.pageErrors).toEqual([]);
    expect(backend.rejected).toEqual([]);
  });

  test('a returning Level-5 patient starts harder than a new one', async ({ browser }) => {
    test.setTimeout(120_000);
    const { installFakeSupabase } = await import('../fixtures/fakeSupabase');

    // New patient.
    const ctxNew = await browser.newContext();
    const beNew = await installFakeSupabase(ctxNew);
    const pNew = await ctxNew.newPage();
    await openPhotoNaming(pNew);
    const newBadge = await badge(pNew);
    const newChips = (await chipWords(pNew)).length;
    await pNew.screenshot({ path: `${SHOTS}/photo-naming-05-level1-start.png` });
    await answer(pNew, true);
    const newFirstDifficulty = (await waitForRows(beNew, 'adaptation_trial_logs', 1))[0]?.difficulty;
    await ctxNew.close();

    // Same exercise, patient who has earned Level 5.
    const ctxL5 = await browser.newContext();
    const beL5 = await installFakeSupabase(ctxL5, { seed: { clinical_progression_state: [level5Row()] } });
    const pL5 = await ctxL5.newPage();
    await openPhotoNaming(pL5);
    const l5Badge = await badge(pL5);
    const l5Chips = (await chipWords(pL5)).length;
    await pL5.screenshot({ path: `${SHOTS}/photo-naming-06-level5-start.png` });
    await answer(pL5, true);
    const l5FirstDifficulty = (await waitForRows(beL5, 'adaptation_trial_logs', 1))[0]?.difficulty;
    await ctxL5.close();

    console.log('NEW PATIENT: stars', newBadge.stars, 'chips', newChips, 'first difficulty', newFirstDifficulty, '|', newBadge.aria);
    console.log('LEVEL 5:     stars', l5Badge.stars, 'chips', l5Chips, 'first difficulty', l5FirstDifficulty, '|', l5Badge.aria);

    // Level 5's clinical floor is engine 6: four choices instead of three,
    // a higher star band, and a higher logged difficulty from the first trial.
    // Both show four chips: photoNamingIntensity pins foilChipCount at 4 on
    // every level, so the "3 chips below L4" step in generateChoices is dead.
    expect(newChips).toBe(4);
    expect(l5Chips).toBe(4);
    expect(l5Badge.stars).toBeGreaterThan(newBadge.stars);
    expect(Number(l5FirstDifficulty)).toBeGreaterThanOrEqual(6);
    expect(Number(l5FirstDifficulty)).toBeGreaterThan(Number(newFirstDifficulty));
  });
});
