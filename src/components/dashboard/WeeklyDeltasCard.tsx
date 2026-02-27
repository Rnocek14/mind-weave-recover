import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { useCognitiveState } from "@/hooks/useCognitiveState";
import { COGNITIVE_DOMAINS } from "@/lib/cognitiveStateEngine";
import { useProfile } from "@/hooks/useProfile";
import { useDashboardContext } from "@/hooks/useDashboardContext";

/**
 * "What changed since last week?" — top 2-3 domain deltas for 90-second triage.
 */
export const WeeklyDeltasCard = memo(function WeeklyDeltasCard() {
  const { userId } = useDashboardContext();
  const { activeProfile } = useProfile();
  const { snapshot, isLoading } = useCognitiveState({
    userId,
    profileId: activeProfile?.id,
  });

  const deltas = useMemo(() => {
    if (!snapshot) return [];
    // Use trend direction + score magnitude as proxy for change
    return snapshot.domains
      .filter((d) => d.trialCount >= 3 && d.trend !== "insufficient")
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((d) => {
        const meta = COGNITIVE_DOMAINS.find((cd) => cd.slug === d.domainSlug);
        return {
          label: meta?.label || d.domainSlug.replace(/_/g, " "),
          score: Math.round(d.score * 100),
          trend: d.trend,
        };
      });
  }, [snapshot]);

  if (isLoading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-48 mb-2" />
        <div className="h-3 bg-muted rounded w-full" />
      </Card>
    );
  }

  if (deltas.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Not enough data yet to show weekly changes. Complete more sessions to track progress.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-primary" />
        What Changed This Week
      </h4>
      <div className="space-y-2">
        {deltas.map((d) => (
          <div
            key={d.label}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">{d.label}</span>
            <div className="flex items-center gap-2">
              {d.trend === "improving" && (
                <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              )}
              {d.trend === "declining" && (
                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              )}
              {d.trend === "stable" && (
                <Minus className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              <Badge
                variant={
                  d.trend === "improving"
                    ? "default"
                    : d.trend === "declining"
                    ? "destructive"
                    : "secondary"
                }
                className="text-xs tabular-nums"
              >
                {d.score}%
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
});
