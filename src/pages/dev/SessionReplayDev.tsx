import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { SimulationChart } from '@/components/dev/SimulationChart';
import type { TrialLogEntry } from '@/lib/simulation/sessionSimulator';
import { useAuth } from '@/hooks/useAuth';

interface TrialRow {
  id: string;
  user_id: string;
  session_id: string | null;
  exercise_slug: string;
  trial_index: number;
  difficulty: number;
  cue_level: number | null;
  cue_dependency: number | null;
  success_rate: number | null;
  correct: boolean | null;
  reaction_time_ms: number | null;
  frustration: string | null;
  fatigue: string | null;
  recommended_action: string | null;
  trials_at_level: number | null;
  difficulty_change_direction: string | null;
  difficulty_change_from: number | null;
  difficulty_change_to: number | null;
  difficulty_change_reason: string | null;
  narration: string | null;
  escalation_blocked: boolean;
  escalation_block_reason: string | null;
  created_at: string;
}

interface AnomalyRow {
  id: string;
  trial_index: number | null;
  exercise_slug: string | null;
  anomaly_type: string;
  severity: string;
  detail: string | null;
  evidence: any;
  created_at: string;
}

/**
 * Phase 4 — Real session replay.
 * Pulls live `adaptation_trial_logs` and renders the same chart as the
 * simulation harness, plus the adaptation event log and any anomalies.
 *
 * Routes:
 *   /dev/session-replay                — input session id
 *   /dev/session-replay/:sessionId     — direct
 */
export default function SessionReplayDev() {
  const params = useParams<{ sessionId?: string }>();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string>(params.sessionId ?? search.get('sessionId') ?? '');
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [recent, setRecent] = useState<{ session_id: string; exercise_slug: string; cnt: number; last: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch a list of recent sessions so the user can pick one.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('adaptation_trial_logs' as any)
        .select('session_id, exercise_slug, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (!data) return;
      const grouped = new Map<string, { session_id: string; exercise_slug: string; cnt: number; last: string }>();
      for (const r of data as any[]) {
        const sid = r.session_id ?? '(no-session)';
        const key = `${sid}::${r.exercise_slug}`;
        const g = grouped.get(key);
        if (g) g.cnt += 1;
        else grouped.set(key, { session_id: sid, exercise_slug: r.exercise_slug, cnt: 1, last: r.created_at });
      }
      setRecent(Array.from(grouped.values()).slice(0, 25));
    })();
  }, [user?.id]);

  const load = async (sid: string) => {
    if (!sid) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: e1 } = await supabase
        .from('adaptation_trial_logs' as any)
        .select('*')
        .eq('session_id', sid)
        .order('trial_index', { ascending: true });
      if (e1) throw e1;
      setRows((data ?? []) as unknown as TrialRow[]);
      const { data: a } = await supabase
        .from('adaptation_anomalies' as any)
        .select('*')
        .eq('session_id', sid)
        .order('created_at', { ascending: true });
      setAnomalies((a ?? []) as unknown as AnomalyRow[]);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      load(sessionId);
      setSearch({ sessionId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Map DB rows → simulator TrialLogEntry so we can reuse SimulationChart.
  const log: TrialLogEntry[] = useMemo(() => {
    return rows.map((r) => ({
      trialIndex: r.trial_index,
      difficulty: r.difficulty,
      cueLevelUsed: r.cue_level ?? 0,
      correct: !!r.correct,
      reactionTimeMs: r.reaction_time_ms ?? 0,
      timeout: false,
      successRate: r.success_rate ?? 0,
      cueDependency: r.cue_dependency ?? 0,
      frustration: r.frustration ?? 'none',
      fatigue: r.fatigue ?? 'none',
      recommendedAction: r.recommended_action ?? 'continue',
      trialsAtLevel: r.trials_at_level ?? 0,
      difficultyChange: r.difficulty_change_direction
        ? {
            direction: r.difficulty_change_direction as 'up' | 'down',
            from: r.difficulty_change_from ?? r.difficulty,
            to: r.difficulty_change_to ?? r.difficulty,
            reason: r.difficulty_change_reason ?? '',
            narration: r.narration ?? '',
          }
        : undefined,
      escalationBlocked: r.escalation_blocked
        ? {
            reason: r.escalation_block_reason ?? '',
            cueDependencyScore: r.cue_dependency ?? 0,
            trialsAtLevel: r.trials_at_level ?? 0,
            level: r.difficulty,
          }
        : undefined,
    }));
  }, [rows]);

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const ups = rows.filter((r) => r.difficulty_change_direction === 'up').length;
    const downs = rows.filter((r) => r.difficulty_change_direction === 'down').length;
    const blocked = rows.filter((r) => r.escalation_blocked).length;
    const final = rows[rows.length - 1];
    return {
      trials: rows.length,
      ups,
      downs,
      blocked,
      finalDiff: final.difficulty,
      finalSR: final.success_rate ?? 0,
      finalCueDep: final.cue_dependency ?? 0,
      exercises: Array.from(new Set(rows.map((r) => r.exercise_slug))).join(', '),
    };
  }, [rows]);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Real Session Replay</h1>
        <p className="text-sm text-muted-foreground">
          Phase 4 validation. Renders live <code>adaptation_trial_logs</code> from a real session
          using the same chart as the simulation harness. Compare against{' '}
          <Link to="/dev/adaptation-sim" className="underline">/dev/adaptation-sim</Link>.
        </p>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Paste session_id…"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="max-w-md"
          />
          <Button onClick={() => load(sessionId)} disabled={!sessionId || loading}>
            {loading ? 'Loading…' : 'Load'}
          </Button>
        </div>
      </header>

      {recent.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Your recent logged sessions</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-xs space-y-1">
              {recent.map((r) => (
                <li key={`${r.session_id}-${r.exercise_slug}`}>
                  <button
                    className="underline text-primary"
                    onClick={() => setSessionId(r.session_id)}
                  >
                    {r.session_id.slice(0, 8)}…
                  </button>{' '}
                  · {r.exercise_slug} · {r.cnt} trials · {new Date(r.last).toLocaleString()}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{summary.exercises}</CardTitle>
            <p className="text-xs text-muted-foreground">{rows.length} trials in this session</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {[
                ['Trials', summary.trials],
                ['Final difficulty', summary.finalDiff],
                ['Up', summary.ups],
                ['Down', summary.downs],
                ['Blocked escalations', summary.blocked],
                ['Final success rate', `${(summary.finalSR * 100).toFixed(0)}%`],
                ['Final cue dependency', summary.finalCueDep.toFixed(2)],
                ['Anomalies', anomalies.length],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded border p-2">
                  <div className="text-muted-foreground text-xs">{k}</div>
                  <div className="font-medium">{v}</div>
                </div>
              ))}
            </div>

            <SimulationChart log={log} />

            <EventList log={log} />
            <AnomalyList anomalies={anomalies} />
          </CardContent>
        </Card>
      )}

      {!loading && rows.length === 0 && sessionId && (
        <p className="text-sm text-muted-foreground">No trial logs found for this session.</p>
      )}
    </div>
  );
}

