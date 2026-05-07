import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface TrialLog {
  id: string;
  created_at: string;
  trial_index: number;
  exercise_slug: string;
  difficulty: number;
  cue_level: number | null;
  cue_dependency: number | null;
  correct: boolean | null;
  reaction_time_ms: number | null;
  trial_mode: string | null;
  signal_granularity: string | null;
  graded_score: number | null;
  archetype: string | null;
  dominant_axis: string | null;
  scaffold_level: number | null;
  score_vector: unknown;
  trials_at_level: number | null;
  difficulty_change_direction: string | null;
  difficulty_change_from: number | null;
  difficulty_change_to: number | null;
  difficulty_change_reason: string | null;
  narration: string | null;
  escalation_blocked: boolean;
  escalation_block_reason: string | null;
  recommended_action: string | null;
  frustration: string | null;
  fatigue: string | null;
  success_rate: number | null;
}

interface Anomaly {
  id: string;
  rule_id: string;
  severity: string;
  scope: string;
  exercise_slug: string | null;
  trial_log_id: string | null;
  observed: unknown;
  expected: unknown;
  checklist_version: string | null;
  created_at: string;
}

const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warn: "outline",
  error: "destructive",
};

export default function AdminTelemetryAnomalySession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [trials, setTrials] = useState<TrialLog[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const [tRes, aRes] = await Promise.all([
        supabase
          .from("adaptation_trial_logs")
          .select("*")
          .eq("session_id", sessionId)
          .order("trial_index", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("adaptation_trial_log_anomalies")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true }),
      ]);
      if (!alive) return;
      setTrials((tRes.data ?? []) as TrialLog[]);
      setAnomalies((aRes.data ?? []) as Anomaly[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [sessionId]);

  const anomaliesByTrial = useMemo(() => {
    const m = new Map<string, Anomaly[]>();
    for (const a of anomalies) {
      if (!a.trial_log_id) continue;
      const arr = m.get(a.trial_log_id) ?? [];
      arr.push(a);
      m.set(a.trial_log_id, arr);
    }
    return m;
  }, [anomalies]);

  const sessionScopeAnomalies = useMemo(
    () => anomalies.filter((a) => !a.trial_log_id),
    [anomalies],
  );

  const summary = useMemo(() => {
    const total = trials.length;
    const correct = trials.filter((t) => t.correct === true).length;
    const slugs = Array.from(new Set(trials.map((t) => t.exercise_slug)));
    const start = trials[0];
    const end = trials[trials.length - 1];
    return {
      total,
      correct,
      accuracy: total ? correct / total : 0,
      slugs,
      startedAt: start?.created_at ?? null,
      endedAt: end?.created_at ?? null,
      anomalyCount: anomalies.length,
    };
  }, [trials, anomalies]);

  return (
    <div className="min-h-screen bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link to="/admin/telemetry-anomalies">
              <ChevronLeft className="w-4 h-4 mr-2" />Back to anomalies
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-1">Session drill-down</h1>
          <p className="text-muted-foreground text-xs font-mono">{sessionId}</p>
          <p className="text-muted-foreground text-sm mt-1">
            Read-only timeline of trial logs and anomalies for this session.
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Trials</div>
            <div className="text-2xl font-semibold">{summary.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Correct</div>
            <div className="text-2xl font-semibold">{summary.correct}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Accuracy</div>
            <div className="text-2xl font-semibold">{(summary.accuracy * 100).toFixed(0)}%</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Anomalies</div>
            <div className="text-2xl font-semibold flex items-center gap-2">
              {summary.anomalyCount}
              {summary.anomalyCount > 0 && <AlertTriangle className="w-4 h-4 text-destructive" />}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Exercises</div>
            <div className="text-sm font-mono break-words">{summary.slugs.join(", ") || "—"}</div>
          </Card>
        </div>

        {/* Session-scope anomalies (no trial_log_id) */}
        {sessionScopeAnomalies.length > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Session-scope anomalies</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Observed</TableHead>
                  <TableHead>Expected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionScopeAnomalies.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        to={`/admin/telemetry-anomalies?rule=${a.rule_id}`}
                        className="text-primary hover:underline"
                        title={`See all ${a.rule_id} anomalies`}
                      >
                        {a.rule_id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to={`/admin/telemetry-anomalies?severity=${a.severity}`}>
                        <Badge variant={SEVERITY_VARIANT[a.severity] ?? "secondary"} className="capitalize cursor-pointer">
                          {a.severity}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{a.scope}</TableCell>
                    <TableCell className="font-mono text-[11px] max-w-[260px] truncate" title={JSON.stringify(a.observed)}>
                      {JSON.stringify(a.observed)}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] max-w-[260px] truncate" title={JSON.stringify(a.expected)}>
                      {JSON.stringify(a.expected)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Trial timeline */}
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Trial timeline</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading trials…
            </div>
          ) : trials.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No trial logs for this session.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Diff</TableHead>
                    <TableHead className="text-right">Cue</TableHead>
                    <TableHead className="text-right">Scaffold</TableHead>
                    <TableHead>Correct</TableHead>
                    <TableHead className="text-right">Graded</TableHead>
                    <TableHead className="text-right">RT (ms)</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Anomalies</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trials.map((t) => {
                    const trialAnoms = anomaliesByTrial.get(t.id) ?? [];
                    const hasError = trialAnoms.some((a) => a.severity === "error");
                    const hasWarn = trialAnoms.some((a) => a.severity === "warn");
                    return (
                      <TableRow
                        key={t.id}
                        className={
                          hasError
                            ? "bg-destructive/5"
                            : hasWarn
                            ? "bg-muted/40"
                            : undefined
                        }
                      >
                        <TableCell className="tabular-nums text-xs">{t.trial_index}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(t.created_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{t.exercise_slug}</TableCell>
                        <TableCell className="text-xs">{t.trial_mode ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{t.difficulty}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{t.cue_level ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{t.scaffold_level ?? "—"}</TableCell>
                        <TableCell>
                          {t.correct === true ? (
                            <Badge variant="secondary" className="text-[10px]">✓</Badge>
                          ) : t.correct === false ? (
                            <Badge variant="destructive" className="text-[10px]">✗</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {t.graded_score != null ? Number(t.graded_score).toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {t.reaction_time_ms ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {t.difficulty_change_direction ? (
                            <span
                              title={t.difficulty_change_reason ?? ""}
                              className={
                                t.escalation_blocked
                                  ? "text-muted-foreground"
                                  : t.difficulty_change_direction === "up"
                                  ? "text-primary"
                                  : "text-destructive"
                              }
                            >
                              {t.difficulty_change_from}→{t.difficulty_change_to}
                              {t.escalation_blocked ? " (blocked)" : ""}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {trialAnoms.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {trialAnoms.map((a) => (
                                <Badge
                                  key={a.id}
                                  variant={SEVERITY_VARIANT[a.severity] ?? "secondary"}
                                  className="text-[10px] font-mono"
                                  title={`${a.rule_id}\nObserved: ${JSON.stringify(a.observed)}\nExpected: ${JSON.stringify(a.expected)}`}
                                >
                                  {a.rule_id}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            Read-only. Hover an anomaly badge for observed/expected. Row tint indicates highest severity.
          </p>
        </Card>
      </div>
    </div>
  );
}
