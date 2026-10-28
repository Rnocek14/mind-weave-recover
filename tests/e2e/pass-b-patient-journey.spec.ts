/**
 * Pass B — authenticated patient journey (anon session).
 *
 * Unblocks the manual archetype walkthrough that was stuck behind /auth.
 * Uses the anonSession fixture (real Supabase anonymous session) so the
 * SPA boots signed in and we can reach gated patient routes.
 *
 * Creates real anonymous users only on the isolated test backend. The home
 * journey uses Welcome's real skip control, which records onboarding completion.
 * Does NOT submit exercise answers or mutate progression, mastery, or scoring.
 */
import { test, expect } from './fixtures/anonSession';

test.describe('Pass B — authenticated patient routes (anon session)', () => {
  test('/today boots authenticated after the fresh-user welcome flow', async ({ anonPage }) => {
    await anonPage.goto('/today');
    // A new patient is intentionally sent to Welcome on their first landing.
    // Complete that real UI path before requiring the patient home page.
    await expect(anonPage).toHaveURL(/\/welcome$/);
    await anonPage.getByRole('button', { name: 'Skip for now', exact: true }).click();
    await expect(anonPage).toHaveURL(/\/today$/);
    await expect(anonPage.getByRole('heading', {
      level: 1, name: /^Good (morning|afternoon|evening)(?:,|$)/,
    })).toBeVisible();
    await expect(anonPage.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
  });

  // Patient exercise routes used by the stroke-archetype walkthrough.
  const EXERCISE_ROUTES = [
    '/exercise/photo-naming',
    '/exercise/fix-sentence',
    '/exercise/category-fluency',
    '/exercise/minimal-pairs',
  ];

  // One authenticated account for all four *read-only* route assertions.
  // A separate signed-in user per route exhausted the isolated project's
  // anonymous-signin quota when the all-game and persistence suites expanded.
  // Keep a fresh page per route to avoid aborted requests leaking across games.
  test('all four patient exercise routes reach a non-dead state without weakening auth', async ({ anonPage }) => {
    test.setTimeout(110_000);
    const failures: string[] = [];
    for (const route of EXERCISE_ROUTES) {
      const page = await anonPage.context().newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await page.waitForLoadState('networkidle', { timeout: 12_000 });
        expect(new URL(page.url()).pathname, `${route} redirected to sign-in`).not.toBe('/auth');
        // Preserve the existing non-dead-state assertion per exercise, rather
        // than passing the suite if only one of the four routes works.
        await expect(page.locator('button, h1, h2, [role="img"], img').first(),
          `no interactive/escape content on ${route}`).toBeVisible({ timeout: 12_000 });
        expect(errors, `uncaught errors on ${route}: ${errors.join(' | ')}`).toEqual([]);
      } catch (error) {
        failures.push(`${route}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        await page.close();
      }
    }
    expect(failures, `All routes must be checked and pass:\n${failures.join('\n')}`).toEqual([]);
  });
});
