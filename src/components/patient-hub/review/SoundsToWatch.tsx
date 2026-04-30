/**
 * Sounds to Watch — auto-detected consonant patterns from incorrect attempts.
 *
 * Hedged: clearly labeled as a hypothesis to confirm clinically.
 * Hidden when fewer than 5 usable incorrect trials exist.
 */
import { Info } from "lucide-react";
import type { TrialData } from "@/hooks/useSessionDetail";
import { deriveSoundPatterns } from "@/lib/clinical/deriveSoundPatterns";
import { useMemo } from "react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface SoundsToWatchProps {
  trials: TrialData[];
}

export function SoundsToWatch({ trials }: SoundsToWatchProps) {
  const result = useMemo(
    () =>
      deriveSoundPatterns(
        trials.map((t) => ({
          target_word: t.target_word,
          transcript: t.transcript,
          is_correct: t.is_correct,
        }))
      ),
    [trials]
  );

  if (result.usableTrialCount < 5) return null;
  if (result.patterns.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <h4 className="text-sm font-medium text-foreground">Patterns to investigate</h4>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                Auto-detected from transcript-vs-target consonant differences.
                These are hypotheses for clinical confirmation, not phoneme-level
                analyses.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <ul className="space-y-1.5">
        {result.patterns.map((p) => (
          <li
            key={p.label}
            className="rounded-md border border-border bg-card px-3 py-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-foreground">{p.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {p.count}×
              </span>
            </div>
            {p.examples.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground italic truncate">
                e.g. {p.examples.join(" · ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
