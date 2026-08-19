/**
 * Editorial standards for the guides, enforced.
 *
 * A content program fails slowly: one article ships without a description,
 * another with a title too long for a search result, a third with no internal
 * links, and by article thirty nobody can tell which ones are fine. These
 * tests are the standard, so it holds at any size.
 *
 * The parity test between the registry and slugs.json is the load-bearing
 * one: the prerender script reads the JSON, and a guide missing from it is
 * published as an empty shell to exactly the crawlers it was written for.
 */
import { describe, it, expect } from 'vitest';
import { GUIDES, getGuide } from '@/content/guides';
import { readingMinutes } from '@/content/guides/types';
import SLUGS from '@/content/guides/slugs.json';

describe('the guide registry', () => {
  it('agrees with slugs.json, which is what actually gets prerendered', () => {
    expect([...SLUGS].sort()).toEqual(GUIDES.map((g) => g.slug).sort());
  });

  it('has no duplicate slugs', () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('uses URL-safe, stable slugs', () => {
    for (const g of GUIDES) {
      expect(g.slug, g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('resolves a known slug and rejects an unknown one', () => {
    expect(getGuide(GUIDES[0].slug)).toBe(GUIDES[0]);
    expect(getGuide('no-such-guide')).toBeUndefined();
    expect(getGuide(undefined)).toBeUndefined();
  });
});

describe.each(GUIDES.map((g) => [g.slug, g] as const))('guide: %s', (_slug, g) => {
  it('has a title that survives a search result', () => {
    expect(g.title.length).toBeGreaterThan(15);
    expect(g.title.length).toBeLessThanOrEqual(65);
  });

  it('has a meta description in the useful range', () => {
    expect(g.description.length).toBeGreaterThanOrEqual(110);
    expect(g.description.length).toBeLessThanOrEqual(180);
  });

  it('tells the reader within two seconds whether they are in the right place', () => {
    expect(g.h1.length).toBeGreaterThan(10);
    expect(g.standfirst.length).toBeGreaterThan(40);
  });

  it('is long enough to be worth landing on', () => {
    // Thin pages do not rank and do not help anyone. 600 words is a floor,
    // not a target.
    const words = g.body.trim().split(/\s+/).length;
    expect(words, `${g.slug} is ${words} words`).toBeGreaterThan(600);
  });

  it('is structured with real subheadings', () => {
    const h2s = g.body.match(/^## .+$/gm) ?? [];
    expect(h2s.length, `${g.slug} h2 count`).toBeGreaterThanOrEqual(3);
  });

  it('links onward into the site', () => {
    // An article with no internal links is a dead end for a reader and for
    // the crawler working out what this site is about.
    const links = g.body.match(/\]\((\/[^)]*)\)/g) ?? [];
    expect(links.length, `${g.slug} internal links`).toBeGreaterThanOrEqual(2);
    expect(g.related.length).toBeGreaterThanOrEqual(2);
  });

  it('only links to real destinations', () => {
    const bodyLinks = [...g.body.matchAll(/\]\((\/[^)#]*)\)/g)].map((m) => m[1]);
    const known = new Set([
      '/free-aphasia-games',
      '/aphasia-sentence-exercises',
      '/free-aphasia-worksheets',
      '/free-aphasia-worksheets/print',
      '/about',
      '/guides',
      '/auth',
      '/privacy',
      '/terms',
      ...GUIDES.map((x) => `/guides/${x.slug}`),
    ]);
    for (const link of [...bodyLinks, ...g.related]) {
      expect(known.has(link), `${g.slug} links to ${link}`).toBe(true);
    }
  });

  it('never links to itself', () => {
    expect(g.related).not.toContain(`/guides/${g.slug}`);
  });

  it('carries a real FAQ, which is also the markup', () => {
    expect(g.faq.length).toBeGreaterThanOrEqual(3);
    for (const f of g.faq) {
      expect(f.q.trim().endsWith('?'), `"${f.q}" should be a question`).toBe(true);
      expect(f.a.trim().length, `answer to "${f.q}"`).toBeGreaterThan(80);
    }
  });

  it('has an ISO date that parses', () => {
    expect(g.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(g.updated))).toBe(false);
  });

  it('defers to a clinician somewhere on the page', () => {
    // Every one of these pages is read by someone making decisions about a
    // person's recovery. None of them may read as the last word.
    const body = g.body.toLowerCase();
    const defers =
      body.includes('speech therapist') ||
      body.includes('speech-language pathologist') ||
      body.includes('clinician') ||
      body.includes('care team');
    expect(defers, `${g.slug} never points at a professional`).toBe(true);
  });

  it('does not promise an outcome', () => {
    // Recovery claims are the one category of sentence that could actually
    // harm a reader, and they are easy to write by accident.
    const forbidden = [/\bwill recover\b/i, /\bguarantee/i, /\bcure\b/i, /\bproven to\b/i, /\brestores? speech\b/i];
    for (const pattern of forbidden) {
      expect(pattern.test(g.body), `${g.slug} matches ${pattern}`).toBe(false);
    }
  });
});

describe('readingMinutes', () => {
  it('never reports zero', () => {
    expect(readingMinutes('one word')).toBe(1);
  });

  it('scales with length', () => {
    const short = readingMinutes(Array(200).fill('word').join(' '));
    const long = readingMinutes(Array(2000).fill('word').join(' '));
    expect(long).toBeGreaterThan(short);
  });
});
