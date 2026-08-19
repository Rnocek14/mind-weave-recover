/**
 * Guide — one long-form article on the public site.
 *
 * WHY A TYPE AND NOT JUST MARKDOWN FILES: this is meant to grow to dozens of
 * articles, and at that size the things that quietly rot are the ones nobody
 * can see — a missing meta description, a title that got too long for a
 * search result, an article with no internal links, a health page that lost
 * its disclaimer. Making those fields part of the type means the compiler
 * and the tests can hold the line instead of a person remembering to.
 *
 * The prose itself is Markdown, because prose is easier to write and review
 * as prose. Everything around it is structured.
 */

export interface GuideFaq {
  q: string;
  a: string;
}

export interface Guide {
  /** URL segment under /guides/. Lowercase, hyphenated, stable forever. */
  slug: string;
  /** <title>. Search results truncate past roughly 60 characters. */
  title: string;
  /** The visible headline. Usually shorter and plainer than the title. */
  h1: string;
  /** Meta description. Roughly 140–165 characters is the useful range. */
  description: string;
  /** ISO date (YYYY-MM-DD). Shown to readers and used as sitemap lastmod. */
  updated: string;
  /**
   * One sentence under the headline saying who this is for. Readers arriving
   * from a search need to know in two seconds whether they are in the right
   * place.
   */
  standfirst: string;
  /** Article body as Markdown. */
  body: string;
  /** Questions repeated verbatim in the FAQPage markup. */
  faq: GuideFaq[];
  /** Site-relative paths this article links onward to. */
  related: string[];
}

/** Rough reading time; deliberately generous for an audience with aphasia. */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 180));
}
