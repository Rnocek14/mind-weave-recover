/**
 * Phase 1B — Exercise entry routes.
 *
 * Read-only. Verifies the clinical-library catalog and exercise-entry
 * routes render without crashing. Does NOT start a session, submit
 * trials, or touch progression / mastery state.
 */
import { test, expect } from '@playwright/test';
import { test as anonTest, expect as anonExpect } from './fixtures/anonSession';

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

anonTest.describe('Pause control on exercise routes (anon session)', () => {
  anonTest('pause button is visible and clickable', async ({ anonPage }) => {
    // Regression: the fixed-position pause control used to sit UNDERNEATH the
    // game pages' sticky z-50 header — rendered but invisible/unclickable.
    await anonPage.goto('/exercise/photo-naming');
    await anonPage.waitForLoadState('networkidle');
    anonTest.skip(new URL(anonPage.url()).pathname === '/auth', 'anon session unavailable');

    const pauseBtn = anonPage.getByRole('button', { name: 'Pause session' });
    await anonExpect(pauseBtn).toBeVisible();
    await pauseBtn.click();
    await anonExpect(anonPage.getByRole('dialog', { name: 'Session paused' })).toBeVisible();
    await anonPage.getByRole('button', { name: 'Resume' }).click();
    await anonExpect(anonPage.getByRole('dialog', { name: 'Session paused' })).toBeHidden();
  });
});
