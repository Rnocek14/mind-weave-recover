/**
 * Fetches sessions + exercise events grouped by day for a 7/14/30 day window.
 * Designed for the Weekly Patient Review clinician screen.
 */
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localYYYYMMDD } from "@/lib/localDate";
import { summarizeTimelineScore, type TimelineScoreEvidence } from '@/lib/clinical/timelineScoreEvidence';

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
  /** Exact weighted total, not a rounded intermediate average. */
  scoreTotalPct: number;
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDayGroups([]);
    setRecordings([]);
    setExerciseSlugs([]);
    setError(null);
    setIsLoading(!!profileId);
    if (!profileId) return () => { cancelled = true; };

    const load = async () => {
      try {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - (daysBack - 1));
        start.setHours(0, 0, 0, 0);

        // Fetch sessions
        const { data: sessions, error: sessionError } = await supabase
          .from("sessions")
          .select("id, started_at, ended_at, duration_sec, profile_id")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .gte("ended_at", start.toISOString())
          .order("started_at", { ascending: true });
        if (cancelled) return;
        if (sessionError || !Array.isArray(sessions)) {
          throw sessionError ?? new Error('Session history evidence unavailable');
        }

        if (!sessions.length) {
          buildEmptyDays(start, daysBack);
          return;
        }

        const sessionIds = sessions.map((s) => s.id);

        // Fetch exercise events for these sessions
        const { data: events, error: eventError } = await supabase
          .from("exercise_events")
          .select("session_id, exercise_slug, score, audio_storage_path, created_at, task_parameters, outputs, error_type, browser_transcript, whisper_transcript, attempt_id, counts_toward_score, validity_label, clinician_validity_override, engagement_flags")
          .in("session_id", sessionIds)
          .order("created_at", { ascending: true });
        if (cancelled) return;
        if (eventError || !Array.isArray(events)) {
          throw eventError ?? new Error('Session trial evidence unavailable');
        }

        // Also fetch utterance_analyses for audio
        const { data: utterances, error: utteranceError } = await supabase
          .from("utterance_analyses")
          .select("attempt_id, session_id, exercise_slug, target_word, transcript, is_correct, error_type, audio_storage_path, created_at")
          .in("session_id", sessionIds)
          .not("audio_storage_path", "is", null)
          .order("created_at", { ascending: false });
        if (cancelled) return;
        if (utteranceError || !Array.isArray(utterances)) {
          throw utteranceError ?? new Error('Speech review evidence unavailable');
        }

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

        if (!cancelled) setRecordings(recs);

        // Group events by session → exercise
        const eventsBySession: Record<string, typeof events> = {};
        (events || []).forEach((ev) => {
          if (!eventsBySession[ev.session_id]) eventsBySession[ev.session_id] = [];
          eventsBySession[ev.session_id]!.push(ev);
        });

        // Build session objects using the same read-side eligibility contract
        // as the weekly clinician stats. Partial credit is a measured score,
        // not an automatic failure. A noisy/no-response excluded event must
        // not silently deflate a patient's demonstrated task accuracy.
        const sessionObjects: Record<string, DaySession> = {};
        sessions.forEach(session => {
          const attempts = eventsBySession[session.id] || [];
          const byExercise = new Map<string, typeof attempts>();
          for (const attempt of attempts) {
            const slug = attempt.exercise_slug || 'unknown';
            const bucket = byExercise.get(slug) || [];
            bucket.push(attempt);
            byExercise.set(slug, bucket);
          }

          const exercises: SessionExercise[] = [];
          for (const [slug, exerciseEvents] of byExercise) {
            const summary = summarizeTimelineScore(exerciseEvents as TimelineScoreEvidence[]);
            if (summary.scoredTrials === 0) continue;
            exercises.push({
              slug,
              trials: summary.scoredTrials,
              accuracy: summary.accuracyPct ?? 0,
              hasAudio: exerciseEvents.some(event => Boolean(event.audio_storage_path)),
            });
          }

          const summary = summarizeTimelineScore(attempts as TimelineScoreEvidence[]);
          sessionObjects[session.id] = {
            id: session.id,
            startedAt: session.started_at || '',
            endedAt: session.ended_at || '',
            durationMin: Math.round((session.duration_sec || 0) / 60),
            exercises,
            totalTrials: summary.scoredTrials,
            avgAccuracy: summary.accuracyPct ?? 0,
            scoreTotalPct: summary.scoreSumPct,
          };
        });

        // Collect all exercise slugs
        const allSlugs = new Set<string>();
        Object.values(sessionObjects).forEach((s) => s.exercises.forEach((e) => allSlugs.add(e.slug)));
        if (!cancelled) setExerciseSlugs(Array.from(allSlugs).sort());

        // Group by day
        const today = localYYYYMMDD();
        const dayMap: Record<string, DaySession[]> = {};

        Object.values(sessionObjects).forEach((s) => {
          const date = localYYYYMMDD(new Date(s.endedAt));
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
          const scoreTotalPct = daySessions.reduce((sum, session) => sum + session.scoreTotalPct, 0);

          groups.push({
            date: dateStr,
            dayLabel: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            sessions: daySessions,
            totalTrials,
            totalMinutes,
            avgAccuracy: totalTrials > 0 ? Math.round(scoreTotalPct / totalTrials * 10) / 10 : null,
            isToday: dateStr === today,
          });
        }

        if (!cancelled) setDayGroups(groups);
      } catch (err) {
        console.error("[useWeeklySessionTimeline] clinical evidence read failed:", err);
        if (!cancelled) {
          setError('Session history unavailable. Please retry.');
          setDayGroups([]);
          setRecordings([]);
          setExerciseSlugs([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
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
      if (!cancelled) {
        setDayGroups(groups);
        setExerciseSlugs([]);
        setRecordings([]);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [profileId, daysBack]);

  // Summary stats
  const summary = useMemo(() => {
    const activeDays = dayGroups.filter((d) => d.sessions.length > 0).length;
    const totalSessions = dayGroups.reduce((s, d) => s + d.sessions.length, 0);
    const totalTrials = dayGroups.reduce((s, d) => s + d.totalTrials, 0);
    const totalMinutes = dayGroups.reduce((s, d) => s + d.totalMinutes, 0);
    const scoreTotalPct = dayGroups.reduce(
      (total, day) => total + day.sessions.reduce(
        (subTotal, session) => subTotal + session.scoreTotalPct, 0
      ), 0
    );
    const avgAccuracy = totalTrials > 0 ? Math.round(scoreTotalPct / totalTrials * 10) / 10 : null;
    return { activeDays, totalSessions, totalTrials, totalMinutes, avgAccuracy };
  }, [dayGroups]);

  return { dayGroups, recordings, exerciseSlugs, summary, isLoading, error };
}
