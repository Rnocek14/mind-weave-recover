/**
 * AdaptationNarrationCard
 *
 * Visible, patient-facing inline message rendered when difficulty changes,
 * cues fade, or escalations are blocked. Replaces tooltip-only narration so
 * users (and clinicians watching over their shoulder) can SEE the reasoning.
 *
 * Renders a small, calm card that auto-dismisses (handled by parent state).
 * Tone-matched icon + short narrator line from `adaptationNarrator`.
 *
 * Usage:
 *   const shift = useAdaptationShift();
 *   onDifficultyChange={(_lvl, why, dir) => {
 *     const narration = narrateAdaptation({ direction: dir, reasonKind: classifyReason(why) });
 *     shift.signal(dir, narration || why);
 *   }}
 *   <AdaptationNarrationCard direction={shift.direction} message={shift.reason} />
 */

import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdaptationDirection } from "@/components/AdaptationBadge";

interface AdaptationNarrationCardProps {
  direction: AdaptationDirection;
  message?: string;
  className?: string;
}

export function AdaptationNarrationCard({
  direction,
  message,
  className,
}: AdaptationNarrationCardProps) {
  if (!direction || !message) return null;

  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
      ? TrendingDown
      : direction === "hold"
      ? Minus
      : Sparkles;

  const tone =
    direction === "up"
      ? "border-primary/40 bg-primary/10 text-primary-foreground"
      : direction === "down"
      ? "border-secondary/40 bg-secondary/10 text-secondary-foreground"
      : "border-muted bg-muted/40 text-foreground";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-sm",
        "animate-in fade-in slide-in-from-top-1 duration-300",
        tone,
        className,
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
      <span className="leading-snug">{message}</span>
    </div>
  );
}
