/**
 * Session Summary Strip — six chips of session-level facts.
 * Compact, mobile-first; wraps on narrow viewports.
 */
import { Calendar, Clock, Gamepad2, Target, TrendingUp, Lightbulb, ShieldCheck } from "lucide-react";

interface SessionSummaryStripProps {
  startedAt: string;
  durationSec: number | null;
  gamesPlayed: number;
  accuracyPct: number;
  highestLevel: number | null;
  cueDependencyPct: number; // 0–100
  validityBuckets?: {
    valid: number;
    filler: number;
    silence: number;
    noise: number;
    flagged: number;
  } | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtDuration(sec: number | null) {
  if (!sec || sec <= 0) return "—";
  const m = Math.round(sec / 60);
  return `${m} min`;
}

function Chip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-sm font-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}

export function SessionSummaryStrip({
  startedAt,
  durationSec,
  gamesPlayed,
  accuracyPct,
  highestLevel,
  cueDependencyPct,
  validityBuckets,
}: SessionSummaryStripProps) {
  const filteredCount = validityBuckets
    ? validityBuckets.filler + validityBuckets.silence + validityBuckets.noise + validityBuckets.flagged
    : 0;
  const totalCount = validityBuckets ? validityBuckets.valid + filteredCount : 0;
  const filterRatePct = totalCount > 0 ? Math.round((filteredCount / totalCount) * 100) : 0;
  const hasFiltered = filteredCount > 0;
  // Health-signal coloring: >30% filtered indicates noisy environment or over-filtering.
  const filterRateTone =
    filterRatePct >= 30 ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Chip icon={Calendar} label="Date" value={fmtDate(startedAt)} />
        <Chip icon={Clock} label="Duration" value={fmtDuration(durationSec)} />
        <Chip icon={Gamepad2} label="Games" value={String(gamesPlayed)} />
        <Chip icon={Target} label="Accuracy" value={`${accuracyPct}%`} />
        <Chip
          icon={TrendingUp}
          label="Highest level"
          value={highestLevel != null ? `L${highestLevel}` : "—"}
        />
        <Chip icon={Lightbulb} label="Cue dependency" value={`${cueDependencyPct}%`} />
      </div>
      {hasFiltered && validityBuckets && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
          <span className={filterRateTone}>
            {filterRatePct}% of responses filtered
          </span>
          <span className="text-muted-foreground">
            · Scored: {validityBuckets.valid}
            {validityBuckets.filler > 0 && ` · Filler: ${validityBuckets.filler}`}
            {validityBuckets.silence > 0 && ` · Silent: ${validityBuckets.silence}`}
            {validityBuckets.noise > 0 && ` · Noise: ${validityBuckets.noise}`}
            {validityBuckets.flagged > 0 && ` · Flagged: ${validityBuckets.flagged}`}
          </span>
        </div>
      )}
    </div>
  );
}
