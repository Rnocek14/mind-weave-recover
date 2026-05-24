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
import { test, expect } from '@playwright/test';

test.describe('Clinician route boundary (unauthenticated)', () => {
  test('/clinician/trial does not expose trial dashboard content', async ({ page }) => {
    await page.goto('/clinician/trial');
    await page.waitForLoadState('networkidle');

    const url = new URL(page.url());
    const onAuth = url.pathname.startsWith('/auth');
    const emailVisible = await page
      .locator('input[type="email"]')
      .first()
      .isVisible()
      .catch(() => false);

    // Must be gated: either redirected to /auth or showing the auth form.
    expect(
      onAuth || emailVisible,
      `Expected /clinician/trial to be gated; got ${url.pathname}`
    ).toBeTruthy();

    // The trial dashboard's distinctive copy must NOT be visible.
    const trialHeading = page.getByRole('heading', { name: /trial enrollment|enroll patient/i });
    await expect(trialHeading).toHaveCount(0);
  });
});
