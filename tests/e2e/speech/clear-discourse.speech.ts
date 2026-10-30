/**
 * Test individual, real production speech-game components. Not a recorder
 * mock: the generated WAV traverses native Chromium getUserMedia and
 * MediaRecorder. We inject Web Speech *text* events separately because native
 * speech recognition may contact a vendor service.
 */
import { test, expect } from './support/speechTest';
import { emitRecognition, microphoneState } from './support/browserControls';
import { readJson } from './support/assertions';

const cases = [
  { game: 'narrative-retell', start: 'Tell it back now', slug: 'narrative_retell' },
  { game: 'abstract-compare', start: 'Explain similarities', slug: 'abstract_compare' },
  { game: 'multi-step-plan', start: 'Start planning', slug: 'multi_step_planning' },
] as const;

for (const scenario of cases) {
  test(`${scenario.game}: controlled mic capture, recognized answer and attempt-scoped discourse evidence`, async ({
    page, transport,
  }) => {
    await page.goto(`/?view=discourse&game=${scenario.game}`);
    await expect(page.getByTestId('speech-game-name')).toHaveText(scenario.game);
    await page.getByRole('button', { name: scenario.start, exact: true }).click();

    // The real recognizer hook must be active. The native recorded-audio stream
    // must be open before a speech transcript can be accepted.
    await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), {
      timeout: 12_000, message: `${scenario.game} did not start recognition`,
    }).toBe(true);
    await expect.poll(async () => (await microphoneState(page)).filter(s => s.tracks.includes('live')).length, {
      timeout: 10_000, message: `${scenario.game} did not acquire a native recording stream`,
    }).toBe(1);
    await expect.poll(async () => (await microphoneState(page)).find(s => s.tracks.includes('live'))?.ageMs ?? 0, {
      timeout: 10_000,
    }).toBeGreaterThan(1100);

    // The injected transcript intentionally differs from the WAV's spoken
    // "apple". This tests event-to-clinical-payload wiring, NOT recognition
    // accuracy. Real recognition and pronunciation need separate validation.
    const statement = 'I went to the store and brought home an apple for my family';
    await emitRecognition(page, statement);
    await expect(page.getByRole('button', { name: "I'm done" })).toBeVisible();
    await page.getByRole('button', { name: "I'm done" }).click();

    await expect.poll(async () => (await readJson<unknown[]>(page, 'speech-game-results')).length, {
      timeout: 20_000, message: `${scenario.game} never produced a trial result`,
    }).toBe(1);
    const rows = await readJson<Array<Record<string, unknown>>>(page, 'speech-game-results');
    expect(String(rows[0].transcript)).toContain('apple');
    expect(rows[0].skipped).not.toBe(true);

    await expect.poll(() => transport.utterances.length, {
      timeout: 20_000, message: `${scenario.game} did not submit one utterance row`,
    }).toBe(1);
    const saved = transport.utterances[0];
    expect(saved).toMatchObject({
      user_id: '11111111-1111-4111-8111-111111111111',
      session_id: '22222222-2222-4222-8222-222222222222',
      exercise_slug: scenario.slug,
    });
    expect(saved.attempt_id).toEqual(expect.any(String));
    expect(String(saved.transcript)).toContain('apple');
    expect(saved.fluency_available).toBe(false);
    expect(saved.gop_data ?? null).toBeNull();

    await expect.poll(() => transport.uploads.length, {
      timeout: 10_000, message: `${scenario.game} did not upload a real captured recording`,
    }).toBe(1);
    expect(transport.uploads[0].bytes).toBeGreaterThan(500);
    expect(transport.uploads[0].path).toMatch(/\/trial-\d+-\d+\.webm$/);
    expect(saved.audio_storage_path).toBe(transport.uploads[0].path);
    // These discourse games do not claim phoneme/ASR analysis based solely
    // on browser SpeechRecognition text.
    expect(transport.pronunciationRequests).toHaveLength(0);
  });
}
