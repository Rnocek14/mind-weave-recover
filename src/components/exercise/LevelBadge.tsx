/**
 * LevelBadge — patient-facing 1–10 difficulty chip.
 *
 * Source of truth: useInGameAdaptation.currentLevel + levelDescriptor.
 * Renders a small chip with a tooltip explaining what makes the level harder.
 * Animates briefly when the level changes (per visible-adaptation-cues memory).
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { LevelDescriptor } from '@/lib/gameLevels';

interface LevelBadgeProps {
  descriptor: LevelDescriptor;
  /** Optional className for layout (e.g. align-self). */
  className?: string;
  /** Compact variant hides the label text, keeps "L4 / 10". */
  compact?: boolean;
}

const BAND_CLASSES: Record<LevelDescriptor['band'], string> = {
  easy: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300',
  building: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  core: 'border-primary/40 bg-primary/10 text-primary',
  stretch: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  mastery: 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300',
};

export function LevelBadge({ descriptor, className, compact = false }: LevelBadgeProps) {
  const { level, label, band, levers } = descriptor;
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
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium select-none transition-all',
              BAND_CLASSES[band],
              pulse && 'ring-2 ring-current ring-offset-1 scale-105',
              className,
            )}
            aria-label={`Game Level ${level} of 10, ${label}`}
            role="status"
          >
            <span className="font-semibold tabular-nums">L{level}</span>
            <span className="opacity-70 tabular-nums">/ 10</span>
            {!compact && (
              <span className="hidden sm:inline opacity-90">· {label}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px] text-xs">
          <div className="font-semibold mb-1">Game Level {level} · {label}</div>
          {levers.length > 0 ? (
            <ul className="list-disc pl-4 space-y-0.5 opacity-90">
              {levers.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <div className="opacity-80">Adapts to your performance.</div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
