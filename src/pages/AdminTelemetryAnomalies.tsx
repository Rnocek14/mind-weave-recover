import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type Severity = "info" | "warn" | "error";

interface Anomaly {
  id: string;
  rule_id: string;
  severity: string;
  scope: string;
  exercise_slug: string | null;
  session_id: string | null;
  user_id: string | null;
  trial_log_id: string | null;
  observed: unknown;
  expected: unknown;
  checklist_version: string | null;
  detector_run_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface DetectorRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  trials_scanned: number | null;
  anomalies_written: number | null;
  anomalies_skipped_dup: number | null;
  checklist_version: string | null;
  notes: string | null;
}

const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warn: "outline",
  error: "destructive",
};

export default function AdminTelemetryAnomalies() {
  const [runs, setRuns] = useState<DetectorRun[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [rule, setRule] = useState<string>("all");
  const [slug, setSlug] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [runsRes, anomRes] = await Promise.all([
      supabase
        .from("adaptation_anomaly_detector_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20),
      supabase
        .from("adaptation_trial_log_anomalies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    setRuns((runsRes.data ?? []) as DetectorRun[]);
    setAnomalies((anomRes.data ?? []) as Anomaly[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const ruleIds = useMemo(
    () => Array.from(new Set(anomalies.map((a) => a.rule_id))).sort(),
    [anomalies]
  );
  const slugs = useMemo(
    () => Array.from(new Set(anomalies.map((a) => a.exercise_slug).filter(Boolean) as string[])).sort(),
    [anomalies]
  );

  const filtered = useMemo(() => anomalies.filter((a) => {
    if (severity !== "all" && a.severity !== severity) return false;
    if (rule !== "all" && a.rule_id !== rule) return false;
    if (slug !== "all" && a.exercise_slug !== slug) return false;
    return true;
  }), [anomalies, severity, rule, slug]);

  const counts = useMemo(() => {
    const bySev = { info: 0, warn: 0, error: 0 } as Record<string, number>;
    const byRule = new Map<string, { rule_id: string; severity: string; count: number }>();
    for (const a of filtered) {
      bySev[a.severity] = (bySev[a.severity] ?? 0) + 1;
      const k = a.rule_id;
      const cur = byRule.get(k) ?? { rule_id: a.rule_id, severity: a.severity, count: 0 };
      cur.count += 1;
      byRule.set(k, cur);
    }
    const ruleRows = Array.from(byRule.values()).sort((a, b) => b.count - a.count);
    return { bySev, ruleRows, total: filtered.length };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link to="/admin"><ChevronLeft className="w-4 h-4 mr-2" />Back to Admin</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-1">Telemetry Anomalies</h1>
          <p className="text-muted-foreground text-sm">
            Read-only view of detector output. Source of truth: <code>docs/telemetry-validation-checklist.md</code>.
            No enforcement, no gating.
          </p>
        </div>

        {/* Severity counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Total (filtered)</div>
            <div className="text-2xl font-semibold">{counts.total}</div>
          </Card>
          {(["error", "warn", "info"] as Severity[]).map((s) => (
            <Card key={s} className="p-4">
              <div className="text-xs text-muted-foreground capitalize">{s}</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-semibold">{counts.bySev[s] ?? 0}</div>
                <Badge variant={SEVERITY_VARIANT[s]} className="capitalize">{s}</Badge>
              </div>
            </Card>
          ))}
        </div>

        {/* Recent runs */}
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Recent detector runs</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead className="text-right">Trials scanned</TableHead>
                  <TableHead className="text-right">Written</TableHead>
                  <TableHead className="text-right">Skipped (dup)</TableHead>
                  <TableHead>Checklist</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm">No runs yet</TableCell></TableRow>
                )}
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.started_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{r.finished_at ? new Date(r.finished_at).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.trials_scanned ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.anomalies_written ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.anomalies_skipped_dup ?? 0}</TableCell>
                    <TableCell className="text-xs">{r.checklist_version ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Counts by rule */}
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Counts by rule</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {counts.ruleRows.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">No anomalies match filters</TableCell></TableRow>
                )}
                {counts.ruleRows.map((r) => (
                  <TableRow key={r.rule_id}>
                    <TableCell className="font-mono text-xs">{r.rule_id}</TableCell>
                    <TableCell><Badge variant={SEVERITY_VARIANT[r.severity] ?? "secondary"} className="capitalize">{r.severity}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Severity</label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as Severity | "all")}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Rule</label>
              <Select value={rule} onValueChange={setRule}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {ruleIds.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Exercise slug</label>
              <Select value={slug} onValueChange={setSlug}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {slugs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(severity !== "all" || rule !== "all" || slug !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSeverity("all"); setRule("all"); setSlug("all"); }}>
                Clear filters
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Observed</TableHead>
                  <TableHead>Expected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm">Loading…</TableCell></TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm">No anomalies</TableCell></TableRow>
                )}
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{a.rule_id}</TableCell>
                    <TableCell><Badge variant={SEVERITY_VARIANT[a.severity] ?? "secondary"} className="capitalize">{a.severity}</Badge></TableCell>
                    <TableCell className="text-xs">{a.scope}</TableCell>
                    <TableCell className="text-xs">{a.exercise_slug ?? "—"}</TableCell>
                    <TableCell className="font-mono text-[11px] max-w-[220px] truncate" title={JSON.stringify(a.observed)}>
                      {JSON.stringify(a.observed)}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] max-w-[220px] truncate" title={JSON.stringify(a.expected)}>
                      {JSON.stringify(a.expected)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Showing latest 500 anomalies. Filters apply client-side.
          </p>
        </Card>
      </div>
    </div>
  );
}
