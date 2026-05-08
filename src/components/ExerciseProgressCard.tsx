import { useState, useEffect, useMemo, memo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight, TrendingUp, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AboutGameLink } from "@/components/leveling/AboutGameLink";

interface ExerciseProgressCardProps {
  userId: string | undefined;
  exerciseSlug: string;
  exerciseTitle: string;
  exerciseIcon: React.ElementType;
  targets: string;
}

interface SessionStats {
  accuracy: number;
  level: number;
  weakestArea: string;
  sessionDate: string;
}

export const ExerciseProgressCard = memo(({
  userId,
  exerciseSlug,
  exerciseTitle,
  exerciseIcon: Icon,
  targets,
}: ExerciseProgressCardProps) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadStats();
    }
  }, [userId, exerciseSlug]);

  const loadStats = async () => {
    if (!userId) return;

    try {
      // Get the most recent session for this exercise
      const { data: sessions } = await supabase
        .from("sessions")
        .select(`
          id,
          ended_at,
          summary
        `)
        .eq("user_id", userId)
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false });

      if (!sessions || sessions.length === 0) {
        setLoading(false);
        return;
      }

      // Find the most recent session with this exercise
      let latestSession = null;
      for (const session of sessions) {
        const { data: events } = await supabase
          .from("exercise_events")
          .select("*")
          .eq("session_id", session.id)
          .eq("exercise_slug", exerciseSlug)
          .limit(1);

        if (events && events.length > 0) {
          latestSession = session;
          break;
        }
      }

      if (!latestSession) {
        setLoading(false);
        return;
      }

      // Get all events from that session
      const { data: events } = await supabase
        .from("exercise_events")
        .select("*")
        .eq("session_id", latestSession.id)
        .eq("exercise_slug", exerciseSlug);

      if (!events || events.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate accuracy
      const correctCount = events.filter((e) => e.score === 1).length;
      const accuracy = Math.round((correctCount / events.length) * 100);

      // Get difficulty level (from task_parameters or inputs)
      const lastEvent = events[events.length - 1];
      const taskParams = lastEvent.task_parameters as any;
      const inputs = lastEvent.inputs as any;
      const level = taskParams?.difficulty || inputs?.difficulty || 1;

      // Calculate weakest area based on exercise type
      let weakestArea = "Not enough data";

      if (exerciseSlug === "semantic-features") {
        // Analyze semantic errors
        const categoryErrors: Record<string, number> = {};
        events.forEach((event) => {
          const outputs = event.outputs as any;
          if (outputs?.analysis) {
            const missed = outputs.analysis.missedCategories || [];
            missed.forEach((cat: string) => {
              categoryErrors[cat] = (categoryErrors[cat] || 0) + 1;
            });
          }
        });

        const weakestCategory = Object.entries(categoryErrors).sort(
          ([, a], [, b]) => b - a
        )[0];
        if (weakestCategory) {
          weakestArea = `${weakestCategory[0]} features`;
        }

        // Check for abstract concept weakness
        const abstractnessScores = events
          .filter((e) => {
            const outputs = e.outputs as any;
            return outputs?.analysis?.weakestAbstractness !== undefined;
          })
          .map((e) => {
            const outputs = e.outputs as any;
            return outputs.analysis.weakestAbstractness;
          });
        if (abstractnessScores.length > 0) {
          const avgAbstractness =
            abstractnessScores.reduce((a, b) => a + b, 0) /
            abstractnessScores.length;
          if (avgAbstractness > 3) {
            weakestArea = "abstract concepts";
          }
        }
      } else if (exerciseSlug === "phonological-awareness") {
        // Analyze phonological errors
        const phonemeErrors: Record<string, number> = {};
        events.forEach((event) => {
          const outputs = event.outputs as any;
          if (!event.score && outputs?.phonemeDiffs) {
            const diffs = outputs.phonemeDiffs;
            diffs.forEach((diff: any) => {
              const key = `${diff.from} ↔ ${diff.to}`;
              phonemeErrors[key] = (phonemeErrors[key] || 0) + 1;
            });
          }
        });

        const mostCommonError = Object.entries(phonemeErrors).sort(
          ([, a], [, b]) => b - a
        )[0];
        if (mostCommonError) {
          weakestArea = mostCommonError[0];
        }
      } else if (exerciseSlug === "sentence-construction") {
        // Analyze grammar errors
        const grammarErrors: Record<string, number> = {};
        events.forEach((event) => {
          const outputs = event.outputs as any;
          const inputs = event.inputs as any;
          if (!event.score && outputs?.errorType) {
            grammarErrors[outputs.errorType] = (grammarErrors[outputs.errorType] || 0) + 1;
          }
          // Also track grammar focus from inputs
          if (!event.score && inputs?.grammarFocus) {
            grammarErrors[inputs.grammarFocus] = (grammarErrors[inputs.grammarFocus] || 0) + 1;
          }
        });

        const mostCommonError = Object.entries(grammarErrors).sort(
          ([, a], [, b]) => b - a
        )[0];
        if (mostCommonError) {
          weakestArea = mostCommonError[0].replace(/_/g, " ");
        }
      }

      setStats({
        accuracy,
        level,
        weakestArea,
        sessionDate: latestSession.ended_at!,
      });
    } catch (error) {
      console.error("Error loading exercise stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 shadow-card" role="status" aria-live="polite">
        <span className="sr-only">Loading exercise progress data...</span>
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="p-6 shadow-card border-2 hover:border-primary transition-smooth">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-lg mb-1">{exerciseTitle}</h3>
              <AboutGameLink slug={exerciseSlug} variant="icon" source="exercise-progress-card-empty" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Targets: {targets}
            </p>
            <EmptyState
              icon={AlertCircle}
              description="Complete sessions to track progress here. Start from the Overview tab."
              variant="info"
              className="mt-4"
            />
          </div>
        </div>
      </Card>
    );
  }

  const sessionDate = useMemo(() => 
    new Date(stats.sessionDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    [stats.sessionDate]
  );

  return (
    <Card className="p-6 shadow-card border-2 hover:border-primary transition-smooth group cursor-pointer"
      onClick={() => navigate("/history")}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-smooth">
          <Icon className="w-6 h-6 text-white" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="font-semibold text-lg">{exerciseTitle}</h3>
            <div className="flex items-center gap-1.5">
              <AboutGameLink slug={exerciseSlug} variant="icon" source="exercise-progress-card" />
              <Badge variant="outline" className="text-xs">
                {sessionDate}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Targets: {targets}
          </p>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Last session accuracy
              </span>
              <div className="flex items-center gap-1">
                <TrendingUp
                  className={`w-4 h-4 ${
                    stats.accuracy >= 80
                      ? "text-success"
                      : stats.accuracy >= 60
                      ? "text-warning"
                      : "text-destructive"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-lg font-bold" aria-label={`${stats.accuracy} percent accuracy`}>{stats.accuracy}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Difficulty level
              </span>
              <Badge variant="secondary">Level {stats.level}</Badge>
            </div>
          </div>

          {stats.weakestArea !== "Not enough data" && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700 text-xs font-semibold">
                    Needs Attention
                  </Badge>
                </div>
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200 mb-1">
                  Weakest area identified
                </p>
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">{stats.weakestArea}</p>
              </div>
            </div>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 group-hover:bg-primary/10 min-h-[44px] md:min-h-[40px]"
                  aria-label={`View detailed session history for ${exerciseTitle}`}
                >
                  View Session History
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>View detailed session-by-session progress, accuracy trends, and performance patterns for {exerciseTitle}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </Card>
  );
});

ExerciseProgressCard.displayName = 'ExerciseProgressCard';
