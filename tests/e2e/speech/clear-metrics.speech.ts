import { expect, test } from '@playwright/test';

/**
 * Actual SessionSummaryStrip and ClinicianPracticeCard, synthetic props.
 * Viewport/layout checks only: no authenticated patient, browser ASR or
 * production database. CI's speech-clear project runs this with fake mic.
 */
for (const size of [
  { width: 320, columns: 2, name: 'small phone' },
  { width: 375, columns: 2, name: 'phone' },
  { width: 1440, columns: 6, name: 'desktop' },
]) {
  test('metrics are legible without horizontal overflow on ' + size.name, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: 900 });
    await page.goto('/?view=metrics');

    const summary = page.getByRole('region', { name: 'Session measurements' });
    await expect(summary).toBeVisible();
    await expect(summary.getByText('Correct answers')).toBeVisible();
    await expect(summary.getByText('Responses with cues')).toBeVisible();
    await expect(summary.getByText('Not enough scored data')).toHaveCount(2);
    await expect(summary.getByText('0 of 3')).toBeVisible();
    await expect(page.getByText(/days with recorded activity/)).toBeVisible();
    await expect(page.getByText(/No adherence target is configured/)).toBeVisible();

    // Computer layout, not a CSS class assertion: CSS must actually resolve.
    const columns = await summary.locator('.grid').evaluate(element =>
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
    );
    expect(columns).toBe(size.columns);

    const width = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(width.content).toBeLessThanOrEqual(width.viewport + 1);
  });
}

test('measured zero is visibly distinct from unavailable data on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?view=metrics&mode=scored-zero');
  const summary = page.getByRole('region', { name: 'Session measurements' });
  await expect(summary.getByText('0%')).toHaveCount(2);
  await expect(summary.getByText('2 of 2')).toBeVisible();
  await expect(summary.getByText('Not enough scored data')).toHaveCount(0);
});
