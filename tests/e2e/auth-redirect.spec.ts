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
      await page.goto(path);
      // Either the URL becomes /auth, or the auth form is rendered inline.
      await page.waitForLoadState('networkidle');
      const url = new URL(page.url());
      const onAuth = url.pathname.startsWith('/auth');
      const emailVisible = await page
        .locator('input[type="email"]')
        .first()
        .isVisible()
        .catch(() => false);
      expect(
        onAuth || emailVisible,
        `Expected ${path} to redirect to /auth or show email input; got ${url.pathname}`
      ).toBeTruthy();
    });
  }
});
