/**
 * Cue Response Panel — two parts:
 *   1. This session: stacked breakdown of how cues were answered.
 *   2. Across last 8 sessions: line of "% trials needing any cue" — the
 *      cue-fade trajectory, the strongest single recovery signal.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TrialData } from "@/hooks/useSessionDetail";
import { Lightbulb } from "lucide-react";

interface CueResponsePanelProps {
  trials: TrialData[];
  profileId: string | undefined;
}

const CUE_LABELS: Array<{ key: string; label: string; color: string }> = [
  { key: "no_cue_correct",  label: "Correct without cue",     color: "bg-emerald-500" },
  { key: "semantic_correct", label: "Correct after semantic",  color: "bg-sky-500" },
  { key: "phonemic_correct", label: "Correct after phonemic",  color: "bg-violet-500" },
  { key: "repetition_correct", label: "Correct after repetition", color: "bg-amber-500" },
  { key: "still_incorrect", label: "Still incorrect",          color: "bg-rose-500" },
];

function bucketCueOutcome(t: TrialData): string | null {
  // No cue given
  if (!t.cue_type_given) {
    if (t.is_correct === true) return "no_cue_correct";
    if (t.is_correct === false) return "still_incorrect";
    return null;
  }
  // Cue given
  const cueType = (t.cue_type_given || "").toLowerCase();
  if (t.cue_was_effective || t.is_correct === true) {
    if (cueType.includes("semantic")) return "semantic_correct";
    if (cueType.includes("phonem") || cueType.includes("phonological")) return "phonemic_correct";
    if (cueType.includes("repeat") || cueType.includes("repetition") || cueType.includes("model")) return "repetition_correct";
    return "semantic_correct"; // fallback
  }
  return "still_incorrect";
}

export function CueResponsePanel({ trials, profileId }: CueResponsePanelProps) {
  const [trajectory, setTrajectory] = useState<{ date: string; pct: number }[]>([]);
  const [trajLoading, setTrajLoading] = useState(true);

  // This-session breakdown
  const { counts, total } = useMemo(() => {
    const c: Record<string, number> = {};
    let n = 0;
    for (const t of trials) {
      const b = bucketCueOutcome(t);
      if (!b) continue;
      c[b] = (c[b] || 0) + 1;
      n += 1;
    }
    return { counts: c, total: n };
  }, [trials]);

  // Cue-fade across last 8 sessions
  useEffect(() => {
    if (!profileId) { setTrajLoading(false); return; }
    let cancelled = false;
    (async () => {
      setTrajLoading(true);
      const { data: sessRows } = await supabase
        .from("sessions")
        .select("id, started_at")
        .eq("profile_id", profileId)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(8);
      const sessions = (sessRows ?? []).slice().reverse();
      if (sessions.length === 0) {
        if (!cancelled) { setTrajectory([]); setTrajLoading(false); }
        return;
      }
      const ids = sessions.map((s) => s.id);
      const { data: events } = await supabase
        .from("exercise_events")
        .select("session_id, cue_type_given")
        .in("session_id", ids);
      const bySess = new Map<string, { total: number; cued: number }>();
      ids.forEach((id) => bySess.set(id, { total: 0, cued: 0 }));
      (events ?? []).forEach((e: any) => {
        const b = bySess.get(e.session_id);
        if (!b) return;
        b.total += 1;
        if (e.cue_type_given) b.cued += 1;
      });
      const out = sessions
        .map((s) => {
          const b = bySess.get(s.id)!;
          return {
            date: new Date(s.started_at).toLocaleDateString(undefined, {
              month: "numeric", day: "numeric",
            }),
            pct: b.total > 0 ? Math.round((b.cued / b.total) * 100) : 0,
            hasData: b.total > 0,
          };
        })
        .filter((p) => p.hasData);
      if (!cancelled) { setTrajectory(out); setTrajLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [profileId]);

  return (
    <div className="space-y-4">
      {/* This session */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">This session</h4>
        </div>
        {total === 0 ? (
          <div className="text-sm text-muted-foreground">No scored attempts.</div>
        ) : (
          <>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
              {CUE_LABELS.map((c) => {
                const v = counts[c.key] || 0;
                if (v === 0) return null;
                return (
                  <div
                    key={c.key}
                    className={c.color}
                    style={{ width: `${(v / total) * 100}%` }}
                    title={`${c.label}: ${v}`}
                  />
                );
              })}
            </div>
            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {CUE_LABELS.map((c) => {
                const v = counts[c.key] || 0;
                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                return (
                  <li key={c.key} className="flex items-center gap-2 text-xs">
                    <span className={`inline-block w-2 h-2 rounded-sm ${c.color}`} />
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="ml-auto tabular-nums text-foreground">
                      {v} · {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Trajectory */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-1">
          Cue dependency · last {trajectory.length || 0} sessions
        </h4>
        <p className="text-xs text-muted-foreground mb-2">
          Lower trend = recovering independence.
        </p>
        {trajLoading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : trajectory.length < 2 ? (
          <div className="text-xs text-muted-foreground">
            Need at least 2 sessions to show a trajectory.
          </div>
        ) : (
          <Sparkline points={trajectory} />
        )}
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: { date: string; pct: number }[] }) {
  const W = 280, H = 60, P = 6;
  const xs = points.map((_, i) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1));
  const ys = points.map((p) => H - P - (p.pct / 100) * (H - 2 * P));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 block">
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="2" fill="hsl(var(--primary))" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{points[0].date} · {points[0].pct}%</span>
        <span>{points[points.length - 1].date} · {points[points.length - 1].pct}%</span>
      </div>
    </div>
  );
}
