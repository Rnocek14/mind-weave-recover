/**
 * Guides — the hub for the long-form articles.
 *
 * Two jobs. For a reader it is the place to find the article that matches the
 * week they are having. For the site it is the internal-linking spine: every
 * guide is one click from here and from every other guide, which is how a
 * small site concentrates authority in one subject instead of scattering it.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { AuthorByline } from '@/components/marketing/AuthorByline';
import { useSeoMeta } from '@/hooks/useSeoMeta';
import { GUIDES, readingMinutes } from '@/content/guides';

export default function Guides() {
  useSeoMeta({
    title: 'Aphasia & Stroke Recovery Guides for Families',
    description:
      'Plain-language guides for families supporting speech and language recovery after a stroke: how to help someone find a word, what the diagnoses mean, and how much to practice at home.',
    canonicalPath: '/guides',
  });

  return (
    <MarketingLayout>
      <div className="container max-w-3xl px-4 py-8 space-y-10">
        <section className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Guides for families after a stroke
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            The things I wanted written down when my father had his stroke and
            nobody had time to explain them. Plain language, no jargon, and
            honest about where an app stops and a speech therapist starts.
          </p>
        </section>

        <section className="space-y-3">
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              to={`/guides/${g.slug}`}
              className="block rounded-xl border border-border p-5 hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <h2 className="text-xl font-bold leading-snug">{g.h1}</h2>
              <p className="mt-1.5 text-muted-foreground leading-relaxed">{g.standfirst}</p>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-primary font-medium">
                <Clock className="h-4 w-4" /> {readingMinutes(g.body)} min read
                <ArrowRight className="h-4 w-4 ml-1" />
              </p>
            </Link>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Or start practicing</h2>
          <p className="text-muted-foreground leading-relaxed">
            Reading about it only goes so far. Everything described in these
            guides has a free, playable version — no account, no download.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/free-aphasia-games">Free games</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/aphasia-sentence-exercises">Sentence practice</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/free-aphasia-worksheets">Printable pack</Link>
            </Button>
          </div>
        </section>

        <AuthorByline />
      </div>
    </MarketingLayout>
  );
}
