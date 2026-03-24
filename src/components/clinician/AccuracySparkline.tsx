/**
 * Tiny accuracy trend sparkline for the Weekly Review summary bar.
 * Shows daily accuracy over the review window as a minimal line chart.
 * Conditionally shows fatigue overlay when fatigue data exists AND correlates with accuracy drops.
 */
import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, ReferenceLine, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface DayPoint {
  date: string;
  accuracy: number | null;
  fatigueRating: number | null;
  trials: number;
}

interface AccuracySparklineProps {
  timeline: DayPoint[];
  height?: number;
}

export function AccuracySparkline({ timeline, height = 48 }: AccuracySparklineProps) {
  const { data, trend, showFatigue, avgAccuracy } = useMemo(() => {
    // Filter to days with actual accuracy data
    const withData = timeline
      .filter((d) => d.accuracy !== null && d.trials > 0)
      .map((d) => ({
        date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        accuracy: Math.round(d.accuracy!),
        fatigue: d.fatigueRating,
      }));

    if (withData.length < 2) return { data: withData, trend: "insufficient" as const, showFatigue: false, avgAccuracy: 0 };

    // Trend: compare first half avg vs second half avg
    const mid = Math.floor(withData.length / 2);
    const firstHalf = withData.slice(0, mid);
    const secondHalf = withData.slice(mid);
    const avgFirst = firstHalf.reduce((s, d) => s + d.accuracy, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, d) => s + d.accuracy, 0) / secondHalf.length;
    const delta = avgSecond - avgFirst;
    const trend = delta > 3 ? ("up" as const) : delta < -3 ? ("down" as const) : ("flat" as const);

    const avg = withData.reduce((s, d) => s + d.accuracy, 0) / withData.length;

    // Show fatigue overlay only if fatigue data exists AND there's a negative correlation
    const fatiguePoints = withData.filter((d) => d.fatigue !== null);
    let showFatigue = false;
    if (fatiguePoints.length >= 3) {
      // Simple check: are high-fatigue days associated with lower accuracy?
      const highFatigueDays = fatiguePoints.filter((d) => d.fatigue! >= 4);
      const normalDays = fatiguePoints.filter((d) => d.fatigue! < 4);
      if (highFatigueDays.length > 0 && normalDays.length > 0) {
        const avgHighFatigueAcc = highFatigueDays.reduce((s, d) => s + d.accuracy, 0) / highFatigueDays.length;
        const avgNormalAcc = normalDays.reduce((s, d) => s + d.accuracy, 0) / normalDays.length;
        showFatigue = avgNormalAcc - avgHighFatigueAcc > 5; // Only show if meaningful gap
      }
    }

    return { data: withData, trend, showFatigue, avgAccuracy: Math.round(avg) };
  }, [timeline]);

  if (data.length < 2) return null;

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-600 dark:text-green-400" : trend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex items-center gap-1.5 shrink-0">
        <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {data.length}d trend
        </span>
      </div>
      <div className="flex-1 min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <YAxis domain={[0, 100]} hide />
            <RechartsTooltip
              contentStyle={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
              }}
              formatter={(value: number, name: string) => {
                if (name === "accuracy") return [`${value}%`, "Accuracy"];
                if (name === "fatigue") return [`${value}/5`, "Fatigue"];
                return [value, name];
              }}
              labelStyle={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}
            />
            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: "hsl(var(--primary))" }}
            />
            {showFatigue && (
              <Line
                type="monotone"
                dataKey="fatigue"
                stroke="hsl(var(--destructive))"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                activeDot={{ r: 2, strokeWidth: 0, fill: "hsl(var(--destructive))" }}
                yAxisId={0}
              />
            )}
            <ReferenceLine y={avgAccuracy} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" strokeOpacity={0.4} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {showFatigue && (
        <span className="text-[9px] text-destructive/70 shrink-0">
          fatigue ↔ accuracy
        </span>
      )}
    </div>
  );
}
