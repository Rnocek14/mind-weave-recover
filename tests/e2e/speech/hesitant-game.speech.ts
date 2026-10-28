import { test, expect, knownSpeech } from './support/speechTest';
import { openGame, readJson } from './support/assertions';
import { emitRecognition, observeNoCompletion } from './support/browserControls';

test('an interim hesitation stays on the same trial, then the completed answer submits once', async ({ page, transport }) => {
  transport.speechResponse = { ...knownSpeech, transcript: 'uh apple', acousticMetrics: {
    ...knownSpeech.acousticMetrics, speechRateWpm: 30, pauseCount: 1,
    totalPauseDurationSec: 1.2, avgPauseDurationMs: 1200, wordCount: 2, totalDurationSec: 4,
  } };
  await openGame(page);
  await emitRecognition(page, 'uh', false, null);
  await observeNoCompletion(page, 1200);
  expect(transport.speechRequests).toHaveLength(0);
  expect(transport.utterances).toHaveLength(0);
  expect((await readJson(page, 'live-snapshot')).trialIndex).toBe(1);
  // Even a plausible answer remains provisional until the recognizer finalizes it.
  await emitRecognition(page, 'apple', false, null);
  await observeNoCompletion(page, 1000);
  await emitRecognition(page, 'apple');
  await emitRecognition(page, 'apple'); // repeated final must not create another attempt
  await expect.poll(() => transport.utterances.length).toBe(1);
  expect(transport.utterances[0]).toMatchObject({
    trial_index: 1, target_word: 'apple', transcript: 'uh apple', speech_rate_wpm: 30,
    pause_count: 1, total_pause_ms: 1200, avg_pause_duration_ms: 1200,
  });
  expect(await readJson(page, 'trial-results')).toHaveLength(1);
  expect(transport.speechRequests).toHaveLength(1);
  expect(transport.pronunciationRequests).toHaveLength(1);
});
