/**
 * Each case mounts the exact production component. Speech service and
 * PostgREST calls are controlled transport fixtures; only Chromium's
 * getUserMedia + MediaRecorder are real.
 */
import { test, expect } from './support/speechTest';
import { emitRecognition, microphoneState } from './support/browserControls';
import { readJson } from './support/assertions';

const sessionId = '22222222-2222-4222-8222-222222222222';

test('Minimal Pairs: optional spoken echo is recognized but never changes the receptive score', async ({
  page, transport,
}) => {
  await page.goto('/?view=more-speech&game=minimal-pairs');
  await expect(page.getByTestId('more-speech-game-name')).toHaveText('minimal-pairs');
  // Obtain the word the REAL game tried to speak; it is not supplied to
  // the component through test-only props.
  await expect.poll(() => transport.ttsRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
  const target = String(transport.ttsRequests[0].text);
  const photos = await readJson<Array<{target:string;imageUrl:string}>>(page, 'minimal-photo-lookup');
  const image = photos.find(p => p.target.toLowerCase() === target.toLowerCase());
  expect(image, 'Audible word must have a matching photographic stimulus').toBeDefined();
  const options = page.locator('button:has(img[alt^="Option"])');
  await expect(options).toHaveCount(2);
  const images = await options.locator('img').evaluateAll(imgs => imgs.map(img => (img as HTMLImageElement).src));
  const index = images.findIndex(src => src === new URL(image!.imageUrl, page.url()).href);
  expect(index, 'Spoken target must correspond to one of the two displayed pictures').toBeGreaterThanOrEqual(0);
  await options.nth(index).click();

  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), {
    timeout: 12_000, message: 'Correct receptive answer did not open the optional echo mic',
  }).toBe(true);
  await emitRecognition(page, target);
  await expect(page.getByText(/Nice — that sounded close/i)).toBeVisible({ timeout: 8_000 });
  await expect.poll(async () => (await readJson<unknown[]>(page, 'more-speech-results')).length, {
    timeout: 10_000,
  }).toBe(1);
  const [result] = await readJson<Array<Record<string, unknown>>>(page, 'more-speech-results');
  expect(result.isCorrect).toBe(true);
  expect(result.selectedWord).toBe(target);
  expect(result.echoAttempted).toBe(true);
  expect(String(result.echoTranscript).toLowerCase()).toBe(target.toLowerCase());
  expect(transport.uploads).toHaveLength(0);
  expect(transport.pronunciationRequests).toHaveLength(0);
  expect(transport.utterances).toHaveLength(0);
});

test('Sentence Construction: browser speech is accepted by the real grammar-game submit path', async ({
  page, transport,
}) => {
  await page.goto('/?view=more-speech&game=sentence-construction');
  await expect(page.getByTestId('more-speech-game-name')).toHaveText('sentence-construction');
  await expect(page.getByText('Switch to word tiles')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), { timeout: 15_000 }).toBe(true);
  const wordTokens = await page.locator('div[class*="bg-muted/50"] span').allTextContents();
  const selected = wordTokens.map(w => w.trim()).filter(w => /^[a-z]+$/i.test(w)).slice(0, 4);
  expect(selected.length).toBeGreaterThan(0);
  await emitRecognition(page, selected.join(' '));
  await page.evaluate(() => window.__speechTest.recognition?.active && (window.__speechTest.recognition as unknown as {stop:()=>void}).stop());
  await expect.poll(async () => (await readJson<unknown[]>(page, 'more-speech-results')).length, {
    timeout: 12_000, message: 'Actual spoken sentence did not commit a trial',
  }).toBe(1);
  const [result] = await readJson<Array<Record<string, unknown>>>(page, 'more-speech-results');
  expect(typeof result.correct).toBe('boolean');
  expect(result.trialSource).toMatch(/sentence_bank/);
  expect(transport.utterances).toHaveLength(0);
  expect(transport.uploads).toHaveLength(0);
});

test('Sentence Construction: word-tile answer stays non-spoken and never requests pronunciation', async ({
  page, transport,
}) => {
  await page.goto('/?view=more-speech&game=sentence-construction');
  await expect(page.getByText('Switch to word tiles')).toBeVisible();
  await page.getByRole('button', { name: 'Switch to word tiles' }).click();
  const submit = page.getByRole('button', { name: 'Submit', exact: true });
  await expect(submit).toBeDisabled();
  const tiles = page.locator('div.flex.flex-wrap.gap-2 button');
  await tiles.first().click();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(async () => (await readJson<unknown[]>(page, 'more-speech-results')).length, { timeout: 8_000 }).toBe(1);
  expect(transport.utterances).toHaveLength(0);
  expect(transport.uploads).toHaveLength(0);
  expect(transport.pronunciationRequests).toHaveLength(0);
});

test('Conversation Partner: press-to-talk records one correctly attributed discourse turn', async ({
  page, transport,
}) => {
  await page.goto('/?view=more-speech&game=conversation-partner');
  await page.getByRole('button', { name: 'Start Conversation' }).click();
  await page.getByRole('button', { name: 'Press to Talk' }).click();
  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), { timeout: 12_000 }).toBe(true);
  await expect.poll(async () => (await microphoneState(page)).some(x => x.tracks.includes('live')), { timeout: 12_000 }).toBe(true);
  await expect.poll(async () => Math.max(0, ...(await microphoneState(page)).filter(x => x.tracks.includes('live')).map(x => x.ageMs))).toBeGreaterThan(1100);
  const statement = 'I enjoy walking by the lake with my family in the sunshine';
  await emitRecognition(page, statement);
  await expect(page.getByText(statement)).toBeVisible();
  await page.getByRole('button', { name: 'Done Talking' }).click();
  await expect.poll(() => transport.utterances.length, { timeout: 20_000 }).toBe(1);
  const row = transport.utterances[0];
  expect(row).toMatchObject({ exercise_slug: 'conversation_partner', session_id: sessionId });
  expect(row.attempt_id).toEqual(expect.any(String));
  expect(String(row.transcript).toLowerCase()).toBe(statement.toLowerCase());
  await expect.poll(() => transport.uploads.length, { timeout: 12_000 }).toBe(1);
  expect(transport.uploads[0].bytes).toBeGreaterThan(500);
  expect(row.audio_storage_path).toBe(transport.uploads[0].path);
  await expect.poll(() => transport.eventWrites.some(event => event.exercise_slug === 'conversation_partner'), {timeout: 12_000}).toBe(true);
  expect(transport.pronunciationRequests).toHaveLength(0);
});
