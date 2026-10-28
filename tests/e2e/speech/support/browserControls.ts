import type { Page } from '@playwright/test';

type RecognitionCallback = ((event?: unknown) => void) | null;
interface RecognitionControl {
  active: boolean;
  starts: number;
  emit: (text: string, final: boolean, confidence: number | null) => void;
  fail: (error: string) => void;
}
declare global {
  interface Window {
    __speechTest: {
      recognition: RecognitionControl | null;
      streams: Array<{ stream: MediaStream; startedAt: number }>;
    };
  }
}

/** Install browser API event controls, never a replacement recorder or WAV converter. */
export async function installBrowserControls(page: Page) {
  await page.addInitScript(() => {
    window.__speechTest = { recognition: null, streams: [] };
    const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await nativeGetUserMedia(constraints);
      window.__speechTest.streams.push({ stream, startedAt: performance.now() });
      return stream;
    };

    // Native Web Speech can contact a browser/vendor service independently of
    // getUserMedia. These explicit events test the app's handling, not live ASR.
    class ControlledRecognition {
      active = false;
      starts = 0;
      continuous = false;
      interimResults = false;
      lang = '';
      maxAlternatives = 1;
      onstart: RecognitionCallback = null;
      onend: RecognitionCallback = null;
      onerror: RecognitionCallback = null;
      onresult: RecognitionCallback = null;
      constructor() { window.__speechTest.recognition = this; }
      start() {
        if (this.active) throw new DOMException('Already started', 'InvalidStateError');
        this.active = true;
        this.starts++;
        queueMicrotask(() => this.onstart?.());
      }
      stop() {
        if (!this.active) return;
        this.active = false;
        queueMicrotask(() => this.onend?.());
      }
      abort() { this.stop(); }
      emit(text: string, final: boolean, confidence: number | null) {
        const result = Object.assign([{ transcript: text, confidence }], { isFinal: final });
        this.onresult?.({ resultIndex: 0, results: [result] });
      }
      fail(error: string) {
        this.onerror?.({ error });
        this.active = false;
        queueMicrotask(() => this.onend?.());
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: ControlledRecognition });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: ControlledRecognition });

    // Synthetic cached session: no sign-in request is sent, and every transport
    // is fulfilled by the local test. This is not authentication/RLS evidence.
    const userId = '11111111-1111-4111-8111-111111111111';
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value: object) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: userId, exp: expiry, role: 'authenticated' })}.synthetic`;
    localStorage.setItem('sb-127-auth-token', JSON.stringify({
      access_token: token, refresh_token: 'synthetic-unused-refresh-token',
      token_type: 'bearer', expires_in: 3600, expires_at: expiry,
      user: { id: userId, aud: 'authenticated', role: 'authenticated',
        app_metadata: { provider: 'anonymous' }, user_metadata: {},
        created_at: '2026-01-01T00:00:00Z', is_anonymous: true },
    }));
    localStorage.setItem('coaching-mode', 'off');
  });
}

export const microphoneState = (page: Page) => page.evaluate(() => window.__speechTest.streams.map(({ stream, startedAt }) => ({
  ageMs: performance.now() - startedAt,
  tracks: stream.getTracks().map((track) => track.readyState),
})));

export async function emitRecognition(page: Page, text: string, final = true, confidence: number | null = 0.94) {
  await page.evaluate(({ text, final, confidence }) => {
    const recognition = window.__speechTest.recognition;
    if (!recognition?.active) throw new Error('No active recognition instance');
    recognition.emit(text, final, confidence);
  }, { text, final, confidence });
}

/** An explicit observation window for an absence-of-submission assertion. */
export async function observeNoCompletion(page: Page, milliseconds: number) {
  await page.evaluate((duration) => new Promise<void>((resolve, reject) => {
    const start = performance.now();
    const check = () => {
      const results = document.querySelector('[data-testid="trial-results"]')?.textContent;
      if (results !== '[]') return reject(new Error(`A trial completed during the ${duration}ms patience window`));
      if (performance.now() - start >= duration) return resolve();
      requestAnimationFrame(check);
    };
    check();
  }), milliseconds);
}
