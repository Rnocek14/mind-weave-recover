import { Card } from "@/components/ui/card";
import { usePhysicalMetrics } from "@/hooks/usePhysicalMetrics";
import { useProfile } from "@/hooks/useProfile";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { localYYYYMMDD } from "@/lib/localDate";
import { useWeeklyRecoverySnapshot } from "@/hooks/useWeeklyRecoverySnapshot";
import {
  ResponsiveContainer,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ComposedChart,
} from "recharts";

export function ActivityTrendChart() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;

  // Last 7 days range
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);

  const startStr = localYYYYMMDD(start);
  const endStr = localYYYYMMDD(end);

  const { physicalRows, isLoading } = usePhysicalMetrics(profileId, startStr, endStr);
  const { timeline: snapshotTimeline } = useWeeklyRecoverySnapshot(profileId, 7);

  // Build 7-day contiguous array
  const days: { label: string; date: string; activeMin: number; fatigue: number | null }[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 7; i++) {
    const d = localYYYYMMDD(cursor);
    const row = physicalRows.find((r) => r.metric_date === d);
    const snapshotDay = snapshotTimeline.find((s) => s.date === d);
    days.push({
      date: d,
      label: cursor.toLocaleDateString(undefined, { weekday: "short" }),
      activeMin: row?.active_minutes != null ? Math.round(Number(row.active_minutes)) : 0,
      fatigue: snapshotDay?.fatigueRating ?? null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const hasFatigueData = days.some((d) => d.fatigue !== null);

  if (isLoading) {
    return (
      <Card className="p-5 animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        <div className="h-32 bg-muted rounded" />
      </Card>
    );
  }

  const hasAnyData = days.some((d) => d.activeMin > 0);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Activity — Last 7 Days</h3>
        {hasFatigueData && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm" style={{ background: "hsl(var(--primary))" }} />
              Active min
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 rounded-sm bg-amber-500" />
              Fatigue
            </span>
          </div>
        )}
      </div>

      {!hasAnyData && !hasFatigueData ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No activity data yet. Log your first day above!
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={days} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            {hasFatigueData && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 5]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
            )}
            <Tooltip
              contentStyle={{
                borderRadius: "0.5rem",
                fontSize: "0.8rem",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--card-foreground))",
              }}
              formatter={(value: number, name: string) => {
                if (name === "activeMin") return [`${value} min`, "Active Minutes"];
                if (name === "fatigue") return [`${value}/5`, "Fatigue"];
                return [value, name];
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="activeMin"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            {hasFatigueData && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="fatigue"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: "#f59e0b" }}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
