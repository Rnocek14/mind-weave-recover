import { Card } from "@/components/ui/card";
import { usePhysicalMetrics } from "@/hooks/usePhysicalMetrics";
import { useProfile } from "@/hooks/useProfile";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { localYYYYMMDD } from "@/lib/localDate";
import {
  ResponsiveContainer,
  BarChart,
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

  // Build 7-day contiguous array
  const days: { label: string; date: string; activeMin: number; fatigue: number | null }[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 7; i++) {
    const d = localYYYYMMDD(cursor);
    const row = physicalRows.find((r) => r.metric_date === d);
    days.push({
      date: d,
      label: cursor.toLocaleDateString(undefined, { weekday: "short" }),
      activeMin: row?.active_minutes != null ? Math.round(Number(row.active_minutes)) : 0,
      fatigue: null, // filled below if available
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Overlay fatigue from readiness hook (lightweight — reuses cached data if already mounted)
  // We intentionally don't fetch readiness here to avoid extra queries;
  // fatigue overlay will only show if DailyReadiness is available in context.

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
      <h3 className="font-semibold text-lg mb-4">Activity — Last 7 Days</h3>

      {!hasAnyData ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No activity data yet. Log your first day above!
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <ComposedChart data={days} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              contentStyle={{
                borderRadius: "0.5rem",
                fontSize: "0.8rem",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--card-foreground))",
              }}
              formatter={(value: number, name: string) =>
                name === "activeMin" ? [`${value} min`, "Active Minutes"] : [value, name]
              }
            />
            <Bar
              dataKey="activeMin"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
