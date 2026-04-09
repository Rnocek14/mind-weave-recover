/**
 * Sessions Tab — Per-session clinical evidence with inline expandable cards.
 * Shows exercise breakdown, auto-generated strengths/struggles, adaptation actions, audio.
 */
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar, Clock, Target, ChevronDown, ChevronRight, Volume2, VolumeX,
  CheckCircle2, XCircle, AlertTriangle, Zap, TrendingUp, Mic
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionDetail, type TrialData } from "@/hooks/useSessionDetail";
import { generateSessionInsight, type SessionInsight } from "@/lib/sessionInsightGenerator";
import { cn } from "@/lib/utils";

interface SessionsTabProps {
  userId: string;
  profileId: string | undefined;
  windowSize: number;
}

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  summary: any;
}

function formatSlug(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function SessionsTab({ userId, profileId, windowSize }: SessionsTabProps) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowSize);

    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sessions")
        .select("id, started_at, ended_at, duration_sec, summary")
        .eq("profile_id", profileId)
        .not("ended_at", "is", null)
        .gte("started_at", cutoff.toISOString())
        .order("started_at", { ascending: false })
        .limit(50);
      setSessions(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [profileId, windowSize]);

  if (loading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="mt-4 p-8 text-center">
        <p className="text-muted-foreground">No sessions in this time window.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          isExpanded={expandedId === session.id}
          onToggle={() => setExpandedId(expandedId === session.id ? null : session.id)}
        />
      ))}
    </div>
  );
}

function SessionCard({
  session,
  isExpanded,
  onToggle,
}: {
  session: SessionRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { trials, loading, fetchTrials, playAudio, stopAudio, playingId } = useSessionDetail();
  const [adaptations, setAdaptations] = useState<any[]>([]);

  useEffect(() => {
    if (isExpanded && trials.length === 0 && !loading) {
      fetchTrials(session.id);
      // Fetch adaptations for this session
      supabase
        .from("adaptation_events")
        .select("adaptation_type, exercise_slug, value_before, value_after, trigger_type")
        .eq("session_id", session.id)
        .then(({ data }) => setAdaptations(data ?? []));
    }
    return () => { if (!isExpanded) stopAudio(); };
  }, [isExpanded, session.id]);

  const insight = useMemo<SessionInsight | null>(() => {
    if (trials.length === 0) return null;
    return generateSessionInsight(
      trials.map((t) => ({
        exercise_slug: t.exercise_slug,
        is_correct: t.is_correct,
        error_type: t.error_type,
        cue_type_given: t.cue_type_given,
        cue_was_effective: t.cue_was_effective,
        reaction_time_ms: t.latency_ms,
        audio_storage_path: t.audio_storage_path,
      })),
      adaptations
    );
  }, [trials, adaptations]);

  const durationMin = Math.round((session.duration_sec ?? 0) / 60);
  const date = new Date(session.started_at);
  const dateStr = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Quick stats from summary if available
  const summaryData = session.summary as any;

  return (
    <Card className={cn("transition-shadow", isExpanded && "shadow-md ring-1 ring-primary/20")}>
      {/* Header — always visible */}
      <button
        className="w-full text-left p-4 flex items-center gap-4"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-semibold text-sm">{dateStr}</span>
            <span className="text-xs text-muted-foreground">{timeStr}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{durationMin}m</span>
            {summaryData?.accuracy != null && (
              <span className="flex items-center gap-1"><Target className="w-3 h-3" />{Math.round(summaryData.accuracy)}%</span>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4 space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : insight ? (
            <>
              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <div className="text-xl font-bold text-primary">{insight.overallAccuracy}%</div>
                  <div className="text-[10px] text-muted-foreground">Accuracy</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <div className="text-xl font-bold">{trials.length}</div>
                  <div className="text-[10px] text-muted-foreground">Trials</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <div className="text-xl font-bold">{insight.exerciseBreakdown.length}</div>
                  <div className="text-[10px] text-muted-foreground">Exercises</div>
                </div>
              </div>

              {/* Strengths & Struggles */}
              <div className="grid grid-cols-2 gap-3">
                {insight.strengths.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-success flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Strengths
                    </h4>
                    {insight.strengths.map((s, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {s}</p>
                    ))}
                  </div>
                )}
                {insight.struggles.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Struggles
                    </h4>
                    {insight.struggles.map((s, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {s}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Adaptation actions */}
              {insight.adaptations.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-primary flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Adaptations
                  </h4>
                  {insight.adaptations.map((a, i) => (
                    <p key={i} className="text-xs text-muted-foreground">• {a}</p>
                  ))}
                </div>
              )}

              {/* Exercise breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">Exercise Breakdown</h4>
                {insight.exerciseBreakdown.map((ex) => (
                  <div key={ex.slug} className="flex items-center justify-between p-2 rounded bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{ex.label}</span>
                      {ex.hasAudio && <Mic className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{ex.trials} trials</span>
                      <Badge variant={ex.accuracy >= 80 ? "default" : ex.accuracy >= 50 ? "secondary" : "destructive"} className="text-[10px]">
                        {ex.accuracy}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Audio samples */}
              {trials.some((t) => t.audio_storage_path) && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Audio Samples
                  </h4>
                  <div className="space-y-1">
                    {trials
                      .filter((t) => t.audio_storage_path)
                      .slice(0, 8)
                      .map((t, i) => (
                        <div key={t.attempt_id + i} className="flex items-center gap-2 p-1.5 rounded bg-muted/20 text-xs">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => playAudio(t.audio_storage_path!, t.attempt_id)}
                          >
                            {playingId === t.attempt_id ? (
                              <VolumeX className="w-3 h-3 text-primary" />
                            ) : (
                              <Volume2 className="w-3 h-3 text-muted-foreground" />
                            )}
                          </Button>
                          <span className="font-medium truncate">{t.target_word || formatSlug(t.exercise_slug || "")}</span>
                          {t.is_correct ? (
                            <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                          ) : (
                            <XCircle className="w-3 h-3 text-destructive shrink-0" />
                          )}
                          {t.transcript && (
                            <span className="text-muted-foreground truncate">"{t.transcript}"</span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No trial data for this session.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
