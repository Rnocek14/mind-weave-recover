import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, ChevronDown, Sparkles, Trophy, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUiMode } from "@/hooks/useUiMode";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import { buildPresetLesson } from "@/lib/dailyLessonEngine";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface SessionSummaryScreenProps {
  lesson: DailyLesson;
  sessionId: string | null;
  onFinish: () => void;
}

interface ExerciseScore {
  exercise_slug: string;
  avg_score: number;
  trial_count: number;
}

/** Pick an encouraging headline based on average score */
function getHeadline(avgScore: number | null): { text: string; emoji: string } {
  if (avgScore === null) return { text: "Session complete!", emoji: "✅" };
  if (avgScore >= 80) return { text: "Amazing work!", emoji: "🌟" };
  if (avgScore >= 60) return { text: "Great effort!", emoji: "💪" };
  if (avgScore >= 40) return { text: "Nice practice!", emoji: "👍" };
  return { text: "You showed up — that matters!", emoji: "❤️" };
}

/** Convert exercise slug to plain name */
function slugToName(slug: string): string {
  return slug.replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/** Plain-language performance label */
function scoreToLabel(score: number): { text: string; className: string } {
  if (score >= 80) return { text: "Getting stronger", className: "text-green-600 dark:text-green-400" };
  if (score >= 50) return { text: "Keeping steady", className: "text-primary" };
  return { text: "Let's keep practicing", className: "text-muted-foreground" };
}

export function SessionSummaryScreen({ lesson, sessionId, onFinish }: SessionSummaryScreenProps) {
  const navigate = useNavigate();
  const { uiMode } = useUiMode();
  const isClinician = uiMode === "clinician" || uiMode === "admin";
  const isCaregiver = uiMode === "caregiver";
  const showDetail = isClinician || isCaregiver;

  const [exerciseScores, setExerciseScores] = useState<ExerciseScore[]>([]);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch actual session results
  useEffect(() => {
    if (!sessionId) return;

    const fetchResults = async () => {
      // Get exercise events for this session
      const { data: events } = await supabase
        .from("exercise_events")
        .select("exercise_slug, score")
        .eq("session_id", sessionId)
        .not("score", "is", null);

      if (events && events.length > 0) {
        // Group by exercise and compute averages
        const grouped = new Map<string, { total: number; count: number }>();
        for (const ev of events) {
          const slug = ev.exercise_slug || "unknown";
          const entry = grouped.get(slug) || { total: 0, count: 0 };
          entry.total += (ev.score ?? 0);
          entry.count += 1;
          grouped.set(slug, entry);
        }
        setExerciseScores(
          Array.from(grouped.entries()).map(([slug, { total, count }]) => ({
            exercise_slug: slug,
            avg_score: Math.round(total / count),
            trial_count: count,
          }))
        );
      }

      // Get session duration
      const { data: session } = await supabase
        .from("sessions")
        .select("duration_sec")
        .eq("id", sessionId)
        .single();

      if (session?.duration_sec) {
        setDurationSec(session.duration_sec);
      }
    };

    fetchResults();
  }, [sessionId]);

  const overallAvg = useMemo(() => {
    if (exerciseScores.length === 0) return null;
    const total = exerciseScores.reduce((sum, s) => sum + s.avg_score, 0);
    return Math.round(total / exerciseScores.length);
  }, [exerciseScores]);

  const totalTrials = useMemo(
    () => exerciseScores.reduce((sum, s) => sum + s.trial_count, 0),
    [exerciseScores]
  );

  const headline = getHeadline(overallAvg);
  const isPreset = lesson.reasoning?.[0]?.startsWith("Preset:");
  const durationMin = durationSec ? Math.max(1, Math.round(durationSec / 60)) : lesson.totalDuration;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-xl p-8 space-y-6 text-center animate-fade-in">
        {/* Celebration icon */}
        <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          <span className="text-4xl">{headline.emoji}</span>
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-foreground">{headline.text}</h2>
          <p className="text-muted-foreground text-lg">
            You practiced for {durationMin} {durationMin === 1 ? "minute" : "minutes"}
          </p>
        </div>

        {/* Quick stats — plain language */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">{lesson.blocks.length}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {lesson.blocks.length === 1 ? "Exercise" : "Exercises"}
            </p>
          </div>
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">{totalTrials || "—"}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {totalTrials === 1 ? "Round" : "Rounds"}
            </p>
          </div>
        </div>

        {/* Per-exercise plain-language feedback */}
        {exerciseScores.length > 0 && (
          <div className="space-y-2 text-left">
            {exerciseScores.map((es) => {
              const label = scoreToLabel(es.avg_score);
              return (
                <div
                  key={es.exercise_slug}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/30"
                >
                  <span className="font-medium text-foreground capitalize text-sm">
                    {slugToName(es.exercise_slug)}
                  </span>
                  <span className={`text-sm font-medium ${label.className}`}>
                    {label.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Expandable detail — for caregivers/clinicians or curious patients */}
        {exerciseScores.length > 0 && (
          <Collapsible open={detailOpen} onOpenChange={setDetailOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto">
                {showDetail ? "Session details" : "See more detail"}
                <ChevronDown className={`w-4 h-4 transition-transform ${detailOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="border rounded-lg divide-y text-left text-sm">
                {exerciseScores.map((es) => (
                  <div key={es.exercise_slug} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-muted-foreground capitalize">{slugToName(es.exercise_slug)}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{es.trial_count} rounds</span>
                      <span className="font-semibold tabular-nums text-foreground">{es.avg_score}%</span>
                    </div>
                  </div>
                ))}
                {durationSec && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Total time</span>
                    <span className="font-semibold text-foreground">
                      {Math.floor(durationSec / 60)}m {durationSec % 60}s
                    </span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-2">
          <Button size="lg" className="w-full h-14 text-base" onClick={onFinish}>
            Done
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          {isPreset && (
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => {
                const presetLesson = buildPresetLesson("comprehension_session");
                if (presetLesson) {
                  sessionStorage.removeItem("lessonFlowState");
                  navigate("/lesson", {
                    state: { lesson: presetLesson, runId: Date.now() },
                    replace: true,
                  });
                } else {
                  toast.error("Comprehension Session unavailable");
                }
              }}
            >
              🔄 Repeat Session
            </Button>
          )}

          {showDetail && (
            <Button
              size="lg"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => navigate("/insights", { state: { defaultTab: "deep-dive" } })}
            >
              View detailed analysis
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
