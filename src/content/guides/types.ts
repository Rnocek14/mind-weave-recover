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

/**
 * The kind of search this guide is written for.
 *
 * WHY THIS IS IN THE DATA: the first batches are written before there is any
 * Search Console history, so topic choice is judgment, not evidence. Tagging
 * each guide with the intent it targets turns "we wrote some articles" into a
 * readable experiment — when impression data does arrive, you can see which
 * KIND of query found the site rather than only which page did, and aim the
 * next batch at that instead of guessing again.
 */
export type GuideIntent =
  /** "He just had a stroke and I don't know what to do." */
  | 'situational'
  /** "How do I help him find a word?" */
  | 'how-to'
  /** "How much practice, how often, for how long?" */
  | 'dosage'
  /** "What does this word the doctor used actually mean?" */
  | 'definitional'
  /** "Why does he do this specific thing?" */
  | 'symptom'
  /** "This is exhausting and I'm not coping." */
  | 'emotional'
  /** "What is out there that I can use?" */
  | 'resource'
  /** "How long will this take?" */
  | 'prognosis'
  /** "Give me exercises I can do today." */
  | 'activity';

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
  /** The search intent this guide targets. See GuideIntent. */
  intent: GuideIntent;
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
