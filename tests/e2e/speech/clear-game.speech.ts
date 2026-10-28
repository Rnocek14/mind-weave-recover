import { test, expect, knownSpeech, knownPronunciation, fulfillJson, type JsonObject } from './support/speechTest';
import { openGame, waitForGameTrial, readJson, expectWavRequest } from './support/assertions';
import { emitRecognition } from './support/browserControls';

type CompletedTrial = { target: string; result: JsonObject };

test('known controlled answer uses real audio and retains exact measured metrics, including zero and missing values', async ({ page, transport }) => {
  await openGame(page);
  await emitRecognition(page, 'apple');
  await expect.poll(() => transport.utterances.length).toBe(1);
  const completed = await readJson<CompletedTrial[]>(page, 'trial-results');
  expect(completed).toHaveLength(1);
  expect(completed[0]).toMatchObject({ target: 'apple', result: {
    correct: true, trialIndex: 1, browserTranscript: 'apple', whisperTranscript: 'apple',
    whisperConfidence: 0.94, acousticMetrics: knownSpeech.acousticMetrics,
  } });
  const saved = transport.utterances[0];
  expect(saved).toMatchObject({
    user_id: '11111111-1111-4111-8111-111111111111',
    session_id: '22222222-2222-4222-8222-222222222222',
    exercise_slug: 'photo_naming', trial_index: 1, target_word: 'apple',
    transcript: 'apple', transcript_source: 'whisper', audio_meta: { transcriptProvider: 'azure' },
    speech_rate_wpm: 75, pause_count: 0,
    total_pause_ms: 0, avg_pause_duration_ms: 0, pronunciation_status: 'complete',
    gop_data: { source: 'azure', pronunciationScore: 84, accuracyScore: 87,
      fluencyScore: 0, completenessScore: 100, prosodyScore: null },
  });
  expect(saved.attempt_id).toBe(completed[0].result.attemptId);
  expect(transport.uploads).toHaveLength(1);
  expect(transport.uploads[0].path).toMatch(/^11111111-1111-4111-8111-111111111111\/22222222-2222-4222-8222-222222222222\/trial-1-\d+\.webm$/);
  expect(transport.uploads[0].bytes).toBeGreaterThan(500);
  expect(saved.audio_storage_path).toBe(transport.uploads[0].path);
  expect(transport.speechRequests).toHaveLength(1);
  expect(transport.pronunciationRequests).toHaveLength(1);
  expectWavRequest(transport.speechRequests[0]);
  expectWavRequest(transport.pronunciationRequests[0]);
  expect(transport.pronunciationRequests[0].referenceText).toBe('apple');
});

