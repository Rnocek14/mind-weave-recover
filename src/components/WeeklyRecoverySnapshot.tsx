import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, Brain, Calendar, Dumbbell, Zap } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import {
  useWeeklyRecoverySnapshot,
  type SnapshotDay,
  type RecoveryFlag,
} from "@/hooks/useWeeklyRecoverySnapshot";

/* ── Mini sparkline (pure SVG) ─────────────────────── */
const Sparkline = ({
  data,
  color,
  max,
  height = 32,
  width = 200,
}: {
  data: (number | null)[];
  color: string;
  max: number;
  height?: number;
  width?: number;
}) => {
  const safeMax = max || 1;
  const step = width / Math.max(data.length - 1, 1);

  // Build polyline points, skip nulls
  const points: string[] = [];
  data.forEach((v, i) => {
    if (v === null || v === undefined) return;
    const x = i * step;
    const y = height - (v / safeMax) * height;
    points.push(`${x},${y}`);
  });

  if (points.length < 2) {
    return (
      <svg width={width} height={height} className="opacity-40">
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={10} fill="currentColor" className="text-muted-foreground">
          No data
        </text>
      </svg>
    );
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
      {/* Dot on last real value */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].split(",")[0]}
          cy={points[points.length - 1].split(",")[1]}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
};

/* ── Sparkline row ─────────────────────────────────── */
const SparklineRow = ({
  icon: Icon,
  label,
  data,
  color,
  max,
  suffix,
  latestValue,
}: {
  icon: React.ElementType;
  label: string;
  data: (number | null)[];
  color: string;
  max: number;
  suffix: string;
  latestValue: string;
}) => (
  <div className="flex items-center gap-3">
    <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
    <span className="text-sm font-medium w-20 shrink-0">{label}</span>
    <div className="flex-1 min-w-0">
      <Sparkline data={data} color={color} max={max} width={180} height={28} />
    </div>
    <span className="text-sm font-semibold tabular-nums w-20 text-right shrink-0">
      {latestValue} {suffix}
    </span>
  </div>
);

/* ── Flag badge ────────────────────────────────────── */
const FlagBadge = ({ flag }: { flag: RecoveryFlag }) => (
  <Badge
    variant={flag.type === "no_signal" ? "destructive" : "secondary"}
    className="gap-1 text-xs"
  >
    <AlertTriangle className="w-3 h-3" />
    {flag.label}
  </Badge>
);

/* ── Loading skeleton ──────────────────────────────── */
const SnapshotSkeleton = () => (
  <Card>
    <CardHeader className="pb-3">
      <Skeleton className="h-5 w-48" />
    </CardHeader>
    <CardContent className="space-y-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </CardContent>
  </Card>
);

/* ── Main component ────────────────────────────────── */
export const WeeklyRecoverySnapshot = memo(function WeeklyRecoverySnapshot() {
  const { activeProfile } = useProfile();
  const { timeline, flags, lastActiveDate, isLoading } =
    useWeeklyRecoverySnapshot(activeProfile?.id, 14);

  if (isLoading) return <SnapshotSkeleton />;
  if (timeline.length === 0) return null;

  // Compute per-row data arrays
  const speechData = timeline.map((d) => (d.speechMinutes > 0 ? d.speechMinutes : null));
  const therapyData = timeline.map((d) => (d.therapyMinutes > 0 ? d.therapyMinutes : null));
  const fatigueData = timeline.map((d) => d.fatigueRating);

  // Compute display values (last 7 days averages)
  const last7 = timeline.slice(-7);
  const avgSpeech = last7.reduce((s, d) => s + d.speechMinutes, 0) / 7;
  const avgTherapy = last7.reduce((s, d) => s + d.therapyMinutes, 0) / 7;
  const fatigueDays = last7.filter((d) => d.fatigueRating !== null);
  const avgFatigue =
    fatigueDays.length > 0
      ? fatigueDays.reduce((s, d) => s + (d.fatigueRating || 0), 0) / fatigueDays.length
      : 0;

  // Max for sparkline scaling
  const maxMinutes = Math.max(
    ...timeline.map((d) => Math.max(d.speechMinutes, d.therapyMinutes, 1)),
    30
  );

  const formatLastActive = () => {
    if (!lastActiveDate) return "No activity yet";
    const today = new Date();
    const last = new Date(lastActiveDate + "T12:00:00"); // avoid TZ shift
    const diffDays = Math.round(
      (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Recovery Snapshot
            <Badge variant="outline" className="text-xs font-normal">
              14 days
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            Last active: {formatLastActive()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sparkline rows */}
        <SparklineRow
          icon={Brain}
          label="Speech"
          data={speechData}
          color="hsl(var(--primary))"
          max={maxMinutes}
          suffix="min/day"
          latestValue={avgSpeech.toFixed(0)}
        />
        <SparklineRow
          icon={Dumbbell}
          label="Therapy"
          data={therapyData}
          color="hsl(var(--chart-2))"
          max={maxMinutes}
          suffix="min/day"
          latestValue={avgTherapy.toFixed(0)}
        />
        <SparklineRow
          icon={Zap}
          label="Fatigue"
          data={fatigueData}
          color="hsl(var(--chart-4))"
          max={5}
          suffix="avg"
          latestValue={avgFatigue > 0 ? avgFatigue.toFixed(1) : "—"}
        />

        {/* Flags */}
        {flags.length > 0 && (
          <div className="pt-2 border-t flex flex-wrap gap-2">
            {flags.map((f, i) => (
              <FlagBadge key={i} flag={f} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
