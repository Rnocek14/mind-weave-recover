import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Copy, Database, Info, Minus, RefreshCw, Search, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  ReferenceDot,
  Legend,
} from "recharts";

type Window = "1h" | "24h" | "7d";

const WINDOW_LABEL: Record<Window, string> = {
  "1h": "Last 1 hour",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
};

const WINDOW_MS: Record<Window, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

function windowToTimestamp(w: Window, offsetWindows = 0): string {
  const ms = WINDOW_MS[w];
  return new Date(Date.now() - ms * (offsetWindows + 1) + (offsetWindows > 0 ? 0 : 0)).toISOString();
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return (n / d) * 100;
}

function PctCell({ value, threshold }: { value: number; threshold: number }) {
  const ok = value >= threshold;
  return (
    <span className={`font-mono font-semibold ${ok ? "text-emerald-600" : "text-red-600"}`}>
      {value.toFixed(1)}%
    </span>
  );
}

function CopyButton({ sql, label = "Copy SQL" }: { sql: string; label?: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs gap-1"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(sql.trim());
          toast.success("SQL copied to clipboard");
        } catch {
          toast.error("Copy failed");
        }
      }}
    >
      <Copy className="w-3 h-3" />
      {label}
    </Button>
  );
}

const AUTO_REFRESH_MS = 8000;

interface CoverageRow {
  slug: string;
  total: number;
  errorPct: number;
  adaptPct: number;
  signalPct: number;        // % of trials with outputs.clinical_signal (only meaningful for scored exercises)
  adaptEventCount: number;  // # of adaptation_events in window for this slug
}

// Exercises that produce LLM clinical_signal (discourse / scored exercises).
// For these, signal completeness counts toward the health score.
const SCORED_EXERCISE_SLUGS = new Set<string>([
  "conversation-partner",
  "thought-continuation",
  "narrative-retell",
  "describe-guess",
  "category-fluency",
]);

// Exercises that emit adaptation_events. For others, adaptation_events absence
// is not a regression — we just don't penalize them.
// Conservative heuristic: any slug we have *ever* seen in adaptation_events
// counts as adaptive. We track this dynamically off the loaded data.
type HealthStatus = "Healthy" | "Watch" | "Broken";

interface HealthComponent {
  key: "error_type" | "adaptations_active" | "adaptation_events" | "clinical_signal";
  label: string;
  value: number;       // 0–100 component score
  weight: number;      // effective weight after redistribution (0–1)
  contribution: number; // value * weight (points contributed to the final score)
  included: boolean;   // whether this component counted for this exercise
  note?: string;       // e.g. "n/a — non-adaptive"
}

interface HealthScore {
  slug: string;
  total: number;
  score: number;
  status: HealthStatus;
  reasons: string[];
  isScored: boolean;
  isAdaptive: boolean;
  errorPct: number;
  adaptPct: number;
  signalPct: number;
  adaptEventCount: number;
  components: HealthComponent[];
}

function statusFromScore(score: number): HealthStatus {
  if (score >= 90) return "Healthy";
  if (score >= 75) return "Watch";
  return "Broken";
}

function statusBadgeClass(status: HealthStatus): string {
  switch (status) {
    case "Healthy":
      return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "Watch":
      return "bg-amber-100 text-amber-700 border-amber-300";
    case "Broken":
      return "bg-red-100 text-red-700 border-red-300";
  }
}

function scoreColorClass(score: number): string {
  if (score >= 90) return "text-emerald-600";
  if (score >= 75) return "text-amber-600";
  return "text-red-600";
}

// =====================================================================
// Trend types
// =====================================================================

type TrendWindow = "1h" | "24h" | "7d" | "30d";

const TREND_WINDOW_LABEL: Record<TrendWindow, string> = {
  "1h": "Last 1h · 5-min buckets",
  "24h": "Last 24h · hourly buckets",
  "7d": "Last 7d · daily buckets",
  "30d": "Last 30d · daily buckets",
};

interface BucketRow {
  bucket_start: string;
  exercise_slug: string;
  total: number;
  with_error_type: number;
  with_adaptations: number;
  with_signal: number;
  adaptation_event_count: number;
}

interface TrendPoint {
  bucket_start: string; // ISO
  score: number;
  errorPct: number;
  adaptPct: number;
  signalPct: number;
  adaptEvents: number;
  total: number;
  isAdaptive: boolean;
  isScored: boolean;
}

type TrendDirection = "improving" | "stable" | "declining" | "broken" | "no-data";

function classifyTrend(points: TrendPoint[]): TrendDirection {
  const valid = points.filter((p) => p.total > 0);
  if (valid.length === 0) return "no-data";
  const last = valid[valid.length - 1];
  if (last.score < 75) return "broken";
  if (valid.length < 3) return "stable";
  // Compare last 1/3 average vs first 1/3 average
  const third = Math.max(1, Math.floor(valid.length / 3));
  const head = valid.slice(0, third);
  const tail = valid.slice(-third);
  const avg = (arr: TrendPoint[]) => arr.reduce((s, p) => s + p.score, 0) / arr.length;
  const delta = avg(tail) - avg(head);
  if (delta >= 5) return "improving";
  if (delta <= -5) return "declining";
  return "stable";
}

function trendChipClass(d: TrendDirection): string {
  switch (d) {
    case "improving": return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "stable":    return "bg-slate-100 text-slate-700 border-slate-300";
    case "declining": return "bg-amber-100 text-amber-700 border-amber-300";
    case "broken":    return "bg-red-100 text-red-700 border-red-300";
    case "no-data":   return "bg-muted text-muted-foreground border-border";
  }
}

function TrendIcon({ d }: { d: TrendDirection }) {
  if (d === "improving") return <TrendingUp className="w-3 h-3" />;
  if (d === "declining" || d === "broken") return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
}

/**
 * Tiny inline sparkline for the per-exercise health table.
 * Renders the last N health-score points; colors by trend direction.
 */
