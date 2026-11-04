import { test, expect, knownPronunciation } from './support/speechTest';
import { expectWavRequest, readJson } from './support/assertions';
import { microphoneState } from './support/browserControls';

interface EchoReport {
  status: string;
  analysis: null | {
    transcript: string;
    accuracyScore: number;
    pronunciationScore: number;
    pronRequestId: string;
  };
}

async function captureCat(page: import('@playwright/test').Page) {
  await page.goto('/?view=minimal-echo');
  await page.getByRole('button', { name: 'Select cat then practice' }).click();
  await expect(page.getByTestId('minimal-echo-state')).toHaveText('listening');
  await expect.poll(async () => {
    const streams = await microphoneState(page);
    return streams.find(stream => stream.tracks.includes('live'))?.ageMs ?? 0;
  }, { timeout: 8000 }).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Done speaking' }).click();
}

test('Minimal Pairs records native fake-mic audio, converts WAV and invokes the actual pronunciation hook', async ({ page, transport }) => {
  transport.pronunciationResponse = {
    ok: true,
    data: {
      ...knownPronunciation.data,
      transcript: 'cat', pronunciationScore: 74, accuracyScore: 80,
      words: [{ word: 'cat', accuracyScore: 80, errorType: 'None', phonemes: [] }],
    },
  };
  await captureCat(page);
  await expect.poll(() => transport.pronunciationRequests.length, { timeout: 12000 }).toBe(1);
  const request = transport.pronunciationRequests[0];
  expectWavRequest(request);
  expect(request.referenceText).toBe('cat');
  await expect(page.getByTestId('minimal-echo-state')).toHaveText('heard');
  const report = await readJson<EchoReport>(page, 'minimal-echo-report');
  expect(report).toMatchObject({
    status: 'heard',
    analysis: { transcript: 'cat', pronunciationScore: 74, accuracyScore: 80 },
  });
  expect(report.analysis?.pronRequestId).toEqual(expect.any(String));
  expect(report.analysis?.pronRequestId.length).toBeGreaterThan(0);
  expect((await microphoneState(page))[0].tracks).toEqual(['ended']);
});

test('Minimal Pairs provider failure is unavailable, not a fabricated zero score', async ({ page, transport }) => {
  transport.pronunciationResponse = { ok: false, error: { stage: 'azure_api', message: 'NoMatch' } };
  await captureCat(page);
  await expect.poll(() => transport.pronunciationRequests.length, { timeout: 12000 }).toBe(1);
  expectWavRequest(transport.pronunciationRequests[0]);
  await expect(page.getByTestId('minimal-echo-state')).toHaveText('analysis-unavailable');
  const report = await readJson<EchoReport>(page, 'minimal-echo-report');
  expect(report).toEqual({ status: 'analysis-unavailable', analysis: null });
  expect((await microphoneState(page))[0].tracks).toEqual(['ended']);
});
