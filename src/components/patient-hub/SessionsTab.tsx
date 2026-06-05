/**
 * Sessions Tab — Per-session clinical evidence with inline expandable cards.
 * Shows exercise breakdown with per-exercise trial drill-down, accuracy sparkline,
 * session plan reasoning, error type badges, grouped audio, best/worst curation.
 */
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Calendar, Clock, Target, ChevronDown, ChevronRight, Volume2, VolumeX,
  CheckCircle2, XCircle, AlertTriangle, Zap, TrendingUp, Mic, Lightbulb,
  Timer, ArrowRightLeft, FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSessionDetail, type TrialData } from "@/hooks/useSessionDetail";
import { generateSessionInsight, type SessionInsight } from "@/lib/sessionInsightGenerator";
import { AccuracySparkline } from "@/components/clinician/AccuracySparkline";
import { cn } from "@/lib/utils";
import type { SnapshotDay } from "@/hooks/useWeeklyRecoverySnapshot";

function formatSlug(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const ERROR_COLORS: Record<string, string> = {
  semantic: "bg-amber-500",
  phonological: "bg-blue-500",
  timeout: "bg-muted-foreground",
  no_response: "bg-muted-foreground",
  perseveration: "bg-purple-500",
  neologism: "bg-rose-500",
};

const MOOD_EMOJI: Record<number, string> = { 1: "😞", 2: "😐", 3: "🙂", 4: "😊", 5: "😄" };

interface SessionsTabProps {
  userId: string;
  profileId: string | undefined;
  windowSize: number;
  timeline?: SnapshotDay[];
}

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  summary: any;
  plan: any;
  mood_rating: number | null;
  caregiver_notes: string | null;
  engagement_summary: any;
  user_id: string;
  profile_id: string | null;
}

interface ExerciseSummary {
  slug: string;
  trialCount: number;
  correctCount: number;
  accuracy: number;
  audioCount: number;
  avgRtMs: number | null;
}

interface SessionMeta {
  exercises: ExerciseSummary[];
  totalTrials: number;
  overallAccuracy: number;
  totalAudio: number;
  avgRtMs: number | null;
  adaptationCount: number;
}

