/* WeeklyRecoverySnapshot – recovery trend visualization */
import { memo, useCallback, useMemo } from "react";
import { useUiMode } from "@/hooks/useUiMode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, Brain, Calendar, ClipboardCopy, Dumbbell, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatEhrSummary } from "@/lib/formatEhrSummary";
import { computeEngagementScore } from "@/lib/computeEngagementScore";
import { useProfile } from "@/hooks/useProfile";
import {
  useWeeklyRecoverySnapshot,
  type RecoveryFlag,
} from "@/hooks/useWeeklyRecoverySnapshot";
import { useRecoveryAlerts } from "@/hooks/useRecoveryAlerts";
import { RecoveryAlertsPanel } from "@/components/RecoveryAlertsPanel";

/* ── Mini sparkline with null-gap awareness (Option A: break on nulls) ── */
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

  // Build segments — break on nulls so gaps don't get false lines
  const segments: string[][] = [];
  let current: string[] = [];
  data.forEach((v, i) => {
    if (v === null || v === undefined) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      return;
    }
    const x = i * step;
    const y = height - (v / safeMax) * height;
    current.push(`${x},${y}`);
  });
  if (current.length > 0) segments.push(current);

  if (segments.length === 0 || segments.every((s) => s.length < 2)) {
    // Show dots for single-point segments
    const dots = segments.flat();
    if (dots.length === 0) {
      return (
        <svg width={width} height={height} className="opacity-40">
          <text
            x={width / 2}
            y={height / 2 + 4}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            className="text-muted-foreground"
          >
            No data
          </text>
        </svg>
      );
    }
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {dots.map((pt, i) => {
          const [cx, cy] = pt.split(",");
          return <circle key={i} cx={cx} cy={cy} r={3} fill={color} />;
        })}
      </svg>
    );
  }

  // Last point across all segments for the end dot
  const allPoints = segments.flat();
  const lastPt = allPoints[allPoints.length - 1]?.split(",");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      {segments.map((seg, i) =>
        seg.length >= 2 ? (
          <polyline
            key={i}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={seg.join(" ")}
          />
        ) : (
          <circle
            key={i}
            cx={seg[0].split(",")[0]}
            cy={seg[0].split(",")[1]}
            r={3}
            fill={color}
          />
        )
      )}
      {lastPt && <circle cx={lastPt[0]} cy={lastPt[1]} r={3} fill={color} />}
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

/* ── Loading / error states ────────────────────────── */
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
  const { uiMode } = useUiMode();
  const isClinician = uiMode === "clinician" || uiMode === "admin";
  const { toast } = useToast();
  const { timeline, flags, lastActiveDate, isLoading, error } =
    useWeeklyRecoverySnapshot(activeProfile?.id, 14);
  const { alerts: persistedAlerts, resolveAlert } = useRecoveryAlerts(
    activeProfile?.id,
    timeline
  );

  const engagement = useMemo(
    () => (timeline.length > 0 ? computeEngagementScore(timeline) : null),
    [timeline]
  );

  const handleCopyEhr = useCallback(async () => {
    const summary = formatEhrSummary({
      timeline,
      flags,
      alerts: persistedAlerts,
      lastActiveDate,
      engagement,
    });
    try {
      await navigator.clipboard.writeText(summary);
      toast({ title: "Copied for EHR paste", description: "Weekly summary copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not access clipboard.", variant: "destructive" });
    }
  }, [timeline, flags, persistedAlerts, lastActiveDate, engagement, toast]);

  if (isLoading) return <SnapshotSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-destructive">
          {error} — check your connection and try again.
        </CardContent>
      </Card>
    );
  }

  if (timeline.length === 0) return null;

  // Per-row data — zeros become null so sparkline breaks on "no data" days
  const toNullIfZero = (v: number) => (v > 0 ? v : null);
  const speechData = timeline.map((d) => toNullIfZero(d.speechMinutes));
  const therapyData = timeline.map((d) => toNullIfZero(d.therapyMinutes));
  const fatigueData = timeline.map((d) => d.fatigueRating);

  // Last 7 day averages
  const last7 = timeline.slice(-7);
  const avgSpeech = last7.reduce((s, d) => s + d.speechMinutes, 0) / 7;
  const avgTherapy = last7.reduce((s, d) => s + d.therapyMinutes, 0) / 7;
  const fatigueDays = last7.filter((d) => d.fatigueRating !== null);
  const avgFatigue =
    fatigueDays.length > 0
      ? fatigueDays.reduce((s, d) => s + (d.fatigueRating || 0), 0) /
        fatigueDays.length
      : 0;

  const maxMinutes = Math.max(
    ...timeline.map((d) => Math.max(d.speechMinutes, d.therapyMinutes, 1)),
    30
  );

  const formatLastActive = () => {
    if (!lastActiveDate) return "No activity yet";
    const today = new Date();
    const last = new Date(lastActiveDate + "T12:00:00");
    const diffDays = Math.round(
      (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Recovery Snapshot
            <Badge variant="outline" className="text-xs font-normal">
              14 days
            </Badge>
            {engagement && (
              <Badge
                variant={engagement.band === "Low" ? "destructive" : engagement.band === "Moderate" ? "secondary" : "default"}
                className="text-xs font-semibold ml-1"
                title={`Active ${engagement.breakdown.activeDays}/${engagement.breakdown.daysTotal} • Dose ${engagement.breakdown.doseDays}/${engagement.breakdown.daysTotal} • Readiness ${engagement.breakdown.readinessDays}/${engagement.breakdown.daysTotal} • Fatigue stable ${engagement.breakdown.fatigueStableDays}/${engagement.breakdown.fatigueDaysRecorded || 0}`}
              >
                Engagement: {engagement.score}/100
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              Last active: {formatLastActive()}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleCopyEhr}
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              Copy for EHR
            </Button>
          </div>
        </div>
        {/* Clinician-only: inline engagement breakdown */}
        {isClinician && engagement && (
          <p className="text-xs text-muted-foreground mt-1">
            Active {engagement.breakdown.activeDays}/{engagement.breakdown.daysTotal} • Dose ≥10m {engagement.breakdown.doseDays}/{engagement.breakdown.daysTotal} • Readiness {engagement.breakdown.readinessDays}/{engagement.breakdown.daysTotal} • Fatigue stable {engagement.breakdown.fatigueStableDays}/{engagement.breakdown.fatigueDaysRecorded || 0}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
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

        {flags.length > 0 && (
          <div className="pt-2 border-t flex flex-wrap gap-2">
            {flags.map((f, i) => (
              <FlagBadge key={i} flag={f} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    {/* Persisted recovery alerts with resolve UI */}
    <RecoveryAlertsPanel alerts={persistedAlerts} onResolve={resolveAlert} />
    </>
  );
});
