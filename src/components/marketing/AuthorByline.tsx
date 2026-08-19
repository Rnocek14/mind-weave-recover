/**
 * AuthorByline — who wrote this, and what they are not.
 *
 * WHY IT EXISTS: health content from an anonymous brand is the weakest kind
 * there is. Search quality guidelines weigh first-hand experience heavily,
 * and the experience here is the entire origin of the product — it was built
 * by a son for his father. Saying so, with a name, on every public page is
 * the cheapest credibility this site will ever buy.
 *
 * WHY IT ALSO SAYS WHAT HE ISN'T: the honest disclaimer is not a hedge
 * against the byline, it is the other half of it. A reader deciding whether
 * to trust an exercise for someone recovering from a stroke deserves to know
 * it comes from a kitchen table and not a clinic — and a page that overstates
 * its authority is the one thing here that could actually cause harm.
 */

import { Link } from 'react-router-dom';
import { FOUNDER } from '@/lib/seo/structuredData';

export function AuthorByline({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-muted/30 p-4 text-sm ${className}`}>
      <p className="leading-relaxed">
        <span className="text-muted-foreground">Written by </span>
        <Link to="/about" className="font-semibold text-foreground hover:underline">
          {FOUNDER.name}
        </Link>
        <span className="text-muted-foreground">
          , who built NeuroSpark for his father after a stroke and rewrote it around
          what actually happened when they practiced together.
        </span>
      </p>
      <p className="mt-1.5 text-muted-foreground leading-relaxed">
        Not written or reviewed by a speech-language pathologist. These are
        practice activities, not medical treatment — if you are working with a
        speech therapist, show them anything here before you use it.
      </p>
    </div>
  );
}
