/**
 * MarketingLayout — shared chrome for the public, indexable pages.
 *
 * Also the internal-linking backbone: every free resource links to every
 * other one, which is how a small site builds topical authority in a
 * single subject area.
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const FREE_RESOURCES: Array<{ to: string; label: string }> = [
  { to: '/free-aphasia-games', label: 'Free aphasia games' },
  { to: '/aphasia-sentence-exercises', label: 'Sentence exercises' },
  { to: '/free-aphasia-worksheets', label: 'Printable worksheets' },
];

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-40">
        <div className="container max-w-4xl px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="font-semibold shrink-0">NeuroRecover</Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
            {FREE_RESOURCES.map((r) => (
              <Link key={r.to} to={r.to} className="hover:text-foreground">{r.label}</Link>
            ))}
          </nav>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/auth">Try the full app</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-8 mt-8">
        <div className="container max-w-4xl px-4 space-y-4 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {FREE_RESOURCES.map((r) => (
              <Link key={r.to} to={r.to} className="text-muted-foreground hover:text-foreground">
                {r.label}
              </Link>
            ))}
            <Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            NeuroRecover provides speech and language <strong>practice</strong> activities.
            It is not medical treatment and does not replace care from a licensed
            speech-language pathologist. If speech changes are new or sudden, contact
            a doctor.
          </p>
        </div>
      </footer>
    </div>
  );
}
