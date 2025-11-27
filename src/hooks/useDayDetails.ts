import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";

export interface SessionDetail {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  mood_rating: number | null;
  exercises: ExerciseDetail[];
}

export interface ExerciseDetail {
  exercise_slug: string;
  exercise_title: string;
  trials: number;
  correct: number;
  accuracy: number;
  avgReactionTime: number | null;
}

export function useDayDetails(date: string | null) {
  const { activeProfile } = useProfile();
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeProfile?.id || !date) {
      setSessions([]);
      return;
    }

    const fetchDayDetails = async () => {
      setLoading(true);
      try {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        // Fetch sessions for the selected day
        const { data: sessionsData } = await supabase
          .from("sessions")
          .select("id, started_at, ended_at, duration_sec, mood_rating")
          .eq("profile_id", activeProfile.id)
          .gte("started_at", dayStart.toISOString())
          .lte("started_at", dayEnd.toISOString())
          .order("started_at", { ascending: true });

        if (!sessionsData || sessionsData.length === 0) {
          setSessions([]);
          setLoading(false);
          return;
        }

        // Fetch exercise events for each session
        const sessionIds = sessionsData.map(s => s.id);
        const { data: eventsData } = await supabase
          .from("exercise_events")
          .select("session_id, exercise_slug, score, reaction_time_ms")
          .in("session_id", sessionIds);

        // Fetch exercise titles
        const exerciseSlugs = [...new Set(eventsData?.map(e => e.exercise_slug) || [])];
        const { data: exercisesData } = await supabase
          .from("exercises")
          .select("slug, title")
          .in("slug", exerciseSlugs);

        const exerciseTitleMap = new Map(
          exercisesData?.map(ex => [ex.slug, ex.title]) || []
        );

        // Process data
        const processedSessions: SessionDetail[] = sessionsData.map(session => {
          const sessionEvents = eventsData?.filter(e => e.session_id === session.id) || [];
          
          // Group by exercise
          const exerciseMap = new Map<string, ExerciseDetail>();
          sessionEvents.forEach(event => {
            if (!event.exercise_slug) return;
            
            const existing = exerciseMap.get(event.exercise_slug);
            const isCorrect = event.score === 100;
            
            if (existing) {
              existing.trials += 1;
              existing.correct += isCorrect ? 1 : 0;
              if (event.reaction_time_ms) {
                existing.avgReactionTime = 
                  ((existing.avgReactionTime || 0) * (existing.trials - 1) + event.reaction_time_ms) / existing.trials;
              }
            } else {
              exerciseMap.set(event.exercise_slug, {
                exercise_slug: event.exercise_slug,
                exercise_title: exerciseTitleMap.get(event.exercise_slug) || event.exercise_slug,
                trials: 1,
                correct: isCorrect ? 1 : 0,
                accuracy: 0,
                avgReactionTime: event.reaction_time_ms || null,
              });
            }
          });

          // Calculate accuracies
          const exercises = Array.from(exerciseMap.values()).map(ex => ({
            ...ex,
            accuracy: ex.trials > 0 ? Math.round((ex.correct / ex.trials) * 100) : 0,
          }));

          return {
            ...session,
            exercises,
          };
        });

        setSessions(processedSessions);
      } catch (error) {
        console.error("Error fetching day details:", error);
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDayDetails();
  }, [activeProfile?.id, date]);

  return { sessions, loading };
}
