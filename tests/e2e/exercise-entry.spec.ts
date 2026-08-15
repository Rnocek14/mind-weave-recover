/**
 * Phase 1B — Exercise entry routes.
 *
 * Read-only. Verifies the clinical-library catalog and exercise-entry
 * routes render without crashing. Does NOT start a session, submit
 * trials, or touch progression / mastery state.
 */
import { test, expect } from '@playwright/test';
import { test as anonTest, expect as anonExpect } from './fixtures/anonSession';

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
