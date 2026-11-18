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

test('Photo Naming holds a scored trial behind Pause and saves it once after resume', async ({ anonPage: page, isolatedSession }) => {
  test.slow();
  await page.goto('/exercise/photo-naming');
  const counter = page.getByText('Trial', { exact: true }).locator('..');
  await expect(counter).toHaveText(/^Trial\s*1\s*\/\s*10$/i, { timeout: 20_000 });
  const label = await page.locator('button[aria-label^="Hear "]').first().getAttribute('aria-label');
  await page.clock.install();
  await page.getByRole('button', { name: label!.slice(5), exact: true }).click();
  await expect(page.getByText(/^(You found the word!|The word is ".+"\.)$/)).toBeVisible();
  await page.getByRole('button', { name: 'Pause session', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Session paused' })).toBeVisible();
  await page.clock.runFor(3_000);
  await expect(counter).toHaveText(/^Trial\s*1\s*\/\s*10$/i);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor(2_000);
  await expect(counter).toHaveText(/^Trial\s*2\s*\/\s*10$/i);
  await expect.poll(async () => {
    const { data, error } = await isolatedSession.client.from('exercise_events')
      .select('trial_index, attempt_id, sessions!inner(user_id)').eq('exercise_slug', 'photo_naming')
      .eq('sessions.user_id', isolatedSession.session.user.id);
    if (error) throw error;
    return data?.map(event => ({ index: event.trial_index, identified: Boolean(event.attempt_id) }));
  }, { timeout: 15_000 }).toEqual([{ index: 1, identified: true }]);
});

test('finishing Photo Naming and starting again separates the next attempt and preserves the prior level', async ({ anonPage: page, isolatedSession }) => {
  test.setTimeout(150_000);
  const { client, session } = isolatedSession;
  const events = async () => {
    const { data, error } = await client.from('exercise_events')
      .select('session_id, trial_index, attempt_id, sessions!inner(user_id, profile_id)')
      .eq('sessions.user_id', session.user.id).eq('exercise_slug', 'photo_naming');
    if (error) throw error;
    return data ?? [];
  };
  const answer = async (index: number) => {
    const counter = page.getByText('Trial', { exact: true }).locator('..');
    await expect(counter).toHaveText(new RegExp(`^Trial\\s*${index}\\s*/\\s*10$`, 'i'), { timeout: 20_000 });
    const word = await page.locator('button[aria-label^="Hear "]').first().getAttribute('aria-label');
    await page.getByRole('button', { name: word!.slice(5), exact: true }).click();
  };
  await page.goto('/exercise/photo-naming');
  for (let i = 1; i <= 10; i++) await answer(i);
  await expect.poll(async () => (await events()).length, { timeout: 20_000 }).toBe(10);
  const first = await events();
  expect(first.map(e => e.trial_index).sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const id = first[0].session_id;
  const profileId = first[0].sessions.profile_id;
  expect(profileId).toBeTruthy();
  expect(new Set(first.map(e => e.session_id)).size).toBe(1);
  expect(new Set(first.map(e => e.attempt_id)).size).toBe(10);
  const level = async () => {
    const { data, error } = await client.from('clinical_progression_state')
      .select('last_session_id,current_level,progress_pct,support_baseline')
      .eq('profile_id', profileId!).eq('exercise_slug', 'photo-naming').maybeSingle();
    if (error) throw error;
    return data;
  };
  await expect.poll(async () => (await level())?.last_session_id, { timeout: 20_000 }).toBe(id);
  await expect.poll(async () => {
    const { data, error } = await client.from('sessions').select('ended_at').eq('id', id!).single();
    if (error) throw error;
    return Boolean(data.ended_at);
  }, { timeout: 20_000 }).toBe(true);
  const previous = await level();
  await page.goto('/history');
  await page.goto('/exercise/photo-naming');
  await answer(1);
  await expect.poll(async () => (await events()).length, { timeout: 20_000 }).toBe(11);
  const all = await events();
  const second = all.filter(e => e.session_id !== id);
  expect(second).toHaveLength(1);
  expect(second[0]).toMatchObject({ trial_index: 1, sessions: { profile_id: profileId } });
  expect(first.map(e => e.attempt_id)).not.toContain(second[0].attempt_id);
  expect(await level()).toEqual(previous);
});

test('a Level 7 Photo Naming choice preserves cue depth, response mode and the actual engine difficulty', async ({ anonPage: page, isolatedSession }) => {
  test.slow();
  const { client, session } = isolatedSession;
  const { data: profile, error: profileError } = await client.from('profiles').select('id')
    .eq('user_id', session.user.id).eq('is_active', true).single();
  if (profileError) throw profileError;
  const { error: seedError } = await client.from('clinical_progression_state').upsert({
    user_id: session.user.id, profile_id: profile.id, exercise_slug: 'photo-naming',
    current_level: 7, stable_level: 7, progress_pct: 30, support_baseline: 0,
    consecutive_success_sessions: 0, consecutive_struggle_sessions: 0,
  }, { onConflict: 'profile_id,exercise_slug' });
  if (seedError) throw seedError;

  await page.goto('/exercise/photo-naming');
  await expect(page.getByText('Level 7 (30%)', { exact: true })).toBeVisible({ timeout: 20_000 });
  const hint = page.getByRole('button', { name: 'Need a hint?', exact: true });
  for (let n = 0; n < 3; n++) await hint.click();
  await expect(hint).toHaveCount(0);
  const label = await page.locator('button[aria-label^="Hear "]').first().getAttribute('aria-label');
  await page.getByRole('button', { name: label!.slice(5), exact: true }).click();

  const event = async () => {
    const { data, error } = await client.from('exercise_events')
      .select('session_id,cue_level,task_parameters,sessions!inner(profile_id)')
      .eq('sessions.profile_id', profile.id).eq('exercise_slug', 'photo_naming').maybeSingle();
    if (error) throw error;
    return data;
  };
  await expect.poll(event, { timeout: 20_000 }).toMatchObject({
    cue_level: 3, task_parameters: { trial_mode: 'recognition', support_used: 'recognition_only', difficulty_level: 8, game_level: 8 },
  });
  const sessionId = (await event())!.session_id!;
  const decisions = async () => {
    const { data, error } = await client.from('adaptation_trial_logs')
      .select('trial_mode,cue_level,difficulty,difficulty_change_from,difficulty_change_to,difficulty_change_direction')
      .eq('session_id', sessionId).eq('exercise_slug', 'photo_naming');
    if (error) throw error;
    return data;
  };
  await expect.poll(decisions, { timeout: 20_000 }).toHaveLength(1);
  const [decision] = (await decisions())!;
  expect(decision).toMatchObject({ trial_mode: 'recognition', cue_level: 3 });
  // A trial stores its presented difficulty. The adaptation row stores the
  // difficulty after the decision, together with the transition that produced it.
  if (decision.difficulty_change_direction) {
    expect(decision.difficulty_change_from).toBe(8);
    expect(decision.difficulty_change_to).toBe(decision.difficulty);
    if (decision.difficulty_change_direction === 'down') expect(decision.difficulty).toBeLessThan(8);
    else {
      expect(decision.difficulty_change_direction).toBe('up');
      expect(decision.difficulty).toBeGreaterThan(8);
    }
  } else {
    expect(decision).toMatchObject({ difficulty: 8, difficulty_change_from: null, difficulty_change_to: null });
  }
});
