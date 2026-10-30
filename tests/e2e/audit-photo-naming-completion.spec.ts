/**
 * Photo Naming end-to-end clinical-save gate against isolated staging.
 *
 * Unlike route-entry smoke tests, this drives the actual full patient game,
 * deliberately loses the session-close acknowledgement, and confirms both
 * the visible recovery UI and the exact persisted attempt history. No speech
 * provider is called: answers are real UI taps on the manual picture choices.
 */
import { resolveE2EEnvironment } from '../../scripts/e2e-environment.mjs';
import { test, expect } from './fixtures/anonSession';

test.describe('Photo Naming final session: no false success or duplicate attempts', () => {
  test.describe.configure({ timeout: 210_000 });

  test('complete all visible trials; recover failed close; verify exact saved attempts and summary', async ({
    anonPage: page, isolatedSession,
  }) => {
    test.setTimeout(195_000);
    const settings = resolveE2EEnvironment();
    expect(settings.suite).toBe('staging');
    const { client, session } = isolatedSession;

    const readEvents = async () => {
      const { data, error } = await client.from('exercise_events')
        .select('id, session_id, trial_index, attempt_id, score, exercise_slug, validity_label, counts_toward_score, task_parameters, whisper_transcript, browser_transcript, sessions!inner(user_id)')
        .eq('sessions.user_id', session.user.id)
        .eq('exercise_slug', 'photo_naming')
        .order('trial_index');
      if (error) throw new Error('Photo Naming persistence query failed: ' + error.message);
      return data ?? [];
    };

    expect(await readEvents()).toHaveLength(0);
    let rejectSessionClose = true;
    let interceptedClose = 0;
    await page.route('**/rest/v1/sessions?*', async route => {
      const request = route.request();
      // Only this synthetic patient browser and exactly this isolated backend
      // are in scope. Never intercept or mutate a production environment.
      if (new URL(request.url()).origin !== settings.supabaseURL) {
        throw new Error('Photo Naming fault injection refuses non-staging Supabase origin');
      }
      if (request.method() === 'PATCH' &&
          /"ended_at"\s*:/.test(request.postData() ?? '') &&
          rejectSessionClose) {
        interceptedClose++;
        return route.fulfill({
          status: 503,
          headers: {
            'access-control-allow-origin': '*',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            code: 'AUDIT_SYNTHETIC_SESSION_CLOSE_FAILURE',
            message: 'Simulated closure failure; source patient records unchanged',
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/exercise/photo-naming');
    await expect(page).toHaveURL(/\/exercise\/photo-naming$/);
    const firstHearChoice = page.locator('button[aria-label^="Hear "]').first();
    const start = page.getByRole('button', { name: /^(start|begin|let'?s go)/i }).first();
    await expect(start.or(firstHearChoice).first()).toBeVisible({ timeout: 25_000 });
    if (await start.isVisible()) await start.click();

    const trialCounter = page.getByText('Trial', { exact: true }).locator('..');
    await expect(trialCounter).toContainText(/^Trial\s*1\s*\/\s*\d+$/, { timeout: 20_000 });
    // textContent is the same backing value Playwright's toContainText
    // assertion checks. innerText may omit visually-hidden "Trial" labels.
    const openingCounter = ((await trialCounter.textContent()) ?? '').replace(/\s+/g, ' ').trim();
    const totalTrials = Number(openingCounter.match(/Trial\s*1\s*\/\s*(\d+)/)?.[1]);
    expect(Number.isInteger(totalTrials)).toBe(true);
    expect(totalTrials).toBeGreaterThanOrEqual(3);
    expect(totalTrials).toBeLessThanOrEqual(20);

    for (let trial = 1; trial <= totalTrials; trial++) {
      await expect(trialCounter).toHaveText(
        new RegExp(`^Trial\\s*${trial}\\s*\\/\\s*${totalTrials}$`),
        { timeout: 25_000 },
      );
      const hearChoice = page.locator('button[aria-label^="Hear "]').first();
      await expect(hearChoice).toBeVisible();
      const spokenLabel = await hearChoice.getAttribute('aria-label');
      expect(spokenLabel).toMatch(/^Hear .+/);
      const answer = page.getByRole('button', { name: spokenLabel!.slice(5), exact: true });
      await expect(answer).toBeEnabled();
      await answer.click();
      await expect.poll(readEvents, { timeout: 25_000 }).toHaveLength(trial);
    }

    await expect.poll(() => interceptedClose, { timeout: 30_000 }).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: 'Practice not saved' }))
      .toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/exercise\/photo-naming$/);
    const saved = await readEvents();
    expect(saved).toHaveLength(totalTrials);
    expect(saved.map(row => row.trial_index)).toEqual(
      Array.from({ length: totalTrials }, (_, index) => index + 1),
    );
    expect(new Set(saved.map(row => row.attempt_id)).size).toBe(totalTrials);
    expect(new Set(saved.map(row => row.session_id)).size).toBe(1);
    expect(saved.every(row => row.sessions.user_id === session.user.id)).toBe(true);
    // A patient tapped visible picture choices rather than speaking words.
    // These are legitimate scored *recognition tasks*. A stale transcript,
    // prior mic start, or absent audio must never turn them into ASR trials.
    for (const row of saved) {
      const params = row.task_parameters as Record<string, unknown> | null;
      expect(params?.trial_mode).toBe('recognition');
      expect(params?.response_mode).toBe('recognition');
      expect(row.counts_toward_score).toBe(true);
      expect(row.validity_label).toBeNull();
      expect(params?.asr_verified).toBe(false);
    }
    const id = saved[0].session_id!;
    const readSpeechEvidence = async () => {
      const { data, error } = await client.from('utterance_analyses')
        .select('attempt_id, is_correct, counts_toward_score, audio_meta, transcript_source')
        .eq('session_id', id)
        .order('trial_index');
      if (error) throw new Error('Photo Naming original utterance read failed: ' + error.message);
      return data ?? [];
    };

    const readSession = async () => {
      const { data, error } = await client.from('sessions')
        .select('id, ended_at, summary, ended_reason')
        .eq('id', id)
        .single();
      if (error) throw new Error('Photo Naming clinical session lookup failed: ' + error.message);
      return data;
    };
    expect((await readSession()).ended_at).toBeNull();

    rejectSessionClose = false;
    await page.getByRole('button', { name: 'Try saving again' }).click();
    // Level-ups intentionally wait for a patient's explicit tap; do not
    // assume the recap's optional timer will advance this session.
    const recapContinue = page.getByRole('dialog', { name: 'Session progression summary' })
      .getByRole('button', { name: 'Continue' });
    try {
      await recapContinue.waitFor({ state: 'visible', timeout: 12_000 });
      await recapContinue.click();
    } catch {
      // A session without an eligible recap goes directly to Today.
      await expect(page).toHaveURL(/\/today$/, { timeout: 20_000 });
    }
    await expect(page).toHaveURL(/\/today$/, { timeout: 35_000 });
    await expect.poll(async () => (await readSession()).ended_at, { timeout: 25_000 }).not.toBeNull();
    const final = await readSession();
    expect(final.ended_reason).toBe('completed');
    // The child game must not close the session until its separate
    // utterance_analyses writer acknowledges ALL original attempt IDs.
    const speechRows = await readSpeechEvidence();
    expect(speechRows).toHaveLength(totalTrials);
    expect(new Set(speechRows.map(row => row.attempt_id)).size).toBe(totalTrials);
    for (const row of speechRows) {
      expect(row.is_correct).toBeNull();
      expect(row.counts_toward_score).toBe(false);
      expect((row.audio_meta as Record<string, unknown> | null)?.responseMode)
        .toBe('recognition');
    }
    expect(final.summary).toMatchObject({
      scored_trials: totalTrials,
      participation_trials: totalTrials,
      asr_scored_trials: 0,
      asr_accuracy: null,
    });
    expect(await readEvents()).toEqual(saved);

    // Browser reload must not make two saves for the same original attempts.
    await page.reload();
    expect(await readEvents()).toEqual(saved);
  });
});
