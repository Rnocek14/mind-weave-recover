/**
 * GuideBody — renders a guide's Markdown with this site's typography.
 *
 * Deliberately restricted to core Markdown: headings, paragraphs, lists,
 * emphasis, links. No tables, because remark-gfm is not installed and because
 * a table is the wrong shape for a page a lot of people will read on a phone
 * with the text size turned up.
 *
 * Type scale is a notch larger than the marketing pages. The audience is
 * adults reading after a stroke, often with vision changes, often tired —
 * comfortable line length and generous leading are functional here, not
 * stylistic.
 */

import Markdown from 'react-markdown';
import { Link } from 'react-router-dom';

/** Internal paths route client-side; anything else opens safely off-site. */
function GuideLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  if (href?.startsWith('/')) {
    return (
      <Link to={href} className="text-primary underline underline-offset-2 hover:no-underline">
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  );
}

export function GuideBody({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-5">
      <Markdown
        components={{
          h1: ({ children }) => (
            <h2 className="text-2xl font-bold mt-10 mb-1 leading-snug">{children}</h2>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold mt-10 mb-1 leading-snug">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold mt-8 mb-1 leading-snug">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-[1.0625rem] leading-[1.75] text-foreground/90">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-2 pl-5 list-disc marker:text-primary text-[1.0625rem] leading-[1.7] text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="space-y-2 pl-5 list-decimal marker:text-primary text-[1.0625rem] leading-[1.7] text-foreground/90">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          a: GuideLink,
          hr: () => <hr className="my-8 border-border" />,
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
