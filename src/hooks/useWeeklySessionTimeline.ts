/**
 * Fetches sessions + exercise events grouped by day for a 7/14/30 day window.
 * Designed for the Weekly Patient Review clinician screen.
 */
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localYYYYMMDD } from "@/lib/localDate";

export interface SessionExercise {
  slug: string;
  trials: number;
  accuracy: number;
  hasAudio: boolean;
}

export interface DaySession {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  exercises: SessionExercise[];
  totalTrials: number;
  avgAccuracy: number;
}

export interface DayGroup {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Mon, Mar 17"
  sessions: DaySession[];
  totalTrials: number;
  totalMinutes: number;
  avgAccuracy: number | null;
  isToday: boolean;
}

export interface WeeklyRecording {
  attemptId: string;
  exerciseSlug: string;
  targetWord: string;
  transcript: string | null;
  score: number | null;
  errorType: string | null;
  audioPath: string;
  createdAt: string;
  isCorrect: boolean | null;
}

export function useWeeklySessionTimeline(
  profileId: string | undefined,
  daysBack: number = 7
) {
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [recordings, setRecordings] = useState<WeeklyRecording[]>([]);
  const [exerciseSlugs, setExerciseSlugs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - (daysBack - 1));
        start.setHours(0, 0, 0, 0);

        // Fetch sessions
        const { data: sessions } = await supabase
          .from("sessions")
          .select("id, started_at, ended_at, duration_sec, profile_id")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .gte("ended_at", start.toISOString())
          .gte("duration_sec", 30)
          .order("started_at", { ascending: true });

        if (!sessions?.length) {
          buildEmptyDays(start, daysBack);
          setIsLoading(false);
          return;
        }

        const sessionIds = sessions.map((s) => s.id);

        // Fetch exercise events for these sessions
        const { data: events } = await supabase
          .from("exercise_events")
          .select("session_id, exercise_slug, score, audio_storage_path, created_at, task_parameters, outputs, error_type, browser_transcript, whisper_transcript, attempt_id")
          .in("session_id", sessionIds)
          .order("created_at", { ascending: true });

        // Also fetch utterance_analyses for audio
        const { data: utterances } = await supabase
          .from("utterance_analyses")
          .select("attempt_id, session_id, exercise_slug, target_word, transcript, is_correct, error_type, audio_storage_path, created_at")
          .in("session_id", sessionIds)
          .not("audio_storage_path", "is", null)
          .order("created_at", { ascending: false });

        // Build recordings list
        const recs: WeeklyRecording[] = (utterances || []).map((u) => ({
          attemptId: u.attempt_id || u.created_at || "",
          exerciseSlug: u.exercise_slug || "unknown",
          targetWord: u.target_word || "",
          transcript: u.transcript,
          score: u.is_correct ? 100 : u.is_correct === false ? 0 : null,
          errorType: u.error_type,
          audioPath: u.audio_storage_path!,
          createdAt: u.created_at || "",
          isCorrect: u.is_correct,
        }));
        // Also add exercise_events with audio that aren't in utterances
        const utteranceAttempts = new Set(recs.map(r => r.attemptId));
        (events || []).forEach((e) => {
          if (e.audio_storage_path && !utteranceAttempts.has(e.attempt_id)) {
            recs.push({
              attemptId: e.attempt_id || e.created_at || "",
              exerciseSlug: e.exercise_slug || "unknown",
              targetWord: (e.task_parameters as any)?.target_word || (e.task_parameters as any)?.targetWord || (e.outputs as any)?.target || "",
              transcript: e.whisper_transcript || e.browser_transcript || null,
              score: e.score,
              errorType: e.error_type,
              audioPath: e.audio_storage_path!,
              createdAt: e.created_at || "",
              isCorrect: e.score === 1 || e.score === 100 ? true : e.score === 0 ? false : null,
            });
          }
        });

        setRecordings(recs);

        // Group events by session → exercise
        const eventsBySession: Record<string, typeof events> = {};
        (events || []).forEach((ev) => {
          if (!eventsBySession[ev.session_id]) eventsBySession[ev.session_id] = [];
          eventsBySession[ev.session_id]!.push(ev);
        });

        // Build session objects
        const sessionObjects: Record<string, DaySession> = {};
        sessions.forEach((s) => {
          const evts = eventsBySession[s.id] || [];
          const exerciseMap: Record<string, { trials: number; correct: number; hasAudio: boolean }> = {};
          evts.forEach((e) => {
            const slug = e.exercise_slug || "unknown";
            if (!exerciseMap[slug]) exerciseMap[slug] = { trials: 0, correct: 0, hasAudio: false };
            exerciseMap[slug].trials++;
            if (e.score === 1 || e.score === 100) exerciseMap[slug].correct++;
            if (e.audio_storage_path) exerciseMap[slug].hasAudio = true;
          });

          const exercises = Object.entries(exerciseMap).map(([slug, data]) => ({
            slug,
            trials: data.trials,
            accuracy: data.trials > 0 ? Math.round((data.correct / data.trials) * 100) : 0,
            hasAudio: data.hasAudio,
          }));

          const totalTrials = evts.length;
          const correct = evts.filter((e) => e.score === 1 || e.score === 100).length;

          sessionObjects[s.id] = {
            id: s.id,
            startedAt: s.started_at || "",
            endedAt: s.ended_at || "",
            durationMin: Math.round((s.duration_sec || 0) / 60),
            exercises,
            totalTrials,
            avgAccuracy: totalTrials > 0 ? Math.round((correct / totalTrials) * 100) : 0,
          };
        });

        // Collect all exercise slugs
        const allSlugs = new Set<string>();
        Object.values(sessionObjects).forEach((s) => s.exercises.forEach((e) => allSlugs.add(e.slug)));
        setExerciseSlugs(Array.from(allSlugs).sort());

        // Group by day
        const today = localYYYYMMDD();
        const dayMap: Record<string, DaySession[]> = {};

        Object.values(sessionObjects).forEach((s) => {
          const date = s.endedAt.slice(0, 10);
          if (!dayMap[date]) dayMap[date] = [];
          dayMap[date].push(s);
        });

        // Build contiguous day groups
        const groups: DayGroup[] = [];
        for (let i = 0; i < daysBack; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const dateStr = localYYYYMMDD(d);
          const daySessions = dayMap[dateStr] || [];

          const totalTrials = daySessions.reduce((s, ds) => s + ds.totalTrials, 0);
          const totalMinutes = daySessions.reduce((s, ds) => s + ds.durationMin, 0);
          const allCorrect = daySessions.reduce((s, ds) => {
            const c = Math.round((ds.avgAccuracy / 100) * ds.totalTrials);
            return s + c;
          }, 0);

          groups.push({
            date: dateStr,
            dayLabel: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            sessions: daySessions,
            totalTrials,
            totalMinutes,
            avgAccuracy: totalTrials > 0 ? Math.round((allCorrect / totalTrials) * 100) : null,
            isToday: dateStr === today,
          });
        }

        setDayGroups(groups);
      } catch (err) {
        console.error("[useWeeklySessionTimeline] error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const buildEmptyDays = (start: Date, days: number) => {
      const today = localYYYYMMDD();
      const groups: DayGroup[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = localYYYYMMDD(d);
        groups.push({
          date: dateStr,
          dayLabel: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          sessions: [],
          totalTrials: 0,
          totalMinutes: 0,
          avgAccuracy: null,
          isToday: dateStr === today,
        });
      }
      setDayGroups(groups);
      setExerciseSlugs([]);
      setRecordings([]);
    };

    load();
  }, [profileId, daysBack]);

  // Summary stats
  const summary = useMemo(() => {
    const activeDays = dayGroups.filter((d) => d.sessions.length > 0).length;
    const totalSessions = dayGroups.reduce((s, d) => s + d.sessions.length, 0);
    const totalTrials = dayGroups.reduce((s, d) => s + d.totalTrials, 0);
    const totalMinutes = dayGroups.reduce((s, d) => s + d.totalMinutes, 0);
    const allCorrect = dayGroups.reduce((s, d) => {
      if (d.avgAccuracy !== null) return s + Math.round((d.avgAccuracy / 100) * d.totalTrials);
      return s;
    }, 0);
    const avgAccuracy = totalTrials > 0 ? Math.round((allCorrect / totalTrials) * 100) : null;
    return { activeDays, totalSessions, totalTrials, totalMinutes, avgAccuracy };
  }, [dayGroups]);

  return { dayGroups, recordings, exerciseSlugs, summary, isLoading };
}
