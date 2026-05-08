/**
 * AboutGameLink — single canonical entry point to /games/:slug/about
 *
 * Use this everywhere we want to link to a game's "How this supports
 * recovery" page (exercise cards, level-up banners, pause overlay,
 * session summary, Patient Hub recovery profile). Centralising the
 * link means we can change the route, add tracking, or reword the
 * label in one place.
 *
 * Spec-only consumer: imports `getGameClinicalProfile` to resolve the
 * canonical urlSlug from any input slug (handles `photo_naming` ↔
 * `photo-naming`). Falls back to a normalized hyphen slug if the game
 * isn't yet in the rung profile registry.
 */
import { Link } from 'react-router-dom';
import { Info, BookOpen } from 'lucide-react';
import { getGameClinicalProfile } from '@/lib/leveling/clinicalRungs';
import { cn } from '@/lib/utils';

type Variant = 'inline' | 'button' | 'icon' | 'pill';

interface Props {
  /** Either underscore (photo_naming) or hyphen (photo-naming) slug. */
  slug: string;
  variant?: Variant;
  /** Override default label per variant. */
  label?: string;
  className?: string;
  /** Optional analytics label (logged to console for now). */
  source?: string;
}

function resolveUrlSlug(slug: string): string {
  const profile = getGameClinicalProfile(slug);
  if (profile) return profile.urlSlug;
  // Normalize underscores → hyphens for unknown slugs so the route still works.
  return slug.replace(/_/g, '-');
}

export function AboutGameLink({
  slug,
  variant = 'inline',
  label,
  className,
  source,
}: Props) {
  const urlSlug = resolveUrlSlug(slug);
  const to = `/games/${urlSlug}/about`;

  const onClick = () => {
    if (source) console.log('[AboutGameLink]', { slug: urlSlug, source });
  };

  if (variant === 'icon') {
    return (
      <Link
        to={to}
        onClick={onClick}
        aria-label={label || 'About this exercise'}
        title={label || 'About this exercise'}
        className={cn(
          'inline-flex items-center justify-center rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors',
          className
        )}
      >
        <Info className="w-4 h-4" />
      </Link>
    );
  }

  if (variant === 'pill') {
    return (
      <Link
        to={to}
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors',
          className
        )}
      >
        <Info className="w-3 h-3" />
        {label || 'About'}
      </Link>
    );
  }

  if (variant === 'button') {
    return (
      <Link
        to={to}
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted/60 transition-colors',
          className
        )}
      >
        <BookOpen className="w-3.5 h-3.5" />
        {label || 'How this supports recovery'}
      </Link>
    );
  }

  // inline
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2',
        className
      )}
    >
      {label || 'Why?'}
    </Link>
  );
}

export default AboutGameLink;
