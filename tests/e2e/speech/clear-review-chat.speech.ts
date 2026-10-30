import { expect, test } from '@playwright/test';

// The real ReviewChatPage and production queue run in the existing isolated
// speech harness. Browser ASR is deliberately absent here: this suite proves
// UI fallback, bounded navigation and metric honesty, NOT live recognition.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
  });
  await page.goto('/?view=review');
  await page.getByRole('button', { name: 'Seed practice' }).click();
});

test('mic-unavailable participation stays unverified rather than becoming false speech success', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Quick chat about today's words/i })).toBeVisible();
  await page.getByRole('button', { name: 'Start the chat' }).click();

  await expect(page.getByText(/Mic unavailable/i)).toBeVisible();
  const attempted = page.getByRole('button', { name: /I tried saying/i });
  await expect(attempted).toBeVisible();

  await attempted.click();
  await expect(attempted).toBeVisible();
  await attempted.click();

  await expect(page.getByRole('heading', { name: 'Nice chat!' })).toBeVisible();
  await expect(page.getByText(/2 self-reported attempts/i)).toBeVisible();
  await expect(page.getByText(/not scored because the microphone was unavailable/i)).toBeVisible();
  await expect(page.getByText(/used without a hint in this chat/i)).toHaveCount(0);
  await expect(page.getByText(/with a little help/i)).toHaveCount(0);
});

test('patient can skip a prompt and end without being trapped in a question loop', async ({ page }) => {
  await page.getByRole('button', { name: 'Start the chat' }).click();
  await expect(page.getByRole('button', { name: 'New topic' })).toBeVisible();

  await page.getByRole('button', { name: 'New topic' }).click();
  await expect(page.getByRole('button', { name: /All done/i })).toBeVisible();
  await page.getByRole('button', { name: /All done/i }).click();

  await expect(page.getByRole('heading', { name: 'Nice chat!' })).toBeVisible();
  await expect(page.getByText(/2 saved for next time/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
});
