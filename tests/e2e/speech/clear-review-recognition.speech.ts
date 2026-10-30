import { expect, test } from '@playwright/test';

/**
 * Controlled Web Speech recognition integration against the real ReviewChatPage.
 * Unlike the other speech harness lanes this does NOT run native ASR; it injects
 * browser recognition events to verify the UI-to-engine-to-summary contract.
 */
test('uncertain ASR cannot be counted as successful speech until confirmed', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    class RecognitionStub {
      continuous = false;
      interimResults = false;
      lang = 'en-US';
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      start() {
        (window as any).__reviewRecognizer = this;
        this.onstart?.();
      }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    (window as any).webkitSpeechRecognition = RecognitionStub;
    (window as any).__emitReviewSpeech = (transcript: string, confidence: number) => {
      const recognizer = (window as any).__reviewRecognizer as RecognitionStub;
      if (!recognizer) throw new Error('Recognition stub did not start');
      const alternatives = Object.assign([{ transcript, confidence }], { isFinal: true });
      recognizer.onresult?.({ results: [alternatives] });
    };
  });
  await page.goto('/?view=review');
  await page.getByRole('button', { name: 'Seed practice' }).click();
  await page.getByRole('button', { name: 'Start the chat' }).click();
  await expect(page.getByText(/Maya is listening/i)).toBeVisible();

  // Advance past the deterministic Maya echo lock but NOT the patient timeout.
  await page.clock.fastForward(11000);
  await page.evaluate(() => (window as any).__emitReviewSpeech('apple', 0.2));

  await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'No' })).toBeVisible();

  // Web Speech may re-send its last final hypothesis. It must not
  // auto-confirm the word as a second, independent patient turn.
  await page.evaluate(() => (window as any).__emitReviewSpeech('apple', 0.2));
  await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible();

  // Explicit refusal must not produce false success.
  await page.getByRole('button', { name: 'No' }).click();
  await page.getByRole('button', { name: /All done/ }).click();
  await expect(page.getByRole('heading', { name: 'Nice chat!' })).toBeVisible();
  await expect(page.getByText(/found in conversation/)).toHaveCount(0);
  await expect(page.getByText(/used without a hint in this chat/)).toHaveCount(0);
  await expect(page.getByText(/with a little help/)).toHaveCount(0);
});
