import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, TrendingUp } from "lucide-react";
import { BackButton } from "@/components/layout/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUiMode } from "@/hooks/useUiMode";
import { SessionDetailPanel } from "@/components/SessionDetailPanel";

interface SessionWithEvents {
  session: {
    id: string;
    started_at: string;
    ended_at?: string;
    duration_sec?: number;
    summary?: any;
  };
  events: Array<{
    session_id: string;
    exercise_slug: string | null;
    is_correct: boolean | null;
    created_at: string | null;
  }>;
}

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const { uiMode } = useUiMode();
  const isPatient = uiMode === 'patient';
  const navigate = useNavigate();
  const [history, setHistory] = useState<SessionWithEvents[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionWithEvents["session"] | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/auth");
      return;
    }

    fetchHistory();
  }, [authLoading, user, navigate]);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("id, started_at, ended_at, duration_sec, summary")
        .eq("user_id", user.id)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(50);

      if (sessionsError) throw sessionsError;

      if (!sessions || sessions.length === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      const sessionIds = sessions.map((s) => s.id);

      const [utteranceResult, exerciseResult] = await Promise.all([
        supabase
          .from("utterance_analyses")
          .select("session_id, exercise_slug, is_correct, created_at")
          .in("session_id", sessionIds),
        supabase
          .from("exercise_events")
          .select("session_id, exercise_slug, score, created_at")
          .in("session_id", sessionIds),
      ]);

      if (utteranceResult.error && exerciseResult.error) {
        throw utteranceResult.error;
      }

      const utteranceBySession: Record<string, SessionWithEvents["events"]> = {};
      (utteranceResult.data ?? []).forEach((u) => {
        if (!u.session_id) return;
        if (!utteranceBySession[u.session_id]) utteranceBySession[u.session_id] = [];
        utteranceBySession[u.session_id].push({
          session_id: u.session_id,
          exercise_slug: u.exercise_slug,
          is_correct: u.is_correct,
          created_at: u.created_at,
        });
      });

      const exerciseBySession: Record<string, SessionWithEvents["events"]> = {};
      (exerciseResult.data ?? []).forEach((e) => {
        if (!exerciseBySession[e.session_id]) exerciseBySession[e.session_id] = [];
        exerciseBySession[e.session_id].push({
          session_id: e.session_id,
          exercise_slug: e.exercise_slug,
          is_correct: (e.score ?? 0) > 0,
          created_at: e.created_at,
        });
      });

      const bySession: Record<string, SessionWithEvents> = {};
      sessions.forEach((s) => {
        const utteranceEvents = utteranceBySession[s.id] ?? [];
        const fallbackExerciseEvents = exerciseBySession[s.id] ?? [];

        bySession[s.id] = {
          session: s,
          events: utteranceEvents.length > 0 ? utteranceEvents : fallbackExerciseEvents,
        };
      });

      // Only show sessions that have at least one event
      setHistory(Object.values(bySession).filter((s) => s.events.length > 0));
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-gradient-calm flex items-center justify-center">
        <div className="text-lg">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold">Session History</h1>
            <p className="text-muted-foreground">
              {isPatient ? 'Your progress over time' : 'Practice sessions and performance'}
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {isPatient
                ? 'No sessions yet. Start your first exercise to see your progress here!'
                : 'No sessions recorded yet.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
          {history.map(({ session, events }) => {
              const exercises = Array.from(new Set(events.map((e) => e.exercise_slug).filter(Boolean)));
              const correctCount = events.filter((e) => e.is_correct === true).length;
              const totalTrials = events.length;
              const accuracy = totalTrials > 0 ? Math.round((correctCount / totalTrials) * 100) : 0;

              return (
                <Card 
                  key={session.id} 
                  className="p-6 shadow-card hover:shadow-glow transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedSession(session);
                    setPanelOpen(true);
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{formatDate(session.started_at)}</span>
                        <span className="text-muted-foreground">at {formatTime(session.started_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>
                          {Math.round((session.duration_sec ?? 0) / 60)} minutes
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-primary">{events.length}</div>
                        <div className="text-xs text-muted-foreground">{isPatient ? 'Tries' : 'Trials'}</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-success">{exercises.length}</div>
                        <div className="text-xs text-muted-foreground">{isPatient ? 'Activities' : 'Exercises'}</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-accent">{accuracy}%</div>
                        <div className="text-xs text-muted-foreground">{isPatient ? 'Score' : 'Accuracy'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="w-4 h-4" />
                    <span>{exercises.map((e: string) => e.replace(/-/g, " ")).join(" • ") || "No exercises"}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <SessionDetailPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        session={selectedSession}
      />
    </div>
  );
}
