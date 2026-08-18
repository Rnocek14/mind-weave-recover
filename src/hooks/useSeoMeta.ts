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

    let canonical: HTMLLinkElement | null = null;
    if (canonicalPath && typeof window !== 'undefined') {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = `${window.location.origin}${canonicalPath}`;
      document.head.appendChild(canonical);
    }

    return () => {
      document.title = prevTitle;
      undos.forEach((u) => u());
      canonical?.remove();
    };
  }, [title, description, canonicalPath]);
}
