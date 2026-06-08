import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Info } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useProbeResults } from "@/hooks/useProbeResults";

interface ProbeTrendCardProps {
  userId: string | undefined;
  profileId?: string | null;
}

/**
 * Clinician view: generalization-probe accuracy trend over time, built from the
 * `probe_analytics` daily aggregate view. Plots REAL measured independent
 * accuracy per day. Explicitly labelled as a generalization signal.
 */
export function ProbeTrendCard({ userId, profileId }: ProbeTrendCardProps) {
  const { loading, dailyTrend } = useProbeResults({
    userId,
    profileId,
    trendDays: 90,
  });

  if (loading || dailyTrend.length === 0) return null;

  const data = dailyTrend.map((d) => ({
    date: new Date(d.assessment_date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    accuracy: d.accuracy_pct,
    cues: d.avg_cues_needed,
    trials: d.total_probes,
  }));

  const latest = dailyTrend[dailyTrend.length - 1];

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Generalization Probe Trend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground">
            {latest.accuracy_pct}%
          </span>
          <span className="text-xs text-muted-foreground">
            latest probe accuracy · {latest.total_probes} trials ·{" "}
            {latest.avg_cues_needed} avg. cues
          </span>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) =>
                name === "accuracy" ? [`${value}%`, "Independent accuracy"] : [value, name]
              }
            />
            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Untrained-word probes estimate carry-over of naming gains. This is a
          generalization signal, not a validated outcome measure.
        </p>
      </CardContent>
    </Card>
  );
}
