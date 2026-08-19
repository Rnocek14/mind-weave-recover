#!/usr/bin/env node
/**
 * verify-dist — refuse to publish a build that is quietly wrong.
 *
 * WHY THIS EXISTS: the live site sat on a build from weeks earlier and
 * nobody noticed, because "the deploy ran" and "the deploy shipped the right
 * thing" are different claims. A deploy step that only checks its own exit
 * code cannot tell the difference. This inspects the artifact itself.
 *
 * HARD FAILURES (the deploy must not proceed):
 *   • no index.html, or a shell that still carries the pre-rename title
 *   • the hosted practice-pack PDF missing or truncated — it is linked from
 *     a public page, so a 404 there is a broken promise to a caregiver
 *   • a localhost origin baked into any HTML: the prerender step renders
 *     against a preview server, and a canonical pointing at 127.0.0.1 is
 *     worse than no canonical at all
 *
 * SOFT FAILURES (warn, still deploy): missing sitemap or un-prerendered
 * marketing routes. Those degrade discovery; they do not break the app, and
 * blocking a working build over an SEO nicety is the wrong trade.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST = resolve('dist');
const BRAND = 'NeuroSpark';
const PDF = 'downloads/neurospark-home-practice-pack.pdf';
const MIN_PDF_BYTES = 50_000;
const PRERENDERED = [
  'free-aphasia-games',
  'aphasia-sentence-exercises',
  'free-aphasia-worksheets',
];

const errors = [];
const warnings = [];

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error('[verify-dist] dist/ not found — nothing was built.');
  process.exit(1);
}

// 1. The shell renders, and it is the current brand.
const shellPath = join(DIST, 'index.html');
if (!existsSync(shellPath)) {
  errors.push('dist/index.html is missing');
} else {
  const shell = readFileSync(shellPath, 'utf8');
  const title = shell.match(/<title>(.*?)<\/title>/is)?.[1]?.trim() ?? '';
  if (!title) errors.push('dist/index.html has no <title>');
  else if (!title.includes(BRAND)) {
    errors.push(`dist/index.html title is "${title}" — expected it to name ${BRAND}`);
  }
  if (!/<div id="root">/.test(shell)) errors.push('dist/index.html has no #root mount point');
}

// 2. The downloadable pack is present and whole.
const pdfPath = join(DIST, PDF);
if (!existsSync(pdfPath)) {
  errors.push(`${PDF} is missing — /free-aphasia-worksheets links to it`);
} else {
  const bytes = statSync(pdfPath).size;
  if (bytes < MIN_PDF_BYTES) errors.push(`${PDF} is only ${bytes} bytes — truncated?`);
}

// 3. No preview origin leaked into any published HTML.
for (const file of htmlFiles(DIST)) {
  const html = readFileSync(file, 'utf8');
  if (html.includes('127.0.0.1') || html.includes('localhost:')) {
    errors.push(`${file.replace(`${DIST}/`, '')} references a local origin`);
  }
}

// 4. Discovery surface — degraded, not broken.
if (!existsSync(join(DIST, 'sitemap.xml'))) warnings.push('sitemap.xml was not generated');
for (const route of PRERENDERED) {
  if (!existsSync(join(DIST, route, 'index.html'))) {
    warnings.push(`/${route} was not prerendered — it ships as a client-rendered SPA route`);
  }
}

for (const w of warnings) console.warn(`[verify-dist] WARN  ${w}`);
for (const e of errors) console.error(`[verify-dist] FAIL  ${e}`);

if (errors.length) {
  console.error(`[verify-dist] refusing to publish: ${errors.length} blocking problem(s).`);
  process.exit(1);
}
console.log(
  `[verify-dist] artifact looks publishable${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`
);
