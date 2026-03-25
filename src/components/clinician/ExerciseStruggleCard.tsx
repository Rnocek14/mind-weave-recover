import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, XCircle } from "lucide-react";
import { useMemo } from "react";
import type { DayGroup } from "@/hooks/useWeeklySessionTimeline";

interface ExerciseStruggleCardProps {
  dayGroups: DayGroup[];
}

/**
 * Shows exercise-level struggle patterns for clinicians.
 * Surfaces exercises with high failure rates during the review window.
 */
export function ExerciseStruggleCard({ dayGroups }: ExerciseStruggleCardProps) {
  const struggles = useMemo(() => {
    const exerciseStats: Record<string, { trials: number; correct: number; slug: string }> = {};

    dayGroups.forEach((day) => {
      day.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          if (!exerciseStats[ex.slug]) {
            exerciseStats[ex.slug] = { trials: 0, correct: 0, slug: ex.slug };
          }
          exerciseStats[ex.slug].trials += ex.trials;
          exerciseStats[ex.slug].correct += Math.round((ex.accuracy / 100) * ex.trials);
        });
      });
    });

    return Object.values(exerciseStats)
      .filter((e) => e.trials >= 5)
      .map((e) => ({
        ...e,
        accuracy: Math.round((e.correct / e.trials) * 100),
        failures: e.trials - e.correct,
      }))
      .filter((e) => e.accuracy < 60)
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [dayGroups]);

  if (struggles.length === 0) return null;

  const formatSlug = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <Card className="border-amber-500/20">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Exercise Struggles
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-2">
        {struggles.slice(0, 5).map((ex) => (
          <div key={ex.slug} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
            <div className="flex items-center gap-2 min-w-0">
              <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <span className="font-medium truncate">{formatSlug(ex.slug)}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {ex.failures} failed / {ex.trials} trials
              </span>
              <Badge variant={ex.accuracy < 40 ? "destructive" : "secondary"} className="text-[10px]">
                {ex.accuracy}%
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