function EventList({ log }: { log: TrialLogEntry[] }) {
  const events = log.filter((l) => l.difficultyChange || l.escalationBlocked);
  if (events.length === 0) return <div className="text-sm text-muted-foreground">No adaptation events.</div>;
  return (
    <div className="space-y-1">
      <div className="font-semibold text-sm">Adaptation events</div>
      <ul className="text-xs space-y-1 font-mono">
        {events.map((e) => (
          <li key={e.trialIndex} className="border-l-2 pl-2 border-muted">
            <span className="text-muted-foreground">t{e.trialIndex}:</span>{' '}
            {e.escalationBlocked ? (
              <span className="text-amber-700">
                BLOCKED · "{e.difficultyChange?.narration}" — {e.escalationBlocked.reason}
              </span>
            ) : (
              <span>
                {e.difficultyChange?.direction.toUpperCase()} {e.difficultyChange?.from}→
                {e.difficultyChange?.to} · "{e.difficultyChange?.narration}" ({e.difficultyChange?.reason})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnomalyList({ anomalies }: { anomalies: AnomalyRow[] }) {
  if (anomalies.length === 0) {
    return (
      <div className="text-sm">
        <Badge variant="default">No anomalies detected</Badge>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="font-semibold text-sm">Anomalies</div>
      <ul className="text-xs space-y-1">
        {anomalies.map((a) => (
          <li key={a.id} className="border-l-2 pl-2 border-destructive">
            <Badge variant={a.severity === 'critical' ? 'destructive' : 'secondary'} className="mr-2">
              {a.severity}
            </Badge>
            <span className="font-mono">t{a.trial_index} · {a.anomaly_type}</span> — {a.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
