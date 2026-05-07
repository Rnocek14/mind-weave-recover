/**
 * ClinicalLevelBadge — minimal persistent surface for Clinical Progression v1.
 *
 * Shows the current rehab Level, its clinical description, and an unobtrusive
 * progress bar. Read-only. Does NOT drive gameplay or difficulty — it only
 * makes the persistent level visible so patient + clinician can orient.
 *
 * Design constraints (per project memory):
 *   - No gamification, XP, or animations. Stable recovery orientation.
 *   - No celebration, no punishment. Calm clinical framing.
 *   - One small card. Never a 6th glance card. Never replaces other UI.
 */

import { Progress } from '@/components/ui/progress';
import { getPhotoNamingLevelSpec } from '@/lib/progression/photoNamingLevels';

interface ClinicalLevelBadgeProps {
  level: number | null;
  progressPct: number | null;
  /** Optional className for placement tweaks. */
  className?: string;
}

export function ClinicalLevelBadge({
  level,
  progressPct,
  className,
}: ClinicalLevelBadgeProps) {
  if (level == null) return null;
  const spec = getPhotoNamingLevelSpec(level);
  const pct = Math.max(0, Math.min(100, Math.round(progressPct ?? 0)));

  return (
    <div
      className={
        'rounded-md border border-border bg-muted/40 px-3 py-2 text-left ' +
        (className ?? '')
      }
      aria-label={`Clinical Level ${level}: ${spec.description}. Progress ${pct} percent.`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          Clinical Level {level}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {pct}%
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
        {spec.description}
      </p>
      <Progress value={pct} className="mt-1.5 h-1" />
    </div>
  );
}
