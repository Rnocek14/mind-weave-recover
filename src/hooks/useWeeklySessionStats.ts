import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localYYYYMMDD } from "@/lib/localDate";
import { readAllById } from "@/lib/clinical/readAllById";
import { isComparableScoredEvent } from "@/lib/clinical/metricsPresentation";

interface WeeklySessionStats {
  trialCount: number;
  priorTrialCount: number;
  days: string[];
  minutes: number;
  recordedEventCount: number;
  unscoredEventCount: number;
  sessionCount: number;
  avgAccuracy: number | null;
  priorAvgAccuracy: number | null;
  accuracySlope: number | null;
  isLoading: boolean;
  readError: boolean;
}

const emptyStats = (isLoading: boolean, readError = false): WeeklySessionStats => ({
  trialCount: 0,
  priorTrialCount: 0,
  days: [],
  minutes: 0,
  recordedEventCount: 0,
  unscoredEventCount: 0,
  sessionCount: 0,
  avgAccuracy: null,
  priorAvgAccuracy: null,
  accuracySlope: null,
  isLoading,
  readError,
});

/**
 * Fetches aggregated session/trial stats for the last 7 and prior 7 days.
 * Used by the progress note generator. Keeps the existing window, score units,
 * and minimum session duration; excludes explicitly non-scorable evidence.
 */
export function useWeeklySessionStats(profileId: string | undefined, retry = 0): WeeklySessionStats {
  // Bind the visible result to its profile. An effect-only reset would still
  // allow one render with the previous patient's data after a profile switch.
  const [state, setState] = useState<{ profileId: string | undefined; stats: WeeklySessionStats }>(
    () => ({ profileId, stats: emptyStats(!!profileId) }),
  );

  useEffect(() => {
    let cancelled = false;
    setState({ profileId, stats: emptyStats(!!profileId) });
    if (!profileId) return () => { cancelled = true; };

    const load = async () => {
      try {
        const now = new Date();
        const start = new Date(now);
        start.setHours(0,0,0,0);
        start.setDate(start.getDate() - 6);
        const previous = new Date(start);
        previous.setDate(start.getDate() - 7);
        const sessions = await readAllById(after => {
          let q = supabase.from("sessions").select("id, ended_at, duration_sec")
            .eq("profile_id", profileId).gte("ended_at", previous.toISOString()).lte("ended_at", now.toISOString())
            .gte("duration_sec", 60).order("id").limit(500);
          if (after) q = q.gt("id", after);
          return q;
        });
        if (cancelled) return;
        const recent = sessions.filter(s => s.ended_at && Date.parse(s.ended_at) >= start.getTime());
        const recentIds = new Set(recent.map(s => s.id));
        const recentScores: number[] = [];
        const priorScores: number[] = [];
        let recordedEventCount = 0;
        for (let i = 0; i < sessions.length; i += 100) {
          const ids = sessions.slice(i, i + 100).map(s => s.id);
          const events = await readAllById(after => {
            let q = supabase.from("exercise_events")
              .select("id, profile_id, session_id, score, exercise_slug, validity_label, counts_toward_score, clinician_validity_override, task_parameters, engagement_flags")
              .in("session_id",ids).order("id").limit(500);
            if (after) q = q.gt("id",after);
            return q;
          });
          if (cancelled) return;
          for (const e of events) {
            if (e.profile_id && e.profile_id !== profileId) continue;
            const recentEvent = recentIds.has(e.session_id);
            if (recentEvent) recordedEventCount++;
            if (!isComparableScoredEvent(e)) continue;
            (recentEvent ? recentScores : priorScores).push(e.score! <= 1 ? e.score! * 100 : e.score!);
          }
        }

        const { data: lrData, error: learningError } = await supabase
          .from("learning_rates")
          .select("accuracy_slope")
          .eq("profile_id", profileId)
          .order("calculated_at", { ascending: false })
          .limit(1);
        if (learningError) throw learningError;
        if (cancelled) return;

        const avgAcc = recentScores.length > 0
          ? recentScores.reduce((s, n) => s + n, 0) / recentScores.length
          : null;
        const priorAvg = priorScores.length > 0
          ? priorScores.reduce((s, n) => s + n, 0) / priorScores.length
          : null;

        setState({ profileId, stats: {
          trialCount: recentScores.length,
          priorTrialCount: priorScores.length,
          recordedEventCount,
          unscoredEventCount: Math.max(0, recordedEventCount - recentScores.length),
          sessionCount: recent.length,
          days: [...new Set(recent.map(s => localYYYYMMDD(new Date(s.ended_at!))))].sort(),
          minutes: Math.round(recent.reduce((sum, s) => sum + (s.duration_sec ?? 0), 0) / 60),
          avgAccuracy: avgAcc,
          priorAvgAccuracy: priorAvg,
          accuracySlope: lrData?.[0]?.accuracy_slope ?? null,
          isLoading: false,
          readError: false,
        } });
      } catch (err) {
        if (cancelled) return;
        console.error("[useWeeklySessionStats] error:", err);
        // Never present stale patient metrics as the result of a failed load.
        setState({ profileId, stats: emptyStats(false, true) });
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [profileId, retry]);

  return state.profileId === profileId ? state.stats : emptyStats(!!profileId);
}
