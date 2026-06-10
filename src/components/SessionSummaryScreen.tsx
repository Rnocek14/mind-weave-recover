import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, ChevronDown, Sparkles, Trophy, ArrowRight, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUiMode } from "@/hooks/useUiMode";
import { useCoachingMode } from "@/contexts/CoachingModeContext";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { getSummaryInsight } from "@/lib/coachingNarrative";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import type { SessionFrameTemplate, BlockResult } from "@/lib/sessionFrameTemplates";
import { readAllExerciseDetails } from "@/lib/exerciseDetailsStore";
import { buildSessionInsight } from "@/lib/reflectionEngine";
import { buildPresetLesson } from "@/lib/dailyLessonEngine";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getSessionHeadline, humanizeSlug, getFeedbackTone } from "@/lib/performanceAwareFeedback";
import { getSessionDelightLine } from "@/lib/sessionFeedbackCopy";
import { saveSessionSignals } from "@/lib/sessionSignalStore";
import { AboutGameLink } from "@/components/leveling/AboutGameLink";
import { TodaysPracticeInsights } from "@/components/insights/TodaysPracticeInsights";
import { ProbeResultsCard } from "@/components/probe/ProbeResultsCard";
import { useAuth } from "@/hooks/useAuth";
import { useActiveProfileId } from "@/hooks/useActiveProfileId";
import { useUiProfile } from "@/hooks/useUiProfile";
import { variantClass } from "@/lib/ui/variantClass";

interface SessionSummaryScreenProps {
  lesson: DailyLesson;
  sessionId: string | null;
  sessionFrame?: SessionFrameTemplate | null;
  onFinish: () => void;
}

interface ExerciseScore {
  exercise_slug: string;
  avg_score: number;
  trial_count: number;
}

/** Convert exercise slug to plain name */
function slugToName(slug: string): string {
  return humanizeSlug(slug);
}

/** Plain-language performance label — tone-aware */
function scoreToLabel(score: number): { text: string; className: string } {
  const tone = getFeedbackTone(score);
  switch (tone) {
    case 'celebrate':
      return { text: "Getting stronger", className: "text-green-600 dark:text-green-400" };
    case 'encourage':
      return { text: "Keeping steady", className: "text-primary" };
    case 'support':
      return { text: "Building up", className: "text-muted-foreground" };
    case 'protect':
      return { text: "Let's keep practicing", className: "text-muted-foreground" };
  }
}

