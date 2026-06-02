/**
 * Pass B — authenticated patient journey (anon session).
 *
 * Unblocks the manual archetype walkthrough that was stuck behind /auth.
 * Uses the anonSession fixture (real Supabase anonymous session) so the
 * SPA boots signed in and we can reach gated patient routes.
 *
 * Read-only: navigates and asserts render/no-dead-state. Does NOT submit
 * answers, mutate progression, mastery, or scoring rows.
 */
import { test, expect } from './fixtures/anonSession';

test.describe('Pass B — authenticated patient routes (anon session)', () => {
  test('/today boots authenticated, not bounced to /auth', async ({ anonPage }) => {
    await anonPage.goto('/today');
    await anonPage.waitForLoadState('networkidle');

    expect(new URL(anonPage.url()).pathname).toBe('/today');

    const hasHeading = await anonPage
      .locator('h1, h2')
      .first()
      .isVisible()
      .catch(() => false);
    const hasButton = await anonPage
      .locator('button')
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasHeading || hasButton).toBeTruthy();
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
