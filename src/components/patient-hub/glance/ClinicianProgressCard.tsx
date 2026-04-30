/**
 * Clinician Glance — Card 4: Progress / Trajectory
 * Answers: "Which way is this patient trending and how confident am I?"
 *
 * Sparkline of accuracy + slope number + volume context. Uses
 * sessionStats.accuracySlope (already computed upstream) so we don't double-count.
 */
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
  /** Slope in % accuracy / week, computed in PatientHub. */
  accuracySlope: number | null;
  recentTrials: number;
  priorTrials: number;
}

interface DayPoint { date: string; accuracy: number; count: number; }

export function ClinicianProgressCard({ userId, accuracySlope, recentTrials, priorTrials }: Props) {
  const [points, setPoints] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const since = new Date(Date.now() - 28 * 86_400_000).toISOString();
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
      const today = new Date(); today.setHours(0,0,0,0);
      const series: DayPoint[] = [];
      for (let i = 27; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const b = buckets[key];
        series.push({ date: key, accuracy: b ? Math.round((b.c / b.t) * 100) : 0, count: b?.t ?? 0 });
      }
      setPoints(series);
      setLoading(false);
    };
    run();
    return () => { mounted = false; };
  }, [userId]);

  const { thisWeekAvg, hasData } = useMemo(() => {
    const last7 = points.slice(-7).filter((p) => p.count > 0);
    const avg = last7.length === 0 ? null : Math.round(last7.reduce((s, p) => s + p.accuracy, 0) / last7.length);
    return { thisWeekAvg: avg, hasData: last7.length > 0 };
  }, [points]);

  const trend = accuracySlope === null
    ? "flat"
    : accuracySlope >= 3 ? "up"
    : accuracySlope <= -3 ? "down"
    : "flat";

  const ts = {
    up: { Icon: TrendingUp, color: "text-emerald-600", label: "Improving" },
    down: { Icon: TrendingDown, color: "text-amber-600", label: "Regression" },
    flat: { Icon: Minus, color: "text-muted-foreground", label: "Plateau" },
  }[trend];

  // Minimal trial-volume confidence note
  const volumeNote = useMemo(() => {
    if (recentTrials === 0) return "No trials this window";
    if (recentTrials < 20) return `Low n (${recentTrials} trials) — interpret with caution`;
    const diff = recentTrials - priorTrials;
    if (diff >= 10) return `n=${recentTrials} (+${diff} vs prior)`;
    if (diff <= -10) return `n=${recentTrials} (${diff} vs prior)`;
    return `n=${recentTrials}`;
  }, [recentTrials, priorTrials]);

  // Sparkline geometry
  const W = 280; const H = 56;
  const path = useMemo(() => {
    if (points.length === 0) return "";
    const step = W / Math.max(points.length - 1, 1);
    return points.map((p, i) => {
      const x = i * step;
      const y = H - (p.accuracy / 100) * H;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }, [points]);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Trajectory
          </div>
          <div className={`text-2xl font-bold leading-tight ${ts.color}`}>
            {ts.label}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {accuracySlope !== null
              ? `${accuracySlope > 0 ? "+" : ""}${Math.round(accuracySlope)}%/wk`
              : "slope unavailable"}
            {hasData && <span> · {thisWeekAvg}% this week</span>}
          </div>
        </div>
        <div className={`flex items-center justify-center w-9 h-9 rounded-full bg-muted/40 ${ts.color} shrink-0`}>
          <ts.Icon className="w-4 h-4" />
        </div>
      </div>
      {loading ? (
        <div className="h-14 bg-muted/40 rounded animate-pulse" />
      ) : !hasData ? (
        <div className="h-14 flex items-center justify-center text-xs text-muted-foreground">
          Insufficient data — need active trials.
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
          <defs>
            <linearGradient id="clFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="url(#clFill)" />
          <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
        <span>Last 28 days</span>
        <span>{volumeNote}</span>
      </div>
    </Card>
  );
}
