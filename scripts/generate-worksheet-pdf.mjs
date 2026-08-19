#!/usr/bin/env node
/**
 * generate-worksheet-pdf — render the printable Home Practice Pack to the
 * PDF we host at public/downloads/.
 *
 * WHY THIS IS A SCRIPT AND NOT A MANUAL STEP: the pack's pages are laid out
 * in CSS against a letter page box, so any content change can silently push a
 * block past the bottom margin. When that happened, the Listening Pairs sheet
 * overflowed and the partner's read-aloud instructions — the part that makes
 * the exercise administrable at all — landed alone on a following sheet. A
 * caregiver printing the pack got a page of word pairs with no idea how to
 * use them, and the defect was invisible in the browser (where pages simply
 * grow) and invisible in the page count the app advertises.
 *
 * So this asserts PHYSICAL sheets == DESIGNED pages and refuses to write a
 * PDF that doesn't match. Run it after any change to the pack content or the
 * print layout:
 *
 *   npm run build && npm run worksheets:pdf
 *
 * Exits non-zero on mismatch — unlike the prerender step, a wrong PDF is a
 * document people download and re-share, so failing loudly is correct here.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const OUT = resolve('public/downloads/neurorecover-home-practice-pack.pdf');
const PORT = Number(process.env.WORKSHEET_PDF_PORT ?? 4193);
const ROUTE = '/free-aphasia-worksheets/print';

function fail(msg) {
  console.error(`[worksheet-pdf] ${msg}`);
  process.exit(1);
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function countPdfSheets(path) {
  const buf = readFileSync(path);
  const counts = [...buf.toString('latin1').matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/gs)]
    .map((m) => Number(m[1]));
  return counts.length ? Math.max(...counts) : null;
}

async function main() {
  if (!existsSync(resolve('dist'))) fail('dist/ not found — run the build first.');

  const viteBin = resolve('node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) fail('vite not installed.');

  let chromium;
  try { ({ chromium } = await import('@playwright/test')); }
  catch { fail('@playwright/test not installed.'); }

  const server = spawn(
    process.execPath,
    [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { stdio: 'ignore', detached: true }
  );
  server.on('error', (err) => fail(`preview server failed: ${err.code ?? err}`));

  const stop = () => {
    try { if (server.pid && !server.killed) process.kill(-server.pid, 'SIGTERM'); }
    catch { try { server.kill('SIGTERM'); } catch { /* gone */ } }
  };

  let browser;
  try {
    const base = `http://127.0.0.1:${PORT}`;
    if (!(await waitForServer(base))) fail('preview server did not start.');

    const candidates = [
      process.env.CHROMIUM_PATH,
      '/opt/pw-browsers/chromium/chrome-linux/chrome',
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      '/usr/bin/chromium',
    ].filter(Boolean).filter(existsSync);
    browser = await chromium.launch(candidates[0] ? { executablePath: candidates[0] } : {});

    const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(base + ROUTE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.ws-page', { timeout: 15000 });
    await page.waitForTimeout(800);

    if (errors.length) fail(`print route errored: ${errors[0].slice(0, 160)}`);

    const designed = await page.locator('.ws-page').count();
    if (designed < 10) fail(`only ${designed} pages rendered — pack looks empty.`);

    mkdirSync(dirname(OUT), { recursive: true });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: OUT,
      format: 'Letter',
      printBackground: false,
      margin: { top: '0.7in', bottom: '0.6in', left: '0.7in', right: '0.7in' },
    });

    const sheets = countPdfSheets(OUT);
    if (sheets == null) fail('could not read the page count back from the PDF.');
    if (sheets !== designed) {
      fail(
        `layout overflow: ${designed} designed pages became ${sheets} printed sheets. ` +
        `Some block no longer fits its sheet, which orphans content (e.g. a partner ` +
        `instruction box) onto a page with no heading. Tighten the offending section ` +
        `and re-run. The PDF was written but MUST NOT be shipped as-is.`
      );
    }

    console.log(`[worksheet-pdf] ✓ ${designed} pages → ${sheets} sheets, ${Math.round(readFileSync(OUT).length / 1024)} KB`);
  } finally {
    try { await browser?.close(); } catch { /* noop */ }
    stop();
  }
}

main().catch((err) => fail(String(err).slice(0, 200)));
