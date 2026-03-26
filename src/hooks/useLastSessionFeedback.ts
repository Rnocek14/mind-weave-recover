import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LastSessionFeedback {
  /** Did a session end today or since last visit? */
  hasRecentSession: boolean;
  /** Minutes practiced in the last session */
  durationMin: number;
  /** Correct trials in the last session */
  correct: number;
  /** Total trials in the last session */
  total: number;
  /** Accuracy % */
  accuracy: number;
  /** Improvement in correct count vs previous session (can be negative) */
  correctDelta: number;
  /** Current streak */
  streak: number;
  /** Exercise names practiced */
  exerciseNames: string[];
  /** Timestamp of session end */
  endedAt: string;
  /** Session ID for dismiss tracking */
  sessionId: string;
  /** Answers without any cues (cue_level 0) */
  independentCorrect: number;
}

export function useLastSessionFeedback(userId: string, profileId: string) {
  const [feedback, setFeedback] = useState<LastSessionFeedback | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !profileId) return;

    const fetch = async () => {
      try {
        // Get last 2 completed sessions
        const { data: sessions } = await supabase
          .from("sessions")
          .select("id, ended_at, duration_sec, started_at")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .order("ended_at", { ascending: false })
          .limit(2);

        if (!sessions || sessions.length === 0) {
          setLoading(false);
          return;
        }

        const latest = sessions[0];
        const previous = sessions[1] || null;

        // Check if session ended within last 24 hours
        const endedAt = new Date(latest.ended_at!);
        const hoursAgo = (Date.now() - endedAt.getTime()) / (1000 * 60 * 60);
        if (hoursAgo > 24) {
          setLoading(false);
          return;
        }

        // Check if already dismissed this session
        const dismissKey = `post-session-dismissed-${latest.id}`;
        if (sessionStorage.getItem(dismissKey)) {
          setDismissed(true);
          setLoading(false);
          return;
        }

        // Get events for latest session
        const { data: latestEvents } = await supabase
          .from("exercise_events")
          .select("score, exercise_slug, cue_level")
          .eq("session_id", latest.id);

        const correct = latestEvents?.filter(e => e.score === 100).length || 0;
        const total = latestEvents?.length || 0;
        const exercises = [...new Set(latestEvents?.map(e => e.exercise_slug).filter(Boolean) || [])];
        const independentCorrect = latestEvents?.filter(e => e.score === 100 && (e.cue_level === 0 || e.cue_level === null)).length || 0;

        // Get events for previous session to compute delta
        let prevCorrect = 0;
        if (previous) {
          const { data: prevEvents } = await supabase
            .from("exercise_events")
            .select("score")
            .eq("session_id", previous.id);
          prevCorrect = prevEvents?.filter(e => e.score === 100).length || 0;
        }

        // Compute streak
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: allSessions } = await supabase
          .from("sessions")
          .select("ended_at")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .gte("ended_at", new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString())
          .order("ended_at", { ascending: false });

        if (allSessions) {
          const sessionDates = new Set(
            allSessions.map(s => new Date(s.ended_at!).toISOString().split("T")[0])
          );
          for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toISOString().split("T")[0];
            if (sessionDates.has(dateStr)) streak++;
            else if (i > 0) break;
          }
        }

        setFeedback({
          hasRecentSession: true,
          durationMin: Math.round((latest.duration_sec || 0) / 60),
          correct,
          total,
          accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
          correctDelta: correct - prevCorrect,
          streak,
          exerciseNames: exercises as string[],
          endedAt: latest.ended_at!,
          sessionId: latest.id,
        });
      } catch (err) {
        console.error("Error fetching last session feedback:", err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [userId, profileId]);

  const dismiss = (sessionId?: string) => {
    setDismissed(true);
    if (sessionId) {
      sessionStorage.setItem(`post-session-dismissed-${sessionId}`, "1");
    }
  };

  return { feedback: dismissed ? null : feedback, loading, dismiss };
}
