import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isComparableScoredEvent } from "@/lib/clinical/metricsPresentation";

interface WeeklySessionStats {
  trialCount: number;
  priorTrialCount: number;
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
export function useWeeklySessionStats(profileId: string | undefined): WeeklySessionStats {
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
        const sevenAgo = new Date(now);
        sevenAgo.setDate(sevenAgo.getDate() - 7);
        const fourteenAgo = new Date(now);
        fourteenAgo.setDate(fourteenAgo.getDate() - 14);
        const fmt = (d: Date) => d.toISOString();

        const { data: recentSessions, error: recentError } = await supabase
          .from("sessions")
          .select("id, ended_at, duration_sec")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .gte("ended_at", fmt(sevenAgo))
          .gte("duration_sec", 60);
        if (recentError) throw recentError;
        if (cancelled) return;

        const sessionIds = (recentSessions || []).map((s) => s.id);
        let recentScores: number[] = [];
        let recordedEventCount = 0;
        if (sessionIds.length > 0) {
          const { data: events, error } = await supabase
            .from("exercise_events")
            .select("score, session_id, exercise_slug, validity_label, counts_toward_score, clinician_validity_override, task_parameters, engagement_flags")
            .in("session_id", sessionIds);
          if (error || !events || events.length >= 1000) {
            throw error ?? new Error("Incomplete recent speech metrics");
          }
          if (cancelled) return;
          recordedEventCount = events.length;
          recentScores = events.filter(isComparableScoredEvent).map(event =>
            event.score! <= 1 ? event.score! * 100 : event.score!
          );
        }

        const { data: priorSessions, error: priorError } = await supabase
          .from("sessions")
          .select("id")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .gte("ended_at", fmt(fourteenAgo))
          .lt("ended_at", fmt(sevenAgo))
          .gte("duration_sec", 60);
        if (priorError) throw priorError;
        if (cancelled) return;

        let priorScores: number[] = [];
        const priorIds = (priorSessions || []).map((s) => s.id);
        if (priorIds.length > 0) {
          const { data: priorEvents, error } = await supabase
            .from("exercise_events")
            .select("score, exercise_slug, validity_label, counts_toward_score, clinician_validity_override, task_parameters, engagement_flags")
            .in("session_id", priorIds);
          if (error || !priorEvents || priorEvents.length >= 1000) {
            throw error ?? new Error("Incomplete comparison metrics");
          }
          if (cancelled) return;
          priorScores = priorEvents.filter(isComparableScoredEvent).map(event =>
            event.score! <= 1 ? event.score! * 100 : event.score!
          );
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
          sessionCount: sessionIds.length,
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
  }, [profileId]);

  return state.profileId === profileId ? state.stats : emptyStats(!!profileId);
}
