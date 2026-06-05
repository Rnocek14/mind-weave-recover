/**
 * Regression spec — ProfileProvider presence & no blank screen.
 *
 * Reproduces the class of bug where the caregiver / assessment-context
 * routes crashed with "useProfile must be used within a ProfileProvider"
 * and rendered a blank white screen (empty #root).
 *
 * Read-only: only navigates and asserts. Does NOT log in or mutate any
 * clinical state, progression, or mastery tables. These routes are auth
 * gated, so unauthenticated visits redirect to /auth — but in NO case may
 * the app throw a provider error or paint a blank screen.
 */
import { test, expect, type Page } from '@playwright/test';

// Routes that mount inside <ProfileProvider> + <AssessmentProviderWrapper>.
// The caregiver portal and assessment-context-dependent pages are the ones
// that previously crashed on the provider boundary / HMR mismatch.
const PROVIDER_ROUTES = ['/caregiver', '/caregiver/status', '/today', '/practice'];

/** Collect any uncaught page errors during a navigation. */
function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe('ProfileProvider present & no blank screen', () => {
  for (const route of PROVIDER_ROUTES) {
    test(`${route} renders without provider error or blank screen`, async ({ page }) => {
      const errors = trackPageErrors(page);

      await page.goto(route);
      await page.waitForLoadState('networkidle');

      // 1) No "ProfileProvider"/"useProfile" provider-boundary crash.
      const providerErrors = errors.filter((m) =>
        /ProfileProvider|useProfile|AssessmentProvider/i.test(m)
      );
      expect(
        providerErrors,
        `Provider boundary error(s) on ${route}:\n${providerErrors.join('\n')}`
      ).toEqual([]);

      // 2) No uncaught page errors at all.
      expect(errors, `Uncaught error(s) on ${route}:\n${errors.join('\n')}`).toEqual([]);

      // 3) The app shell is mounted (not a blank document).
      await expect(page.locator('body')).toBeVisible();

      // 4) #root actually rendered content — guards against the blank screen
      //    where React unmounts the tree on an unhandled provider throw.
      const rootText = (await page.locator('#root').innerText().catch(() => '')) ?? '';
      const rootHtml = (await page.locator('#root').innerHTML().catch(() => '')) ?? '';
      expect(
        rootText.trim().length > 0 || rootHtml.trim().length > 0,
        `#root is empty (blank screen) on ${route}`
      ).toBeTruthy();
    });
  }
});
