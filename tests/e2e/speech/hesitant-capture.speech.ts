import { test, expect } from './support/speechTest';
import { captureFor, expectConvertedWav } from './support/assertions';

test('native capture preserves a deliberate silent gap between synthetic uh and apple', async ({ page }) => {
  const report = await captureFor(page, 3300);
  expectConvertedWav(report, 3.2);
  expect(report.wav!.peak).toBeGreaterThan(0.05);
  expect(report.wav!.voicedWindows).toBeGreaterThan(5);
  expect(report.wav!.longestInternalSilence).toBeGreaterThan(0.7);
});
