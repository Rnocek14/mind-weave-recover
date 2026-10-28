import type { Page } from '@playwright/test';
import { expect } from './speechTest';
import { microphoneState } from './browserControls';

export async function readJson<T = Record<string, unknown>>(page: Page, testId: string): Promise<T> {
  return JSON.parse(await page.getByTestId(testId).innerText()) as T;
}

export interface CaptureReport {
  durationMs: number;
  recordedBytes: number;
  mimeType: string;
  conversion?: { targetSampleRate: number; outputSize: number };
  conversionError?: { stage: string; workerStage: string; message: string };
  wav?: {
    riff: string; wave: string; format: number; channels: number; sampleRate: number;
    bitsPerSample: number; decodedDuration: number; peak: number;
    voicedWindows: number; longestInternalSilence: number;
  };
}

/** Wait on capture's actual lifecycle and elapsed media window, not page load sleeps. */
export async function captureFor(page: Page, milliseconds: number) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByTestId('recording-state')).toHaveText('recording');
  await expect.poll(async () => (await microphoneState(page))[0]?.ageMs ?? 0, { timeout: milliseconds + 5_000 }).toBeGreaterThan(milliseconds);
  await page.getByRole('button', { name: 'Stop and convert', exact: true }).click();
  await expect(page.getByTestId('capture-report')).not.toHaveText('null');
  await expect(page.getByTestId('capture-error')).toBeEmpty();
  await expect(page.getByTestId('recording-state')).toHaveText('idle');
  const streams = await microphoneState(page);
  expect(streams).toHaveLength(1);
  expect(streams[0].tracks).toEqual(['ended']);
  return readJson<CaptureReport>(page, 'capture-report');
}

export function expectConvertedWav(report: CaptureReport, minimumDuration: number) {
  expect(report.conversionError).toBeUndefined();
  expect(report.mimeType).toMatch(/^audio\/(webm|mp4)/);
  expect(report.recordedBytes).toBeGreaterThan(500);
  expect(report.durationMs).toBeGreaterThan(minimumDuration * 1000);
  expect(report.conversion?.targetSampleRate).toBe(16000);
  expect(report.wav).toMatchObject({ riff: 'RIFF', wave: 'WAVE', format: 1, channels: 1, sampleRate: 16000, bitsPerSample: 16 });
  expect(report.wav!.decodedDuration).toBeGreaterThan(minimumDuration);
  // Compare encoded duration with the actual recorder lifecycle, allowing codec
  // packet padding and browser scheduling. This catches empty/truncated output.
  expect(Math.abs(report.wav!.decodedDuration - report.durationMs / 1000)).toBeLessThan(0.3);
}

export function expectWavRequest(body: Record<string, unknown>) {
  expect(body.mimeType).toBe('audio/wav');
  const audio = Buffer.from(String(body.audioBlob), 'base64');
  expect(audio.length).toBeGreaterThan(500);
  expect(audio.subarray(0, 4).toString()).toBe('RIFF');
  expect(audio.subarray(8, 12).toString()).toBe('WAVE');
  expect(audio.readUInt16LE(22)).toBe(1);
  expect(audio.readUInt32LE(24)).toBe(16000);
  expect(audio.readUInt16LE(34)).toBe(16);
}

export async function waitForGameTrial(page: Page, index: number, target: string) {
  const counter = page.getByText('Trial', { exact: true }).locator('..');
  await expect(counter).toHaveText(new RegExp(`^Trial\\s*${index}\\s*/\\s*3$`));
  await expect(page.getByRole('img', { name: 'Naming task' })).toBeVisible();
  await expect.poll(async () => (await readJson(page, 'live-snapshot')).targetWord).toBe(target);
  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active)).toBe(true);
  await expect.poll(async () => (await microphoneState(page)).filter((stream) => stream.tracks.includes('live')).length).toBe(1);
  // Give the real encoder a nonempty capture; no network response is fabricated
  // until this recording has traversed the actual conversion path.
  await expect.poll(async () => (await microphoneState(page)).find((stream) => stream.tracks.includes('live'))?.ageMs ?? 0).toBeGreaterThan(1000);
}

export async function openGame(page: Page) {
  await page.goto('/?view=game');
  await page.getByRole('button', { name: 'Toggle auto hints' }).click();
  await waitForGameTrial(page, 1, 'apple');
}
