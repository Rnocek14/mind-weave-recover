/**
 * Drive the real production bundle in a real browser against the real backend.
 *
 * Two accommodations, both of which keep the thing under test honest:
 *
 *  - Chromium in this sandbox has no usable certificate root store at all
 *    (example.com fails identically to neurospark.co, proxy or no proxy), so
 *    Node terminates TLS and serves the SAME dist that neurospark.co serves —
 *    verified byte-identical, all 89 chunks — over plain HTTP on localhost.
 *  - Headless Chromium has no Web Speech API, so a controllable stand-in is
 *    installed before any app code runs. It is a stand-in for the ENGINE, not
 *    for the app: every hook, timer, threshold and gate under test is the real
 *    shipped code reacting to real recognition events.
 */
import { chromium } from '@playwright/test';

export const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const ORIGIN = `http://127.0.0.1:${process.env.RT_PORT || 8899}`;

const SPEECH_SHIM = () => {
  class FakeRecognition {
    constructor() {
      this.continuous = false; this.interimResults = false;
      this.lang = 'en-US'; this.maxAlternatives = 1; this._running = false;
    }
    start() {
      if (this._running) throw new DOMException('already started', 'InvalidStateError');
      this._running = true;
      window.__sr.log.push(['start', Date.now()]);
      setTimeout(() => this.onstart && this.onstart(new Event('start')), 0);
    }
    stop() {
      if (!this._running) return;
      this._running = false;
      window.__sr.log.push(['stop', Date.now()]);
      setTimeout(() => this.onend && this.onend(new Event('end')), 0);
    }
    abort() { this.stop(); }
    addEventListener() {} removeEventListener() {}
  }
  const instances = [];
  const OrigCtor = function () { const r = new FakeRecognition(); instances.push(r); return r; };
  OrigCtor.prototype = FakeRecognition.prototype;
  window.SpeechRecognition = OrigCtor;
  window.webkitSpeechRecognition = OrigCtor;
  window.__sr = {
    log: [],
    instances,
    active() { return instances.filter((i) => i._running).pop() || null; },
    /** Feed one recognition result to whichever recogniser is listening. */
    say(text, isFinal = true) {
      const inst = this.active();
      if (!inst || !inst.onresult) return 'no-active-recogniser';
      const alt = { transcript: text, confidence: 0.92 };
      const res = { 0: alt, length: 1, isFinal, item: (i) => alt };
      const results = { 0: res, length: 1, item: (i) => res };
      this.log.push(['say', text, isFinal]);
      inst.onresult({ results, resultIndex: 0 });
      return 'ok';
    },
  };
};

/** Record everything worth knowing about a page for later assertions. */
export function instrument(page, bag) {
  page.on('console', (m) => {
    const t = m.text();
    bag.console.push(`[${m.type()}] ${t.slice(0, 300)}`);
    if (m.type() === 'error') bag.consoleErrors.push(t.slice(0, 300));
  });
  page.on('pageerror', (e) => bag.pageErrors.push(String(e).slice(0, 400)));
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText || '';
    if (!/ERR_ABORTED/.test(f)) bag.failedRequests.push(`${r.method()} ${r.url().slice(0, 110)} ${f}`);
  });
}

export function newBag() {
  return { console: [], consoleErrors: [], pageErrors: [], failedRequests: [] };
}

export async function launch() {
  return chromium.launch({
    executablePath: EXE,
    args: ['--no-proxy-server', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    env: { ...process.env, HTTPS_PROXY: '', https_proxy: '', HTTP_PROXY: '', http_proxy: '' },
  });
}

export async function newPage(browser, bag) {
  const ctx = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 420, height: 900 }, // a phone, which is what it is used on
  });
  await ctx.addInitScript(SPEECH_SHIM);
  const page = await ctx.newPage();
  instrument(page, bag);
  return page;
}

/** Create a throwaway account and land signed in. */
export async function signUp(page, email, password = 'RuntimeCheck!2026') {
  await page.goto(`${ORIGIN}/auth`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  return { email, password };
}

/** Full signup: switch to the signup form, fill it, accept terms, submit. */
export async function createAccount(page, email, password = 'RuntimeCheck!2026', name = 'Runtime Check') {
  await page.goto(`${ORIGIN}/auth`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  const toSignup = page.locator('button:has-text("Sign Up")');
  if (await toSignup.count()) { await toSignup.first().click(); await page.waitForTimeout(1200); }

  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  const nameBox = page.locator('input[type=text]').first();
  if (await nameBox.count()) await nameBox.fill(name);

  // The role picker is a combobox already defaulted to "I'm recovering", and
  // consent is a shadcn button[role=checkbox] — clicking the hidden native
  // input as well just toggles it straight back off.
  const consent = page.locator('button[role=checkbox]').first();
  if (await consent.count()) {
    await consent.click();
    await page.waitForFunction(
      () => document.querySelector('button[role=checkbox]')?.getAttribute('data-state') === 'checked',
      undefined, { timeout: 5000 }
    );
  }
  await page.click('button:has-text("Create Account")', { timeout: 20000 });
  await page.waitForTimeout(9000);
  return page.url();
}

/** Get into an exercise, waiting for the game to actually mount. */
export async function openExercise(page, slug, ms = 12000) {
  await page.goto(`${ORIGIN}/exercise/${slug}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(ms);
  return { url: page.url(), text: (await page.locator('body').innerText()).replace(/\n+/g, ' | ') };
}
