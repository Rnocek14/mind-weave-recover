/**
 * True Chromium MediaRecorder audio + real production pronunciation calls,
 * controlled Web Speech text and HTTP transport. This is neither live Azure
 * quality validation nor an authenticated database persistence test.
 */
import { test, expect } from './support/speechTest';
import { emitRecognition, microphoneState } from './support/browserControls';
import { readJson } from './support/assertions';
import { TWO_CLUES_PUZZLES } from '../../../src/data/twoCluesBank';

test('Two Clues: valid spoken anchor is recorded and tied to one scored utterance', async ({
  page, transport,
}) => {
  await page.goto('/?view=lexical&game=two-clues');
  await expect(page.getByTestId('lexical-game-name')).toHaveText('two-clues');
  const clueContainer = page.getByText('What word connects these clues?').locator('..');
  const clues = (await clueContainer.locator('div.px-4.py-3').allInnerTexts()).map(c => c.trim());
  expect(clues.length).toBeGreaterThanOrEqual(2);
  const currentPuzzle = TWO_CLUES_PUZZLES.find(p =>
    p.clues.length === clues.length && p.clues.every(c => clues.includes(c)));
  expect(currentPuzzle, 'The visible clues must correspond to an actual clinical-bank puzzle').toBeDefined();

  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), {
    timeout: 12_000,
  }).toBe(true);
  await expect.poll(async () => (await microphoneState(page)).filter(s => s.tracks.includes('live')).length, {
    timeout: 10_000,
  }).toBe(1);
  await expect.poll(async () => (await microphoneState(page)).find(s => s.tracks.includes('live'))?.ageMs ?? 0).toBeGreaterThan(1100);

  await emitRecognition(page, currentPuzzle!.anchors[0]);
  await expect.poll(async () => (await readJson<unknown[]>(page, 'lexical-results')).length, {
    timeout: 18_000, message: 'A spoken correct anchor never reached the real game result',
  }).toBe(1);
  const [result] = await readJson<Array<Record<string, unknown>>>(page, 'lexical-results');
  expect(result.spokenWord).toBe(currentPuzzle!.anchors[0]);

  await expect.poll(() => transport.utterances.length, { timeout: 15_000 }).toBe(1);
  expect(transport.utterances[0]).toMatchObject({
    user_id: '11111111-1111-4111-8111-111111111111',
    session_id: '22222222-2222-4222-8222-222222222222',
    exercise_slug: 'two_clues',
  });
  expect(transport.utterances[0].attempt_id).toEqual(expect.any(String));
  expect(transport.uploads).toHaveLength(1);
  expect(transport.uploads[0].bytes).toBeGreaterThan(500);
  expect(transport.pronunciationRequests).toHaveLength(1);
  expect(transport.utterances[0].audio_storage_path).toBe(transport.uploads[0].path);
});

test('Dual Load Naming: real picture-naming mic creates pronunciation and utterance evidence', async ({
  page, transport,
}) => {
  await page.goto('/?view=lexical&game=dual-load-naming');
  await expect(page.getByTestId('lexical-game-name')).toHaveText('dual-load-naming');
  await page.getByRole('button', { name: /I've memorized them.*start naming/i }).click();
  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), {
    timeout: 12_000,
  }).toBe(true);
  await expect.poll(async () => (await microphoneState(page)).filter(s => s.tracks.includes('live')).length, {
    timeout: 10_000,
  }).toBe(1);
  await expect.poll(async () => (await microphoneState(page)).find(s => s.tracks.includes('live'))?.ageMs ?? 0).toBeGreaterThan(1100);
  await emitRecognition(page, 'apple');

  await expect.poll(() => transport.utterances.length, {
    timeout: 15_000,
    message: 'Dual Load Naming did not log the spoken naming attempt',
  }).toBe(1);
  expect(transport.utterances[0]).toMatchObject({
    user_id: '11111111-1111-4111-8111-111111111111',
    session_id: '22222222-2222-4222-8222-222222222222',
    exercise_slug: 'dual_load_naming',
    transcript: 'apple',
  });
  expect(transport.utterances[0].attempt_id).toEqual(expect.any(String));
  expect(transport.pronunciationRequests).toHaveLength(1);
  expect(transport.uploads).toHaveLength(1);
  expect(transport.uploads[0].bytes).toBeGreaterThan(500);
  expect(transport.utterances[0].audio_storage_path).toBe(transport.uploads[0].path);
});
