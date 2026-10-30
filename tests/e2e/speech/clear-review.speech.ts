import { expect, test, type Page } from '@playwright/test';

/**
 * Runs the actual ReviewChatPage -> useSpeechRecognition -> reviewConversation
 * path. The Web Speech recognition boundary is deliberately controlled: WAV
 * fake-mic capture alone cannot guarantee a deterministic transcript.
 * No authentication, patient data, real backend, or live ASR is involved.
 */
async function emitSpeech(page: Page, text: string, confidence = 0.95) {
  await page.evaluate(({ transcript, confidence: score }) => {
    (window as any).__reviewEmitSpeech(transcript, score);
  }, { transcript: text, confidence });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Silence audio output so that echo-lock delays don't obscure deterministic
    // recognition-state tests. Physical TTS/ASR echo must be tested separately.
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });

    class ControlledSpeechRecognition {
      static active: ControlledSpeechRecognition | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onresult: ((event: any) => void) | null = null;
      onerror: ((event: any) => void) | null = null;
      continuous = true;
      interimResults = true;
      lang = 'en-US';
      maxAlternatives = 5;
      constructor() { ControlledSpeechRecognition.active = this; }
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
      emit(transcript: string, confidence: number) {
        const result = Object.assign([{ transcript, confidence }], { isFinal: true });
        this.onresult?.({ results: [result], resultIndex: 0 });
      }
    }

    Object.defineProperty(window, 'SpeechRecognition', {
      value: ControlledSpeechRecognition, configurable: true,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: ControlledSpeechRecognition, configurable: true,
    });
    (window as any).__reviewEmitSpeech = (text: string, confidence: number) => {
      if (!ControlledSpeechRecognition.active) throw new Error('Recognition not ready');
      ControlledSpeechRecognition.active.emit(text, confidence);
    };
  });
  await page.goto('/?view=review');
  await page.getByRole('button', { name: 'Seed practice' }).click();
  await page.getByRole('button', { name: 'Start the chat' }).click();
  await expect(page.getByRole('button', { name: 'New topic' })).toBeVisible();
  await expect(page.getByText('Maya is listening...')).toBeVisible();
});

test('actual review UI accepts independent words and reaches a bounded summary', async ({ page }) => {
  await emitSpeech(page, 'apple');
  await expect(page.getByText(/cup.*\?/i)).toBeVisible();
  await emitSpeech(page, 'cup');
  await expect(page.getByRole('heading', { name: 'Nice chat!' })).toBeVisible();
  await expect(page.getByText(/2 found in conversation/i)).toBeVisible();
  await expect(page.getByText(/word.*used all on your own/i)).toHaveCount(0);
});

test('low-confidence ASR requires verification and duplicate finals cannot auto-confirm', async ({ page }) => {
  await emitSpeech(page, 'apple', 0.1);
  await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'No' })).toBeVisible();

  // The recognition hook and engine must not treat a second identical final
  // as the patient's explicit confirmation.
  await emitSpeech(page, 'apple', 0.1);
  await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'No' })).toBeVisible();

  await page.getByRole('button', { name: 'No' }).click();
  await expect(page.getByRole('button', { name: 'New topic' })).toBeVisible();
  await page.getByRole('button', { name: 'All done' }).click();
  await expect(page.getByRole('heading', { name: 'Nice chat!' })).toBeVisible();
  await expect(page.getByText(/2 saved for next time/i)).toBeVisible();
});

test('patient can stop immediately despite unresolved practice words', async ({ page }) => {
  await page.getByRole('button', { name: 'All done' }).click();
  await expect(page.getByRole('heading', { name: 'Nice chat!' })).toBeVisible();
  await expect(page.getByText(/2 saved for next time/i)).toBeVisible();
});
