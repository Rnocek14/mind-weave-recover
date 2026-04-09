import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GoalTrackingCardProps {
  userId: string;
  profileId: string | undefined;
}

interface GoalWithRating {
  id: string;
  goalText: string;
  targetDomain: string;
  baselineStatus: string;
  latestStatus: string | null;
  latestNotes: string | null;
  ratedAt: string | null;
}

/**
 * Shows functional goals and their latest progress rating for clinicians.
 */
export function GoalTrackingCard({ userId, profileId }: GoalTrackingCardProps) {
  const [goals, setGoals] = useState<GoalWithRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;

    const fetch = async () => {
      const { data: goalsData } = await supabase
        .from("functional_goals")
        .select("id, goal_text, target_domain, baseline_status")
        .eq("profile_id", profileId)
        .is("archived_at", null);

      if (!goalsData || goalsData.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch latest rating for each goal
      const goalIds = goalsData.map((g) => g.id);
      const { data: ratings } = await supabase
        .from("goal_progress_ratings")
        .select("goal_id, status, notes, rated_at")
        .in("goal_id", goalIds)
        .order("rated_at", { ascending: false });

      const latestByGoal: Record<string, { status: string; notes: string | null; ratedAt: string }> = {};
      ratings?.forEach((r) => {
        if (!latestByGoal[r.goal_id]) {
          latestByGoal[r.goal_id] = { status: r.status, notes: r.notes, ratedAt: r.rated_at };
        }
      });

      setGoals(
        goalsData.map((g) => ({
          id: g.id,
          goalText: g.goal_text,
          targetDomain: g.target_domain,
          baselineStatus: g.baseline_status,
          latestStatus: latestByGoal[g.id]?.status || null,
          latestNotes: latestByGoal[g.id]?.notes || null,
          ratedAt: latestByGoal[g.id]?.ratedAt || null,
        }))
      );
      setLoading(false);
    };

    fetch();
  }, [profileId]);

  if (loading || goals.length === 0) return null;

  const statusColor = (status: string | null) => {
    if (!status) return "secondary";
    if (status === "achieved" || status === "exceeded") return "default";
    if (status === "progressing") return "secondary";
    return "outline";
  };

  const statusLabel = (status: string | null) => {
    if (!status) return "Not rated";
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Functional Goals
          <Badge variant="secondary" className="text-xs">{goals.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-2">
        {goals.map((g) => (
          <div key={g.id} className="p-2.5 rounded-lg bg-muted/20 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground flex-1">{g.goalText}</p>
              <Badge variant={statusColor(g.latestStatus)} className="text-xs shrink-0">
                {statusLabel(g.latestStatus)}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{g.targetDomain.replace(/_/g, " ")}</span>
              <span>·</span>
              <span>Baseline: {g.baselineStatus.replace(/_/g, " ")}</span>
              {g.ratedAt && (
                <>
                  <span>·</span>
                  <span>Last rated {new Date(g.ratedAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
            {g.latestNotes && (
              <p className="text-xs text-muted-foreground italic">{g.latestNotes}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
