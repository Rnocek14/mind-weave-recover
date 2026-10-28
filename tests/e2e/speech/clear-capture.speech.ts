import { test, expect } from './support/speechTest';
import { captureFor, expectConvertedWav, readJson, type CaptureReport } from './support/assertions';
import { microphoneState } from './support/browserControls';

test('native recorder captures synthetic apple and converts it to 16kHz mono PCM', async ({ page }) => {
  const report = await captureFor(page, 2500);
  expectConvertedWav(report, 2.4);
  expect(report.wav!.peak).toBeGreaterThan(0.05);
  expect(report.wav!.voicedWindows).toBeGreaterThan(3);
});

test('cancel releases the microphone and a fresh recording can start', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByTestId('recording-state')).toHaveText('recording');
  await page.getByRole('button', { name: 'Cancel recording' }).click();
  await expect.poll(async () => (await microphoneState(page))[0]?.tracks).toEqual(['ended']);
  await expect(page.getByTestId('recording-state')).toHaveText('idle');
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect.poll(async () => (await microphoneState(page)).length).toBe(2);
  await expect.poll(async () => (await microphoneState(page))[1].ageMs).toBeGreaterThan(1400);
  await page.getByRole('button', { name: 'Stop and convert' }).click();
  await expect(page.getByTestId('capture-report')).not.toHaveText('null');
  await expect(page.getByTestId('capture-error')).toBeEmpty();
  expectConvertedWav(await readJson<CaptureReport>(page, 'capture-report'), 1.3);
  expect((await microphoneState(page)).map((stream) => stream.tracks)).toEqual([['ended'], ['ended']]);
});
