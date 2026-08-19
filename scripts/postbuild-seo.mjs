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
 * FAIL-SOFT BY DESIGN: every failure path exits 0 and leaves the plain SPA
 * build intact. A missing browser, an unstartable preview server, or a
 * read-only filesystem must degrade to "ships as a normal SPA", never to a
 * broken deploy. Two rules keep that promise honest:
 *   1. Nothing is written unless it is verifiably BETTER than the shell —
 *      a crash screen or an unrendered shell is never published.
 *   2. The outcome is always reported (`prerendered N/M routes`), so a
 *      silent no-op can't masquerade as success.
 *
 * Sitemap generation runs only when SITE_URL is set — a sitemap pointing at
 * the wrong origin is worse than no sitemap at all.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST = resolve('dist');
const PORT = Number(process.env.PRERENDER_PORT ?? 4183);
/**
 * Production origin. SITE_URL overrides it (preview deploys, staging), but it
 * DEFAULTS to the real domain so an ordinary `npm run build` on the deploy
 * host emits correct canonicals and a sitemap without any env configuration —
 * the previous env-only behaviour silently shipped neither.
 */
const DEFAULT_SITE_URL = 'https://neurospark.co';
const SITE_URL = (process.env.SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, '');

/** Public, indexable routes. Keep in sync with the marketing routes in App.tsx. */
const ROUTES = [
  '/free-aphasia-games',
  '/aphasia-sentence-exercises',
  '/free-aphasia-worksheets',
  // NOTE: '/about' is deliberately NOT indexed yet — it is still written as a
  // clinician-facing pitch. Add it once it is rewritten as the founder story
  // (which is also the page's value as an experience/authorship signal).
];

/** Text the app's own error boundary renders — never publish this. */
const CRASH_MARKERS = ['Something went wrong', 'Application error'];

const warn = (msg) => console.warn(`[postbuild-seo] ${msg}`);
const info = (msg) => console.log(`[postbuild-seo] ${msg}`);

function writeSitemap() {
  if (!SITE_URL) {
    info('SITE_URL not set — skipping sitemap (a sitemap with the wrong origin is worse than none).');
    return;
  }
  try {
    // Prerendered marketing routes plus the static legal pages, which are
    // indexable but not worth prerendering.
    const urls = ['/', ...ROUTES, '/privacy', '/terms']
      .map((r) => `  <url>\n    <loc>${SITE_URL}${r}</loc>\n  </url>`)
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
  } catch (err) {
    warn(`sitemap skipped: ${String(err).slice(0, 120)}`);
  }
}

/**
 * Resolve a Chromium binary. Order: explicit env var, Playwright's own
 * resolution (the portable answer), then known container paths.
 */
async function resolveChromium() {
  let chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    return null;
  }
  const candidates = [
    process.env.CHROMIUM_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) return { chromium, executablePath: p };
  }
  // Let Playwright find its own managed install; may throw at launch time,
  // which the caller handles.
  return { chromium, executablePath: undefined };
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

