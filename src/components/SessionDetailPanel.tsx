import { useEffect, useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock, Target, TrendingUp, Volume2, VolumeX, CheckCircle2, XCircle,
  AlertTriangle, Zap, Brain
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HelpLabel } from "@/components/HelpTooltip";

interface TrialData {
  attempt_id: string;
  target_word: string;
  transcript: string | null;
  is_correct: boolean | null;
  exercise_slug: string | null;
  latency_ms: number | null;
  error_type: string | null;
  cue_type_given: string | null;
  cue_was_effective: boolean | null;
  audio_storage_path: string | null;
  recording_duration_ms: number | null;
  pronunciation_status: string | null;
  semantic_similarity: number | null;
  phonological_similarity: number | null;
  stuck_type: string | null;
  speech_rate_wpm: number | null;
  created_at: string | null;
  taskParameters?: any;
  outputs?: any;
}

interface SessionDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: {
    id: string;
    started_at: string;
    ended_at?: string;
    duration_sec?: number;
    summary?: any;
  } | null;
}

export function SessionDetailPanel({ open, onOpenChange, session }: SessionDetailPanelProps) {
  const [trials, setTrials] = useState<TrialData[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (session && open) {
      fetchTrials(session.id);
    }
    return () => {
      stopAudio();
    };
  }, [session?.id, open]);

  const fetchTrials = async (sessionId: string) => {
    setLoading(true);
    try {
      // Try utterance_analyses first (speech exercises)
      const { data: uaData, error: uaError } = await supabase
        .from("utterance_analyses")
        .select(
          "attempt_id, target_word, transcript, is_correct, exercise_slug, latency_ms, error_type, cue_type_given, cue_was_effective, audio_storage_path, recording_duration_ms, pronunciation_status, semantic_similarity, phonological_similarity, stuck_type, speech_rate_wpm, created_at"
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (uaError) throw uaError;

      if (uaData && uaData.length > 0) {
        setTrials(uaData);
      } else {
        // Fallback to exercise_events
        const { data: eeData, error: eeError } = await supabase
          .from("exercise_events")
          .select(
            "attempt_id, exercise_slug, score, reaction_time_ms, error_type, cue_type_given, cue_was_effective, cue_level, audio_storage_path, recording_duration_ms, semantic_similarity, phonological_similarity, browser_transcript, whisper_transcript, task_parameters, outputs, created_at"
          )
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });

        if (eeError) throw eeError;

        // Map exercise_events to TrialData shape
        const mapped: TrialData[] = (eeData ?? []).map((ev) => ({
          attempt_id: ev.attempt_id || ev.created_at || "",
          target_word: (ev.task_parameters as any)?.target_word || (ev.task_parameters as any)?.targetWord || (ev.outputs as any)?.target || "",
          transcript: ev.whisper_transcript || ev.browser_transcript || null,
          is_correct: ev.score === 1 || ev.score === 100 ? true : ev.score === 0 ? false : null,
          exercise_slug: ev.exercise_slug,
          latency_ms: ev.reaction_time_ms,
          error_type: ev.error_type,
          cue_type_given: ev.cue_type_given,
          cue_was_effective: ev.cue_was_effective,
          audio_storage_path: ev.audio_storage_path,
          recording_duration_ms: ev.recording_duration_ms,
          pronunciation_status: null,
          semantic_similarity: ev.semantic_similarity,
          phonological_similarity: ev.phonological_similarity,
          stuck_type: null,
          speech_rate_wpm: null,
          created_at: ev.created_at,
          taskParameters: ev.task_parameters,
          outputs: ev.outputs,
        }));
        setTrials(mapped);
      }
    } catch (err) {
      console.error("Error fetching session trials:", err);
    } finally {
      setLoading(false);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  const playAudio = async (path: string, attemptId: string) => {
    if (playingId === attemptId) {
      stopAudio();
      return;
    }

    stopAudio();

    try {
      const { data } = await supabase.storage
        .from("session-recordings")
        .createSignedUrl(path, 60);

      if (data?.signedUrl) {
        const audio = new Audio(data.signedUrl);
        audio.onended = () => setPlayingId(null);
        audio.onerror = () => setPlayingId(null);
        audioRef.current = audio;
        setPlayingId(attemptId);
        await audio.play();
      }
    } catch (err) {
      console.error("Error playing audio:", err);
      setPlayingId(null);
    }
  };

  if (!session) return null;

  // Compute summary stats
  const totalTrials = trials.length;
  const correctTrials = trials.filter((t) => t.is_correct === true).length;
  const accuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
  const avgLatency = totalTrials > 0
    ? Math.round(trials.reduce((s, t) => s + (t.latency_ms ?? 0), 0) / totalTrials)
    : 0;
  const exercises = Array.from(new Set(trials.map((t) => t.exercise_slug).filter(Boolean))) as string[];

  // Error breakdown
  const errorCounts: Record<string, number> = {};
  trials.forEach((t) => {
    const type = t.error_type ?? "unknown";
    errorCounts[type] = (errorCounts[type] || 0) + 1;
  });

  const durationMin = Math.round((session.duration_sec ?? 0) / 60);
  const sessionDate = new Date(session.started_at).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const sessionTime = new Date(session.started_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const errorTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      correct: "Correct",
      semantic_paraphasia: "Semantic error",
      phonological_paraphasia: "Phonological error",
      timeout: "Timeout",
      no_response: "No response",
      unrelated: "Unrelated",
      unknown: "Unknown",
    };
    return map[type] || type.replace(/_/g, " ");
  };

  const errorTypeColor = (type: string) => {
    if (type === "correct") return "bg-green-500/10 text-green-700 border-green-200";
    if (type.includes("semantic")) return "bg-amber-500/10 text-amber-700 border-amber-200";
    if (type.includes("phonological")) return "bg-orange-500/10 text-orange-700 border-orange-200";
    if (type === "timeout" || type === "no_response") return "bg-red-500/10 text-red-700 border-red-200";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-left">
            <span className="block text-lg font-bold">{sessionDate}</span>
            <span className="block text-sm font-normal text-muted-foreground">
              {sessionTime} · {durationMin} min
            </span>
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : totalTrials === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Brain className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No trial data recorded for this session.</p>
          </div>
        ) : (
          <Tabs defaultValue="summary" className="mt-2">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="detailed">Trials ({totalTrials})</TabsTrigger>
            </TabsList>

            {/* ─── Summary Tab ─── */}
            <TabsContent value="summary" className="space-y-4 mt-4">
              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                  <Target className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <div className="text-2xl font-bold text-primary">{accuracy}%</div>
                  <div className="text-xs text-muted-foreground"><HelpLabel term="Accuracy">Accuracy</HelpLabel></div>
                </Card>
                <Card className="p-3 text-center">
                  <Zap className="w-4 h-4 mx-auto mb-1 text-amber-500" />
                  <div className="text-2xl font-bold">{avgLatency}<span className="text-sm font-normal">ms</span></div>
                  <div className="text-xs text-muted-foreground"><HelpLabel term="Reaction Time">Avg RT</HelpLabel></div>
                </Card>
                <Card className="p-3 text-center">
                  <TrendingUp className="w-4 h-4 mx-auto mb-1 text-green-500" />
                  <div className="text-2xl font-bold">{totalTrials}</div>
                  <div className="text-xs text-muted-foreground"><HelpLabel term="Trial Count">Trials</HelpLabel></div>
                </Card>
              </div>

              {/* Exercise breakdown */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Exercises</h3>
                <div className="space-y-2">
                  {exercises.map((slug) => {
                    const exTrials = trials.filter((t) => t.exercise_slug === slug);
                    const exCorrect = exTrials.filter((t) => t.is_correct).length;
                    const exAcc = Math.round((exCorrect / exTrials.length) * 100);
                    return (
                      <div key={slug} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{slug.replace(/_/g, " ").replace(/-/g, " ")}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{exTrials.length} trials</span>
                          <Badge variant={exAcc >= 80 ? "default" : exAcc >= 50 ? "secondary" : "destructive"}>
                            {exAcc}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Error breakdown */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Response Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(errorCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {type === "correct" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span className="text-sm">{errorTypeLabel(type)}</span>
                        </div>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                </div>
              </Card>
            </TabsContent>

            {/* ─── Detailed Tab ─── */}
            <TabsContent value="detailed" className="space-y-4 mt-4">
              {exercises.map((slug) => {
                const exTrials = trials.filter((t) => t.exercise_slug === slug);
                const exCorrect = exTrials.filter((t) => t.is_correct).length;
                const exAcc = exTrials.length > 0 ? Math.round((exCorrect / exTrials.length) * 100) : 0;

                return (
                  <div key={slug}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold capitalize">
                        {slug.replace(/_/g, " ").replace(/-/g, " ")}
                      </h4>
                      <Badge variant={exAcc >= 80 ? "default" : exAcc >= 50 ? "secondary" : "destructive"}>
                        {exCorrect}/{exTrials.length} correct
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {exTrials.map((trial, idx) => {
                        const tp = trial.taskParameters as any;
                        const out = trial.outputs as any;

                        // Build a descriptive label based on exercise type
                        let label = trial.target_word || "";
                        let detail = "";

                        if (slug === "phonological_awareness" || slug?.includes("phonological")) {
                          const w1 = tp?.word1 || out?.task_params?.word1;
                          const w2 = tp?.word2 || out?.task_params?.word2;
                          const expected = tp?.expectedAnswer || out?.task_params?.expectedAnswer;
                          const userAns = tp?.userAnswer || out?.task_params?.userAnswer;
                          if (w1 && w2) {
                            label = `${w1} / ${w2}`;
                            detail = `Expected: ${expected || "?"} · Answered: ${userAns || "?"}`;
                          }
                        } else if (slug === "sentence_construction" || slug?.includes("sentence")) {
                          const sentence = tp?.targetSentence || tp?.sentence || out?.task_params?.targetSentence || out?.target;
                          const userSentence = tp?.userSentence || out?.userSentence || out?.task_params?.userAnswer;
                          if (sentence) label = sentence;
                          if (userSentence && userSentence !== sentence) detail = `Said: "${userSentence}"`;
                        } else if (slug === "reach_tap" || slug === "left_side_hunt") {
                          label = `Target ${idx + 1}`;
                        }

                        if (trial.transcript && !detail) {
                          detail = `Said: "${trial.transcript}"`;
                        }

                        return (
                          <Card
                            key={trial.attempt_id + idx}
                            className={`p-2.5 border-l-4 ${
                              trial.is_correct
                                ? "border-l-success"
                                : "border-l-destructive"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[10px] text-muted-foreground font-mono">#{idx + 1}</span>
                                  <span className="font-medium text-sm truncate">{label || "—"}</span>
                                  {trial.is_correct ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                                  )}
                                </div>

                                {detail && (
                                  <p className="text-xs text-muted-foreground mb-1 truncate">{detail}</p>
                                )}

                                <div className="flex flex-wrap gap-1">
                                  {trial.error_type && trial.error_type !== "correct" && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${errorTypeColor(trial.error_type)}`}>
                                      {errorTypeLabel(trial.error_type)}
                                    </span>
                                  )}
                                  {trial.latency_ms != null && trial.latency_ms > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                                      {trial.latency_ms >= 1000
                                        ? `${(trial.latency_ms / 1000).toFixed(1)}s`
                                        : `${trial.latency_ms}ms`}
                                    </span>
                                  )}
                                  {trial.cue_type_given && trial.cue_type_given !== "none" && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">
                                      Cue: {trial.cue_type_given}
                                      {trial.cue_was_effective === true && " ✓"}
                                      {trial.cue_was_effective === false && " ✗"}
                                    </span>
                                  )}
                                  {trial.speech_rate_wpm != null && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                                      {Math.round(trial.speech_rate_wpm)} wpm
                                    </span>
                                  )}
                                </div>
                              </div>

                              {trial.audio_storage_path && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Play recording"
                                  className="h-8 w-8 flex-shrink-0"
                                  onClick={() => playAudio(trial.audio_storage_path!, trial.attempt_id)}
                                  aria-label={playingId === trial.attempt_id ? "Stop audio" : "Play audio"}
                                >
                                  {playingId === trial.attempt_id ? (
                                    <VolumeX className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}