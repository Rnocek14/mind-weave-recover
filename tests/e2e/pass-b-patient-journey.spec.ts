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

  for (const route of EXERCISE_ROUTES) {
    test(`${route} reaches a non-dead state within 12s`, async ({ anonPage }) => {
      const errors: string[] = [];
      anonPage.on('pageerror', (e) => errors.push(e.message));

      await anonPage.goto(route);
      await anonPage.waitForLoadState('networkidle');

      // Should not be kicked to /auth.
      expect(new URL(anonPage.url()).pathname).not.toBe('/auth');

      // Either the exercise renders OR the ExerciseLoadGate escape hatch
      // appears — both are valid non-dead states. An infinite bare spinner
      // with no escape would be the failure we are guarding against.
      const settled = await anonPage
        .locator('button, h1, h2, [role="img"], img')
        .first()
        .isVisible({ timeout: 12_000 })
        .catch(() => false);
      expect(settled, `no interactive/escape content on ${route}`).toBeTruthy();

      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});
