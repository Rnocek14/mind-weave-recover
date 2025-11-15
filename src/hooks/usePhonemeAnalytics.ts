import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PhonemeErrorPair {
  from: string;
  to: string;
  count: number;
  percentage: number;
}

export interface PositionErrors {
  onset: number;
  nucleus: number;
  coda: number;
  total: number;
}

export interface SessionTrend {
  date: string;
  accuracy: number;
  errorCount: number;
  totalTrials: number;
}

export interface PhonemeAnalytics {
  errorPairs: PhonemeErrorPair[];
  positionErrors: PositionErrors;
  sessionTrends: SessionTrend[];
  overallAccuracy: number;
  totalSessions: number;
  mostCommonErrors: PhonemeErrorPair[];
  weakestPosition: "onset" | "nucleus" | "coda" | null;
}

export const usePhonemeAnalytics = (userId: string | undefined) => {
  const [analytics, setAnalytics] = useState<PhonemeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      loadAnalytics();
    }
  }, [userId]);

  const loadAnalytics = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Get all sessions for phonological awareness
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("id, ended_at")
        .eq("user_id", userId)
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: true });

      if (sessionsError) throw sessionsError;
      if (!sessions || sessions.length === 0) {
        setAnalytics({
          errorPairs: [],
          positionErrors: { onset: 0, nucleus: 0, coda: 0, total: 0 },
          sessionTrends: [],
          overallAccuracy: 0,
          totalSessions: 0,
          mostCommonErrors: [],
          weakestPosition: null
        });
        setLoading(false);
        return;
      }

      // Get all phonological awareness events
      const { data: events, error: eventsError } = await supabase
        .from("exercise_events")
        .select("*")
        .in(
          "session_id",
          sessions.map((s) => s.id)
        )
        .eq("exercise_slug", "phonological-awareness");

      if (eventsError) throw eventsError;
      if (!events || events.length === 0) {
        setAnalytics({
          errorPairs: [],
          positionErrors: { onset: 0, nucleus: 0, coda: 0, total: 0 },
          sessionTrends: [],
          overallAccuracy: 0,
          totalSessions: 0,
          mostCommonErrors: [],
          weakestPosition: null
        });
        setLoading(false);
        return;
      }

      // Analyze error pairs
      const errorPairMap: Record<string, number> = {};
      const positionErrorCounts = { onset: 0, nucleus: 0, coda: 0, total: 0 };
      let totalCorrect = 0;

      events.forEach((event) => {
        const outputs = event.outputs as any;
        const inputs = event.inputs as any;

        if (event.score === 1) {
          totalCorrect++;
        } else if (outputs?.phonemeDiffs) {
          const diffs = outputs.phonemeDiffs as Array<{
            pos: number;
            from: string;
            to: string;
          }>;

          diffs.forEach((diff) => {
            const key = `${diff.from}→${diff.to}`;
            errorPairMap[key] = (errorPairMap[key] || 0) + 1;

            // Categorize by position
            if (diff.pos === 0) {
              positionErrorCounts.onset++;
            } else if (diff.pos === 1) {
              positionErrorCounts.nucleus++;
            } else {
              positionErrorCounts.coda++;
            }
            positionErrorCounts.total++;
          });
        }
      });

      // Convert error pairs to array and calculate percentages
      const errorPairs: PhonemeErrorPair[] = Object.entries(errorPairMap)
        .map(([pair, count]) => {
          const [from, to] = pair.split("→");
          return {
            from,
            to,
            count,
            percentage: Math.round((count / events.length) * 100)
          };
        })
        .sort((a, b) => b.count - a.count);

      // Calculate session trends
      const sessionMap: Record<
        string,
        { correct: number; total: number; date: string }
      > = {};

      sessions.forEach((session) => {
        const sessionEvents = events.filter(
          (e) => e.session_id === session.id
        );
        if (sessionEvents.length > 0) {
          const dateKey = new Date(session.ended_at!).toLocaleDateString();
          if (!sessionMap[dateKey]) {
            sessionMap[dateKey] = { correct: 0, total: 0, date: session.ended_at! };
          }
          sessionMap[dateKey].correct += sessionEvents.filter(
            (e) => e.score === 1
          ).length;
          sessionMap[dateKey].total += sessionEvents.length;
        }
      });

      const sessionTrends: SessionTrend[] = Object.entries(sessionMap)
        .map(([date, data]) => ({
          date: data.date,
          accuracy: Math.round((data.correct / data.total) * 100),
          errorCount: data.total - data.correct,
          totalTrials: data.total
        }))
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

      // Determine weakest position
      let weakestPosition: "onset" | "nucleus" | "coda" | null = null;
      if (positionErrorCounts.total > 0) {
        const positions = [
          { name: "onset" as const, count: positionErrorCounts.onset },
          { name: "nucleus" as const, count: positionErrorCounts.nucleus },
          { name: "coda" as const, count: positionErrorCounts.coda }
        ];
        weakestPosition = positions.sort((a, b) => b.count - a.count)[0].name;
      }

      setAnalytics({
        errorPairs,
        positionErrors: positionErrorCounts,
        sessionTrends,
        overallAccuracy: Math.round((totalCorrect / events.length) * 100),
        totalSessions: sessions.length,
        mostCommonErrors: errorPairs.slice(0, 5),
        weakestPosition
      });
    } catch (err) {
      console.error("Error loading phoneme analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  return { analytics, loading, error, refresh: loadAnalytics };
};
