/**
 * Glance Card 5 — Levels
 * Answers: "What level are they playing at?"
 * Top 3 active exercises with current difficulty + last direction (↑ ↓ →).
 */
import { Card } from "@/components/ui/card";
import { ArrowUp, ArrowDown, ArrowRight, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LevelsCardProps {
  userId: string;
}

interface LevelRow {
  slug: string;
  level: number;
  trials: number;
  direction: "up" | "down" | "flat";
}

const PRETTY: Record<string, string> = {
  "photo-naming": "Naming",
  "photo_naming": "Naming",
  "two-clues": "Two Clues",
  "category-fluency": "Category Fluency",
  "sentence-construction": "Sentences",
  "narrative-retell": "Storytelling",
  "describe-guess": "Describe & Guess",
  "minimal-pairs": "Minimal Pairs",
  "phonological": "Sounds",
  "synonym-generator": "Synonyms",
  "meaning-match": "Meaning Match",
  "fix-sentence": "Fix the Sentence",
  "semantic-feature": "Word Features",
  "abstract-compare": "Compare & Contrast",
  "multi-step-plan": "Multi-Step Plan",
  "thought-continuation": "Continue the Thought",
  "conversation-coach": "Conversation",
  "conversation-partner": "Conversation",
  "detective-mind": "Detective Mind",
  "dual-load-naming": "Dual Naming",
  "pattern-match": "Pattern Match",
};

function pretty(slug: string): string {
  return PRETTY[slug] || slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LevelsCard({ userId }: LevelsCardProps) {
  const [rows, setRows] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      const { data } = await supabase
        .from("adaptation_trial_logs")
        .select("exercise_slug, difficulty, difficulty_change_direction, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (!mounted) return;
      const byExercise = new Map<string, { latest?: any; trials: number; lastDir?: string }>();
      for (const r of (data || []) as any[]) {
        const slug = r.exercise_slug;
        if (!slug) continue;
        const cur = byExercise.get(slug) || { trials: 0 };
        if (!cur.latest) {
          cur.latest = r;
          if (r.difficulty_change_direction && r.difficulty_change_direction !== "none") {
            cur.lastDir = r.difficulty_change_direction;
          }
        } else if (!cur.lastDir && r.difficulty_change_direction && r.difficulty_change_direction !== "none") {
          cur.lastDir = r.difficulty_change_direction;
        }
        cur.trials += 1;
        byExercise.set(slug, cur);
      }

      const list: LevelRow[] = Array.from(byExercise.entries())
        .map(([slug, v]) => ({
          slug,
          level: v.latest?.difficulty ?? 1,
          trials: v.trials,
          direction: (v.lastDir === "up" ? "up" : v.lastDir === "down" ? "down" : "flat") as LevelRow["direction"],
        }))
        .sort((a, b) => b.trials - a.trials)
        .slice(0, 4);

      setRows(list);
      setLoading(false);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const dirStyle = {
    up: { Icon: ArrowUp, color: "text-emerald-600 bg-emerald-500/10", label: "moving up" },
    down: { Icon: ArrowDown, color: "text-amber-600 bg-amber-500/10", label: "stepped back" },
    flat: { Icon: ArrowRight, color: "text-muted-foreground bg-muted", label: "holding" },
  };

  return (
    <Card className="p-5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">
        Game Levels
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 bg-muted/40 rounded animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center text-center py-3 text-muted-foreground">
          <Layers className="w-6 h-6 mb-1.5 opacity-60" />
          <div className="text-sm">No levels recorded yet.</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const ds = dirStyle[r.direction];
            return (
              <div
                key={r.slug}
                className="flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{pretty(r.slug)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.trials} trial{r.trials === 1 ? "" : "s"} this week
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-base font-bold text-foreground leading-tight">L{r.level}</div>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${ds.color}`}
                    title={ds.label}
                  >
                    <ds.Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
