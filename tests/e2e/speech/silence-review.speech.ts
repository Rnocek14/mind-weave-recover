import { expect, test } from '@playwright/test';

/**
 * Uses the real ReviewChatPage and recognition hook, with a controlled browser
 * not-allowed result. No backend, live speech service, or patient data.
 */
test('denied microphone supports self-report without falsifying spoken transfer', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    class DeniedRecognition {
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      start() { this.onerror?.({ error: 'not-allowed' }); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: DeniedRecognition, configurable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: DeniedRecognition, configurable: true });
  });

  await page.goto('/?view=review');
  await page.getByRole('button', { name: 'Seed practice' }).click();
  await page.getByRole('button', { name: 'Start the chat' }).click();
  await expect(page.getByText(/Mic unavailable — try saying the word, then tap/i)).toBeVisible();

  await page.getByRole('button', { name: /I tried saying.*apple/i }).click();
  await expect(page.getByRole('button', { name: /I tried saying.*cup/i })).toBeVisible();
  await page.getByRole('button', { name: /I tried saying.*cup/i }).click();

  await expect(page.getByRole('heading', { name: 'Nice chat!' })).toBeVisible();
  await expect(page.getByText(/2 self-reported attempts/i)).toBeVisible();
  await expect(page.getByText(/found in conversation/i)).toHaveCount(0);
});
