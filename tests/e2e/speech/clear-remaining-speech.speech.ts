/**
 * Last three production speech journeys. Chromium uses its native
 * getUserMedia/MediaRecorder with a synthetic WAV; controlled Web Speech
 * events and explicit fake HTTP responses do not validate live ASR, semantic
 * accuracy, clinician scoring or authenticated persistence.
 */
import { test, expect } from './support/speechTest';
import { emitRecognition, microphoneState } from './support/browserControls';
import { readJson } from './support/assertions';

const sessionId = '22222222-2222-4222-8222-222222222222';
const userId = '11111111-1111-4111-8111-111111111111';

test('Thought Continuation: real prompt accepts contentful speech and writes attempt-scoped audio and discourse evidence', async ({
  page, transport,
}) => {
  await page.goto('/?view=remaining-speech&game=thought-continuation');
  await expect(page.getByTestId('remaining-speech-game-name')).toHaveText('thought-continuation');
  await expect(page.getByText('Finish the thought', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await microphoneState(page)).some(s => s.tracks.includes('live')), { timeout: 10_000 }).toBe(true);
  await expect.poll(async () => Math.max(0, ...(await microphoneState(page)).filter(s => s.tracks.includes('live')).map(s => s.ageMs))).toBeGreaterThan(1100);

  const response = 'I would make a warm breakfast and then visit the garden with my family later today';
  await emitRecognition(page, response);
  await expect(page.getByText(response, { exact: true })).toBeVisible({ timeout: 6_000 });
  await expect.poll(() => transport.utterances.length, { timeout: 20_000, message: 'Real thought response not logged' }).toBe(1);
  const row = transport.utterances[0];
  expect(row).toMatchObject({ exercise_slug: 'thought_continuation', user_id: userId, session_id: sessionId });
  expect(row.attempt_id).toEqual(expect.any(String));
  expect(String(row.transcript).toLowerCase()).toContain('warm breakfast');
  await expect.poll(() => transport.uploads.length, { timeout: 12_000 }).toBe(1);
  expect(transport.uploads[0].bytes).toBeGreaterThan(500);
  expect(row.audio_storage_path).toBe(transport.uploads[0].path);
  await expect.poll(() => transport.eventWrites.some(x => x.exercise_slug === 'thought_continuation'), {
    timeout: 12_000, message: 'Clinical discourse scoring did not attempt a structured event write',
  }).toBe(true);
  expect(transport.pronunciationRequests).toHaveLength(0);
});

test('Describe & Guess: contentful description passes the gate and persists a real captured speaking attempt', async ({
  page, transport,
}) => {
  await page.goto('/?view=remaining-speech&game=describe-guess');
  await expect(page.getByTestId('remaining-speech-game-name')).toHaveText('describe-guess');
  await expect(page.getByText(/Describe this.*without.*saying the word/i)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await microphoneState(page)).some(s => s.tracks.includes('live')), { timeout: 10_000 }).toBe(true);
  await expect.poll(async () => Math.max(0, ...(await microphoneState(page)).filter(s => s.tracks.includes('live')).map(s => s.ageMs))).toBeGreaterThan(1100);

  const answer = 'It has a smooth surface and a clear shape. You can find something like it around the house, and people use it in everyday life.';
  await emitRecognition(page, answer);
  await expect(page.getByText(/Heard:/)).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: "I'm done" }).click();
  await expect.poll(() => transport.utterances.length, { timeout: 18_000 }).toBe(1);
  const row = transport.utterances[0];
  expect(row).toMatchObject({ exercise_slug: 'describe_guess', user_id: userId, session_id: sessionId });
  expect(row.attempt_id).toEqual(expect.any(String));
  expect(String(row.transcript).toLowerCase()).toContain('smooth surface');
  await expect.poll(() => transport.uploads.length, { timeout: 12_000 }).toBe(1);
  expect(transport.uploads[0].bytes).toBeGreaterThan(500);
  expect(row.audio_storage_path).toBe(transport.uploads[0].path);
  await expect.poll(async () => (await readJson<unknown[]>(page, 'remaining-speech-results')).length, { timeout: 18_000 }).toBeGreaterThan(0);
});

test('Conversation Coach: first turn uses actual recorder, yields one attributed utterance and releases mic on exit', async ({
  page, transport,
}) => {
  await page.goto('/?view=remaining-speech&game=conversation-coach');
  await expect(page.getByRole('heading', { name: 'Conversation Coach' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Conversation' }).click();
  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), {
    timeout: 18_000, message: 'Coach did not enter listening mode after initial Maya line',
  }).toBe(true);
  await expect.poll(async () => (await microphoneState(page)).some(s => s.tracks.includes('live')), { timeout: 12_000 }).toBe(true);
  await expect.poll(async () => Math.max(0, ...(await microphoneState(page)).filter(s => s.tracks.includes('live')).map(s => s.ageMs))).toBeGreaterThan(1100);

  const answer = 'I went to the market today to get some fresh vegetables for dinner';
  await emitRecognition(page, answer);
  await expect(page.getByText(answer, { exact: true })).toBeVisible({ timeout: 7_000 });
  // The coach owns speech-end detection; do not simulate a second submission
  // by clicking Done after it already auto-advanced the turn.
  await expect.poll(() => transport.utterances.length, {
    timeout: 20_000, message: 'Coach did not persist one finalized speech attempt',
  }).toBe(1);
  const row = transport.utterances[0];
  expect(row).toMatchObject({ exercise_slug: 'conversation_coach', user_id: userId, session_id: sessionId });
  expect(row.attempt_id).toEqual(expect.any(String));
  expect(String(row.transcript).toLowerCase()).toContain('fresh vegetables');
  await expect.poll(() => transport.uploads.length, { timeout: 12_000 }).toBe(1);
  expect(transport.uploads[0].bytes).toBeGreaterThan(500);
  expect(row.audio_storage_path).toBe(transport.uploads[0].path);

  await page.getByTestId('end-remaining-speech-game').click();
  await expect(page.getByTestId('remaining-speech-exited')).toHaveText('exited');
  await expect.poll(async () => (await microphoneState(page)).every(s => !s.tracks.includes('live')), {
    timeout: 8_000, message: 'A coach mic track stayed live after the session was exited',
  }).toBe(true);
  expect(transport.utterances).toHaveLength(1);
});
