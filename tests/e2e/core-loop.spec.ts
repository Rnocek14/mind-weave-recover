/** Real browser answers and real persistence, only in the isolated staging suite. */
import { test, expect } from './fixtures/anonSession';

test.describe('Core loop — Photo Naming trials persist', () => {
  test('answer three trials and verify their session ownership and persistence', async ({ anonPage: page, isolatedSession }) => {
    test.slow();
    const { session, client } = isolatedSession;
    // exercise_events has no user_id. Ownership is through its sessions FK.
    const readEvents = async () => {
      const { data, error } = await client
        .from('exercise_events')
        .select('id, session_id, exercise_slug, trial_index, attempt_id, reaction_time_ms, sessions!inner(user_id)')
        .eq('sessions.user_id', session.user.id)
        .eq('exercise_slug', 'photo_naming')
        .order('trial_index');
      if (error) throw new Error(`Cannot verify saved exercise events: ${error.message}`);
      return data ?? [];
    };
    const readUtterances = async () => {
      const { data, error } = await client
        .from('utterance_analyses')
        .select('id, user_id, attempt_id, session_id, trial_index, audio_meta')
        .eq('user_id', session.user.id)
        .eq('exercise_slug', 'photo_naming')
        .order('trial_index');
      if (error) throw new Error(`Cannot verify saved utterance analyses: ${error.message}`);
      return data ?? [];
    };
    // Every test receives a new anonymous user, so old data cannot make it pass.
    expect(await readEvents()).toHaveLength(0);
    expect(await readUtterances()).toHaveLength(0);
    await page.goto('/exercise/photo-naming');
    await expect(page).toHaveURL(/\/exercise\/photo-naming/);

    const startButton = page.getByRole('button', { name: /^(start|begin|let'?s go)/i }).first();
    const hearChoice = page.locator('button[aria-label^="Hear "]').first();
    await expect(startButton.or(hearChoice).first()).toBeVisible({ timeout: 20_000 });
    if (await startButton.isVisible()) await startButton.click();

    // The visible trial counter changes after feedback, so waiting on it avoids
    // arbitrary sleeps and accidental second taps on the previous trial.
    const trialCounter = page.getByText('Trial', { exact: true }).locator('..');
    const expectedTrials = 3;
    for (let index = 1; index <= expectedTrials; index++) {
      await expect(trialCounter).toHaveText(new RegExp(`^Trial\\s*${index}\\s*/\\s*\\d+$`), { timeout: 20_000 });
      await expect(hearChoice).toBeVisible();
      const spokenLabel = await hearChoice.getAttribute('aria-label');
      expect(spokenLabel).toMatch(/^Hear .+/);
      const answer = page.getByRole('button', { name: spokenLabel!.slice(5), exact: true });
      await expect(answer).toBeEnabled();
      await answer.click();
      await expect.poll(readEvents, {
        timeout: 20_000,
        message: `Trial ${index} must persist exactly once before the test advances`,
      }).toHaveLength(index);
      await expect.poll(readUtterances, {
        timeout: 20_000,
        message: `Trial ${index} must persist its accepted-answer timing exactly once`,
      }).toHaveLength(index);
    }

    const events = await readEvents();
    const utterances = await readUtterances();
    expect(events).toHaveLength(expectedTrials);
    expect(utterances).toHaveLength(expectedTrials);
    expect(events.map((event) => event.trial_index)).toEqual([1, 2, 3]);
    expect(utterances.map((utterance) => utterance.trial_index)).toEqual([1, 2, 3]);
    expect(new Set(events.map((event) => event.id)).size).toBe(expectedTrials);
    expect(new Set(events.map((event) => event.attempt_id)).size).toBe(expectedTrials);
    expect(new Set(events.map((event) => event.session_id)).size).toBe(1);
    expect(new Set(utterances.map((utterance) => utterance.id)).size).toBe(expectedTrials);
    expect(new Set(utterances.map((utterance) => utterance.attempt_id)).size).toBe(expectedTrials);
    for (const [index, event] of events.entries()) {
      expect(event.attempt_id).toBeTruthy();
      expect(event.session_id).toBeTruthy();
      expect(event.exercise_slug).toBe('photo_naming');
      expect(event.sessions.user_id).toBe(session.user.id);
      expect(Number.isFinite(event.reaction_time_ms)).toBe(true);
      expect(event.reaction_time_ms).toBeGreaterThanOrEqual(0);
      // Independent contract: both real writes must retain the same captured
      // answer time. This verifies persistence, not live ASR or pronunciation.
      expect(utterances[index]).toMatchObject({
        user_id: session.user.id,
        attempt_id: event.attempt_id,
        session_id: event.session_id,
        trial_index: event.trial_index,
        audio_meta: { responseTiming: {
          version: 1,
          basis: 'trial_start_to_answer_acceptance',
          elapsedMs: event.reaction_time_ms,
        } },
      });
    }
    // All selected identities and timing values must survive a real reload.
    await page.reload();
    await expect(page).toHaveURL(/\/exercise\/photo-naming/);
    expect(await readEvents()).toEqual(events);
    expect(await readUtterances()).toEqual(utterances);
  });
});
