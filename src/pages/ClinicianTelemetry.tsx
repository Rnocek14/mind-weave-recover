import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, Activity, AlertTriangle, CheckCircle2, Copy, Database, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type Window = "1h" | "24h" | "7d";

const WINDOW_LABEL: Record<Window, string> = {
  "1h": "Last 1 hour",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
};

function windowToTimestamp(w: Window): string {
  const ms =
    w === "1h" ? 60 * 60 * 1000 :
    w === "24h" ? 24 * 60 * 60 * 1000 :
    7 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
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

export default function ClinicianTelemetry() {
  const navigate = useNavigate();
  const [windowSel, setWindowSel] = useState<Window>("24h");
  const since = useMemo(() => windowToTimestamp(windowSel), [windowSel]);

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
  });

  const coverage = useMemo(() => {
    const rows = eventsQuery.data || [];
    const map = new Map<string, { total: number; withErrorType: number; withAdaptations: number }>();
    for (const r of rows as any[]) {
      const slug = r.exercise_slug || "(unknown)";
      const cur = map.get(slug) || { total: 0, withErrorType: 0, withAdaptations: 0 };
      cur.total += 1;
      if (r.error_type !== null && r.error_type !== undefined && String(r.error_type).length > 0) {
        cur.withErrorType += 1;
      }
      const ad = r.adaptations_active;
      if (ad && typeof ad === "object" && Object.keys(ad).length > 0) {
        cur.withAdaptations += 1;
      }
      map.set(slug, cur);
    }
    return Array.from(map.entries())
      .map(([slug, v]) => ({
        slug,
        total: v.total,
        errorPct: pct(v.withErrorType, v.total),
        adaptPct: pct(v.withAdaptations, v.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [eventsQuery.data]);

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

  const refresh = () => {
    eventsQuery.refetch();
    adaptQuery.refetch();
  };

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

  return (
    <div className="min-h-screen bg-gradient-calm py-8 px-4">
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
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
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

        <Tabs defaultValue="coverage">
          <TabsList>
            <TabsTrigger value="coverage">Coverage</TabsTrigger>
            <TabsTrigger value="adaptations">Adaptation events</TabsTrigger>
            <TabsTrigger value="signals">Clinical signals</TabsTrigger>
          </TabsList>

          <TabsContent value="coverage" className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">1 · Error-type coverage by exercise</h3>
                <CopyButton sql={sqlErrorCoverage} />
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Red if &lt; 95%. Indicates trials where the centralized telemetry guard set <code>error_type</code>.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 px-2">exercise_slug</th>
                      <th className="py-2 px-2 text-right">trials</th>
                      <th className="py-2 px-2 text-right">error_type %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.length === 0 && (
                      <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">No trials in window</td></tr>
                    )}
                    {coverage.map((r) => (
                      <tr key={`et-${r.slug}`} className="border-b last:border-0">
                        <td className="py-2 px-2 font-mono text-xs">{r.slug}</td>
                        <td className="py-2 px-2 text-right font-mono">{r.total}</td>
                        <td className="py-2 px-2 text-right">
                          <PctCell value={r.errorPct} threshold={95} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">2 · adaptations_active coverage by exercise</h3>
                <CopyButton sql={sqlAdaptCoverage} />
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Red if &lt; 80%. Indicates trials carrying which adaptive parameters were active.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 px-2">exercise_slug</th>
                      <th className="py-2 px-2 text-right">trials</th>
                      <th className="py-2 px-2 text-right">adaptations_active %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.length === 0 && (
                      <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">No trials in window</td></tr>
                    )}
                    {coverage.map((r) => (
                      <tr key={`ad-${r.slug}`} className="border-b last:border-0">
                        <td className="py-2 px-2 font-mono text-xs">{r.slug}</td>
                        <td className="py-2 px-2 text-right font-mono">{r.total}</td>
                        <td className="py-2 px-2 text-right">
                          <PctCell value={r.adaptPct} threshold={80} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="adaptations">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  3 · Recent adaptation_events ({(adaptQuery.data || []).length})
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
                      <tr key={i} className="border-b last:border-0 align-top">
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
                <h3 className="font-semibold">4 · Recent clinical_signal rows ({clinicalSignals.length})</h3>
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
                      <tr key={i} className="border-b last:border-0">
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
    </div>
  );
}