export function SessionSummaryScreen({ lesson, sessionId, sessionFrame, onFinish }: SessionSummaryScreenProps) {
  const navigate = useNavigate();
  const { uiMode } = useUiMode();
  const { showTransferOnSummary, mode, isVoiceLed } = useCoachingMode();
  const { speak, stop } = useTextToSpeech();
  const { user } = useAuth();
  const activeProfileId = useActiveProfileId();
  const { profile } = useUiProfile();
  const { variant } = profile;
  const isClinician = uiMode === "clinician" || uiMode === "admin";
  const isCaregiver = uiMode === "caregiver";
  const showDetail = isClinician || isCaregiver;


  const [exerciseScores, setExerciseScores] = useState<ExerciseScore[]>([]);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const hasSpokenClosingRef = useRef(false);

  // Cleanup TTS on unmount
  useEffect(() => { return () => { stop(); }; }, [stop]);

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

  // Save session signals for the recommendation engine
  useEffect(() => {
    if (exerciseScores.length === 0) return;
    
    const savedDetails = readAllExerciseDetails();
    const blockResults: BlockResult[] = exerciseScores.map((es, i) => {
      const detailEntry = Array.from(savedDetails.values()).find(
        d => d.exerciseId === es.exercise_slug
      ) || savedDetails.get(i);
      return {
        exerciseId: es.exercise_slug,
        avgScore: es.avg_score,
        trialCount: es.trial_count,
        details: detailEntry?.details,
      };
    });
    
    const insight = buildSessionInsight(blockResults);
    
    saveSessionSignals({
      timestamp: Date.now(),
      insight,
      exerciseScores: exerciseScores.map(es => ({
        exerciseId: es.exercise_slug,
        avgScore: es.avg_score,
        trialCount: es.trial_count,
      })),
      templateId: sessionFrame?.id,
      completed: true,
    });
  }, [exerciseScores, sessionFrame]);

  // Full Coaching: speak the closing reflection once scores are ready
  useEffect(() => {
    if (!isVoiceLed || hasSpokenClosingRef.current || exerciseScores.length === 0) return;
    hasSpokenClosingRef.current = true;

    // Build a spoken summary
    const savedDetails = readAllExerciseDetails();
    const blockResults: BlockResult[] = exerciseScores.map((es, i) => {
      const detailEntry = Array.from(savedDetails.values()).find(
        d => d.exerciseId === es.exercise_slug
      ) || savedDetails.get(i);
      return {
        exerciseId: es.exercise_slug,
        avgScore: es.avg_score,
        trialCount: es.trial_count,
        details: detailEntry?.details,
      };
    });
    
    const insight = buildSessionInsight(blockResults);
    const spokenClosing = `${insight.strength}. ${insight.nextStep}.`;
    speak(spokenClosing);
  }, [isVoiceLed, exerciseScores, speak]);

  const totalTrials = useMemo(
    () => exerciseScores.reduce((sum, s) => sum + s.trial_count, 0),
    [exerciseScores]
  );

  const headline = getSessionHeadline(overallAvg);
  const isPreset = lesson.reasoning?.[0]?.startsWith("Preset:");
  const durationMin = durationSec ? Math.max(1, Math.round(durationSec / 60)) : lesson.totalDuration;

  return (
    <div className={variantClass(variant, {
      base: "min-h-screen bg-background flex items-center justify-center p-4",
      simplified: "p-6",
    })}>
      <Card className={variantClass(variant, {
        base: "w-full max-w-xl p-8 space-y-6 text-center animate-fade-in",
        simplified: "max-w-2xl p-10 space-y-8",
        minimal: "max-w-2xl p-10 space-y-8 shadow-none border-2",
      })}>
        {/* Celebration icon */}
        <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          <span className="text-4xl">{headline.emoji}</span>
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <h2 className={variantClass(variant, {
            base: "text-3xl font-bold text-foreground",
            simplified: "text-4xl",
          })}>{headline.text}</h2>
          <p className={variantClass(variant, {
            base: "text-muted-foreground text-lg",
            simplified: "text-xl",
          })}>
            You practiced for {durationMin} {durationMin === 1 ? "minute" : "minutes"}
          </p>
          <p className="text-sm text-primary/80 font-medium mt-1">
            {getSessionDelightLine(overallAvg)}
          </p>
        </div>

        {/* Today's practice — Phase B recovery insights (renders nothing if empty) */}
        <TodaysPracticeInsights sessionId={sessionId} />

        {/* Untrained-word generalization probe — real measured signal */}
        <ProbeResultsCard userId={user?.id} profileId={activeProfileId} />

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

        {/* UX1: explain the difference between session challenge and recovery level */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-left">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The app changed difficulty during practice to keep the challenge at the
            right level. This does not change your recovery level — that moves
            slowly over time, based on your practice.
          </p>
        </div>

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
                  <div key={es.exercise_slug} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <span className="text-muted-foreground capitalize truncate">{slugToName(es.exercise_slug)}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground">{es.trial_count} rounds</span>
                      <span className="font-semibold tabular-nums text-foreground">{es.avg_score}%</span>
                      <AboutGameLink slug={es.exercise_slug} variant="icon" source="session-summary" />
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

        {/* Session frame closing — cross-exercise insights (for Maya-led sessions) */}
        {sessionFrame && exerciseScores.length > 0 && (() => {
          // Merge exercise scores with detailed signals from sessionStorage
          const savedDetails = readAllExerciseDetails();
          const blockResults: BlockResult[] = exerciseScores.map((es, i) => {
            // Try to find matching details by exercise slug or block index
            const detailEntry = Array.from(savedDetails.values()).find(
              d => d.exerciseId === es.exercise_slug
            ) || savedDetails.get(i);
            return {
              exerciseId: es.exercise_slug,
              avgScore: es.avg_score,
              trialCount: es.trial_count,
              details: detailEntry?.details,
            };
          });
          
          // Use reflection engine for signal-based insights
          const insight = buildSessionInsight(blockResults);
          const closing = sessionFrame.closingBuilder(blockResults);
          
          // Prefer reflection engine insights over template-level ones when signals are available
          const hasDetailedSignals = blockResults.some(br => br.details);
          const finalStrength = hasDetailedSignals ? insight.strength : closing.strength;
          const finalNextStep = hasDetailedSignals ? insight.nextStep : closing.nextStep;
          return (
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-5 text-left space-y-3">
              <div className="flex items-start gap-2.5">
                <MessageCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-foreground">Maya's session reflection</p>
              </div>
              
              {closing.practiced.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Practiced today</p>
                  <ul className="text-sm text-foreground space-y-0.5">
                    {closing.practiced.map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="capitalize">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Strong today</p>
                <p className="text-sm text-foreground">{finalStrength}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next step</p>
                <p className="text-sm text-foreground">{finalNextStep}</p>
              </div>
              
              <p className="text-sm text-muted-foreground leading-relaxed italic border-t border-primary/10 pt-3 mt-2">
                {closing.realLifeLine}
              </p>
            </div>
          );
        })()}

        {/* Maya's session insight — Guided/Full coaching modes (non-framed sessions) */}
        {!sessionFrame && mode !== 'off' && exerciseScores.length > 0 && (() => {
          const insight = getSummaryInsight({ mode, exerciseScores, durationMin });
          return insight ? (
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-left">
              <div className="flex items-start gap-2.5">
                <MessageCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Maya's observation</p>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                    "{insight}"
                  </p>
                </div>
              </div>
            </div>
          ) : null;
        })()}

        {showTransferOnSummary && !sessionFrame && lesson.targetDomains?.[0] && (
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-left">
            <div className="flex items-start gap-2.5">
              <MessageCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Try this in real life</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {getTransferSuggestion(lesson.targetDomains[0])}
                </p>
              </div>
            </div>
          </div>
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

function getTransferSuggestion(domain: string): string {
  const map: Record<string, string> = {
    lexical_retrieval: "Try naming 3 objects around you as quickly as you can — that's the same skill you just practiced.",
    semantic_depth: "Pick one word from today and describe it to someone without saying the word itself.",
    semantic: "Pick one word from today and describe it to someone without saying the word itself.",
    phonology: "Listen for a tricky sound in conversation today — notice when you hear it clearly.",
    phonological: "Listen for a tricky sound in conversation today — notice when you hear it clearly.",
    syntax: "Try building one full sentence about your day — subject, verb, detail.",
    discourse: "Tell someone one thing that happened today, in order: first, then, finally.",
    comprehension: "Ask someone a question and focus on catching the key words in their answer.",
    executive_function: "Plan your next meal in 3 steps — that uses the same sequencing skill.",
  };
  return map[domain] || "Use one word or skill from today's practice in a real conversation.";
}