/** Start `vite preview`, returning a handle with a teardown that actually works. */
function startPreview() {
  // Spawn the local vite binary directly rather than through `npx`: killing
  // an `npx` wrapper leaves the real server running, which orphans a process
  // that later builds would then silently prerender against (serving a STALE
  // dist). `detached` puts it in its own group so teardown takes the whole
  // tree with it.
  const viteBin = resolve('node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) return { ok: false, reason: 'vite binary not found' };

  let child;
  let spawnError = null;
  try {
    child = spawn(
      process.execPath,
      [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
      { stdio: 'ignore', detached: true }
    );
  } catch (err) {
    return { ok: false, reason: String(err).slice(0, 120) };
  }
  // Without this listener a spawn failure (ENOENT/EAGAIN/EMFILE under memory
  // pressure right after a build) is an UNCAUGHT exception that would fail
  // the whole deploy — exactly what fail-soft is supposed to prevent.
  child.on('error', (err) => { spawnError = err; });

  return {
    ok: true,
    child,
    failed: () => spawnError,
    stop() {
      try {
        if (child.pid && !child.killed) process.kill(-child.pid, 'SIGTERM');
      } catch {
        try { child.kill('SIGTERM'); } catch { /* already gone */ }
      }
    },
  };
}

/**
 * Is this rendered HTML actually a successful render of `route`?
 * A bare `<h1>` check is not enough: the app's error boundary renders its
 * own `<h1>`, so a failed lazy-chunk load would otherwise be published as
 * the marketing page.
 */
function isPublishable(html, shellTitle) {
  if (!/<h1[\s>]/i.test(html)) return { ok: false, why: 'no <h1> — route did not render' };
  for (const marker of CRASH_MARKERS) {
    if (html.includes(marker)) return { ok: false, why: `error boundary rendered ("${marker}")` };
  }
  const title = html.match(/<title>(.*?)<\/title>/is)?.[1]?.trim();
  if (!title) return { ok: false, why: 'no <title>' };
  if (shellTitle && title === shellTitle) {
    return { ok: false, why: 'title still the shell default — per-route meta never ran' };
  }
  return { ok: true };
}

async function prerender() {
  const resolved = await resolveChromium();
  if (!resolved) {
    warn('Playwright unavailable — prerendered 0/' + ROUTES.length + ' routes; shipping as a plain SPA.');
    return;
  }

  const shellTitle = (() => {
    try {
      const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
      return shell.match(/<title>(.*?)<\/title>/is)?.[1]?.trim() ?? null;
    } catch { return null; }
  })();

  const preview = startPreview();
  if (!preview.ok) {
    warn(`preview server unavailable (${preview.reason}) — prerendered 0/${ROUTES.length} routes.`);
    return;
  }

  let browser;
  let written = 0;
  try {
    const base = `http://127.0.0.1:${PORT}`;
    const up = await waitForServer(base);
    if (preview.failed()) {
      warn(`preview server failed to start (${preview.failed().code ?? 'error'}) — prerendered 0/${ROUTES.length} routes.`);
      return;
    }
    if (!up) {
      warn(`preview server did not answer on ${PORT} — prerendered 0/${ROUTES.length} routes.`);
      return;
    }

    const { chromium, executablePath } = resolved;
    browser = await chromium.launch(executablePath ? { executablePath } : {});
    const page = await browser.newPage();

    for (const route of ROUTES) {
      try {
        await page.goto(base + route, { waitUntil: 'networkidle', timeout: 30000 });
        // Wait for actual render rather than a fixed sleep: on a cold runner
        // a fixed wait elapses before React mounts the lazy route, and we
        // would capture (and reject) an empty shell every time.
        await page.waitForSelector('h1', { timeout: 15000 });
        await page.waitForTimeout(300); // let meta effects settle

        let html = await page.content();

        const verdict = isPublishable(html, shellTitle);
        if (!verdict.ok) {
          warn(`${route} skipped — ${verdict.why}.`);
          continue;
        }

        // The page rendered against localhost, so any absolute URL built at
        // runtime (canonical, og:url) points at the preview server. Rewrite
        // to the real origin, or drop the canonical entirely — a canonical
        // pointing at 127.0.0.1 is far more damaging than a missing one.
        if (SITE_URL) {
          html = html.split(base).join(SITE_URL);
        } else {
          html = html.replace(/\s*<link[^>]+rel="canonical"[^>]*>/gi, '');
        }
        if (html.includes('127.0.0.1')) {
          warn(`${route} skipped — preview origin still referenced.`);
          continue;
        }

        const slug = route.replace(/^\//, '');
        // Directory form serves /route on hosts that resolve directory
        // indexes; the sibling .html file covers hosts that only do
        // extension lookup. Both are cheap; one of them will be right.
        mkdirSync(join(DIST, slug), { recursive: true });
        writeFileSync(join(DIST, slug, 'index.html'), html);
        writeFileSync(join(DIST, `${slug}.html`), html);
        written += 1;
        info(`prerendered ${route} (${Math.round(html.length / 1024)} KB)`);
      } catch (err) {
        warn(`${route} skipped — ${String(err).slice(0, 110)}`);
      }
    }
  } catch (err) {
    warn(`prerender aborted: ${String(err).slice(0, 160)}`);
  } finally {
    try { await browser?.close(); } catch { /* noop */ }
    preview.stop();
    const msg = `prerendered ${written}/${ROUTES.length} routes`;
    if (written === ROUTES.length) info(msg);
    else warn(`${msg} — the rest ship as a plain SPA.`);
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