test('delayed analysis is saved once to its original attempt without overwriting the next trial display', async ({ page, transport }) => {
  transport.holdSpeech = true;
  transport.holdPronunciation = true;
  await openGame(page);
  await emitRecognition(page, 'apple');
  await expect.poll(() => transport.pendingSpeech.length).toBe(1);
  await expect.poll(() => transport.pendingPronunciation.length).toBe(1);
  await waitForGameTrial(page, 2, 'cup');
  expect(transport.utterances).toHaveLength(0);

  transport.holdSpeech = false;
  transport.holdPronunciation = false;
  transport.speechResponse = { ...knownSpeech, transcript: 'cup', confidence: 0.88 };
  transport.pronunciationResponse = {
    ok: true, data: { ...knownPronunciation.data, transcript: 'cup', pronunciationScore: 92,
      accuracyScore: 93, fluencyScore: 91, completenessScore: 100,
      words: [{ word: 'cup', accuracyScore: 93, errorType: 'None', phonemes: [] }],
      alignmentData: { word_segments: [{ word: 'cup', start: 0.2, end: 1 }], phone_segments: [] } },
  };
  await emitRecognition(page, 'cup');
  await expect.poll(() => transport.utterances.length).toBe(1);
  expect(transport.utterances[0]).toMatchObject({ trial_index: 2, target_word: 'cup', transcript: 'cup', gop_data: { pronunciationScore: 92 } });
  await waitForGameTrial(page, 3, 'book');
  const current = await readJson(page, 'live-snapshot');
  expect(current.pronunciationScore).toBeUndefined();

  await fulfillJson(transport.pendingSpeech[0].route, knownSpeech);
  await fulfillJson(transport.pendingPronunciation[0].route, knownPronunciation);
  await expect.poll(() => transport.utterances.length).toBe(2);
  const results = await readJson<CompletedTrial[]>(page, 'trial-results');
  expect(results.map(({ target }) => target)).toEqual(['cup', 'apple']);
  expect(results.map(({ result }) => result.trialIndex)).toEqual([2, 1]);
  const [second, first] = transport.utterances;
  expect(first).toMatchObject({ trial_index: 1, target_word: 'apple', transcript: 'apple', gop_data: { pronunciationScore: 84 } });
  expect(first.attempt_id).not.toBe(second.attempt_id);
  expect(first.attempt_id).toBe(results[1].result.attemptId);
  expect(second.attempt_id).toBe(results[0].result.attemptId);
  expect(first.audio_storage_path).toMatch(/\/trial-1-\d+\.webm$/);
  expect(second.audio_storage_path).toMatch(/\/trial-2-\d+\.webm$/);
  const after = await readJson(page, 'live-snapshot');
  expect(after).toMatchObject({ attemptId: current.attemptId, targetWord: 'book', trialIndex: 3 });
  expect(after.pronunciationScore).toBeUndefined();
  expect(transport.speechRequests).toHaveLength(2);
  expect(transport.pronunciationRequests).toHaveLength(2);
});

test('a failed upload and invalid pronunciation response remain unavailable instead of fabricated zero scores', async ({ page, transport }) => {
  transport.uploadStatus = 503;
  transport.pronunciationResponse = { ok: true, data: { transcript: 'apple', words: [] } };
  await openGame(page);
  await emitRecognition(page, 'apple');
  await expect.poll(() => transport.utterances.length).toBe(1);
  expect(transport.utterances[0]).toMatchObject({
    trial_index: 1, target_word: 'apple', pronunciation_status: 'failed', gop_data: null,
  });
  expect(transport.utterances[0].audio_storage_path).toBeUndefined();
  const completed = await readJson<CompletedTrial[]>(page, 'trial-results');
  expect(completed).toHaveLength(1);
  expect(completed[0].result.audioStoragePath).toBeUndefined();
});

test('a coach-lock deferred transcript cannot answer the next trial after a chip advances the game', async ({ page, transport }) => {
  let deferred = 0;
  page.on('console', (message) => {
    if (message.text().includes('processStableTranscript deferred')) deferred++;
  });
  await openGame(page);
  const now = await page.evaluate(() => Date.now());
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1000);
  await emitRecognition(page, 'apple');
  await page.getByRole('button', { name: 'Hold coach microphone lock' }).click();
  await page.getByRole('button', { name: 'apple', exact: true }).click();
  await page.clock.runFor(800);
  expect(deferred, 'The actual stable-transcript retry must have been scheduled').toBeGreaterThan(0);
  await expect.poll(() => transport.utterances.length).toBe(1);
  await page.clock.runFor(450);
  const counter = page.getByText('Trial', { exact: true }).locator('..');
  await expect(counter).toHaveText(/^Trial\s*2\s*\/\s*3$/);
  await page.getByRole('button', { name: 'Release coach microphone lock' }).click();
  // Includes the controller's real 400ms tail lock and an already queued retry.
  await page.clock.runFor(600);
  await expect(page.getByRole('button', { name: 'cup', exact: true })).toBeEnabled({ timeout: 1000 });
  await expect(page.getByText('Processing…', { exact: true })).not.toBeVisible();
  expect(await readJson(page, 'trial-results')).toHaveLength(1);
  expect(transport.utterances).toHaveLength(1);
  expect(await readJson(page, 'live-snapshot')).toMatchObject({ targetWord: 'cup', trialIndex: 2 });
});
