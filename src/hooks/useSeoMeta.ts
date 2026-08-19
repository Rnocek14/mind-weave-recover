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

export function useSeoMeta({ title, description, canonicalPath }: SeoMeta): void {
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


    return () => {
      document.title = prevTitle;
      undos.forEach((u) => u());
      restoreCanonical?.();
    };
  }, [title, description, canonicalPath]);
}