export function SessionsTab({ userId, profileId, windowSize, timeline }: SessionsTabProps) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionMeta, setSessionMeta] = useState<Map<string, SessionMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build sparkline data from timeline
  const sparkData = useMemo(() => {
    if (!timeline) return [];
    return timeline.map((d) => ({
      date: d.date,
      accuracy: d.totalMinutes > 0 ? null : null, // will be overridden
      fatigueRating: d.fatigueRating,
      trials: 0,
    }));
  }, [timeline]);

  useEffect(() => {
    if (!profileId) {
      setSessions([]);
      setLoading(false);
      return;
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowSize);

    const fetchAll = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sessions")
        .select("id, started_at, ended_at, duration_sec, summary, plan, mood_rating, caregiver_notes, engagement_summary, user_id, profile_id")
        .eq("profile_id", profileId)
        .not("ended_at", "is", null)
        .gte("started_at", cutoff.toISOString())
        .order("started_at", { ascending: false })
        .limit(50);
      
      const sessionRows = (data ?? []) as SessionRow[];
      setSessions(sessionRows);

      if (sessionRows.length > 0) {
        const sessionIds = sessionRows.map((s) => s.id);

        // Batch fetch exercise events summary + adaptation counts
        const [eventsRes, adaptRes] = await Promise.all([
          supabase
            .from("exercise_events")
            .select("session_id, exercise_slug, score, audio_storage_path, reaction_time_ms")
            .in("session_id", sessionIds),
          supabase
            .from("adaptation_events" as any)
            .select("session_id")
            .in("session_id", sessionIds),
        ]);

        const events = eventsRes.data ?? [];
        const adaptations = (adaptRes.data ?? []) as any[];

        // Build per-session meta
        const metaMap = new Map<string, SessionMeta>();

        // Group events by session
        const bySession = new Map<string, typeof events>();
        events.forEach((e) => {
          if (!bySession.has(e.session_id)) bySession.set(e.session_id, []);
          bySession.get(e.session_id)!.push(e);
        });

        // Count adaptations per session
        const adaptCounts = new Map<string, number>();
        adaptations.forEach((a: any) => {
          adaptCounts.set(a.session_id, (adaptCounts.get(a.session_id) || 0) + 1);
        });

        sessionIds.forEach((sid) => {
          const evts = bySession.get(sid) || [];
          const exMap = new Map<string, { trials: number; correct: number; audio: number; rtSum: number; rtCount: number }>();

          evts.forEach((e) => {
            const slug = e.exercise_slug || "unknown";
            if (!exMap.has(slug)) exMap.set(slug, { trials: 0, correct: 0, audio: 0, rtSum: 0, rtCount: 0 });
            const ex = exMap.get(slug)!;
            ex.trials++;
            if (e.score === 1 || e.score === 100) ex.correct++;
            if (e.audio_storage_path) ex.audio++;
            if (e.reaction_time_ms && e.reaction_time_ms > 0) {
              ex.rtSum += e.reaction_time_ms;
              ex.rtCount++;
            }
          });

          const exercises: ExerciseSummary[] = Array.from(exMap.entries()).map(([slug, d]) => ({
            slug,
            trialCount: d.trials,
            correctCount: d.correct,
            accuracy: d.trials > 0 ? Math.round((d.correct / d.trials) * 100) : 0,
            audioCount: d.audio,
            avgRtMs: d.rtCount > 0 ? Math.round(d.rtSum / d.rtCount) : null,
          }));

          const totalTrials = evts.length;
          const totalCorrect = evts.filter((e) => e.score === 1 || e.score === 100).length;
          const totalAudio = evts.filter((e) => e.audio_storage_path).length;
          const allRt = evts.filter((e) => e.reaction_time_ms && e.reaction_time_ms > 0).map((e) => e.reaction_time_ms!);
          const avgRtMs = allRt.length > 0 ? Math.round(allRt.reduce((a, b) => a + b, 0) / allRt.length) : null;

          metaMap.set(sid, {
            exercises,
            totalTrials,
            overallAccuracy: totalTrials > 0 ? Math.round((totalCorrect / totalTrials) * 100) : 0,
            totalAudio,
            avgRtMs,
            adaptationCount: adaptCounts.get(sid) || 0,
          });
        });

        setSessionMeta(metaMap);
      }

      setLoading(false);
    };
    fetchAll();
  }, [profileId, windowSize]);

  // Build per-session accuracy for sparkline
  const sessionSparkData = useMemo(() => {
    if (sessions.length === 0) return [];
    return sessions
      .filter((s) => s.summary?.accuracy != null)
      .reverse()
      .map((s) => ({
        date: new Date(s.started_at).toISOString().slice(0, 10),
        accuracy: Math.round(s.summary.accuracy),
        fatigueRating: null as number | null,
        trials: s.summary?.trials || 0,
      }));
  }, [sessions]);

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
      {/* Accuracy Sparkline */}
      {sessionSparkData.length >= 2 && (
        <Card className="border-border/50">
          <CardContent className="py-2 px-4">
            <AccuracySparkline timeline={sessionSparkData} />
          </CardContent>
        </Card>
      )}

      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          meta={sessionMeta.get(session.id)}
          isExpanded={expandedId === session.id}
          onToggle={() => setExpandedId(expandedId === session.id ? null : session.id)}
        />
      ))}
    </div>
  );
}

