/**
 * Guide — one long-form article at /guides/:slug.
 *
 * Every article carries the same three things, because a health page missing
 * any of them is a weaker page: a named author, a plain statement of what the
 * author is not, and an FAQ whose questions are visible on the page and
 * mirrored exactly in the markup.
 *
 * An unknown slug renders a real "not found" rather than an empty shell — a
 * blank page is indistinguishable from a broken deploy, both to a reader and
 * to a crawler.
 */

import { useParams, Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { AuthorByline } from '@/components/marketing/AuthorByline';
import { GuideBody } from '@/components/marketing/GuideBody';
import { useSeoMeta } from '@/hooks/useSeoMeta';
import { faqPageSchema } from '@/lib/seo/structuredData';
import { GUIDES, getGuide, readingMinutes } from '@/content/guides';

/** Human label for a path we link onward to. */
function relatedLabel(path: string): string {
  const guide = GUIDES.find((g) => `/guides/${g.slug}` === path);
  if (guide) return guide.h1;
  const known: Record<string, string> = {
    '/free-aphasia-games': 'Free aphasia games you can play now',
    '/aphasia-sentence-exercises': 'Sentence completion exercises',
    '/free-aphasia-worksheets': 'Printable home practice pack (PDF)',
    '/about': 'Why this app exists',
  };
  return known[path] ?? path;
}

function formatUpdated(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function Guide() {
  const { slug } = useParams<{ slug: string }>();
  const guide = getGuide(slug);

  useSeoMeta({
    title: guide ? guide.title : 'Guide not found — NeuroSpark',
    description: guide
      ? guide.description
      : 'That guide does not exist. Browse the full list of speech and language guides for stroke survivors and their families.',
    canonicalPath: guide ? `/guides/${guide.slug}` : '/guides',
    jsonLd: guide ? [faqPageSchema(guide.faq, `/guides/${guide.slug}`)] : [],
  });

  if (!guide) {
    return (
      <MarketingLayout>
        <div className="container max-w-3xl px-4 py-16 space-y-4">
          <h1 className="text-3xl font-bold">We couldn't find that guide</h1>
          <p className="text-muted-foreground leading-relaxed">
            It may have been renamed. Everything we've written is listed on the
            guides page.
          </p>
          <Button asChild>
            <Link to="/guides">
              See all guides <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <article className="container max-w-2xl px-4 py-8 space-y-8">
        <header className="space-y-3">
          <Link to="/guides" className="text-sm text-muted-foreground hover:text-foreground">
            ← All guides
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{guide.h1}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">{guide.standfirst}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> {readingMinutes(guide.body)} min read
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> Updated {formatUpdated(guide.updated)}
            </span>
          </div>
        </header>

        <GuideBody markdown={guide.body} />

        <section className="space-y-4 pt-2">
          <h2 className="text-2xl font-bold">Common questions</h2>
          {guide.faq.map((f) => (
            <div key={f.q} className="space-y-1">
              <h3 className="font-semibold">{f.q}</h3>
              <p className="text-muted-foreground leading-relaxed">{f.a}</p>
            </div>
          ))}
        </section>

        {guide.related.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-2xl font-bold">Read next</h2>
            <div className="grid gap-2">
              {guide.related.map((path) => (
                <Button key={path} asChild variant="outline" className="justify-start h-auto py-3">
                  <Link to={path}>
                    <span className="text-left leading-snug">{relatedLabel(path)}</span>
                    <ArrowRight className="h-4 w-4 ml-auto shrink-0" />
                  </Link>
                </Button>
              ))}
            </div>
          </section>
        )}

        <AuthorByline />
      </article>
    </MarketingLayout>
  );
}
