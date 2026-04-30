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
}: SessionSummaryStripProps) {
  return (
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
  );
}
