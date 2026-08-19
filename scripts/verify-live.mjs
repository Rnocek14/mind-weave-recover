#!/usr/bin/env node
/**
 * verify-live — ask the live site whether the deploy actually landed.
 *
 * WHY: "the deploy succeeded" and "the site changed" are different claims,
 * and for weeks they disagreed here — the domain served a build older than
 * every fix in the repo while everything looked fine from the inside. The
 * only way to know is to fetch the origin and read what it says.
 *
 * Usage:
 *   node scripts/verify-live.mjs                     # https://neurospark.co
 *   node scripts/verify-live.mjs https://example.com # any origin
 *
 * Exits non-zero if any check fails, so it can gate a release.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE = (process.argv[2] ?? 'https://neurospark.co').replace(/\/$/, '');
const BRAND = 'NeuroSpark';

/**
 * Every route that must render its OWN page rather than the app shell. Read
 * from the same JSON the build reads, because this script has already been
 * wrong once in the direction that matters: it reported 8/8 green while the
 * whole guides section and the rewritten About page were absent from the live
 * site. A checker that only knows about the pages that existed when it was
 * written reports success by omission.
 */
function contentRoutes() {
  const fixed = [
    '/free-aphasia-games',
    '/aphasia-sentence-exercises',
    '/free-aphasia-worksheets',
    '/about',
    '/guides',
  ];
  try {
    const slugs = JSON.parse(readFileSync(resolve('src/content/guides/slugs.json'), 'utf8'));
    return [...fixed, ...slugs.map((slug) => `/guides/${slug}`)];
  } catch {
    console.warn('[verify-live] slugs.json unreadable — guide pages not checked.');
    return fixed;
  }
}

let passed = 0;
const failures = [];

const pass = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const fail = (label, detail) => {
  failures.push(label);
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
};

async function get(path) {
  try {
    const res = await fetch(SITE + path, { redirect: 'follow' });
    return { status: res.status, body: res.ok ? await res.text() : '' };
  } catch (err) {
    return { status: 0, body: '', error: String(err).slice(0, 80) };
  }
}

const titleOf = (html) =>
  html.match(/<title>(.*?)<\/title>/is)?.[1]?.replace(/<[^>]*>/g, '').trim() ?? '';

async function main() {
  console.log(`Verifying ${SITE}\n`);

  // 1. The shell is the current build.
  const home = await get('/');
  const homeTitle = titleOf(home.body);
  if (home.status !== 200) fail('homepage responds', `HTTP ${home.status}${home.error ? ` (${home.error})` : ''}`);
  else if (!homeTitle.includes(BRAND)) fail('homepage carries the current brand', `title is "${homeTitle}"`);
  else pass(`homepage title: ${homeTitle}`);

  // 2. Files that only exist in a current build.
  for (const path of ['/manifest.json', '/sitemap.xml', '/downloads/neurospark-home-practice-pack.pdf']) {
    const res = await get(path);
    if (res.status === 200) pass(`${path} is served`);
    else fail(`${path} is served`, `HTTP ${res.status}`);
  }

  // 3. Content routes render themselves rather than falling through to the
  //    app shell — the failure mode that gets the app's 404 screen indexed
  //    under a dozen different URLs.
  for (const path of contentRoutes()) {
    const res = await get(path);
    const title = titleOf(res.body);
    if (res.status !== 200) fail(`${path} renders`, `HTTP ${res.status}`);
    else if (!title || title === homeTitle) fail(`${path} renders its own page`, `fell through to the shell ("${title}")`);
    else pass(`${path} → ${title}`);
  }

  // 4. Crawler policy shipped.
  const robots = await get('/robots.txt');
  if (robots.status === 200 && robots.body.includes('OAI-SearchBot')) pass('robots.txt allows the AI-search crawlers');
  else fail('robots.txt allows the AI-search crawlers', robots.status === 200 ? 'old version still served' : `HTTP ${robots.status}`);

  const total = passed + failures.length;
  console.log(`\n${passed}/${total} checks passed.`);
  if (failures.length) {
    console.log('The live site is NOT serving the current build.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`verify-live failed to run: ${err}`);
  process.exit(1);
});
