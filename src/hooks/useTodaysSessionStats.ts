import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";

export interface TodaysSessionStats {
  timeWorkedMinutes: number;
  dailyGoalMinutes: number;
  correctTrials: number;
  totalTrials: number;
  exercisesCompleted: number;
  exercisesSkipped: number;
  accuracy: number;
}

export function useTodaysSessionStats() {
  const { activeProfile } = useProfile();
  const [stats, setStats] = useState<TodaysSessionStats>({
    timeWorkedMinutes: 0,
    dailyGoalMinutes: 20,
    correctTrials: 0,
    totalTrials: 0,
    exercisesCompleted: 0,
    exercisesSkipped: 0,
    accuracy: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProfile?.id) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        // Fetch sessions for today
        const { data: sessions } = await supabase
          .from("sessions")
          .select("id, duration_sec")
          .eq("profile_id", activeProfile.id)
          .gte("started_at", todayISO);

        // Calculate total time worked
        const timeWorkedMinutes = Math.round(
          (sessions?.reduce((sum, s) => sum + (s.duration_sec || 0), 0) || 0) / 60
        );

        // Get session IDs for today
        const sessionIds = sessions?.map(s => s.id) || [];

        let correctTrials = 0;
        let totalTrials = 0;
        let exercisesCompleted = 0;

        if (sessionIds.length > 0) {
          // Fetch exercise events for today's sessions
          const { data: events } = await supabase
            .from("exercise_events")
            .select("score, exercise_slug")
            .in("session_id", sessionIds);

          if (events) {
            totalTrials = events.length;
            correctTrials = events.filter(e => e.score === 100).length;
            
            // Count distinct exercises
            const uniqueExercises = new Set(events.map(e => e.exercise_slug));
            exercisesCompleted = uniqueExercises.size;
          }
        }

        // Fetch skips for today
        const { data: skips } = await supabase
          .from("exercise_skips")
          .select("id")
          .eq("profile_id", activeProfile.id)
          .gte("skipped_at", todayISO);

        const exercisesSkipped = skips?.length || 0;

        // Calculate accuracy
        const accuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;

        setStats({
          timeWorkedMinutes,
          dailyGoalMinutes: activeProfile.daily_goal_minutes || 20,
          correctTrials,
          totalTrials,
          exercisesCompleted,
          exercisesSkipped,
          accuracy,
        });
      } catch (error) {
        console.error("Error fetching today's stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [activeProfile?.id]);

  return { stats, loading };
}
