/**
 * Offline boot — the app runs whole exercise pages against the in-memory
 * backend, signed in, with no network. Everything else in this folder
 * builds on this; if it fails, fix the fixture first.
 */
import { test, expect, USER_ID } from '../fixtures/fakeSupabase';

test.describe('offline harness boots the real app', () => {
  test('photo naming reaches a trial with no page errors', async ({ offlinePage: page, backend }) => {
    test.setTimeout(90_000);
    await page.goto('/exercise/photo-naming');
    await page.waitForLoadState('networkidle');
    expect(new URL(page.url()).pathname, 'must not bounce to /auth').toBe('/exercise/photo-naming');

    const start = page.getByRole('button', { name: /start|begin|let'?s go/i }).first();
    if (await start.isVisible({ timeout: 3000 }).catch(() => false)) await start.click();

    await expect(page.locator('button[aria-label^="Hear "]').first()).toBeVisible({ timeout: 30_000 });

    // The session row must belong to our fixed user.
    const sessions = backend.rows('sessions');
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions[0].user_id).toBe(USER_ID);

    console.log('UNMATCHED:', JSON.stringify(backend.unmatched.map((u) => `${u.method} ${u.path} ${JSON.stringify(u.query)}`), null, 1));
    console.log('PAGE ERRORS:', backend.pageErrors);
    expect(backend.pageErrors).toEqual([]);
    expect(backend.rejected).toEqual([]);
  });
});
