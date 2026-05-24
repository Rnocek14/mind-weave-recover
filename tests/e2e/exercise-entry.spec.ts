/**
 * Phase 1B — Exercise entry routes.
 *
 * Read-only. Verifies the clinical-library catalog and exercise-entry
 * routes render without crashing. Does NOT start a session, submit
 * trials, or touch progression / mastery state.
 */
import { test, expect } from '@playwright/test';

const ENTRY_ROUTES = [
  '/games',
  '/games/photo-naming/about',
  '/exercise/photo-naming',
];

test.describe('Exercise entry routes render', () => {
  for (const path of ENTRY_ROUTES) {
    test(`${path} loads without page errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      const resp = await page.goto(path);
      expect(resp?.ok()).toBeTruthy();
      await page.waitForLoadState('networkidle');

      // Page should not have redirected to /auth.
      expect(new URL(page.url()).pathname).not.toBe('/auth');
      // Body present.
      await expect(page.locator('body')).toBeVisible();

      expect(errors, `${path} page errors:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});
