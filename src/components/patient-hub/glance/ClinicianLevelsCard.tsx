/**
 * Clinician Glance — Card 5: Levels / Adaptation
 * Answers: "Where is the engine putting them, and is it appropriate?"
 *
 * Per-exercise: current level, direction, success-band check (target 65–80% Core),
 * and cue-dependency badge if escalation was blocked.
 */
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, ArrowRight, Layers, ShieldAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props { userId: string; profileId?: string; }

interface Row {
  slug: string;
  level: number;
  trials: number;
  direction: "up" | "down" | "flat";
  successRate: number | null;
  cueBlocked: boolean;
  cueDependency: number | null;
}

const PRETTY: Record<string, string> = {
  "photo-naming": "Naming",
  "photo_naming": "Naming",
  "two-clues": "Two Clues",
  "category-fluency": "Category Fluency",
  "sentence-construction": "Sentences",
  "narrative-retell": "Narrative Retell",
  "describe-guess": "Describe & Guess",
  "minimal-pairs": "Minimal Pairs",
  "phonological": "Phonology",
  "synonym-generator": "Synonyms",
  "meaning-match": "Meaning Match",
  "fix-sentence": "Fix the Sentence",
  "semantic-feature": "Semantic Features",
  "abstract-compare": "Compare & Contrast",
  "multi-step-plan": "Multi-Step Plan",
  "thought-continuation": "Thought Continuation",
  "conversation-coach": "Conversation Coach",
  "conversation-partner": "Conversation Partner",
  "detective-mind": "Detective Mind",
  "dual-load-naming": "Dual-Load Naming",
  "pattern-match": "Pattern Match",
};
function pretty(s: string) {
  return PRETTY[s] || s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Therapy Arc Core target band: 65–80%
function bandLabel(rate: number | null): { text: string; color: string } | null {
  if (rate === null) return null;
  const pct = Math.round(rate * 100);
  if (pct < 55) return { text: `${pct}% — too hard`, color: "text-amber-700 border-amber-500/30" };
  if (pct > 90) return { text: `${pct}% — too easy`, color: "text-amber-700 border-amber-500/30" };
  return { text: `${pct}% in band`, color: "text-emerald-700 border-emerald-500/30" };
}

export function ClinicianLevelsCard({ userId, profileId }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();

      let sessionIds: string[] | null = null;
      if (profileId) {
        const { data: sessRows } = await supabase
          .from("sessions")
          .select("id")
          .eq("user_id", userId)
          .eq("profile_id", profileId)
          .gte("started_at", since);
        sessionIds = (sessRows || []).map((s) => s.id);
        if (sessionIds.length === 0) {
          if (mounted) { setRows([]); setLoading(false); }
          return;
        }
      }

      let q = supabase
        .from("adaptation_trial_logs")
        .select("exercise_slug, difficulty, difficulty_change_direction, success_rate, cue_dependency, escalation_blocked, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (sessionIds) q = q.in("session_id", sessionIds);
      const { data } = await q;

      if (!mounted) return;
      const map = new Map<string, { latest?: any; trials: number; lastDir?: string; blocked: boolean }>();
      for (const r of (data || []) as any[]) {
        const slug = r.exercise_slug;
        if (!slug) continue;
        const cur = map.get(slug) || { trials: 0, blocked: false };
        if (!cur.latest) {
          cur.latest = r;
          if (r.difficulty_change_direction && r.difficulty_change_direction !== "none") {
            cur.lastDir = r.difficulty_change_direction;
          }
        } else if (!cur.lastDir && r.difficulty_change_direction && r.difficulty_change_direction !== "none") {
          cur.lastDir = r.difficulty_change_direction;
        }
        if (r.escalation_blocked) cur.blocked = true;
        cur.trials += 1;
        map.set(slug, cur);
      }

      const list: Row[] = Array.from(map.entries())
        .map(([slug, v]) => ({
          slug,
          level: v.latest?.difficulty ?? 1,
          trials: v.trials,
          direction: (v.lastDir === "up" ? "up" : v.lastDir === "down" ? "down" : "flat") as Row["direction"],
          successRate: v.latest?.success_rate ?? null,
          cueBlocked: v.blocked,
          cueDependency: v.latest?.cue_dependency ?? null,
        }))
        .sort((a, b) => b.trials - a.trials)
        .slice(0, 5);

      setRows(list);
      setLoading(false);
    };
    run();
    return () => { mounted = false; };
  }, [userId, profileId]);


  const dirStyle = {
    up: { Icon: ArrowUp, color: "text-emerald-600 bg-emerald-500/10", verb: "Up" },
    down: { Icon: ArrowDown, color: "text-amber-600 bg-amber-500/10", verb: "Down" },
    flat: { Icon: ArrowRight, color: "text-muted-foreground bg-muted", verb: "Hold" },
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
          Adaptation · Levels
        </div>
        <span className="text-[10px] text-muted-foreground">target band 65–80%</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-muted/40 rounded animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center text-center py-3 text-muted-foreground">
          <Layers className="w-6 h-6 mb-1.5 opacity-60" />
          <div className="text-sm">No adaptation data in window.</div>
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => {
            const ds = dirStyle[r.direction];
            const band = bandLabel(r.successRate);
            return (
              <div key={r.slug} className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{pretty(r.slug)}</span>
                    <span className="text-[11px] text-muted-foreground">L{r.level}</span>
                    {r.cueBlocked && (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-[10px] font-normal text-amber-700 border-amber-500/30 gap-1 cursor-help">
                              <ShieldAlert className="w-2.5 h-2.5" />
                              cue gate
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-xs">
                            Patient required cues to maintain success — level not increased.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {band && (
                      <Badge variant="outline" className={`text-[10px] font-normal ${band.color}`}>
                        {band.text}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {r.trials} trial{r.trials === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${ds.color} shrink-0`}
                  title={ds.verb}
                >
                  <ds.Icon className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
