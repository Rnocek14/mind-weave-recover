import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CategoryPerformance {
  category: string;
  correct: number;
  total: number;
  accuracy: number;
}

export interface AbstractnessLevel {
  level: number;
  correct: number;
  total: number;
  accuracy: number;
  avgReactionTime: number;
}

export interface DistractorAnalysis {
  type: string;
  effectiveness: number; // % of times user was fooled
  count: number;
}

export interface SessionTrend {
  date: string;
  accuracy: number;
  avgAbstractness: number;
  categoryAccuracy: Record<string, number>;
}

export interface SemanticAnalytics {
  categoryPerformance: CategoryPerformance[];
  abstractnessLevels: AbstractnessLevel[];
  distractorAnalysis: DistractorAnalysis[];
  sessionTrends: SessionTrend[];
  overallAccuracy: number;
  totalSessions: number;
  weakestCategory: string | null;
  hardestAbstractnessLevel: number | null;
  mostEffectiveDistractor: string | null;
}

export const useSemanticAnalytics = (userId: string | undefined) => {
  const [analytics, setAnalytics] = useState<SemanticAnalytics | null>(null);
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
      // Get all sessions for semantic features
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("id, ended_at")
        .eq("user_id", userId)
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: true });

      if (sessionsError) throw sessionsError;
      if (!sessions || sessions.length === 0) {
        setAnalytics({
          categoryPerformance: [],
          abstractnessLevels: [],
          distractorAnalysis: [],
          sessionTrends: [],
          overallAccuracy: 0,
          totalSessions: 0,
          weakestCategory: null,
          hardestAbstractnessLevel: null,
          mostEffectiveDistractor: null
        });
        setLoading(false);
        return;
      }

      // Get all semantic feature events
      const { data: events, error: eventsError } = await supabase
        .from("exercise_events")
        .select("*")
        .in(
          "session_id",
          sessions.map((s) => s.id)
        )
        .eq("exercise_slug", "semantic-features");

      if (eventsError) throw eventsError;
      if (!events || events.length === 0) {
        setAnalytics({
          categoryPerformance: [],
          abstractnessLevels: [],
          distractorAnalysis: [],
          sessionTrends: [],
          overallAccuracy: 0,
          totalSessions: 0,
          weakestCategory: null,
          hardestAbstractnessLevel: null,
          mostEffectiveDistractor: null
        });
        setLoading(false);
        return;
      }

      // Analyze category performance
      const categoryMap: Record<
        string,
        { correct: number; total: number }
      > = {};

      // Analyze abstractness levels
      const abstractnessMap: Record<
        number,
        { correct: number; total: number; totalRT: number; rtCount: number }
      > = {};

      // Analyze distractor effectiveness
      const distractorMap: Record<string, { fooled: number; total: number }> = {};

      let totalCorrect = 0;

      events.forEach((event) => {
        const outputs = event.outputs as any;
        const inputs = event.inputs as any;

        if (event.score === 1) {
          totalCorrect++;
        }

        // Category analysis
        if (outputs?.analysis) {
          const { missedCategories, incorrectCategories } = outputs.analysis;

          // Track all categories that appeared
          const allCategories = [
            ...(missedCategories || []),
            ...(incorrectCategories || [])
          ];

          allCategories.forEach((cat: string) => {
            if (!categoryMap[cat]) {
              categoryMap[cat] = { correct: 0, total: 0 };
            }
            categoryMap[cat].total++;
            
            // If not in missed or incorrect, it was correct
            if (
              !missedCategories?.includes(cat) &&
              !incorrectCategories?.includes(cat)
            ) {
              categoryMap[cat].correct++;
            }
          });
        }

        // Abstractness analysis
        if (outputs?.analysis?.weakestAbstractness !== undefined) {
          const level = outputs.analysis.weakestAbstractness;
          if (!abstractnessMap[level]) {
            abstractnessMap[level] = {
              correct: 0,
              total: 0,
              totalRT: 0,
              rtCount: 0
            };
          }
          abstractnessMap[level].total++;
          if (event.score === 1) {
            abstractnessMap[level].correct++;
          }
          if (event.reaction_time_ms) {
            abstractnessMap[level].totalRT += event.reaction_time_ms;
            abstractnessMap[level].rtCount++;
          }
        }

        // Distractor analysis
        if (inputs?.distractorTypes) {
          const types = inputs.distractorTypes as string[];
          types.forEach((type: string) => {
            if (!distractorMap[type]) {
              distractorMap[type] = { fooled: 0, total: 0 };
            }
            distractorMap[type].total++;
            if (event.score !== 1) {
              distractorMap[type].fooled++;
            }
          });
        }
      });

      // Convert to arrays
      const categoryPerformance: CategoryPerformance[] = Object.entries(
        categoryMap
      )
        .map(([category, data]) => ({
          category,
          correct: data.correct,
          total: data.total,
          accuracy: Math.round((data.correct / data.total) * 100)
        }))
        .sort((a, b) => a.accuracy - b.accuracy);

      const abstractnessLevels: AbstractnessLevel[] = Object.entries(
        abstractnessMap
      )
        .map(([level, data]) => ({
          level: parseInt(level),
          correct: data.correct,
          total: data.total,
          accuracy: Math.round((data.correct / data.total) * 100),
          avgReactionTime:
            data.rtCount > 0 ? Math.round(data.totalRT / data.rtCount) : 0
        }))
        .sort((a, b) => a.level - b.level);

      const distractorAnalysis: DistractorAnalysis[] = Object.entries(
        distractorMap
      )
        .map(([type, data]) => ({
          type,
          effectiveness: Math.round((data.fooled / data.total) * 100),
          count: data.total
        }))
        .sort((a, b) => b.effectiveness - a.effectiveness);

      // Calculate session trends
      const sessionMap: Record<
        string,
        {
          correct: number;
          total: number;
          abstractnessSum: number;
          abstractnessCount: number;
          date: string;
          categoryCorrect: Record<string, number>;
          categoryTotal: Record<string, number>;
        }
      > = {};

      sessions.forEach((session) => {
        const sessionEvents = events.filter(
          (e) => e.session_id === session.id
        );
        if (sessionEvents.length > 0) {
          const dateKey = new Date(session.ended_at!).toLocaleDateString();
          if (!sessionMap[dateKey]) {
            sessionMap[dateKey] = {
              correct: 0,
              total: 0,
              abstractnessSum: 0,
              abstractnessCount: 0,
              date: session.ended_at!,
              categoryCorrect: {},
              categoryTotal: {}
            };
          }

          sessionEvents.forEach((event) => {
            sessionMap[dateKey].total++;
            if (event.score === 1) {
              sessionMap[dateKey].correct++;
            }

            const outputs = event.outputs as any;
            if (outputs?.analysis?.weakestAbstractness !== undefined) {
              sessionMap[dateKey].abstractnessSum +=
                outputs.analysis.weakestAbstractness;
              sessionMap[dateKey].abstractnessCount++;
            }

            // Track category performance per session
            if (outputs?.analysis) {
              const { missedCategories, incorrectCategories } = outputs.analysis;
              const allCategories = [
                ...(missedCategories || []),
                ...(incorrectCategories || [])
              ];
              
              allCategories.forEach((cat: string) => {
                if (!sessionMap[dateKey].categoryTotal[cat]) {
                  sessionMap[dateKey].categoryTotal[cat] = 0;
                  sessionMap[dateKey].categoryCorrect[cat] = 0;
                }
                sessionMap[dateKey].categoryTotal[cat]++;
                
                if (
                  !missedCategories?.includes(cat) &&
                  !incorrectCategories?.includes(cat)
                ) {
                  sessionMap[dateKey].categoryCorrect[cat]++;
                }
              });
            }
          });
        }
      });

      const sessionTrends: SessionTrend[] = Object.entries(sessionMap)
        .map(([date, data]) => {
          const categoryAccuracy: Record<string, number> = {};
          Object.keys(data.categoryTotal).forEach((cat) => {
            categoryAccuracy[cat] = Math.round(
              (data.categoryCorrect[cat] / data.categoryTotal[cat]) * 100
            );
          });

          return {
            date: data.date,
            accuracy: Math.round((data.correct / data.total) * 100),
            avgAbstractness:
              data.abstractnessCount > 0
                ? data.abstractnessSum / data.abstractnessCount
                : 0,
            categoryAccuracy
          };
        })
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

      // Determine weakest areas
      const weakestCategory =
        categoryPerformance.length > 0 ? categoryPerformance[0].category : null;
      const hardestAbstractnessLevel =
        abstractnessLevels.length > 0
          ? abstractnessLevels.reduce((min, curr) =>
              curr.accuracy < min.accuracy ? curr : min
            ).level
          : null;
      const mostEffectiveDistractor =
        distractorAnalysis.length > 0 ? distractorAnalysis[0].type : null;

      setAnalytics({
        categoryPerformance,
        abstractnessLevels,
        distractorAnalysis,
        sessionTrends,
        overallAccuracy: Math.round((totalCorrect / events.length) * 100),
        totalSessions: sessions.length,
        weakestCategory,
        hardestAbstractnessLevel,
        mostEffectiveDistractor
      });
    } catch (err) {
      console.error("Error loading semantic analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  return { analytics, loading, error, refresh: loadAnalytics };
};
