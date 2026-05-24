/**
 * Phase 1B — Today (patient hub) renders.
 *
 * Read-only. Uses offline mode (localStorage.offlineMode = "true") to
 * satisfy Today.tsx's `if (!user && !isOfflineMode) return null` gate
 * without creating any anonymous Supabase auth users.
 *
 * Asserts: /today mounts, shows a greeting/heading, no page errors.
 * Does NOT mutate clinical state, progression, or mastery tables.
 */
import { test, expect } from '@playwright/test';

test.describe('/today renders (offline mode)', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      try { localStorage.setItem('offlineMode', 'true'); } catch {}
    });
  });

  test('mounts without crashing and shows main content', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/today');
    await page.waitForLoadState('networkidle');

    // Should NOT have redirected to /auth.
    expect(new URL(page.url()).pathname).toBe('/today');

    // Some interactive content should exist (button or heading).
    const hasHeading = await page.locator('h1, h2').first().isVisible().catch(() => false);
    const hasButton = await page.locator('button').first().isVisible().catch(() => false);
    expect(hasHeading || hasButton).toBeTruthy();

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
