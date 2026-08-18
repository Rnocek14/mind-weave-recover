/**
 * LevelBadge — patient-facing "Today's Challenge" indicator.
 *
 * UX1: shows the in-session adaptive difficulty as a friendly star meter +
 * flow-zone label ("Good challenge") instead of a raw "D5/10" number, with an
 * optional Support line. This is the SHORT-TERM session challenge ONLY — it is
 * deliberately separate from the long-term Recovery (Clinical) Level, which is
 * never shown during gameplay.
 *
 * Source of truth: useInGameAdaptation.levelDescriptor (+ optional
 * recentSuccessRate for the flow zone, and cue/support state).
 *
 * Backward compatible: only `descriptor` is required. Existing call sites that
 * pass just `descriptor` (and `compact`) keep working — they simply show the
 * stars + band label until `successRate` / `support` are wired in.
 */

import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { LevelDescriptor } from '@/lib/gameLevels';

/** Normalized support state. Accepts a few shapes for convenience. */
export type SupportInput =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | boolean
  | number // cueLevel 0..3
  | null
  | undefined;

interface LevelBadgeProps {
  descriptor: LevelDescriptor;
  /** Optional className for layout (e.g. align-self). */
  className?: string;
  /** Compact variant keeps it tight; both variants now show stars + label. */
  compact?: boolean;
  /** Rolling success rate (0..1). When provided, drives the flow-zone label. */
  successRate?: number | null;
  /** Current support / cue state. When provided, renders a support line. */
  support?: SupportInput;
  /**
   * Explicit, game-specific support wording shown verbatim (e.g.
   * "Audio Support On", "Hint used"). When provided it overrides the
   * generic cue-level text and is always rendered. Use this to describe
   * support honestly per game.
   */
  supportLabel?: string;
}

const BAND_CLASSES: Record<LevelDescriptor['band'], string> = {
  easy: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300',
  building: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  core: 'border-primary/40 bg-primary/10 text-primary',
  stretch: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  mastery: 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300',
};

/** 1..10 difficulty → 1..5 filled stars. */
function levelToStars(level: number): number {
  return Math.max(1, Math.min(5, Math.round(level / 2)));
}

/** Friendly, non-punitive flow-zone label. */
function flowLabel(
  successRate: number | null | undefined,
  fallback: string,
): string {
  if (successRate == null || !Number.isFinite(successRate)) return fallback;
  if (successRate >= 0.9) return 'Going strong';
  if (successRate >= 0.7) return 'Good challenge';
  if (successRate >= 0.5) return 'Warming up';
  return 'Taking it steady';
}

/** Normalize the various support shapes into none|low|medium|high. */
function normalizeSupport(input: SupportInput): 'none' | 'low' | 'medium' | 'high' {
  if (input == null || input === false) return 'none';
  if (input === true) return 'low';
  if (typeof input === 'number') {
    if (input <= 0) return 'none';
    if (input === 1) return 'low';
    if (input === 2) return 'medium';
    return 'high';
  }
  return input;
}

const SUPPORT_TEXT: Record<'none' | 'low' | 'medium' | 'high', string> = {
  none: 'Independent',
  low: 'Support: Low',
  medium: 'Support: Medium',
  high: 'Support: High',
};

export function LevelBadge({
  descriptor,
  className,
  compact = false,
  successRate,
  support,
  supportLabel,
}: LevelBadgeProps) {
  const { level, label, band, levers } = descriptor;
  const stars = levelToStars(level);
  const flow = flowLabel(successRate, label);
  const supportState = normalizeSupport(support);

  // Show a support line whenever the game tells us something about support —
  // either an explicit label, or any `support` prop (incl. cue level 0 →
  // "Independent"). Games with no support concept simply pass nothing.
  const hasSupportInfo = supportLabel != null || support !== undefined;
  const supportText = supportLabel ?? SUPPORT_TEXT[supportState];

  const previousLevelRef = useRef(level);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (previousLevelRef.current !== level) {
      previousLevelRef.current = level;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1200);
      return () => clearTimeout(t);
    }
  }, [level]);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex flex-col gap-0.5 rounded-lg border px-2.5 py-1 select-none transition-all',
              BAND_CLASSES[band],
              pulse && 'ring-2 ring-current ring-offset-1 scale-105 motion-reduce:scale-100 motion-reduce:ring-0',
              className,
            )}
            aria-label={
              `Today's Challenge: ${flow}.` +
              (hasSupportInfo ? ` ${supportText}.` : '')
            }
            role="status"
            aria-live="polite"
          >
            {/* Anchor label. In compact mode it collapses on short screens
                (laptops/phones) — the stars+label line carries the meaning,
                the tooltip + aria-label keep the full context, and in-game
                vertical space goes to the task. */}
            <span
              className={cn(
                'font-semibold uppercase tracking-wide opacity-70',
                compact ? 'text-[10px] hidden tall:inline' : 'text-[11px]',
              )}
            >
              Today's Challenge
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3.5 w-3.5',
                      i < stars ? 'fill-current' : 'opacity-30',
                    )}
                  />
                ))}
              </span>
              <span className="text-sm font-semibold">{flow}</span>
            </span>
            {hasSupportInfo && (
              <span className={cn('text-xs font-medium opacity-90', compact && 'hidden tall:inline')}>
                {supportText}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px] text-xs">
          <div className="font-semibold mb-1">Today's Challenge</div>
          <div className="mb-1 opacity-80">
            This changes during practice to keep things at the right level. It is
            separate from your long-term Recovery Level.
          </div>
          {hasSupportInfo && (
            <div className="mb-1 opacity-80">
              {supportText} — getting a little help is part of practice.
            </div>
          )}
          {levers.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5 opacity-90">
              {levers.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
