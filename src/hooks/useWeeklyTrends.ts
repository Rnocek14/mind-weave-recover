import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { format, subDays, startOfDay } from "date-fns";

export interface DailyTrend {
  date: string;
  displayDate: string;
  timeMinutes: number;
  accuracy: number;
  totalTrials: number;
  correctTrials: number;
}

export function useWeeklyTrends() {
  const { activeProfile } = useProfile();
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProfile?.id) return;

    const fetchWeeklyTrends = async () => {
      setLoading(true);
      try {
        const today = startOfDay(new Date());
        const sevenDaysAgo = subDays(today, 6);

        // Fetch all sessions from the last 7 days
        const { data: sessions } = await supabase
          .from("sessions")
          .select("id, started_at, duration_sec")
          .eq("profile_id", activeProfile.id)
          .gte("started_at", sevenDaysAgo.toISOString())
          .order("started_at", { ascending: true });

        // Initialize data structure for all 7 days
        const dailyData: Record<string, DailyTrend> = {};
        for (let i = 0; i < 7; i++) {
          const date = subDays(today, 6 - i);
          const dateKey = format(date, "yyyy-MM-dd");
          dailyData[dateKey] = {
            date: dateKey,
            displayDate: format(date, "EEE"),
            timeMinutes: 0,
            accuracy: 0,
            totalTrials: 0,
            correctTrials: 0,
          };
        }

        if (sessions && sessions.length > 0) {
          // Group sessions by day and sum durations
          sessions.forEach((session) => {
            const dateKey = format(new Date(session.started_at!), "yyyy-MM-dd");
            if (dailyData[dateKey]) {
              dailyData[dateKey].timeMinutes += Math.round((session.duration_sec || 0) / 60);
            }
          });

          // Fetch exercise events for accuracy calculation
          const sessionIds = sessions.map(s => s.id);
          const { data: events } = await supabase
            .from("exercise_events")
            .select("session_id, score, created_at")
            .in("session_id", sessionIds);

          if (events) {
            // Group events by day
            events.forEach((event) => {
              const dateKey = format(new Date(event.created_at!), "yyyy-MM-dd");
              if (dailyData[dateKey]) {
                dailyData[dateKey].totalTrials += 1;
                if (event.score === 100) {
                  dailyData[dateKey].correctTrials += 1;
                }
              }
            });

            // Calculate accuracy for each day
            Object.values(dailyData).forEach((day) => {
              if (day.totalTrials > 0) {
                day.accuracy = Math.round((day.correctTrials / day.totalTrials) * 100);
              }
            });
          }
        }

        setTrends(Object.values(dailyData));
      } catch (error) {
        console.error("Error fetching weekly trends:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyTrends();
  }, [activeProfile?.id]);

  return { trends, loading };
}
