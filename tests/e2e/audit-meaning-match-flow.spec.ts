/**
 * A complete Meaning Match journey on the isolated, synthetic-only backend.
 *
 * This executes the actual React game, validates the correct and incorrect
 * feedback paths, captures a hint, waits for durable exercise_events, checks
 * clinical summary reconciliation, reloads, and checks real API ownership.
 * No speech model is called: this is a receptive-choice therapy task.
 */
import { createClient } from '@supabase/supabase-js';
import { MEANING_MATCH_ITEMS } from '../../src/data/meaningMatchItems';
import { resolveE2EEnvironment } from '../../scripts/e2e-environment.mjs';
import { test, expect } from './fixtures/anonSession';

test.describe('Audit: Meaning Match complete recognition exercise', () => {
  test.describe.configure({ timeout: 155_000 });
  test('correct, wrong + hint, final commit, saved evidence, reload and cross-user denial', async ({
    anonPage: page, isolatedSession,
  }) => {
    test.setTimeout(120_000);
    const { client, session } = isolatedSession;
    const settings = resolveE2EEnvironment();
    expect(settings.suite).toBe('staging');

    const readTrials = async () => {
      const { data, error } = await client
        .from('exercise_events')
        .select('id, session_id, exercise_slug, attempt_id, trial_index, score, cue_level, reaction_time_ms, task_parameters, sessions!inner(user_id)')
        .eq('sessions.user_id', session.user.id)
        .eq('exercise_slug', 'meaning_match')
        .order('trial_index');
      if (error) throw new Error('Could not verify Meaning Match trial persistence: ' + error.message);
      return data ?? [];
    };

    expect(await readTrials()).toHaveLength(0);

    // Set the actual React Router location.state before the bundle mounts.
    // This is the real 2-round mode, not a mocked game engine.
    await page.addInitScript(() => {
      if (location.pathname === '/exercise/meaning-match') {
        const existing = history.state ?? {};
        history.replaceState({
          ...existing,
          usr: { ...(existing.usr ?? {}), trialLimit: 2 },
        }, '', location.href);
      }
    });

    await page.goto('/exercise/meaning-match');
    await expect(page.getByText('1 of 2', { exact: true })).toBeVisible({ timeout: 25_000 });

    const readCurrentBankItem = async () => {
      const sentence = (await page.locator('p.text-lg.leading-relaxed').first().innerText()).trim();
      const item = MEANING_MATCH_ITEMS.find(entry => entry.sentence === sentence);
      expect(item, 'The displayed sentence must come from the actual clinical bank').toBeDefined();
      return item!;
    };
    const clickDisplayedOption = async (optionText: string) => {
      const choice = page.getByRole('button').filter({ hasText: optionText });
      await expect(choice, 'Expected a unique displayed choice: ' + optionText).toHaveCount(1);
      await choice.click();
    };

    const firstItem = await readCurrentBankItem();
    const firstCorrect = firstItem.options[firstItem.correctIndex];
    await clickDisplayedOption(firstCorrect);
    await expect(page.getByText('Correct', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Next/ }).click();
    await expect.poll(readTrials, { timeout: 20_000 }).toHaveLength(1);
    await expect(page.getByText('2 of 2', { exact: true })).toBeVisible();

    const secondItem = await readCurrentBankItem();
    const secondCorrect = secondItem.options[secondItem.correctIndex];
    const secondWrong = secondItem.options.find((_, index) => index !== secondItem.correctIndex)!;
    await page.getByRole('button', { name: /Highlight keywords|first letter hint/i }).click();
    await clickDisplayedOption(secondWrong);
    await expect(page.getByText('Not quite', { exact: true })).toBeVisible();
    await expect(page.locator('p').filter({ hasText: 'Answer:' }).first()).toContainText(secondCorrect);
    await page.getByRole('button', { name: /Next/ }).click();
    await expect(page.getByRole('heading', { name: 'Arena Complete!' })).toBeVisible({ timeout: 25_000 });
    await expect.poll(readTrials, { timeout: 20_000 }).toHaveLength(2);

    const rows = await readTrials();
    expect(rows.map(row => row.trial_index)).toEqual([1, 2]);
    expect(rows.map(row => row.score)).toEqual([100, 0]);
    expect(rows.map(row => row.cue_level)).toEqual([0, 1]);
    expect(rows.map(row => row.exercise_slug)).toEqual(['meaning_match', 'meaning_match']);
    expect(new Set(rows.map(row => row.id)).size).toBe(2);
    expect(new Set(rows.map(row => row.attempt_id)).size).toBe(2);
    expect(rows[0].session_id).toBeTruthy();
    expect(rows[1].session_id).toBe(rows[0].session_id);
    expect(rows.every(row => row.sessions.user_id === session.user.id)).toBe(true);
    for (const row of rows) {
      expect(row.attempt_id).toBeTruthy();
      expect(Number.isFinite(row.reaction_time_ms)).toBe(true);
      expect(row.reaction_time_ms).toBeGreaterThanOrEqual(0);
    }
    expect(rows[0].task_parameters).toMatchObject({
      unified_trial_v1: true,
      trial_mode: 'recognition',
      support_used: 'recognition_only',
      item_id: firstItem.id,
      expected_response: firstCorrect,
      user_response: firstCorrect,
    });
    expect(rows[1].task_parameters).toMatchObject({
      unified_trial_v1: true,
      trial_mode: 'recognition',
      support_used: 'semantic_cue',
      item_id: secondItem.id,
      expected_response: secondCorrect,
      user_response: secondWrong,
    });
    for (const row of rows) {
      const task = row.task_parameters as Record<string, unknown>;
      expect(task.selected_index).toBeGreaterThanOrEqual(0);
      expect(task.correct_index).toBeGreaterThanOrEqual(0);
      expect(task.selected_index).toBeLessThan(4);
      expect(task.correct_index).toBeLessThan(4);
    }
    expect((rows[0].task_parameters as Record<string, unknown>).selected_index)
      .toBe((rows[0].task_parameters as Record<string, unknown>).correct_index);
    expect((rows[1].task_parameters as Record<string, unknown>).selected_index)
      .not.toBe((rows[1].task_parameters as Record<string, unknown>).correct_index);

    const savedSessionId = rows[0].session_id!;
    const readSession = async () => {
      const { data, error } = await client.from('sessions')
        .select('id, ended_at, summary')
        .eq('id', savedSessionId)
        .single();
      if (error) throw new Error('Could not read own completed session: ' + error.message);
      return data;
    };
    await expect.poll(async () => (await readSession()).ended_at, { timeout: 20_000 }).not.toBeNull();
    const finishedSession = await readSession();
    expect(finishedSession.summary).toMatchObject({
      accuracy: 50,
      asr_accuracy: null,
      asr_scored_trials: 0,
      independent_accuracy: 100,
      cue_assisted_accuracy: 0,
      scored_trials: 2,
    });

    // A real reload must not duplicate or rewrite historical attempts.
    await page.reload();
    await expect.poll(readTrials, { timeout: 20_000 }).toEqual(rows);

    // A second real isolated user may not read another patient's session or
    // its event records through the exposed REST API.
    const other = createClient(settings.supabaseURL, settings.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: otherLogin, error: loginError } = await other.auth.signInAnonymously();
    if (loginError || !otherLogin.session) throw new Error('Isolated cross-user test account unavailable');
    try {
      const otherSessions = await other.from('sessions').select('id').eq('id', savedSessionId);
      expect(otherSessions.error).toBeNull();
      expect(otherSessions.data).toEqual([]);
      const otherEvents = await other.from('exercise_events').select('id').eq('session_id', savedSessionId);
      expect(otherEvents.error).toBeNull();
      expect(otherEvents.data).toEqual([]);
    } finally {
      await other.auth.signOut();
    }
  });
  test('does not celebrate or advance after a simulated session close failure', async ({ anonPage: page }) => {
    test.setTimeout(120_000);
    let rejectedClose = 0;
    // The real game runs against isolated staging. Only the final persistence
    // response is fault-injected; no permissions or patient records are altered.
    await page.route('**/rest/v1/sessions?*', async route => {
      const req = route.request();
      if (req.method() === 'PATCH' && /"ended_at"\s*:/.test(req.postData() ?? '')) {
        rejectedClose += 1;
        return route.fulfill({
          status: 503,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify({ code: 'AUDIT_SIMULATED_FAILURE', message: 'Synthetic save failure' }),
        });
      }
      return route.continue();
    });
    await page.addInitScript(() => {
      if (location.pathname === '/exercise/meaning-match') {
        const state = history.state ?? {};
        history.replaceState({ ...state, usr: { ...(state.usr ?? {}), trialLimit: 2 } }, '', location.href);
      }
    });
    await page.goto('/exercise/meaning-match');
    for (let i = 1; i <= 2; i++) {
      await expect(page.getByText(i + ' of 2', { exact: true })).toBeVisible({ timeout: 25_000 });
      await page.getByRole('button', { name: /^A\./ }).click();
      await page.getByRole('button', { name: /Next/ }).click();
    }
    await expect.poll(() => rejectedClose, { timeout: 20_000 }).toBeGreaterThan(0);
    await expect(page.getByRole('alert')).toContainText(/not saved|couldn't save|could not save/i, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: /try saving again/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Arena Complete!' })).toHaveCount(0);
  });

});
