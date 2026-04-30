/**
 * Glance Card 4 — Progress
 * Answers: "Are they getting better?"
 * One sparkline of weekly accuracy. One line.
 */
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProgressCardProps {
  userId: string;
}

interface DayPoint {
  date: string;
  accuracy: number;
  count: number;
}

export function ProgressCard({ userId }: ProgressCardProps) {
  const [points, setPoints] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      const { data } = await supabase
        .from("utterance_analyses")
        .select("created_at, is_correct")
        .eq("user_id", userId)
        .gte("created_at", since)
        .not("is_correct", "is", null);

      if (!mounted) return;
      const buckets: Record<string, { c: number; t: number }> = {};
      for (const r of (data || []) as any[]) {
        const d = new Date(r.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!buckets[key]) buckets[key] = { c: 0, t: 0 };
        buckets[key].t += 1;
        if (r.is_correct) buckets[key].c += 1;
      }
      // Build last 14 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const series: DayPoint[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const b = buckets[key];
        series.push({
          date: key,
          accuracy: b ? Math.round((b.c / b.t) * 100) : 0,
          count: b?.t ?? 0,
        });
      }
      setPoints(series);
      setLoading(false);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const { thisWeekAvg, lastWeekAvg, hasData, thisWeekTrials, lastWeekTrials } = useMemo(() => {
    const last7 = points.slice(-7).filter((p) => p.count > 0);
    const prev7 = points.slice(0, 7).filter((p) => p.count > 0);
    const avg = (arr: DayPoint[]) =>
      arr.length === 0 ? null : Math.round(arr.reduce((s, p) => s + p.accuracy, 0) / arr.length);
    const sum = (arr: DayPoint[]) => arr.reduce((s, p) => s + p.count, 0);
    return {
      thisWeekAvg: avg(last7),
      lastWeekAvg: avg(prev7),
      hasData: last7.length > 0,
      thisWeekTrials: sum(points.slice(-7)),
      lastWeekTrials: sum(points.slice(0, 7)),
    };
  }, [points]);

  // Plain-language volume context — caregivers think in "more practice", not trial counts.
  const volumeNote = useMemo(() => {
    if (!hasData) return null;
    const diff = thisWeekTrials - lastWeekTrials;
    if (lastWeekTrials === 0 && thisWeekTrials > 0) return "First full week of practice";
    if (diff >= 10) return `More practice this week (+${diff} attempts)`;
    if (diff <= -10) return `Less practice this week (${diff} attempts)`;
    return `Similar practice volume (${thisWeekTrials} attempts)`;
  }, [hasData, thisWeekTrials, lastWeekTrials]);

  const delta = thisWeekAvg !== null && lastWeekAvg !== null ? thisWeekAvg - lastWeekAvg : null;
  const trend = delta === null ? "flat" : delta > 3 ? "up" : delta < -3 ? "down" : "flat";

  const trendStyle = {
    up: { Icon: TrendingUp, color: "text-emerald-600", label: "Improving" },
    down: { Icon: TrendingDown, color: "text-amber-600", label: "Slight dip" },
    flat: { Icon: Minus, color: "text-muted-foreground", label: "Steady" },
  }[trend];

  // Sparkline geometry
  const W = 280;
  const H = 56;
  const max = 100;
  const path = useMemo(() => {
    if (points.length === 0) return "";
    const step = W / Math.max(points.length - 1, 1);
    return points
      .map((p, i) => {
        const x = i * step;
        const y = H - (p.accuracy / max) * H;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points]);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Progress
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-foreground leading-tight">
              {hasData ? `${thisWeekAvg}%` : "—"}
            </div>
            <div className="text-xs text-muted-foreground">this week</div>
          </div>
        </div>
        {hasData && (
          <div className={`flex items-center gap-1 ${trendStyle.color}`}>
            <trendStyle.Icon className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {trendStyle.label}
              {delta !== null && delta !== 0 && (
                <span className="ml-1 font-normal">
                  ({delta > 0 ? "+" : ""}
                  {delta}%)
                </span>
              )}
            </span>
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-14 bg-muted/40 rounded animate-pulse" />
      ) : !hasData ? (
        <div className="h-14 flex items-center justify-center text-xs text-muted-foreground">
          Not enough practice yet to show a trend.
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
          <defs>
            <linearGradient id="cgFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="url(#cgFill)" />
          <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <div className="text-[11px] text-muted-foreground mt-1.5 text-center">Last 14 days</div>
    </Card>
  );
}
