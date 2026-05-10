/**
 * ProgressionRecap — generic patient-facing post-session progression view.
 *
 * Game-agnostic: callers pass the game's display title and the current
 * level's plain-language clinical description. The shape mirrors the original
 * PhotoNamingProgressionRecap (animated bar, level-up callout, neutral
 * "no movement" framing) per clinical-safety-principles +
 * recovery-insights-language-rules.
 *
 * Includes an explicit Continue button AND a safety auto-advance fallback —
 * never leave users in a dead state.
 */

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export interface ProgressionRecapProps {
  /** Game display title, e.g. "Picture Naming", "Fix the Sentence". */
  gameTitle: string;
  /** Plain-language description of the level being shown. */
  levelDescription: string;
  prev: { level: number; progressPct: number };
  next: { level: number; progressPct: number };
  leveledUp: boolean;
  onContinue: () => void;
  /** Auto-advance after this many ms as a safety fallback. Default 8000. */
  autoAdvanceMs?: number;
}

export function ProgressionRecap({
  gameTitle,
  levelDescription,
  prev,
  next,
  leveledUp,
  onContinue,
  autoAdvanceMs = 8000,
}: ProgressionRecapProps) {
  const dismissedRef = useRef(false);
  const [animatedPct, setAnimatedPct] = useState(prev.progressPct);

  useEffect(() => {
    const t = setTimeout(() => setAnimatedPct(next.progressPct), 250);
    return () => clearTimeout(t);
  }, [next.progressPct]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      onContinue();
    }, autoAdvanceMs);
    return () => clearTimeout(t);
  }, [autoAdvanceMs, onContinue]);

  const handleContinue = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onContinue();
  };

  const displayLevel = leveledUp ? next.level : prev.level;
  const pctRounded = Math.round(animatedPct);
  const delta = Math.max(0, Math.round(next.progressPct - prev.progressPct));
  const noMovement = !leveledUp && delta === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Session progression summary"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {gameTitle}
          </p>
          <h2 className="text-xl font-semibold text-foreground">
            {leveledUp ? 'You reached a new level' : 'Session complete'}
          </h2>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              Clinical Level {displayLevel}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {pctRounded}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            {levelDescription}
          </p>
          <Progress value={animatedPct} className="h-2 transition-all duration-700" />
          {leveledUp ? (
            <p className="text-xs text-primary font-medium pt-1">
              Moved up from Level {prev.level} → Level {next.level}.
            </p>
          ) : noMovement ? (
            <p className="text-xs text-muted-foreground pt-1">
              No change this session — your work still counts. Practice keeps the skill warm.
            </p>
          ) : (
            <p className="text-xs text-foreground/80 pt-1">
              +{delta}% toward Level {prev.level + 1} this session.
            </p>
          )}
        </div>

        <Button onClick={handleContinue} className="w-full" size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
