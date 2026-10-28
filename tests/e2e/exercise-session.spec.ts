import { test, expect } from './fixtures/anonSession';

test.describe('Pause control on exercise routes (isolated session)', () => {
  test('pause button is visible and clickable', async ({ anonPage }) => {
    await anonPage.goto('/exercise/photo-naming');
    await expect(anonPage).toHaveURL(/\/exercise\/photo-naming/);
    const pauseButton = anonPage.getByRole('button', { name: 'Pause session' });
    await expect(pauseButton).toBeVisible();
    await pauseButton.click();
    await expect(anonPage.getByRole('dialog', { name: 'Session paused' })).toBeVisible();
    await anonPage.getByRole('button', { name: 'Resume' }).click();
    await expect(anonPage.getByRole('dialog', { name: 'Session paused' })).toBeHidden();
  });
});
