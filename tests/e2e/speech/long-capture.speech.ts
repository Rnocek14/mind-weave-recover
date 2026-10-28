import { test, expect } from './support/speechTest';
import { captureFor } from './support/assertions';

test('over-limit recording is rejected instead of silently dropping the answer after ten seconds', async ({ page }) => {
  const report = await captureFor(page, 11800);
  expect(report.durationMs).toBeGreaterThan(11000);
  expect(report.conversionError, 'An incomplete first-ten-seconds WAV must never be presented as full speech evidence').toMatchObject({
    stage: 'wav_conversion', workerStage: 'validation',
    message: 'Recording exceeds the 10-second analysis limit; partial audio was not analyzed',
  });
  expect(report.wav).toBeUndefined();
});
