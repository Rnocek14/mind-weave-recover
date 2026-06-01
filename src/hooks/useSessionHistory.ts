import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TrialDetail {
  id: string;
  round: number;
  score: number | null;
  reactionTimeMs: number | null;
  errorType: string | null;
  cueLevel: number | null;
  taskParameters: any;
  outputs: any;
  createdAt: string;
}

export interface SessionDetail {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  summary: any;
  plan: any;
  exercises: Array<{
    slug: string;
    trials: TrialDetail[];
    accuracy: number;
    totalTrials: number;
  }>;
}

export interface FilterOptions {
  exerciseSlug?: string;
  dateFrom?: string;
  dateTo?: string;
  minScore?: number;
  maxScore?: number;
}

export const useSessionHistory = (userId: string | undefined | null, profileId?: string | null) => {
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({});

  useEffect(() => {
    if (userId && profileId !== null) {
      loadSessions();
    } else {
      setSessions([]);
      setFilteredSessions([]);
      setLoading(false);
    }
  }, [userId, profileId]);

  useEffect(() => {
    applyFilters();
  }, [sessions, filters]);

  const loadSessions = async () => {
    if (!userId || profileId === null) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all sessions (excluding superseded duplicates + ghost sweeps)
      let sessionsQuery: any = supabase
        .from("sessions")
        .select("*")
        .eq("user_id", userId)
        .not("ended_at", "is", null)
        .not("ended_reason", "in", "(superseded,timeout_sweep,stale_auto_closed)")
        .order("ended_at", { ascending: false });
      if (profileId) sessionsQuery = sessionsQuery.eq("profile_id", profileId);
      const { data: sessionsData, error: sessionsError } = await sessionsQuery;

      if (sessionsError) throw sessionsError;
      if (!sessionsData || sessionsData.length === 0) {
        setSessions([]);
        setFilteredSessions([]);
        setLoading(false);
        return;
      }

      // Fetch all events for these sessions
      const { data: eventsData, error: eventsError } = await supabase
        .from("exercise_events")
        .select("*")
        .in(
          "session_id",
          sessionsData.map((s) => s.id)
        )
        .order("created_at", { ascending: true });

      if (eventsError) throw eventsError;

      // Fallback sources so Photo Naming / Fix Sentence sessions (which write to
      // utterance_analyses + adaptation_trial_logs, not exercise_events) still appear.
      const sessionIds = sessionsData.map((s) => s.id);
      const [{ data: utterances }, { data: trialLogs }] = await Promise.all([
        supabase.from("utterance_analyses").select("session_id, exercise_slug, is_correct, latency_ms, created_at, id").in("session_id", sessionIds),
        supabase.from("adaptation_trial_logs").select("session_id, exercise_slug, correct, reaction_time_ms, created_at, id, difficulty").in("session_id", sessionIds),
      ]);

      // Group events by session and exercise
      const sessionsWithDetails: SessionDetail[] = sessionsData
        .map((session) => {
          const sessionEvents = eventsData?.filter((e) => e.session_id === session.id) || [];
          const exerciseMap: Record<string, TrialDetail[]> = {};
          sessionEvents.forEach((event) => {
            const slug = event.exercise_slug || "unknown";
            if (!exerciseMap[slug]) exerciseMap[slug] = [];
            exerciseMap[slug].push({
              id: event.id,
              round: event.round,
              score: event.score,
              reactionTimeMs: event.reaction_time_ms,
              errorType: event.error_type,
              cueLevel: event.cue_level,
              taskParameters: event.task_parameters,
              outputs: event.outputs,
              createdAt: event.created_at || ""
            });
          });

          // Fallback: synthesize trials from utterance_analyses / adaptation_trial_logs
          // for sessions that wrote no exercise_events (Photo Naming, Fix Sentence).
          if (sessionEvents.length === 0) {
            const sessionUtt = (utterances || []).filter((u) => u.session_id === session.id);
            const sessionLogs = (trialLogs || []).filter((t) => t.session_id === session.id);
            sessionUtt.forEach((u, idx) => {
              const slug = u.exercise_slug || "unknown";
              if (!exerciseMap[slug]) exerciseMap[slug] = [];
              exerciseMap[slug].push({
                id: u.id, round: idx + 1,
                score: u.is_correct ? 1 : 0,
                reactionTimeMs: u.latency_ms ?? null,
                errorType: null, cueLevel: null, taskParameters: {}, outputs: {},
                createdAt: u.created_at || ""
              });
            });
            sessionLogs.forEach((t, idx) => {
              const slug = t.exercise_slug || "unknown";
              if (!exerciseMap[slug]) exerciseMap[slug] = [];
              // Only add if not already represented by an utterance row
              if (sessionUtt.length === 0) {
                exerciseMap[slug].push({
                  id: t.id, round: idx + 1,
                  score: t.correct ? 1 : 0,
                  reactionTimeMs: t.reaction_time_ms ?? null,
                  errorType: null, cueLevel: null,
                  taskParameters: { difficulty: t.difficulty }, outputs: {},
                  createdAt: t.created_at || ""
                });
              }
            });
          }

          const exercises = Object.entries(exerciseMap).map(([slug, trials]) => {
            const correctCount = trials.filter((t) => t.score === 1 || t.score === 100).length;
            return {
              slug,
              trials,
              accuracy: trials.length > 0 ? Math.round((correctCount / trials.length) * 100) : 0,
              totalTrials: trials.length
            };
          });

          return {
            id: session.id,
            startedAt: session.started_at || "",
            endedAt: session.ended_at,
            durationSec: session.duration_sec,
            summary: session.summary,
            plan: session.plan,
            exercises
          };
        })
        // Filter out sessions with no exercise events
        .filter((s) => s.exercises.length > 0);

      setSessions(sessionsWithDetails);
    } catch (err) {
      console.error("Error loading session history:", err);
      setError(err instanceof Error ? err.message : "Failed to load session history");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...sessions];

    // Filter by exercise
    if (filters.exerciseSlug) {
      filtered = filtered.filter((session) =>
        session.exercises.some((ex) => ex.slug === filters.exerciseSlug)
      );
    }

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(
        (session) => new Date(session.startedAt) >= fromDate
      );
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(
        (session) => new Date(session.startedAt) <= toDate
      );
    }

    // Filter by score
    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      filtered = filtered.filter((session) => {
        const avgAccuracy =
          session.exercises.reduce((sum, ex) => sum + ex.accuracy, 0) /
          session.exercises.length;
        
        if (filters.minScore !== undefined && avgAccuracy < filters.minScore) {
          return false;
        }
        if (filters.maxScore !== undefined && avgAccuracy > filters.maxScore) {
          return false;
        }
        return true;
      });
    }

    setFilteredSessions(filtered);
  };

  const updateFilters = (newFilters: Partial<FilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  return {
    sessions: filteredSessions,
    allSessions: sessions,
    loading,
    error,
    filters,
    updateFilters,
    clearFilters,
    refresh: loadSessions
  };
};
