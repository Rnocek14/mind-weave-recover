import { test, expect } from './support/speechTest';
import { emitRecognition, microphoneState } from './support/browserControls';
import { readJson } from './support/assertions';


test('Phrase Practice: recognized exact phrase travels through real recorder, pronunciation and utterance logger', async ({
  page, transport,
}) => {
  await page.goto('/?view=phrase-sentence&game=phrase-practice');
  await expect(page.getByTestId('phrase-sentence-game-name')).toHaveText('phrase-practice');
  const target = (await page.locator('div.text-4xl.font-bold').first().innerText()).trim();
  expect(target.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Start Speaking' }).click();
  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), {
    timeout: 12_000,
  }).toBe(true);
  await expect.poll(async () => (await microphoneState(page)).filter(s => s.tracks.includes('live')).length, {
    timeout: 10_000,
  }).toBe(1);
  await expect.poll(async () => (await microphoneState(page)).find(s => s.tracks.includes('live'))?.ageMs ?? 0).toBeGreaterThan(1100);
  await emitRecognition(page, target);

  await expect.poll(async () => (await readJson<unknown[]>(page, 'phrase-sentence-results')).length, {
    timeout: 15_000, message: 'Exact phrase never reached production onTrialComplete callback',
  }).toBe(1);
  const [trial] = await readJson<Array<Record<string, unknown>>>(page, 'phrase-sentence-results');
  expect(trial.correct).toBe(true);
  expect(trial.whisperTranscript).toBe(target);
  await expect.poll(() => transport.utterances.length, { timeout: 15_000 }).toBe(1);
  expect(transport.utterances[0].exercise_slug).toBe('phrase_practice');
  expect(transport.utterances[0].attempt_id).toEqual(expect.any(String));
  expect(transport.utterances[0].transcript).toBe(target);
  expect(transport.uploads).toHaveLength(1);
  expect(transport.uploads[0].bytes).toBeGreaterThan(500);
  expect(transport.pronunciationRequests).toHaveLength(1);
  expect(transport.utterances[0].audio_storage_path).toBe(transport.uploads[0].path);
});

test('Fix the Sentence: spoken correct replacement, not a tile, enters actual recorder and clinical response', async ({
  page, transport,
}) => {
  await page.goto('/?view=phrase-sentence&game=fix-sentence');
  await expect(page.getByTestId('phrase-sentence-game-name')).toHaveText('fix-sentence');
  const displayedSentence = (await page.locator('p.text-2xl').first().innerText()).trim();
  const stimulusBank = await readJson<Array<{ sentence: string; acceptedFixes: string[] }>>(page, 'fix-sentence-bank');
  const item = stimulusBank.find(x => x.sentence === displayedSentence);
  expect(item, 'Active sentence must match the actual clinical bank').toBeDefined();

  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), {
    timeout: 15_000,
  }).toBe(true);
  await expect.poll(async () => (await microphoneState(page)).filter(s => s.tracks.includes('live')).length, {
    timeout: 12_000,
  }).toBe(1);
  await expect.poll(async () => (await microphoneState(page)).find(s => s.tracks.includes('live'))?.ageMs ?? 0).toBeGreaterThan(1100);
  await emitRecognition(page, item!.acceptedFixes[0]);
  await expect(page.getByText(item!.acceptedFixes[0], { exact: true }).first()).toBeVisible({ timeout: 8_000 });

  await expect.poll(async () => (await readJson<unknown[]>(page, 'phrase-sentence-results')).length, {
    timeout: 15_000, message: 'Spoken replacement was not scored by the actual game',
  }).toBe(1);
  const [trial] = await readJson<Array<Record<string, unknown>>>(page, 'phrase-sentence-results');
  expect(trial.isCorrect).toBe(true);
  await expect.poll(() => transport.utterances.length, { timeout: 15_000 }).toBe(1);
  expect(transport.utterances[0]).toMatchObject({
    exercise_slug: 'fix_sentence',
    user_id: '11111111-1111-4111-8111-111111111111',
    session_id: '22222222-2222-4222-8222-222222222222',
  });
  expect(transport.utterances[0].attempt_id).toEqual(expect.any(String));
  expect(transport.uploads).toHaveLength(1);
  expect(transport.uploads[0].bytes).toBeGreaterThan(500);
  expect(transport.pronunciationRequests).toHaveLength(1);
});
