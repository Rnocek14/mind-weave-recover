import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WeeklySessionStats {
  trialCount: number;
  sessionCount: number;
  avgAccuracy: number | null;
  priorAvgAccuracy: number | null;
  accuracySlope: number | null;
  isLoading: boolean;
}

/**
 * Fetches aggregated session/trial stats for the last 7 and prior 7 days.
 * Used by the progress note generator.
 */
export function useWeeklySessionStats(profileId: string | undefined): WeeklySessionStats {
  const [stats, setStats] = useState<WeeklySessionStats>({
    trialCount: 0,
    sessionCount: 0,
    avgAccuracy: null,
    priorAvgAccuracy: null,
    accuracySlope: null,
    isLoading: true,
  });

  useEffect(() => {
    if (!profileId) {
      setStats((s) => ({ ...s, isLoading: false }));
      return;
    }

    const load = async () => {
      try {
        const now = new Date();
        const sevenAgo = new Date(now);
        sevenAgo.setDate(sevenAgo.getDate() - 7);
        const fourteenAgo = new Date(now);
        fourteenAgo.setDate(fourteenAgo.getDate() - 14);

        const fmt = (d: Date) => d.toISOString();

        // Recent 7 days: sessions + events
        const { data: recentSessions } = await supabase
          .from("sessions")
          .select("id, ended_at, duration_sec")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .gte("ended_at", fmt(sevenAgo))
          .gte("duration_sec", 60);

        const sessionIds = (recentSessions || []).map((s) => s.id);
        let recentScores: number[] = [];

        if (sessionIds.length > 0) {
          const { data: events } = await supabase
            .from("exercise_events")
            .select("score, session_id")
            .in("session_id", sessionIds)
            .not("score", "is", null);

          recentScores = (events || []).map((e) => {
            const s = e.score!;
            return s <= 1 ? s * 100 : s;
          });
        }

        // Prior 7 days
        const { data: priorSessions } = await supabase
          .from("sessions")
          .select("id")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .gte("ended_at", fmt(fourteenAgo))
          .lt("ended_at", fmt(sevenAgo))
          .gte("duration_sec", 60);

        let priorScores: number[] = [];
        const priorIds = (priorSessions || []).map((s) => s.id);
        if (priorIds.length > 0) {
          const { data: priorEvents } = await supabase
            .from("exercise_events")
            .select("score")
            .in("session_id", priorIds)
            .not("score", "is", null);

          priorScores = (priorEvents || []).map((e) => {
            const s = e.score!;
            return s <= 1 ? s * 100 : s;
          });
        }

        // Learning rate (most recent)
        const { data: lrData } = await supabase
          .from("learning_rates")
          .select("accuracy_slope")
          .eq("profile_id", profileId)
          .order("calculated_at", { ascending: false })
          .limit(1);

        const avgAcc = recentScores.length > 0
          ? recentScores.reduce((s, n) => s + n, 0) / recentScores.length
          : null;
        const priorAvg = priorScores.length > 0
          ? priorScores.reduce((s, n) => s + n, 0) / priorScores.length
          : null;

        setStats({
          trialCount: recentScores.length,
          sessionCount: sessionIds.length,
          avgAccuracy: avgAcc,
          priorAvgAccuracy: priorAvg,
          accuracySlope: lrData?.[0]?.accuracy_slope ?? null,
          isLoading: false,
        });
      } catch (err) {
        console.error("[useWeeklySessionStats] error:", err);
        setStats((s) => ({ ...s, isLoading: false }));
      }
    };

    load();
  }, [profileId]);

  return stats;
}
