/**
 * Phase 1A — Critical journey smoke tests.
 *
 * Read-only against the running app. These tests verify pages render
 * without crashes and contain expected landmarks. They do NOT exercise
 * authenticated flows yet — anon-session auth fixture lands in a follow-up.
 *
 * Off-limits: anything that mutates clinical state, progression, or
 * mastery shadow tables. Tests only navigate and assert.
 */
import { test, expect } from '@playwright/test';

test.describe('Public routes render', () => {
  test('landing page (/) loads', async ({ page }) => {
    const resp = await page.goto('/');
    expect(resp?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('auth page renders email field', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('input[type="email"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('about page renders', async ({ page }) => {
    const resp = await page.goto('/about');
    expect(resp?.ok()).toBeTruthy();
  });

  test('welcome page renders', async ({ page }) => {
    const resp = await page.goto('/welcome');
    expect(resp?.ok()).toBeTruthy();
  });

  test('no console errors on landing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
