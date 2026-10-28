import { test, expect } from './support/speechTest';
import { captureFor, expectConvertedWav } from './support/assertions';

test('silence remains decodable silent PCM, not invented speech', async ({ page }) => {
  const report = await captureFor(page, 1600);
  expectConvertedWav(report, 1.5);
  expect(report.wav!.peak).toBeLessThan(0.001);
  expect(report.wav!.voicedWindows).toBe(0);
});
