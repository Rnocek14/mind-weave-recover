import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GrammarErrorType, SentenceTaskType } from "@/data/sentenceBank";

interface GrammarErrorEvent {
  created_at: string;
  error_type: GrammarErrorType | null;
  score: number;
  reaction_time_ms: number | null;
  task_parameters: {
    task_type?: SentenceTaskType;
    difficulty_level?: number;
    grammar_focus?: string;
  };
  session_id: string;
}

interface ErrorPatternData {
  errorType: GrammarErrorType;
  count: number;
  percentage: number;
}

interface DifficultyProgressionData {
  level: number;
  accuracy: number;
  avgReactionTime: number;
  trialCount: number;
}

interface TimeSeriesData {
  date: string;
  accuracy: number;
  avgReactionTime: number;
  errorRate: number;
}

interface TaskTypePerformance {
  taskType: SentenceTaskType;
  accuracy: number;
  avgReactionTime: number;
  count: number;
}

interface GrammarFocusArea {
  focus: string;
  errorCount: number;
  totalTrials: number;
  errorRate: number;
}

export function useGrammarAnalytics(userId?: string) {
  return useQuery({
    queryKey: ["grammar-analytics", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID required");

      // First get user's session IDs
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("id")
        .eq("user_id", userId);

      if (sessionsError) throw sessionsError;

      const sessionIds = sessions?.map(s => s.id) || [];

      if (sessionIds.length === 0) {
        return {
          errorPatterns: [],
          difficultyProgression: [],
          timeSeries: [],
          taskTypePerformance: [],
          grammarFocusAreas: [],
          overallStats: {
            totalTrials: 0,
            overallAccuracy: 0,
            avgReactionTime: 0,
            totalErrors: 0,
          },
        };
      }

      const { data: events, error } = await supabase
        .from("exercise_events")
        .select(`
          created_at,
          error_type,
          score,
          reaction_time_ms,
          task_parameters,
          session_id
        `)
        .eq("exercise_slug", "sentence-construction")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const typedEvents = events as unknown as GrammarErrorEvent[];

      // Calculate error patterns
      const errorCounts = new Map<GrammarErrorType, number>();
      let totalErrors = 0;

      typedEvents.forEach((event) => {
        if (event.error_type && event.score === 0) {
          errorCounts.set(
            event.error_type,
            (errorCounts.get(event.error_type) || 0) + 1
          );
          totalErrors++;
        }
      });

      const errorPatterns: ErrorPatternData[] = Array.from(
        errorCounts.entries()
      ).map(([errorType, count]) => ({
        errorType,
        count,
        percentage: (count / totalErrors) * 100,
      }))
      .sort((a, b) => b.count - a.count);

      // Calculate difficulty progression
      const difficultyMap = new Map<number, { correct: number; total: number; totalRT: number }>();

      typedEvents.forEach((event) => {
        const level = event.task_parameters?.difficulty_level || 1;
        if (!difficultyMap.has(level)) {
          difficultyMap.set(level, { correct: 0, total: 0, totalRT: 0 });
        }
        const stats = difficultyMap.get(level)!;
        stats.total++;
        if (event.score > 0) stats.correct++;
        if (event.reaction_time_ms) stats.totalRT += event.reaction_time_ms;
      });

      const difficultyProgression: DifficultyProgressionData[] = Array.from(
        difficultyMap.entries()
      ).map(([level, stats]) => ({
        level,
        accuracy: (stats.correct / stats.total) * 100,
        avgReactionTime: stats.totalRT / stats.total,
        trialCount: stats.total,
      }))
      .sort((a, b) => a.level - b.level);

      // Calculate time series data (weekly)
      const weeklyMap = new Map<string, { correct: number; total: number; totalRT: number }>();

      typedEvents.forEach((event) => {
        const date = new Date(event.created_at);
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        const weekKey = weekStart.toISOString().split("T")[0];

        if (!weeklyMap.has(weekKey)) {
          weeklyMap.set(weekKey, { correct: 0, total: 0, totalRT: 0 });
        }
        const stats = weeklyMap.get(weekKey)!;
        stats.total++;
        if (event.score > 0) stats.correct++;
        if (event.reaction_time_ms) stats.totalRT += event.reaction_time_ms;
      });

      const timeSeries: TimeSeriesData[] = Array.from(weeklyMap.entries())
        .map(([date, stats]) => ({
          date,
          accuracy: (stats.correct / stats.total) * 100,
          avgReactionTime: stats.totalRT / stats.total,
          errorRate: ((stats.total - stats.correct) / stats.total) * 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate task type performance
      const taskTypeMap = new Map<SentenceTaskType, { correct: number; total: number; totalRT: number }>();

      typedEvents.forEach((event) => {
        const taskType = event.task_parameters?.task_type;
        if (!taskType) return;

        if (!taskTypeMap.has(taskType)) {
          taskTypeMap.set(taskType, { correct: 0, total: 0, totalRT: 0 });
        }
        const stats = taskTypeMap.get(taskType)!;
        stats.total++;
        if (event.score > 0) stats.correct++;
        if (event.reaction_time_ms) stats.totalRT += event.reaction_time_ms;
      });

      const taskTypePerformance: TaskTypePerformance[] = Array.from(
        taskTypeMap.entries()
      ).map(([taskType, stats]) => ({
        taskType,
        accuracy: (stats.correct / stats.total) * 100,
        avgReactionTime: stats.totalRT / stats.total,
        count: stats.total,
      }));

      // Calculate grammar focus areas (weak areas)
      const grammarFocusMap = new Map<string, { errors: number; total: number }>();

      typedEvents.forEach((event) => {
        const focus = event.task_parameters?.grammar_focus;
        if (!focus) return;

        if (!grammarFocusMap.has(focus)) {
          grammarFocusMap.set(focus, { errors: 0, total: 0 });
        }
        const stats = grammarFocusMap.get(focus)!;
        stats.total++;
        if (event.score === 0) stats.errors++;
      });

      const grammarFocusAreas: GrammarFocusArea[] = Array.from(
        grammarFocusMap.entries()
      ).map(([focus, stats]) => ({
        focus,
        errorCount: stats.errors,
        totalTrials: stats.total,
        errorRate: (stats.errors / stats.total) * 100,
      }))
      .sort((a, b) => b.errorRate - a.errorRate);

      // Calculate overall stats
      const totalTrials = typedEvents.length;
      const correctTrials = typedEvents.filter((e) => e.score > 0).length;
      const overallAccuracy = (correctTrials / totalTrials) * 100;
      const avgReactionTime =
        typedEvents
          .filter((e) => e.reaction_time_ms)
          .reduce((sum, e) => sum + (e.reaction_time_ms || 0), 0) /
        typedEvents.filter((e) => e.reaction_time_ms).length;

      return {
        errorPatterns,
        difficultyProgression,
        timeSeries,
        taskTypePerformance,
        grammarFocusAreas,
        overallStats: {
          totalTrials,
          overallAccuracy,
          avgReactionTime,
          totalErrors,
        },
      };
    },
    enabled: !!userId,
  });
}