function SessionCard({
  session,
  meta,
  isExpanded,
  onToggle,
}: {
  session: SessionRow;
  meta?: SessionMeta;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { trials, loading, fetchTrials, playAudio, stopAudio, playingId } = useSessionDetail();
  const [adaptations, setAdaptations] = useState<any[]>([]);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  useEffect(() => {
    if (isExpanded && trials.length === 0 && !loading) {
      fetchTrials(session.id);
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

  // Group trials by exercise for drill-down
  const trialsByExercise = useMemo(() => {
    const map = new Map<string, TrialData[]>();
    trials.forEach((t) => {
      const slug = t.exercise_slug || "unknown";
      if (!map.has(slug)) map.set(slug, []);
      map.get(slug)!.push(t);
    });
    return map;
  }, [trials]);

  // Curated audio: best (correct) and worst (incorrect) picks
  const curatedAudio = useMemo(() => {
    const withAudio = trials.filter((t) => t.audio_storage_path);
    const best = withAudio.find((t) => t.is_correct === true);
    const worst = withAudio.find((t) => t.is_correct === false);
    return { best, worst };
  }, [trials]);

  // Session plan reasoning
  const planData = session.plan as any;
  const hasPlan = planData && (planData.exercises?.length > 0 || planData.reasoning || planData.focus);

  const durationMin = Math.round((session.duration_sec ?? 0) / 60);
  const date = new Date(session.started_at);
  const dateStr = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <Card className={cn("transition-shadow", isExpanded && "shadow-md ring-1 ring-primary/20")}>
      {/* Rich collapsed header */}
      <button className="w-full text-left p-4 space-y-2" onClick={onToggle}>
        {/* Row 1: Date, time, chevron */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-semibold text-sm">{dateStr}</span>
            <span className="text-xs text-muted-foreground">{timeStr}</span>
            {session.mood_rating && (
              <span className="text-sm" title={`Mood: ${session.mood_rating}/5`}>
                {MOOD_EMOJI[session.mood_rating] || "🙂"}
              </span>
            )}
            {session.caregiver_notes && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title={session.caregiver_notes}>
                📝 Note
              </span>
            )}
          </div>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        </div>

        {/* Row 2: Key metrics */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{durationMin}m</span>
          {meta && (
            <>
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                <span className={cn("font-semibold", meta.overallAccuracy >= 80 ? "text-success" : meta.overallAccuracy >= 50 ? "text-amber-500" : "text-destructive")}>
                  {meta.overallAccuracy}%
                </span>
              </span>
              <span>{meta.totalTrials} trials</span>
              <span>{meta.exercises.length} exercises</span>
            </>
          )}
        </div>

        {/* Row 3: Exercise pills */}
        {meta && meta.exercises.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {meta.exercises.map((ex) => (
              <span
                key={ex.slug}
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium border",
                  ex.accuracy >= 80
                    ? "bg-success/10 text-success border-success/30"
                    : ex.accuracy >= 50
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                    : "bg-destructive/10 text-destructive border-destructive/30"
                )}
              >
                {formatSlug(ex.slug)} {ex.accuracy}%
              </span>
            ))}
          </div>
        )}

        {/* Row 4: Secondary signals */}
        {meta && (meta.adaptationCount > 0 || meta.totalAudio > 0 || meta.avgRtMs) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {meta.adaptationCount > 0 && (
              <span className="flex items-center gap-1 text-primary">
                <Zap className="w-3 h-3" />{meta.adaptationCount} adaptations
              </span>
            )}
            {meta.totalAudio > 0 && (
              <span className="flex items-center gap-1">
                <Mic className="w-3 h-3" />{meta.totalAudio} recordings
              </span>
            )}
            {meta.avgRtMs && (
              <span className="flex items-center gap-1">
                <Timer className="w-3 h-3" />Avg {(meta.avgRtMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
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
                  <div className="text-xs text-muted-foreground">Accuracy</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <div className="text-xl font-bold">{trials.length}</div>
                  <div className="text-xs text-muted-foreground">Trials</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <div className="text-xl font-bold">{insight.exerciseBreakdown.length}</div>
                  <div className="text-xs text-muted-foreground">Exercises</div>
                </div>
              </div>

              {/* Session Plan Reasoning */}
              {hasPlan && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-xs text-primary hover:underline w-full">
                      <Lightbulb className="w-3 h-3" />
                      <span className="font-semibold">Why This Plan</span>
                      <ChevronDown className="w-3 h-3 ml-auto" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 p-2 rounded bg-muted/20 text-xs space-y-1">
                    {planData.focus && <p><span className="font-medium">Focus:</span> {planData.focus}</p>}
                    {planData.reasoning && <p><span className="font-medium">Reasoning:</span> {planData.reasoning}</p>}
                    {planData.exercises?.length > 0 && (
                      <p><span className="font-medium">Planned:</span> {planData.exercises.map((e: any) => typeof e === "string" ? formatSlug(e) : formatSlug(e.slug || e.exercise_slug || "")).join(", ")}</p>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}

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

              {/* Adaptation actions with before/after values */}
              {adaptations.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-primary flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Adaptations ({adaptations.length})
                  </h4>
                  {adaptations.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>•</span>
                      <span className="capitalize">{a.adaptation_type.replace(/_/g, " ")}</span>
                      {a.exercise_slug && <Badge variant="outline" className="text-xs py-0">{formatSlug(a.exercise_slug)}</Badge>}
                      {a.value_before != null && a.value_after != null && (
                        <span className="flex items-center gap-1 text-xs">
                          <ArrowRightLeft className="w-2.5 h-2.5" />
                          {JSON.stringify(a.value_before)} → {JSON.stringify(a.value_after)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Exercise breakdown with expandable trial drill-down */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">Exercise Breakdown</h4>
                {insight.exerciseBreakdown.map((ex) => {
                  const exTrials = trialsByExercise.get(ex.slug) || [];
                  const isExExpanded = expandedExercise === ex.slug;
                  const errorKeys = Object.keys(ex.errorTypes);

                  return (
                    <div key={ex.slug} className="rounded border border-border/50">
                      {/* Exercise header - clickable for drill-down */}
                      <button
                        className="w-full flex items-center justify-between p-2 hover:bg-muted/10 transition-colors"
                        onClick={() => setExpandedExercise(isExExpanded ? null : ex.slug)}
                      >
                        <div className="flex items-center gap-2">
                          {isExExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                          <span className="text-sm font-medium">{ex.label}</span>
                          {ex.hasAudio && <Mic className="w-3 h-3 text-muted-foreground" />}
                          {/* Error type dots */}
                          {errorKeys.length > 0 && (
                            <div className="flex gap-0.5">
                              {errorKeys.map((et) => (
                                <span key={et} className={cn("w-2 h-2 rounded-full", ERROR_COLORS[et] || "bg-muted-foreground")} title={`${et}: ${ex.errorTypes[et]}`} />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{ex.trials} trials</span>
                          {ex.avgLatencyMs && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Timer className="w-2.5 h-2.5" />{(ex.avgLatencyMs / 1000).toFixed(1)}s
                            </span>
                          )}
                          <Badge variant={ex.accuracy >= 80 ? "default" : ex.accuracy >= 50 ? "secondary" : "destructive"} className="text-xs">
                            {ex.accuracy}%
                          </Badge>
                        </div>
                      </button>

                      {/* Expanded trial-level detail */}
                      {isExExpanded && (
                        <div className="border-t border-border/30 p-2 space-y-1 bg-muted/5">
                          {/* Error type breakdown */}
                          {errorKeys.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {errorKeys.map((et) => (
                                <Badge key={et} variant="outline" className="text-xs py-0 gap-1">
                                  <span className={cn("w-1.5 h-1.5 rounded-full inline-block", ERROR_COLORS[et] || "bg-muted-foreground")} />
                                  {et.replace(/_/g, " ")}: {ex.errorTypes[et]}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Each trial row */}
                          {exTrials.map((t, idx) => (
                            <div key={t.attempt_id + idx} className="flex items-center gap-2 py-1 px-1.5 rounded text-xs hover:bg-muted/20">
                              {/* Correct/incorrect */}
                              {t.is_correct === true ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                              ) : t.is_correct === false ? (
                                <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                              ) : (
                                <span className="w-3.5 h-3.5 shrink-0" />
                              )}
                              {/* Target word */}
                              <span className="font-medium min-w-[60px] truncate">{t.target_word || "—"}</span>
                              {/* Response/transcript */}
                              {t.transcript && (
                                <span className="text-muted-foreground truncate max-w-[100px]">→ "{t.transcript}"</span>
                              )}
                              {/* Error type badge */}
                              {t.error_type && t.error_type !== "correct" && (
                                <Badge variant="outline" className="text-xs py-0 shrink-0">
                                  {t.error_type.replace(/_/g, " ")}
                                </Badge>
                              )}
                              {/* Cue info */}
                              {t.cue_type_given && t.cue_type_given !== "none" && (
                                <Badge
                                  variant={t.cue_was_effective ? "default" : "secondary"}
                                  className="text-xs py-0 shrink-0"
                                >
                                  {t.cue_type_given.replace(/_/g, " ")}
                                  {t.cue_was_effective === true ? " ✓" : t.cue_was_effective === false ? " ✗" : ""}
                                </Badge>
                              )}
                              {/* Latency */}
                              {t.latency_ms != null && t.latency_ms > 0 && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {(t.latency_ms / 1000).toFixed(1)}s
                                </span>
                              )}
                              {/* Audio play */}
                              {t.audio_storage_path && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Play recording"
                                  className="h-5 w-5 shrink-0 ml-auto"
                                  onClick={() => playAudio(t.audio_storage_path!, t.attempt_id)}
                                >
                                  {playingId === t.attempt_id ? (
                                    <VolumeX className="w-3 h-3 text-primary" />
                                  ) : (
                                    <Volume2 className="w-3 h-3 text-muted-foreground" />
                                  )}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Curated Audio: Best & Worst */}
              {(curatedAudio.best || curatedAudio.worst) && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Key Audio
                  </h4>
                  <div className="space-y-1">
                    {curatedAudio.best && (
                      <AudioTrialRow
                        trial={curatedAudio.best}
                        label="Best"
                        labelClass="text-success"
                        playAudio={playAudio}
                        playingId={playingId}
                      />
                    )}
                    {curatedAudio.worst && (
                      <AudioTrialRow
                        trial={curatedAudio.worst}
                        label="Worst"
                        labelClass="text-destructive"
                        playAudio={playAudio}
                        playingId={playingId}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Clinician Session Notes */}
              <ClinicianNoteSection sessionId={session.id} userId={session.user_id || ""} profileId={session.profile_id} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No trial data for this session.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function AudioTrialRow({
  trial,
  label,
  labelClass,
  playAudio,
  playingId,
}: {
  trial: TrialData;
  label: string;
  labelClass: string;
  playAudio: (path: string, id: string) => void;
  playingId: string | null;
}) {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded bg-muted/20 text-xs">
      <Badge variant="outline" className={cn("text-xs py-0 shrink-0", labelClass)}>
        {label}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Play recording"
        className="h-6 w-6 shrink-0"
        onClick={() => playAudio(trial.audio_storage_path!, trial.attempt_id)}
      >
        {playingId === trial.attempt_id ? (
          <VolumeX className="w-3 h-3 text-primary" />
        ) : (
          <Volume2 className="w-3 h-3 text-muted-foreground" />
        )}
      </Button>
      <span className="font-medium truncate">{trial.target_word || formatSlug(trial.exercise_slug || "")}</span>
      {trial.is_correct ? (
        <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
      ) : (
        <XCircle className="w-3 h-3 text-destructive shrink-0" />
      )}
      {trial.transcript && (
        <span className="text-muted-foreground truncate">"{trial.transcript}"</span>
      )}
    </div>
  );
}

/** Clinician note inline editor for a session */
function ClinicianNoteSection({ sessionId, userId, profileId }: { sessionId: string; userId: string; profileId: string | null }) {
  const [notes, setNotes] = useState<{ id: string; note_text: string; note_type: string; created_at: string; updated_at: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    supabase
      .from("clinician_session_notes" as any)
      .select("id, note_text, note_type, created_at, updated_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setNotes((data as any) ?? []);
        setLoaded(true);
      });
  }, [sessionId]);

  const handleSave = async () => {
    if (!draft.trim() || !user?.id) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("clinician_session_notes" as any)
      .insert({
        session_id: sessionId,
        user_id: userId,
        profile_id: profileId,
        clinician_id: user.id,
        note_text: draft.trim(),
        note_type: "observation",
      } as any)
      .select("id, note_text, note_type, created_at, updated_at")
      .single();
    if (!error && data) {
      setNotes((prev) => [...prev, data as any]);
      setDraft("");
    }
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <div className="space-y-2 pt-2 border-t border-border/30">
      <h4 className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
        <FileText className="w-3 h-3" /> Clinician Notes
      </h4>
      {notes.map((n) => (
        <div key={n.id} className="text-xs p-2 rounded bg-muted/20 space-y-0.5">
          <p className="text-foreground">{n.note_text}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(n.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add clinical observation..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="flex-1 text-xs px-2 py-1.5 rounded border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          onClick={(e) => e.stopPropagation()}
        />
        <Button
          variant="secondary"
          size="sm"
          className="text-xs h-7"
          disabled={!draft.trim() || saving}
          onClick={(e) => { e.stopPropagation(); handleSave(); }}
        >
          {saving ? "..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
