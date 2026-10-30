import { defineConfig, devices } from '@playwright/test';
import { resolveE2EEnvironment } from './scripts/e2e-environment.mjs';

// Validation happens before builds, browsers, or auth calls.
const settings = resolveE2EEnvironment();
const stagingSpecs = [
  '**/core-loop.spec.ts',
  '**/audit-game-readiness.spec.ts',
  '**/audit-meaning-match-flow.spec.ts',
  '**/audit-photo-naming-completion.spec.ts',
  '**/audit-clinical-rpc-access.spec.ts',
  '**/pass-b-patient-journey.spec.ts',
  '**/exercise-session.spec.ts',
];

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: settings.suite === 'staging' ? stagingSpecs : '**/*.spec.ts',
  testIgnore: settings.suite === 'public' ? stagingSpecs : [],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: settings.suite === 'staging' ? 0 : process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    [process.env.CI ? 'github' : 'list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['./tests/e2e/support/coverageReporter.ts'],
  ],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: settings.baseURL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    // No production prerender script. The E2E-only transform preserves the
    // generated client's behavior while substituting the guarded test backend.
    command: `bunx vite build --config tests/e2e/vite.config.ts --outDir dist-e2e && bunx vite preview --config tests/e2e/vite.config.ts --outDir dist-e2e --host 127.0.0.1 --port ${settings.port} --strictPort`,
    url: settings.baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      E2E_SUITE: settings.suite,
      VITE_SUPABASE_URL: settings.supabaseURL,
      VITE_SUPABASE_PUBLISHABLE_KEY: settings.publishableKey,
      VITE_SUPABASE_PROJECT_ID: settings.projectRef,
    },
  },
});