function HealthSparkline({
  points,
  width = 80,
  height = 24,
}: {
  points: TrendPoint[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return <span className="text-[10px] text-muted-foreground italic">need more data</span>;
  }
  const direction = classifyTrend(points);
  const colorClass =
    direction === "improving" ? "text-emerald-600"
    : direction === "declining" ? "text-amber-600"
    : direction === "broken" ? "text-red-600"
    : "text-muted-foreground";

  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  // Y range fixed 0–100
  const yScale = (v: number) => padding + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;
  const xStep = innerW / (points.length - 1);
  const xScale = (i: number) => padding + i * xStep;
  const poly = points.map((p, i) => `${xScale(i)},${yScale(p.score)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg width={width} height={height} className={colorClass} aria-label={`Trend: ${direction}`}>
      {/* 75-line (Watch threshold) */}
      <line
        x1={padding} x2={width - padding}
        y1={yScale(75)} y2={yScale(75)}
        className="stroke-muted" strokeWidth={1} strokeDasharray="2,2"
      />
      <polyline
        points={poly}
        fill="none" stroke="currentColor" strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx={xScale(points.length - 1)} cy={yScale(last.score)} r={2.5} fill="currentColor" />
    </svg>
  );
}

/**
 * Group raw bucket rows into per-exercise time series. Reuses `computeHealth`
 * so the sparkline + chart use the EXACT same scoring formula as the live
 * health table — no second source of truth.
 */
function buildTrendSeries(
  rows: BucketRow[],
  liveAdaptiveSlugs: Set<string>,
): Map<string, TrendPoint[]> {
  // Determine adaptive set: any slug we've seen in the bucket data with
  // adaptation_event_count > 0, plus any slug currently flagged adaptive in
  // the live coverage (so a slug stays adaptive even in a quiet bucket).
  const adaptiveSlugs = new Set<string>(liveAdaptiveSlugs);
  for (const r of rows) {
    if (r.adaptation_event_count > 0) adaptiveSlugs.add(r.exercise_slug);
  }

  const bySlug = new Map<string, TrendPoint[]>();
  for (const r of rows) {
    const isAdaptive = adaptiveSlugs.has(r.exercise_slug) || SCORED_EXERCISE_SLUGS.has(r.exercise_slug);
    const cov: CoverageRow = {
      slug: r.exercise_slug,
      total: r.total,
      errorPct: pct(r.with_error_type, r.total),
      adaptPct: pct(r.with_adaptations, r.total),
      signalPct: pct(r.with_signal, r.total),
      adaptEventCount: r.adaptation_event_count,
    };
    const h = computeHealth(cov, isAdaptive);
    const point: TrendPoint = {
      bucket_start: r.bucket_start,
      score: h.score,
      errorPct: cov.errorPct,
      adaptPct: cov.adaptPct,
      signalPct: cov.signalPct,
      adaptEvents: r.adaptation_event_count,
      total: r.total,
      isAdaptive,
      isScored: SCORED_EXERCISE_SLUGS.has(r.exercise_slug),
    };
    const arr = bySlug.get(r.exercise_slug) || [];
    arr.push(point);
    bySlug.set(r.exercise_slug, arr);
  }
  // Ensure each series is sorted by time
  for (const [k, arr] of bySlug) {
    arr.sort((a, b) => a.bucket_start.localeCompare(b.bucket_start));
    bySlug.set(k, arr);
  }
  return bySlug;
}

/**
 * Compute a 0–100 health score for one exercise.
 *
 * Weighting:
 *   - 40% error_type coverage         (always applies)
 *   - 30% adaptations_active coverage (always applies)
 *   - 20% adaptation_events presence  (only counted if exercise is adaptive;
 *                                      otherwise weight redistributes)
 *   - 10% clinical_signal completeness (only counted if scored exercise;
 *                                       otherwise weight redistributes)
 *
 * If a component is excluded (non-adaptive / non-scored), its weight is
 * redistributed proportionally across the remaining components so the
 * score still tops out at 100.
 *
 * Trials with NO telemetry still count as low — we never hide missing data.
 */
function computeHealth(row: CoverageRow, isAdaptive: boolean): HealthScore {
  const isScored = SCORED_EXERCISE_SLUGS.has(row.slug);
  const reasons: string[] = [];

  // Component scores (0–100)
  const errorComp = row.errorPct;
  const adaptCovComp = row.adaptPct;
  // Adaptation-events component: presence-based.
  //   0 events → 0, 1 event → 50, ≥1 event per 10 trials → 100.
  const expectedEvents = Math.max(1, Math.floor(row.total / 10));
  const adaptEvtComp = isAdaptive
    ? Math.min(100, (row.adaptEventCount / expectedEvents) * 100)
    : 0;
  const signalComp = isScored ? row.signalPct : 0;

  // Weights — start nominal, then redistribute for excluded components.
  let wErr = 0.4;
  let wAdaptCov = 0.3;
  let wAdaptEvt = isAdaptive ? 0.2 : 0;
  let wSignal = isScored ? 0.1 : 0;
  const totalW = wErr + wAdaptCov + wAdaptEvt + wSignal;
  if (totalW > 0 && totalW < 1) {
    const k = 1 / totalW;
    wErr *= k;
    wAdaptCov *= k;
    wAdaptEvt *= k;
    wSignal *= k;
  }

  const score =
    errorComp * wErr +
    adaptCovComp * wAdaptCov +
    adaptEvtComp * wAdaptEvt +
    signalComp * wSignal;

  // Reason chips — explain what dragged the score down
  if (row.total === 0) {
    reasons.push("no trials");
  }
  if (row.errorPct < 95) {
    reasons.push(`error_type ${row.errorPct.toFixed(0)}%`);
  }
  if (row.adaptPct < 80) {
    reasons.push(`adaptations_active ${row.adaptPct.toFixed(0)}%`);
  }
  if (isAdaptive && row.adaptEventCount === 0 && row.total >= 5) {
    reasons.push("no adaptation_events");
  }
  if (isScored && row.signalPct < 80) {
    reasons.push(`clinical_signal ${row.signalPct.toFixed(0)}%`);
  }
  if (reasons.length === 0) {
    reasons.push("all checks passing");
  }

  return {
    slug: row.slug,
    total: row.total,
    score: Math.round(score),
    status: statusFromScore(score),
    reasons,
    isScored,
    isAdaptive,
    errorPct: row.errorPct,
    adaptPct: row.adaptPct,
    signalPct: row.signalPct,
    adaptEventCount: row.adaptEventCount,
    components: [
      {
        key: "error_type",
        label: "error_type coverage",
        value: errorComp,
        weight: wErr,
        contribution: errorComp * wErr,
        included: true,
      },
      {
        key: "adaptations_active",
        label: "adaptations_active coverage",
        value: adaptCovComp,
        weight: wAdaptCov,
        contribution: adaptCovComp * wAdaptCov,
        included: true,
      },
      {
        key: "adaptation_events",
        label: "adaptation_events presence",
        value: adaptEvtComp,
        weight: wAdaptEvt,
        contribution: adaptEvtComp * wAdaptEvt,
        included: isAdaptive,
        note: isAdaptive
          ? `${row.adaptEventCount} event${row.adaptEventCount === 1 ? "" : "s"} / ${expectedEvents} expected`
          : "n/a — non-adaptive exercise",
      },
      {
        key: "clinical_signal",
        label: "clinical_signal completeness",
        value: signalComp,
        weight: wSignal,
        contribution: signalComp * wSignal,
        included: isScored,
        note: isScored ? undefined : "n/a — not an LLM-scored exercise",
      },
    ],
  };
}

export default function ClinicianTelemetry() {
  const navigate = useNavigate();
  const [windowSel, setWindowSel] = useState<Window>("24h");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [drillSlug, setDrillSlug] = useState<string | null>(null);
  const [trendWindow, setTrendWindow] = useState<TrendWindow>("24h");
  const [expandedTrendSlug, setExpandedTrendSlug] = useState<string | null>(null);

  const since = useMemo(() => windowToTimestamp(windowSel), [windowSel]);
  // Previous comparable window (e.g. previous 1h before the current 1h)
  const prevSince = useMemo(
    () => new Date(Date.now() - WINDOW_MS[windowSel] * 2).toISOString(),
    [windowSel]
  );
  const prevUntil = since;

  const eventsQuery = useQuery({
    queryKey: ["telemetry-events", windowSel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_events")
        .select("exercise_slug, error_type, adaptations_active, outputs, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: autoRefresh ? AUTO_REFRESH_MS : false,
  });

  const adaptQuery = useQuery({
    queryKey: ["telemetry-adapt", windowSel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adaptation_events")
        .select("exercise_slug, adaptation_type, value_before, value_after, trigger_condition, trigger_type, layer, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: autoRefresh ? AUTO_REFRESH_MS : false,
  });

  // Previous-window snapshot (for break detection only — coverage % per slug)
  const prevQuery = useQuery({
    queryKey: ["telemetry-events-prev", windowSel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_events")
        .select("exercise_slug, error_type")
        .gte("created_at", prevSince)
        .lt("created_at", prevUntil)
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: autoRefresh ? AUTO_REFRESH_MS : false,
  });

  const coverage: CoverageRow[] = useMemo(() => {
    const rows = eventsQuery.data || [];
    const adaptRows = (adaptQuery.data || []) as any[];
    const adaptCounts = new Map<string, number>();
    for (const a of adaptRows) {
      const slug = a.exercise_slug || "(unknown)";
      adaptCounts.set(slug, (adaptCounts.get(slug) || 0) + 1);
    }
    const map = new Map<string, { total: number; withErrorType: number; withAdaptations: number; withSignal: number }>();
    for (const r of rows as any[]) {
      const slug = r.exercise_slug || "(unknown)";
      const cur = map.get(slug) || { total: 0, withErrorType: 0, withAdaptations: 0, withSignal: 0 };
      cur.total += 1;
      if (r.error_type !== null && r.error_type !== undefined && String(r.error_type).length > 0) {
        cur.withErrorType += 1;
      }
      const ad = r.adaptations_active;
      if (ad && typeof ad === "object" && Object.keys(ad).length > 0) {
        cur.withAdaptations += 1;
      }
      const cs = r.outputs?.clinical_signal;
      if (cs && typeof cs === "object" && (cs.errorType || typeof cs.successScore === "number")) {
        cur.withSignal += 1;
      }
      map.set(slug, cur);
    }
    // Ensure exercises that only show up in adaptation_events also appear (rare)
    for (const slug of adaptCounts.keys()) {
      if (!map.has(slug)) {
        map.set(slug, { total: 0, withErrorType: 0, withAdaptations: 0, withSignal: 0 });
      }
    }
    return Array.from(map.entries())
      .map(([slug, v]) => ({
        slug,
        total: v.total,
        errorPct: pct(v.withErrorType, v.total),
        adaptPct: pct(v.withAdaptations, v.total),
        signalPct: pct(v.withSignal, v.total),
        adaptEventCount: adaptCounts.get(slug) || 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [eventsQuery.data, adaptQuery.data]);

  const prevCoverage = useMemo(() => {
    const rows = prevQuery.data || [];
    const map = new Map<string, { total: number; withErrorType: number }>();
    for (const r of rows as any[]) {
      const slug = r.exercise_slug || "(unknown)";
      const cur = map.get(slug) || { total: 0, withErrorType: 0 };
      cur.total += 1;
      if (r.error_type !== null && r.error_type !== undefined && String(r.error_type).length > 0) {
        cur.withErrorType += 1;
      }
      map.set(slug, cur);
    }
    return map;
  }, [prevQuery.data]);

  // Pipeline-break detector: an exercise that had healthy error_type % previously
  // but dropped sharply (or to 0) in the current window.
  const breaks = useMemo(() => {
    const list: Array<{
      slug: string;
      prevPct: number;
      curPct: number;
      curTotal: number;
      drop: number;
      severity: "critical" | "warning";
    }> = [];
    for (const cur of coverage) {
      const prev = prevCoverage.get(cur.slug);
      if (!prev || prev.total < 5) continue;
      const prevPct = pct(prev.withErrorType, prev.total);
      if (prevPct < 80) continue; // wasn't healthy before, not a regression
      const drop = prevPct - cur.errorPct;
      if (drop >= 30) {
        list.push({
          slug: cur.slug,
          prevPct,
          curPct: cur.errorPct,
          curTotal: cur.total,
          drop,
          severity: cur.errorPct < 20 ? "critical" : "warning",
        });
      }
    }
    return list.sort((a, b) => b.drop - a.drop);
  }, [coverage, prevCoverage]);

  const clinicalSignals = useMemo(() => {
    const rows = (eventsQuery.data || []) as any[];
    const signals = rows
      .map((r) => {
        const cs = r.outputs?.clinical_signal;
        if (!cs) return null;
        return {
          exercise_slug: r.exercise_slug,
          created_at: r.created_at,
          errorType: cs.errorType ?? null,
          successScore: typeof cs.successScore === "number" ? cs.successScore : null,
          recommendedAdaptation: cs.recommendedAdaptation ?? null,
          source: cs.source ?? null,
          model: cs.model ?? null,
          promptVersion: cs.promptVersion ?? null,
        };
      })
      .filter(Boolean) as any[];
    return signals.slice(0, 50);
  }, [eventsQuery.data]);

  const health = useMemo(() => {
    const totals = coverage.reduce(
      (acc, r) => {
        acc.total += r.total;
        acc.errOk += (r.errorPct / 100) * r.total;
        acc.adaptOk += (r.adaptPct / 100) * r.total;
        return acc;
      },
      { total: 0, errOk: 0, adaptOk: 0 }
    );
    const errorPct = pct(totals.errOk, totals.total);
    const adaptPct = pct(totals.adaptOk, totals.total);
    const adaptEvents = (adaptQuery.data || []).length;
    const pass = errorPct >= 95 && adaptPct >= 80 && adaptEvents > 0;
    return { errorPct, adaptPct, adaptEvents, pass, total: totals.total };
  }, [coverage, adaptQuery.data]);

  // Per-exercise health scores. An exercise is "adaptive" if it has emitted
  // any adaptation_events in this window OR is in the scored set (which all
  // run the discourse adaptation engine).
  const [healthSort, setHealthSort] = useState<"score-asc" | "score-desc" | "trials-desc">("score-asc");

  const healthScores: HealthScore[] = useMemo(() => {
    const scores = coverage
      .filter((r) => r.total > 0 || r.adaptEventCount > 0)
      .map((r) => {
        const isAdaptive = r.adaptEventCount > 0 || SCORED_EXERCISE_SLUGS.has(r.slug);
        return computeHealth(r, isAdaptive);
      });
    const sorted = [...scores];
    if (healthSort === "score-asc") sorted.sort((a, b) => a.score - b.score || b.total - a.total);
    else if (healthSort === "score-desc") sorted.sort((a, b) => b.score - a.score || b.total - a.total);
    else sorted.sort((a, b) => b.total - a.total);
    return sorted;
  }, [coverage, healthSort]);

  // ---------------------------------------------------------------------
  // Trends — bucketed RPC, reuses computeHealth for single source of truth
  // ---------------------------------------------------------------------
  const trendsQuery = useQuery({
    queryKey: ["telemetry-trends", trendWindow],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("telemetry_bucketed", { _window: trendWindow });
      if (error) throw error;
      return (data || []) as BucketRow[];
    },
    refetchInterval: autoRefresh ? AUTO_REFRESH_MS : false,
  });

  // Adaptive slugs from the live coverage view — used to keep series classification
  // stable across quiet buckets.
  const liveAdaptiveSlugs = useMemo(() => {
    const s = new Set<string>();
    for (const c of coverage) {
      if (c.adaptEventCount > 0 || SCORED_EXERCISE_SLUGS.has(c.slug)) s.add(c.slug);
    }
    return s;
  }, [coverage]);

  const trendSeries = useMemo(
    () => buildTrendSeries(trendsQuery.data || [], liveAdaptiveSlugs),
    [trendsQuery.data, liveAdaptiveSlugs]
  );

  // Sparkline data for the live health table — last 7 buckets per exercise
  // from the same trends RPC. Falls back gracefully when no trend data yet.
  const sparkBySlug = useMemo(() => {
    const m = new Map<string, TrendPoint[]>();
    for (const [slug, points] of trendSeries) {
      m.set(slug, points.slice(-7));
    }
    return m;
  }, [trendSeries]);

  const refresh = () => {
    eventsQuery.refetch();
    adaptQuery.refetch();
    prevQuery.refetch();
    trendsQuery.refetch();
  };

  // Toast on new break detection
  const breakSlugs = breaks.map((b) => b.slug).join(",");
  useEffect(() => {
    if (!autoRefresh) return;
    if (breaks.length > 0) {
      toast.error(`Pipeline break detected: ${breaks.map((b) => b.slug).join(", ")}`, {
        id: `break-${breakSlugs}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakSlugs, autoRefresh]);

  const intervalSql =
    windowSel === "1h" ? "interval '1 hour'" :
    windowSel === "24h" ? "interval '24 hours'" :
    "interval '7 days'";

  const sqlErrorCoverage = `
-- Error-type coverage by exercise (${WINDOW_LABEL[windowSel]})
SELECT
  exercise_slug,
  COUNT(*) AS trial_count,
  ROUND(100.0 * COUNT(error_type) / NULLIF(COUNT(*), 0), 1) AS error_type_pct
FROM public.exercise_events
WHERE created_at >= now() - ${intervalSql}
GROUP BY exercise_slug
ORDER BY trial_count DESC;
`;

  const sqlAdaptCoverage = `
-- adaptations_active coverage by exercise (${WINDOW_LABEL[windowSel]})
SELECT
  exercise_slug,
  COUNT(*) AS trial_count,
  ROUND(100.0 * SUM(CASE WHEN adaptations_active <> '{}'::jsonb THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*), 0), 1) AS adaptations_active_pct
FROM public.exercise_events
WHERE created_at >= now() - ${intervalSql}
GROUP BY exercise_slug
ORDER BY trial_count DESC;
`;

  const sqlAdaptEvents = `
-- Recent adaptation events (${WINDOW_LABEL[windowSel]})
SELECT exercise_slug, adaptation_type, value_before, value_after,
       trigger_condition, trigger_type, layer, created_at
FROM public.adaptation_events
WHERE created_at >= now() - ${intervalSql}
ORDER BY created_at DESC
LIMIT 200;
`;

  const sqlClinicalSignals = `
-- Recent clinical_signal rows (${WINDOW_LABEL[windowSel]})
SELECT
  exercise_slug,
  outputs->'clinical_signal'->>'errorType'              AS error_type,
  (outputs->'clinical_signal'->>'successScore')::float  AS success_score,
  outputs->'clinical_signal'->>'recommendedAdaptation'  AS recommended_adaptation,
  outputs->'clinical_signal'->>'source'                 AS source,
  outputs->'clinical_signal'->>'model'                  AS model,
  outputs->'clinical_signal'->>'promptVersion'          AS prompt_version,
  created_at
FROM public.exercise_events
WHERE created_at >= now() - ${intervalSql}
  AND outputs ? 'clinical_signal'
ORDER BY created_at DESC
LIMIT 50;
`;

  const isLoading = eventsQuery.isLoading || adaptQuery.isLoading;
  const isFetching = eventsQuery.isFetching || adaptQuery.isFetching || prevQuery.isFetching;

  return (
    <div className="min-h-dvh bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/clinician/dashboard")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Clinician
          </Button>
          <Database className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Telemetry Health</h1>
          <Badge variant="outline" className="ml-auto">Internal · Admin only</Badge>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select value={windowSel} onValueChange={(v) => setWindowSel(v as Window)}>
            <SelectTrigger className="w-48 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <div className="flex items-center gap-2 ml-1">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-xs flex items-center gap-1 cursor-pointer">
              <Zap className={`w-3 h-3 ${autoRefresh ? "text-emerald-600" : "text-muted-foreground"}`} />
              Live ({AUTO_REFRESH_MS / 1000}s)
            </Label>
          </div>
          <span className="text-xs text-muted-foreground">
            {health.total.toLocaleString()} trials in window
          </span>
        </div>

        <Card className={`p-5 border-2 ${health.pass ? "border-emerald-500/40 bg-emerald-50/40" : "border-red-500/40 bg-red-50/40"}`}>
          <div className="flex items-start gap-4">
            {health.pass ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">
                  {health.pass ? "PASS" : "FAIL"}
                </h2>
                <Badge variant={health.pass ? "default" : "destructive"}>
                  {WINDOW_LABEL[windowSel]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Pipeline is healthy when error_type ≥ 95%, adaptations_active ≥ 80%, and adaptation_events &gt; 0.
              </p>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <div className="text-xs text-muted-foreground">error_type coverage</div>
                  <div className={`text-lg font-bold font-mono ${health.errorPct >= 95 ? "text-emerald-600" : "text-red-600"}`}>
                    {health.errorPct.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">target ≥ 95%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">adaptations_active coverage</div>
                  <div className={`text-lg font-bold font-mono ${health.adaptPct >= 80 ? "text-emerald-600" : "text-red-600"}`}>
                    {health.adaptPct.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">target ≥ 80%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">adaptation_events</div>
                  <div className={`text-lg font-bold font-mono ${health.adaptEvents > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {health.adaptEvents}
                  </div>
                  <div className="text-[10px] text-muted-foreground">target &gt; 0</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Per-exercise health scores */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Per-exercise health
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                0–100 score per exercise. Click a row to drill into raw events.
                Weights: 40% error_type · 30% adaptations_active · 20% adaptation_events · 10% clinical_signal.
              </p>
            </div>
            <Select value={healthSort} onValueChange={(v) => setHealthSort(v as typeof healthSort)}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score-asc">Worst first</SelectItem>
                <SelectItem value="score-desc">Best first</SelectItem>
                <SelectItem value="trials-desc">Most trials</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {healthScores.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No exercise activity in window.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 px-2">exercise</th>
                    <th className="py-2 px-2 text-right">score</th>
                    <th className="py-2 px-2">status</th>
                    <th className="py-2 px-2 text-right">trials</th>
                    <th className="py-2 px-2">trend</th>
                    <th className="py-2 px-2">why</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {healthScores.map((h) => (
                    <tr
                      key={`health-${h.slug}`}
                      className="border-b last:border-0 hover:bg-muted/40 cursor-pointer align-top"
                      onClick={() => setDrillSlug(h.slug)}
                    >
                      <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">
                        {h.slug}
                        <div className="flex gap-1 mt-0.5">
                          {h.isScored && (
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">scored</span>
                          )}
                          {h.isAdaptive && (
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">adaptive</span>
                          )}
                        </div>
                      </td>
                      <td className={`py-2 px-2 text-right font-mono font-bold text-base ${scoreColorClass(h.score)}`}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span>{h.score}</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={`Score breakdown for ${h.slug}`}
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              className="w-80 p-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="space-y-2">
                                <div className="flex items-baseline justify-between border-b pb-2">
                                  <div>
                                    <div className="font-mono text-xs">{h.slug}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {h.total} trial{h.total === 1 ? "" : "s"} ·{" "}
                                      {h.isAdaptive ? "adaptive" : "non-adaptive"} ·{" "}
                                      {h.isScored ? "scored" : "non-scored"}
                                    </div>
                                  </div>
                                  <div className={`font-mono font-bold text-2xl ${scoreColorClass(h.score)}`}>
                                    {h.score}
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  {h.components.map((c) => (
                                    <div key={c.key} className="text-xs">
                                      <div className="flex items-baseline justify-between gap-2">
                                        <span className={`font-mono ${c.included ? "" : "text-muted-foreground line-through"}`}>
                                          {c.label}
                                        </span>
                                        <span className="font-mono tabular-nums text-muted-foreground">
                                          {c.included ? `${c.value.toFixed(0)}%` : "—"}
                                        </span>
                                      </div>
                                      <div className="flex items-baseline justify-between gap-2 text-[10px] text-muted-foreground">
                                        <span>
                                          weight {(c.weight * 100).toFixed(0)}%
                                          {c.note ? ` · ${c.note}` : ""}
                                        </span>
                                        <span className="font-mono tabular-nums">
                                          {c.included ? `+${c.contribution.toFixed(1)} pts` : "0 pts"}
                                        </span>
                                      </div>
                                      {c.included && (
                                        <div className="mt-0.5 h-1 rounded bg-muted overflow-hidden">
                                          <div
                                            className={`h-full ${
                                              c.value >= 90
                                                ? "bg-emerald-500"
                                                : c.value >= 75
                                                ? "bg-amber-500"
                                                : "bg-red-500"
                                            }`}
                                            style={{ width: `${Math.min(100, c.value)}%` }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <div className="border-t pt-2 flex items-baseline justify-between text-[10px] text-muted-foreground">
                                  <span>Sum of contributions</span>
                                  <span className="font-mono tabular-nums">
                                    {h.components
                                      .reduce((s, c) => s + (c.included ? c.contribution : 0), 0)
                                      .toFixed(1)}{" "}
                                    / 100
                                  </span>
                                </div>
                                {h.components.some((c) => !c.included) && (
                                  <div className="text-[10px] text-muted-foreground italic">
                                    Excluded components have their weight redistributed across the rest.
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(h.status)}`}>
                          {h.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs">{h.total}</td>
                      <td className="py-2 px-2">
                        {(() => {
                          const points = sparkBySlug.get(h.slug) || [];
                          const direction = classifyTrend(points);
                          return (
                            <div className="flex items-center gap-1.5">
                              <HealthSparkline points={points} />
                              <span
                                className={`text-[9px] uppercase tracking-wide px-1 py-px rounded border inline-flex items-center gap-0.5 ${trendChipClass(direction)}`}
                                title={`Trend over ${TREND_WINDOW_LABEL[trendWindow]}`}
                              >
                                <TrendIcon d={direction} />
                                {direction}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {h.reasons.map((r, i) => {
                            const isGood = r === "all checks passing";
                            return (
                              <span
                                key={i}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  isGood
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                              >
                                {r}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Search className="w-3.5 h-3.5 text-muted-foreground inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pipeline-break detector */}
        {breaks.length > 0 && (
          <Card className="p-4 border-2 border-red-500/50 bg-red-50/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-700">Pipeline break detected</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Exercises whose <code>error_type</code> coverage dropped sharply vs the previous {WINDOW_LABEL[windowSel].toLowerCase()}.
                </p>
                <div className="space-y-1.5">
                  {breaks.map((b) => (
                    <div
                      key={b.slug}
                      className="flex items-center gap-2 text-sm flex-wrap"
                    >
                      <Badge
                        variant={b.severity === "critical" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {b.severity}
                      </Badge>
                      <code className="font-mono text-xs">{b.slug}</code>
                      <span className="text-muted-foreground text-xs">
                        {b.prevPct.toFixed(0)}% → <span className="font-bold text-red-600">{b.curPct.toFixed(0)}%</span>
                        {" "}({b.curTotal} trials, drop {b.drop.toFixed(0)} pts)
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs ml-auto"
                        onClick={() => setDrillSlug(b.slug)}
                      >
                        <Search className="w-3 h-3 mr-1" /> Inspect
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        <Tabs defaultValue="trends">
          <TabsList>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="coverage">Coverage</TabsTrigger>
            <TabsTrigger value="adaptations">Adaptation events</TabsTrigger>
            <TabsTrigger value="signals">Clinical signals</TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Health trend by exercise
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Bucketed live from <code>telemetry_bucketed()</code>. Same scoring formula as the live health table — no second source of truth.
                    Click an exercise to expand the full chart.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={trendWindow} onValueChange={(v) => setTrendWindow(v as TrendWindow)}>
                    <SelectTrigger className="w-56 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">{TREND_WINDOW_LABEL["1h"]}</SelectItem>
                      <SelectItem value="24h">{TREND_WINDOW_LABEL["24h"]}</SelectItem>
                      <SelectItem value="7d">{TREND_WINDOW_LABEL["7d"]}</SelectItem>
                      <SelectItem value="30d">{TREND_WINDOW_LABEL["30d"]}</SelectItem>
                    </SelectContent>
                  </Select>
                  <CopyButton
                    sql={`-- Bucketed telemetry trends (${TREND_WINDOW_LABEL[trendWindow]})
SELECT * FROM public.telemetry_bucketed('${trendWindow}')
ORDER BY exercise_slug, bucket_start;`}
                  />
                </div>
              </div>

              {trendsQuery.isLoading && (
                <div className="text-sm text-muted-foreground py-6 text-center">Loading trend data…</div>
              )}
              {!trendsQuery.isLoading && trendSeries.size === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No telemetry in this window yet.
                </div>
              )}

              <div className="space-y-2">
                {Array.from(trendSeries.entries())
                  .map(([slug, points]) => {
                    const direction = classifyTrend(points);
                    const last = [...points].reverse().find((p) => p.total > 0) || points[points.length - 1];
                    return { slug, points, direction, last };
                  })
                  // Worst / most-broken first, then declining, then stable, then improving
                  .sort((a, b) => {
                    const order: Record<TrendDirection, number> = {
                      broken: 0, declining: 1, "no-data": 2, stable: 3, improving: 4,
                    };
                    if (order[a.direction] !== order[b.direction]) return order[a.direction] - order[b.direction];
                    return (a.last?.score ?? 100) - (b.last?.score ?? 100);
                  })
                  .map(({ slug, points, direction, last }) => {
                    const expanded = expandedTrendSlug === slug;
                    return (
                      <div key={`trend-${slug}`} className="border rounded-md">
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 text-left"
                          onClick={() => setExpandedTrendSlug(expanded ? null : slug)}
                        >
                          {expanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          <code className="font-mono text-xs flex-1">{slug}</code>
                          <span
                            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${trendChipClass(direction)}`}
                          >
                            <TrendIcon d={direction} />
                            {direction}
                          </span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            latest:{" "}
                            <span className={`font-mono font-semibold ${last ? scoreColorClass(last.score) : ""}`}>
                              {last && last.total > 0 ? last.score : "—"}
                            </span>
                          </span>
                          <HealthSparkline points={points.slice(-12)} width={120} height={28} />
                        </button>
                        {expanded && <TrendDetailChart points={points} window={trendWindow} />}
                      </div>
                    );
                  })}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="coverage" className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">1 · Error-type coverage by exercise</h3>
                <CopyButton sql={sqlErrorCoverage} />
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Red if &lt; 95%. Click a row to drill into raw events, inputs, outputs, and adaptation decisions.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 px-2">exercise_slug</th>
                      <th className="py-2 px-2 text-right">trials</th>
                      <th className="py-2 px-2 text-right">error_type %</th>
                      <th className="py-2 px-2 text-right">adaptations_active %</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No trials in window</td></tr>
                    )}
                    {coverage.map((r) => (
                      <tr
                        key={`cov-${r.slug}`}
                        className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                        onClick={() => setDrillSlug(r.slug)}
                      >
                        <td className="py-2 px-2 font-mono text-xs">{r.slug}</td>
                        <td className="py-2 px-2 text-right font-mono">{r.total}</td>
                        <td className="py-2 px-2 text-right">
                          <PctCell value={r.errorPct} threshold={95} />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <PctCell value={r.adaptPct} threshold={80} />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Search className="w-3.5 h-3.5 text-muted-foreground inline" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <CopyButton sql={sqlAdaptCoverage} label="Copy adaptations SQL" />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="adaptations">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Recent adaptation_events ({(adaptQuery.data || []).length})
                </h3>
                <CopyButton sql={sqlAdaptEvents} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 px-2">when</th>
                      <th className="py-2 px-2">exercise</th>
                      <th className="py-2 px-2">type</th>
                      <th className="py-2 px-2">before → after</th>
                      <th className="py-2 px-2">trigger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(adaptQuery.data || []).length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No adaptation events in window</td></tr>
                    )}
                    {(adaptQuery.data || []).map((e: any, i: number) => (
                      <tr
                        key={i}
                        className="border-b last:border-0 align-top hover:bg-muted/40 cursor-pointer"
                        onClick={() => e.exercise_slug && setDrillSlug(e.exercise_slug)}
                      >
                        <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">{e.exercise_slug || "—"}</td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="text-xs">{e.adaptation_type}</Badge>
                        </td>
                        <td className="py-2 px-2 text-xs font-mono">
                          <span className="text-muted-foreground">{JSON.stringify(e.value_before)}</span>
                          <span className="mx-1">→</span>
                          <span>{JSON.stringify(e.value_after)}</span>
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground max-w-xs truncate" title={e.trigger_condition || ""}>
                          {e.trigger_condition || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="signals">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Recent clinical_signal rows ({clinicalSignals.length})</h3>
                <CopyButton sql={sqlClinicalSignals} />
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Pulled from <code>exercise_events.outputs.clinical_signal</code> (LLM scorer output).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 px-2">when</th>
                      <th className="py-2 px-2">exercise</th>
                      <th className="py-2 px-2">errorType</th>
                      <th className="py-2 px-2 text-right">success</th>
                      <th className="py-2 px-2">recommend</th>
                      <th className="py-2 px-2">source</th>
                      <th className="py-2 px-2">model</th>
                      <th className="py-2 px-2">prompt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinicalSignals.length === 0 && (
                      <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No clinical_signal rows in window</td></tr>
                    )}
                    {clinicalSignals.map((s, i) => (
                      <tr
                        key={i}
                        className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                        onClick={() => s.exercise_slug && setDrillSlug(s.exercise_slug)}
                      >
                        <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">{s.exercise_slug || "—"}</td>
                        <td className="py-2 px-2 text-xs">{s.errorType || "—"}</td>
                        <td className="py-2 px-2 text-right font-mono text-xs">
                          {s.successScore !== null ? s.successScore.toFixed(2) : "—"}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {s.recommendedAdaptation ? (
                            <Badge variant="outline" className="text-[10px]">{s.recommendedAdaptation}</Badge>
                          ) : "—"}
                        </td>
                        <td className="py-2 px-2 text-xs">{s.source || "—"}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">{s.model || "—"}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">{s.promptVersion || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center">
          Internal diagnostic. Numbers reflect what is currently persisted to the database in the selected window.
        </p>
      </div>

      {/* Drill-down panel */}
      <ExerciseDrilldown
        slug={drillSlug}
        since={since}
        onClose={() => setDrillSlug(null)}
      />
    </div>
  );
}

// =====================================================================
// Drill-down sheet
// =====================================================================

function ExerciseDrilldown({
  slug,
  since,
  onClose,
}: {
  slug: string | null;
  since: string;
  onClose: () => void;
}) {
  const open = !!slug;

  const eventsQ = useQuery({
    queryKey: ["telemetry-drill-events", slug, since],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_events")
        .select("id, created_at, error_type, score, cue_level, reaction_time_ms, adaptations_active, inputs, outputs, exercise_slug, session_id, trial_index")
        .eq("exercise_slug", slug!)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const adaptQ = useQuery({
    queryKey: ["telemetry-drill-adapt", slug, since],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adaptation_events")
        .select("id, created_at, adaptation_type, value_before, value_after, trigger_condition, trigger_type, layer, evidence, confidence, trial_index")
        .eq("exercise_slug", slug!)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            <code className="font-mono text-base">{slug}</code>
          </SheetTitle>
          <SheetDescription>
            Most recent events &amp; adaptation decisions in the selected window.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="events" className="mt-4">
          <TabsList>
            <TabsTrigger value="events">Events ({eventsQ.data?.length || 0})</TabsTrigger>
            <TabsTrigger value="adapt">Adaptations ({adaptQ.data?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-2 mt-3">
            {eventsQ.isLoading && <div className="text-sm text-muted-foreground p-4">Loading…</div>}
            {!eventsQ.isLoading && (eventsQ.data?.length || 0) === 0 && (
              <div className="text-sm text-muted-foreground p-4">No events.</div>
            )}
            {(eventsQ.data || []).map((e: any) => (
              <Card key={e.id} className="p-3 text-xs">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    {e.trial_index !== null && <> · trial {e.trial_index}</>}
                  </span>
                  <div className="flex gap-1.5">
                    {e.error_type ? (
                      <Badge variant="outline" className="text-[10px]">{e.error_type}</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">no error_type</Badge>
                    )}
                    {typeof e.score === "number" && (
                      <Badge variant="secondary" className="text-[10px]">score {e.score}</Badge>
                    )}
                    {typeof e.cue_level === "number" && (
                      <Badge variant="secondary" className="text-[10px]">cue {e.cue_level}</Badge>
                    )}
                  </div>
                </div>
                <details className="mb-1">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">inputs</summary>
                  <pre className="bg-muted/50 p-2 rounded mt-1 overflow-x-auto text-[10px] leading-relaxed">
                    {JSON.stringify(e.inputs, null, 2)}
                  </pre>
                </details>
                <details className="mb-1">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">outputs</summary>
                  <pre className="bg-muted/50 p-2 rounded mt-1 overflow-x-auto text-[10px] leading-relaxed">
                    {JSON.stringify(e.outputs, null, 2)}
                  </pre>
                </details>
                <details>
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">adaptations_active</summary>
                  <pre className="bg-muted/50 p-2 rounded mt-1 overflow-x-auto text-[10px] leading-relaxed">
                    {JSON.stringify(e.adaptations_active, null, 2)}
                  </pre>
                </details>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="adapt" className="space-y-2 mt-3">
            {adaptQ.isLoading && <div className="text-sm text-muted-foreground p-4">Loading…</div>}
            {!adaptQ.isLoading && (adaptQ.data?.length || 0) === 0 && (
              <div className="text-sm text-muted-foreground p-4">No adaptation events.</div>
            )}
            {(adaptQ.data || []).map((a: any) => (
              <Card key={a.id} className="p-3 text-xs">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    {a.trial_index !== null && <> · trial {a.trial_index}</>}
                  </span>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{a.adaptation_type}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{a.layer}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{a.confidence}</Badge>
                  </div>
                </div>
                <div className="font-mono text-[11px] mb-1">
                  <span className="text-muted-foreground">{JSON.stringify(a.value_before)}</span>
                  <span className="mx-1">→</span>
                  <span className="font-semibold">{JSON.stringify(a.value_after)}</span>
                </div>
                {a.trigger_condition && (
                  <div className="text-muted-foreground">
                    trigger: <code className="text-[10px]">{a.trigger_condition}</code>
                  </div>
                )}
                <details className="mt-1">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">evidence</summary>
                  <pre className="bg-muted/50 p-2 rounded mt-1 overflow-x-auto text-[10px] leading-relaxed">
                    {JSON.stringify(a.evidence, null, 2)}
                  </pre>
                </details>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// =====================================================================
// Trend detail chart — health score + components + adaptation event markers
// =====================================================================

function TrendDetailChart({
  points,
  window: trendWindow,
}: {
  points: TrendPoint[];
  window: TrendWindow;
}) {
  if (points.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No data.</div>;
  }
  // Pre-format x labels per window
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (trendWindow === "1h" || trendWindow === "24h") return format(d, "HH:mm");
    return format(d, "MMM d");
  };
  const data = points.map((p) => ({
    label: fmt(p.bucket_start),
    bucket_start: p.bucket_start,
    score: p.total > 0 ? p.score : null,
    errorPct: p.total > 0 ? Math.round(p.errorPct) : null,
    adaptPct: p.total > 0 ? Math.round(p.adaptPct) : null,
    signalPct: p.isScored && p.total > 0 ? Math.round(p.signalPct) : null,
    adaptEvents: p.adaptEvents,
    total: p.total,
  }));

  // Adaptation-event markers: place a dot at score line for buckets with events
  const eventMarkers = data.filter((d) => d.adaptEvents > 0 && d.score !== null);

  const isScored = points.some((p) => p.isScored);

  return (
    <div className="border-t p-3 bg-muted/20">
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={32} />
            <RTooltip
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
              formatter={(value: any, name: string) => [value === null ? "—" : value, name]}
              labelFormatter={(_, payload) => {
                const p = payload && payload[0]?.payload;
                if (!p) return "";
                const d = new Date(p.bucket_start);
                return `${format(d, "MMM d, HH:mm")} · ${p.total} trial${p.total === 1 ? "" : "s"}${p.adaptEvents ? ` · ${p.adaptEvents} adapt event${p.adaptEvents === 1 ? "" : "s"}` : ""}`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone" dataKey="score" name="health score"
              stroke="hsl(var(--primary))" strokeWidth={2}
              dot={{ r: 2 }} connectNulls
            />
            <Line
              type="monotone" dataKey="errorPct" name="error_type %"
              stroke="hsl(220 70% 55%)" strokeWidth={1.5}
              dot={false} strokeDasharray="4 2" connectNulls
            />
            <Line
              type="monotone" dataKey="adaptPct" name="adaptations_active %"
              stroke="hsl(160 65% 45%)" strokeWidth={1.5}
              dot={false} strokeDasharray="4 2" connectNulls
            />
            {isScored && (
              <Line
                type="monotone" dataKey="signalPct" name="clinical_signal %"
                stroke="hsl(280 60% 55%)" strokeWidth={1.5}
                dot={false} strokeDasharray="4 2" connectNulls
              />
            )}
            {eventMarkers.map((d, i) => (
              <ReferenceDot
                key={`evt-${i}`}
                x={d.label}
                y={d.score ?? 0}
                r={4}
                fill="hsl(35 90% 55%)"
                stroke="white"
                strokeWidth={1}
                ifOverflow="extendDomain"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1 flex-wrap">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "hsl(35 90% 55%)" }} />
          adaptation_event
        </span>
        <span>·</span>
        <span>solid = health score · dashed = component coverage</span>
        <span>·</span>
        <span>gaps = no trials in that bucket</span>
      </div>
    </div>
  );
}
