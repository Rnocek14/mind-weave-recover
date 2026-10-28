import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { resolveE2EEnvironment } from '../../../scripts/e2e-environment.mjs';

// This is a local transport-controlled suite. Never opt into a real backend.
const settings = resolveE2EEnvironment();
if (settings.suite !== 'public') throw new Error('Speech browser tests require E2E_SUITE=public.');
const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const fromRoot = (name: string) => fileURLToPath(new URL(`../../../${name}`, import.meta.url));

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.speech.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 40_000,
  expect: { timeout: 8_000 },
  outputDir: fromRoot('test-results/speech'),
  reporter: [
    [process.env.CI ? 'github' : 'list'],
    ['html', { outputFolder: fromRoot('playwright-report/speech'), open: 'never' }],
    ['json', { outputFile: fromRoot('test-results/speech-results.json') }],
    ['./support/speechReporter.ts'],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: settings.baseURL,
    permissions: ['microphone'],
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    ['clear', 'clear-answer.wav'],
    ['hesitant', 'hesitant-answer.wav'],
    ['silence', 'silence.wav'],
    ['long', 'over-limit-answer.wav'],
  ].map(([name, file]) => ({
    name: `speech-${name}`,
    testMatch: `**/${name}-*.speech.ts`,
    use: {
      launchOptions: {
        args: [
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream',
          `--use-file-for-fake-audio-capture=${fixture(file)}%noloop`,
          '--autoplay-policy=no-user-gesture-required',
        ],
      },
    },
  })),
  webServer: {
    cwd: fromRoot(''),
    command: `bunx vite build --config tests/e2e/speech/vite.config.ts && bunx vite preview --config tests/e2e/speech/vite.config.ts --host 127.0.0.1 --port ${settings.port} --strictPort`,
    url: settings.baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { E2E_SUITE: 'public' },
  },
});
