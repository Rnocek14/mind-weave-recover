#!/usr/bin/env node
/**
 * postbuild-seo — prerender the public marketing routes and emit a sitemap.
 *
 * WHY: the app is a client-rendered SPA. Googlebot executes JavaScript, but
 * the AI-search crawlers that increasingly mediate health queries
 * (OAI-SearchBot, PerplexityBot, Claude-SearchBot) generally do not — they
 * see an empty shell. This writes real HTML for the handful of routes that
 * exist to be found.
 *
 * FAIL-SOFT BY DESIGN: every failure path exits 0. A missing browser or a
 * flaky preview server must degrade to "ships as a normal SPA", never to a
 * broken deploy. Anything that would make the site worse than the status quo
 * is caught and downgraded to a warning.
 *
 * Sitemap generation runs only when SITE_URL is set — a sitemap pointing at
 * the wrong origin is worse than no sitemap at all.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const DIST = resolve('dist');
const PORT = Number(process.env.PRERENDER_PORT ?? 4183);
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/$/, '');

/** Public, indexable routes. Keep in sync with the marketing routes in App.tsx. */
const ROUTES = [
  '/free-aphasia-games',
  '/aphasia-sentence-exercises',
  '/free-aphasia-worksheets',
  '/about',
];

const warn = (msg) => console.warn(`[postbuild-seo] ${msg}`);
const info = (msg) => console.log(`[postbuild-seo] ${msg}`);

function writeSitemap() {
  if (!SITE_URL) {
    info('SITE_URL not set — skipping sitemap (a sitemap with the wrong origin is worse than none).');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['/', ...ROUTES]
    .map(
      (r) =>
        `  <url>\n    <loc>${SITE_URL}${r}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`
    )
    .join('\n');
  writeFileSync(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );

  const robotsPath = join(DIST, 'robots.txt');
  if (existsSync(robotsPath)) {
    const robots = readFileSync(robotsPath, 'utf8');
    if (!robots.includes('Sitemap:')) {
      writeFileSync(robotsPath, `${robots.trimEnd()}\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
    }
  }
  info(`sitemap.xml written for ${SITE_URL}`);
}

async function resolveChromium() {
  try {
    const { chromium } = await import('@playwright/test');
    // Explicit path wins (CI images often preinstall a browser).
    const explicit = process.env.CHROMIUM_PATH;
    if (explicit && existsSync(explicit)) return { chromium, executablePath: explicit };
    const common = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    if (existsSync(common)) return { chromium, executablePath: common };
    // Fall back to Playwright's own resolution; may throw if not installed.
    return { chromium, executablePath: undefined };
  } catch {
    return null;
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function prerender() {
  const resolved = await resolveChromium();
  if (!resolved) {
    warn('Playwright/Chromium unavailable — shipping as a normal SPA (no prerender).');
    return;
  }

  const server = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { stdio: 'ignore', detached: false }
  );

  let browser;
  try {
    const base = `http://127.0.0.1:${PORT}`;
    if (!(await waitForServer(base))) {
      warn('preview server did not start — skipping prerender.');
      return;
    }

    const { chromium, executablePath } = resolved;
    browser = await chromium.launch(executablePath ? { executablePath } : {});
    const page = await browser.newPage();

    for (const route of ROUTES) {
      try {
        await page.goto(base + route, { waitUntil: 'networkidle', timeout: 30000 });
        // Let the route's meta effects (title/description/canonical) apply.
        await page.waitForTimeout(600);
        let html = await page.content();
        // Sanity gate: never write a shell emptier than what we started with.
        if (!/<h1[\s>]/i.test(html)) {
          warn(`${route} rendered without an <h1> — leaving the SPA shell in place.`);
          continue;
        }
        // The page was rendered against localhost, so any absolute URL it
        // built at runtime (canonical, og:url) points at the preview server.
        // Rewrite to the real origin, or drop the tag entirely rather than
        // ship a canonical pointing at 127.0.0.1 — a wrong canonical is far
        // more damaging than a missing one.
        if (SITE_URL) {
          html = html.split(base).join(SITE_URL);
        } else {
          html = html.replace(/\s*<link[^>]+rel="canonical"[^>]*>/gi, '');
        }
        if (html.includes('127.0.0.1')) {
          warn(`${route} still references the preview origin — skipping to avoid bad URLs.`);
          continue;
        }
        const outDir = join(DIST, route.replace(/^\//, ''));
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, 'index.html'), html);
        info(`prerendered ${route} (${Math.round(html.length / 1024)} KB)`);
      } catch (err) {
        warn(`${route} failed to prerender: ${String(err).slice(0, 120)}`);
      }
    }
  } catch (err) {
    warn(`prerender aborted: ${String(err).slice(0, 160)}`);
  } finally {
    try { await browser?.close(); } catch { /* noop */ }
    try { server.kill('SIGTERM'); } catch { /* noop */ }
  }
}

async function main() {
  if (!existsSync(DIST)) {
    warn('dist/ not found — nothing to do.');
    return;
  }
  writeSitemap();
  await prerender();
}

main()
  .catch((err) => warn(`unexpected error, continuing: ${String(err).slice(0, 160)}`))
  .finally(() => process.exit(0));
