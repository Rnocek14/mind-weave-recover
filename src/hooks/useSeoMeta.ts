/**
 * useSeoMeta — per-route title/description/canonical for public marketing
 * pages in this SPA.
 *
 * The app shell ships one static <title>/<meta>; indexable marketing routes
 * need their own. Google renders JS, so updating these at mount is effective
 * for indexing (a prerender step is still the eventual upgrade for these
 * routes — tracked in the content strategy).
 */

import { useEffect } from 'react';

interface SeoMeta {
  title: string;
  description: string;
  /** Path for the canonical URL, e.g. "/free-aphasia-games". */
  canonicalPath?: string;
  /**
   * JSON-LD nodes describing content that is VISIBLE on this page. Nulls are
   * dropped so a builder can return null for "nothing to describe" without
   * every caller having to filter.
   */
  jsonLd?: Array<Record<string, unknown> | null>;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): () => void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const created = !el;
  const prev = el?.getAttribute('content') ?? null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return () => {
    if (created) el?.remove();
    else if (prev !== null) el?.setAttribute('content', prev);
  };
}

/**
 * Replace this route's JSON-LD. Existing managed blocks are removed first:
 * a prerendered page already ships its own, and on hydration we would
 * otherwise append a second identical copy.
 */
function upsertJsonLd(nodes: Array<Record<string, unknown> | null>): () => void {
  const MARK = 'data-seo-jsonld';
  const clear = () => document.head.querySelectorAll(`script[${MARK}]`).forEach((el) => el.remove());
  clear();
  for (const node of nodes) {
    if (!node) continue;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute(MARK, '');
    script.textContent = JSON.stringify(node);
    document.head.appendChild(script);
  }
  return clear;
}

export function useSeoMeta({ title, description, canonicalPath, jsonLd }: SeoMeta): void {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const undos = [
      upsertMeta('name', 'description', description),
      upsertMeta('property', 'og:title', title),
      upsertMeta('property', 'og:description', description),
    ];

    // Upsert, never append: prerendered pages already ship a canonical, and
    // a second one that disagrees is worse than none at all.
    let restoreCanonical: (() => void) | null = null;
    if (canonicalPath && typeof window !== 'undefined') {
      const href = `${window.location.origin}${canonicalPath}`;
      // og:url must self-reference the route too — otherwise crawlers
      // attribute this page's preview to the homepage.
      undos.push(upsertMeta('property', 'og:url', href));
      const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (existing) {
        const prevHref = existing.href;
        existing.href = href;
        restoreCanonical = () => { existing.href = prevHref; };
      } else {
        const link = document.createElement('link');
        link.rel = 'canonical';
        link.href = href;
        document.head.appendChild(link);
        restoreCanonical = () => link.remove();
      }
    }

    const removeJsonLd = jsonLd?.length ? upsertJsonLd(jsonLd) : null;

    return () => {
      document.title = prevTitle;
      undos.forEach((u) => u());
      restoreCanonical?.();
      removeJsonLd?.();
    };
    // jsonLd is rebuilt on every render by its callers, so it is serialized
    // for the dependency comparison rather than compared by identity — which
    // would re-inject the same markup on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, canonicalPath, JSON.stringify(jsonLd ?? null)]);
}
