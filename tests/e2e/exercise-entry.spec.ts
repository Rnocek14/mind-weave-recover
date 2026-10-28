/**
 * Phase 1B — Exercise entry routes.
 *
 * Read-only. Verifies the clinical-library catalog and exercise-entry
 * routes render without crashing. Does NOT start a session, submit
 * trials, or touch progression / mastery state.
 */
import { test, expect } from './fixtures/safeTest';

/**
 * Two different contracts, so they get two different assertions.
 *
 * The catalog routes are public and must render for a signed-out visitor.
 * `/exercise/*` sits behind RequireAuth on purpose — App.tsx: "Guarded by
 * RequireAuth so deep links can't reach a session without auth" — so for a
 * signed-out visitor the CORRECT outcome is a bounce to /auth. Asserting
 * "never /auth" for that route was asserting the guard is broken.
 */
const ENTRY_ROUTES: Array<{ path: string; requiresAuth: boolean }> = [
  { path: '/games', requiresAuth: false },
  { path: '/games/photo-naming/about', requiresAuth: false },
  { path: '/exercise/photo-naming', requiresAuth: true },
];

test.describe('Exercise entry routes render', () => {
  for (const { path, requiresAuth } of ENTRY_ROUTES) {
    test(`${path} loads without page errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      const resp = await page.goto(path);
      expect(resp?.ok()).toBeTruthy();
      await page.waitForLoadState('networkidle');

      const landed = new URL(page.url()).pathname;
      if (requiresAuth) {
        // The guard firing IS the pass condition for a signed-out visitor.
        expect(landed, `${path} should send a signed-out visitor to /auth`).toBe('/auth');
      } else {
        expect(landed, `${path} is public and must not bounce`).not.toBe('/auth');
      }
      // Body present.
      await expect(page.locator('body')).toBeVisible();

      expect(errors, `${path} page errors:\n${errors.join('\n')}`).toEqual([]);
    });
  }

});
