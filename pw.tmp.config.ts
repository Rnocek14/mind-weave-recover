import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath: '/tmp/nixchromium/bin/chromium' },
      },
    },
  ],
});
