/**
 * Phase 1B — Clinician access boundary spec.
 *
 * Read-only. Verifies that the ClinicianProtectedRoute-wrapped trial
 * dashboard does NOT render its protected content for an unauthenticated
 * visitor. Does NOT log in, does NOT mutate clinical state.
 *
 * Patient-Hub-style routes (/clinician/review, /clinician/dashboard) are
 * intentionally NOT asserted here — they rely on app-level auth gating
 * rather than ClinicianProtectedRoute and are covered by auth-redirect.
 */
import { test, expect } from './fixtures/safeTest';

test.describe('Clinician route boundary (unauthenticated)', () => {
  test('/clinician/trial does not expose trial dashboard content', async ({ page }) => {
    await page.goto('/clinician/trial');

    // Must be gated: either redirected to /auth or showing the auth form.
    // Auth effects can settle after the network becomes idle, so wait for the
    // actual boundary rather than sampling the URL/form once.
    await expect.poll(async () => {
      const onAuth = new URL(page.url()).pathname.startsWith('/auth');
      return onAuth || await page.locator('input[type="email"]').first().isVisible();
    }, {
      message: 'Expected /clinician/trial to redirect to /auth or show the sign-in form',
    }).toBe(true);

    // The trial dashboard's distinctive copy must NOT be visible.
    const trialHeading = page.getByRole('heading', { name: /trial enrollment|enroll patient/i });
    await expect(trialHeading).toHaveCount(0);
  });
});
