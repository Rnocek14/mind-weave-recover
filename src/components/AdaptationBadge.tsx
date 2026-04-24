/**
 * AdaptationBadge — visible adaptation cue
 *
 * Standardized component shown across all games when difficulty actually changes.
 * Reinforces "the system is reacting to me" — not cosmetic, only renders when
 * an underlying variable shifts (content tier, time pressure, cue level, etc.).
 *
 * Usage:
 *   const [shift, setShift] = useState<AdaptationDirection>(null);
 *   // when adaptation fires:
 *   setShift('up'); // or 'down' or 'hold'
 *   setTimeout(() => setShift(null), 4000);
 *
 *   <AdaptationBadge direction={shift} />
 */

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AdaptationDirection = "up" | "down" | "hold" | null;

interface AdaptationBadgeProps {
  direction: AdaptationDirection;
  /** Optional reason shown as tooltip text (also used for ARIA label). */
  reason?: string;
  /** Compact label text. Defaults: 'Made it harder' / 'Made it easier' / 'Holding steady'. */
  label?: string;
  className?: string;
  /** Show as inline pill (default) or large card. */
  variant?: "inline" | "card";
}

const DEFAULTS: Record<Exclude<AdaptationDirection, null>, { label: string; aria: string }> = {
  up: { label: "Made it harder", aria: "Difficulty increased based on your performance" },
  down: { label: "Made it easier", aria: "Difficulty reduced to support you" },
  hold: { label: "Holding steady", aria: "Keeping difficulty at this level" },
};

export function AdaptationBadge({
  direction,
  reason,
  label,
  className,
  variant = "inline",
}: AdaptationBadgeProps) {
  if (!direction) return null;

  const cfg = DEFAULTS[direction];
  const text = label ?? cfg.label;
  const aria = reason ?? cfg.aria;

  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  const tone =
    direction === "up"
      ? "border-primary/40 bg-primary/10 text-primary"
      : direction === "down"
      ? "border-secondary/40 bg-secondary/15 text-secondary-foreground"
      : "border-muted bg-muted/40 text-muted-foreground";

  if (variant === "card") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={aria}
        title={reason}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-1 duration-300",
          tone,
          className,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
        <span>{text}</span>
        {reason && (
          <span className="ml-1 text-xs opacity-75 hidden sm:inline">· {reason}</span>
        )}
      </div>
    );
  }

  return (
    <Badge
      role="status"
      aria-live="polite"
      aria-label={aria}
      title={reason}
      variant="outline"
      className={cn(
        "gap-1 px-2 py-0.5 text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-300",
        tone,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {text}
    </Badge>
  );
}

/**
 * Convenience hook: tracks a transient adaptation shift that auto-clears.
 *
 * Example:
 *   const { direction, reason, signal } = useAdaptationShift();
 *   onDifficultyChange={(_lvl, why, dir) => signal(dir, why)}
 *   <AdaptationBadge direction={direction} reason={reason} />
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useAdaptationShift(autoClearMs = 4000) {
  const [direction, setDirection] = useState<AdaptationDirection>(null);
  const [reason, setReason] = useState<string | undefined>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signal = useCallback(
    (dir: Exclude<AdaptationDirection, null>, why?: string) => {
      setDirection(dir);
      setReason(why);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setDirection(null), autoClearMs);
    },
    [autoClearMs],
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { direction, reason, signal };
}
