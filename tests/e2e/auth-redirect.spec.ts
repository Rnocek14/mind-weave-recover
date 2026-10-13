/**
 * Phase 1B — Auth redirect spec.
 *
 * Read-only. Verifies that unauthenticated visits to role-protected routes
 * land on /auth (or render the auth UI). Does NOT log in, does NOT mutate
 * any clinical/progression/mastery state.
 */
import { test, expect } from '@playwright/test';

const PROTECTED_PATHS = [
  '/admin',
  '/admin/pipeline',
  '/clinician/trial',
];

test.describe('Unauthenticated → /auth redirect', () => {
  for (const path of PROTECTED_PATHS) {
    test(`visiting ${path} unauthenticated lands on auth UI`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Auth state resolution is asynchronous and WebKit can become network-idle
      // just before the redirect/render completes. Poll the actual invariant
      // instead of taking a one-shot snapshot at a timing-sensitive boundary.
      await expect.poll(
        async () => {
          const pathname = new URL(page.url()).pathname;
          const onAuth = pathname.startsWith('/auth');
          const emailVisible = await page
            .locator('input[type="email"]')
            .first()
            .isVisible()
            .catch(() => false);
          return onAuth || emailVisible;
        },
        {
          message: `Expected ${path} to redirect to /auth or show email input`,
          timeout: 10_000,
          intervals: [100, 250, 500, 1_000],
        },
      ).toBe(true);
    });
  }
});
