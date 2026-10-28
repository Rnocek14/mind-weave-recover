import { test, expect } from './support/speechTest';
import { openGame, readJson } from './support/assertions';
import { microphoneState, observeNoCompletion } from './support/browserControls';

test('silence and a controlled no-speech restart do not submit or create another recorder', async ({ page, transport }) => {
  await openGame(page);
  await observeNoCompletion(page, 1000);
  const starts = await page.evaluate(() => window.__speechTest.recognition!.starts);
  await page.evaluate(() => window.__speechTest.recognition!.fail('no-speech'));
  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition!.starts)).toBeGreaterThan(starts);
  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition!.active)).toBe(true);
  await observeNoCompletion(page, 600);
  expect(transport.speechRequests).toHaveLength(0);
  expect(transport.pronunciationRequests).toHaveLength(0);
  expect(transport.utterances).toHaveLength(0);
  expect((await readJson(page, 'live-snapshot')).trialIndex).toBe(1);
  const streams = await microphoneState(page);
  expect(streams).toHaveLength(1);
  expect(streams[0].tracks).toEqual(['live']);
});
