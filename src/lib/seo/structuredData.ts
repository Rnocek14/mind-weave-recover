/**
 * structuredData — JSON-LD builders for the public, indexable pages.
 *
 * WHY ONLY THESE TYPES: schema is worth shipping only where it describes
 * something a visitor can actually see on the page — Google treats markup
 * that describes absent content as spam, and it is the easiest way to lose
 * rich results permanently.
 *
 *   • FAQPage is earned: every marketing page carries a real, visible
 *     question-and-answer block.
 *   • AboutPage + Person is the signal that matters most for health content.
 *     Search quality guidelines weigh first-hand experience heavily, and for
 *     this site the experience is the whole story: it was built by a son for
 *     his father. An anonymous brand cannot claim that.
 *
 * Organization and WebSite are deliberately ABSENT here: they are site-wide
 * entities and already live as static blocks in index.html, so every page
 * carries them. Emitting a second, differently-worded copy per route is how
 * you end up with two disagreeing descriptions of one entity, which Google
 * may resolve by discarding both.
 *
 * Pure data — no DOM, no React — so every shape is unit-testable.
 */

export const SITE_ORIGIN = 'https://neurospark.co';

export interface FaqEntry {
  q: string;
  a: string;
}

/**
 * The named human behind the site. Author identity is not decoration in
 * health content: an unattributed page is a weaker page, whatever it says.
 */
export const FOUNDER = {
  name: 'Riley Nocek',
  /** The page that substantiates the byline. */
  url: `${SITE_ORIGIN}/about`,
  /**
   * Stated plainly because it is true, and because overstating it would be
   * the one thing that could actually harm a reader.
   */
  description:
    'Built NeuroSpark for his father after a stroke. Not a speech-language pathologist — the exercises come from practice at the kitchen table, and the app says so.',
} as const;

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export type JsonLd = Record<string, unknown>;

/**
 * FAQPage for a page whose visible content includes these exact questions
 * and answers. Returns null for an empty list rather than emitting an empty
 * mainEntity, which is invalid markup.
 */
export function faqPageSchema(faq: readonly FaqEntry[], path: string): JsonLd | null {
  const entries = faq.filter((f) => f.q.trim() && f.a.trim());
  if (entries.length === 0) return null;
  const url = absoluteUrl(path);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    url,
    mainEntity: entries.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** The person node, referenced by every page that carries the byline. */
export function personSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${FOUNDER.url}#person`,
    name: FOUNDER.name,
    url: FOUNDER.url,
    description: FOUNDER.description,
  };
}

/** AboutPage for the founder story, authored by that same person node. */
export function aboutPageSchema({
  path,
  name,
  description,
}: {
  path: string;
  name: string;
  description: string;
}): JsonLd {
  const url = absoluteUrl(path);
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${url}#about`,
    url,
    name,
    description,
    author: { '@id': `${FOUNDER.url}#person` },
  };
}
