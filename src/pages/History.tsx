import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
    exercise_slug: string;
    round: number;
    score?: number;
    created_at: string;
  }>;
}

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<SessionWithEvents[]>([]);
  const [loading, setLoading] = useState(true);

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
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, started_at, ended_at, duration_sec, summary")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false });

      if (!sessions || sessions.length === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      const sessionIds = sessions.map((s) => s.id);
      const { data: events } = await supabase
        .from("exercise_events")
        .select("session_id, exercise_slug, round, score, created_at")
        .in("session_id", sessionIds);

      const bySession: Record<string, SessionWithEvents> = {};
      sessions.forEach((s) => {
        bySession[s.id] = { session: s, events: [] };
      });
      (events ?? []).forEach((e) => {
        if (bySession[e.session_id]) {
          bySession[e.session_id].events.push(e);
        }
      });

      setHistory(Object.values(bySession));
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
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <div className="text-lg">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Session History</h1>
          <p className="text-muted-foreground">
            Your progress over time
          </p>
        </div>

        {history.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No sessions yet. Start your first exercise to see your progress here!
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {history.map(({ session, events }) => {
              const exercises = Array.from(new Set(events.map((e) => e.exercise_slug)));
              const scores = events.map((e) => e.score ?? 0).filter((s) => s > 0);
              const avgScore = scores.length > 0
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : 0;

              return (
                <Card key={session.id} className="p-6 shadow-card hover:shadow-glow transition-shadow">
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
                        <div className="text-xs text-muted-foreground">Rounds</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-success">{exercises.length}</div>
                        <div className="text-xs text-muted-foreground">Exercises</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-accent">{avgScore}</div>
                        <div className="text-xs text-muted-foreground">Avg Score</div>
                      </div>
                    </div>
                  </div>

                  {/* Simple sparkline for score progression */}
                  {scores.length > 1 && (
                    <div className="mt-4">
                      <svg className="w-full h-12" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polyline
                          points={scores.map((s, i) => {
                            const x = (i / (scores.length - 1)) * 100;
                            const max = Math.max(...scores, 1);
                            const y = 100 - (s / max) * 80;
                            return `${x},${y}`;
                          }).join(" ")}
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="w-4 h-4" />
                    <span>{exercises.map(e => e.replace(/-/g, " ")).join(" • ")}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
