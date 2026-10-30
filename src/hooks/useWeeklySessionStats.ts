import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { scoredEventPercentages } from "@/lib/clinical/scoredEvidence";

interface WeeklySessionStats {
  trialCount: number;
  priorTrialCount: number;
  sessionCount: number;
  avgAccuracy: number | null;
  priorAvgAccuracy: number | null;
  accuracySlope: number | null;
  isLoading: boolean;
  error: string | null;
}

const emptyStats = (isLoading: boolean): WeeklySessionStats => ({
  trialCount: 0,
  priorTrialCount: 0,
  sessionCount: 0,
  avgAccuracy: null,
  priorAvgAccuracy: null,
  accuracySlope: null,
  isLoading,
  error: null,
});

/**
 * Fetches aggregated session/trial stats for the last 7 and prior 7 days.
 * Used by the progress note generator. Keeps the existing window, score units,
 * and excludes explicitly non-scorable evidence. No minimum duration
 * filter: an authenticated 15-second practice with valid saved answers
 * must not disappear from the clinician's review.
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
          .gte("ended_at", fmt(sevenAgo));
        if (recentError || !Array.isArray(recentSessions)) throw recentError ?? new Error('Recent sessions unavailable');
        if (cancelled) return;

        const sessionIds = (recentSessions || []).map((s) => s.id);
        let recentScores: number[] = [];
        if (sessionIds.length > 0) {
          const { data: events, error } = await supabase
            .from("exercise_events")
            .select("score, session_id, validity_label, counts_toward_score, clinician_validity_override, task_parameters, engagement_flags")
            .in("session_id", sessionIds)
            .not("score", "is", null);
          if (error || !Array.isArray(events)) throw error ?? new Error('Recent events unavailable');
          if (cancelled) return;
          recentScores = scoredEventPercentages(events);
        }

        const { data: priorSessions, error: priorError } = await supabase
          .from("sessions")
          .select("id")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .gte("ended_at", fmt(fourteenAgo))
          .lt("ended_at", fmt(sevenAgo));
        if (priorError || !Array.isArray(priorSessions)) throw priorError ?? new Error('Prior sessions unavailable');
        if (cancelled) return;

        let priorScores: number[] = [];
        const priorIds = (priorSessions || []).map((s) => s.id);
        if (priorIds.length > 0) {
          const { data: priorEvents, error } = await supabase
            .from("exercise_events")
            .select("score, validity_label, counts_toward_score, clinician_validity_override, task_parameters, engagement_flags")
            .in("session_id", priorIds)
            .not("score", "is", null);
          if (error || !Array.isArray(priorEvents)) throw error ?? new Error('Prior events unavailable');
          if (cancelled) return;
          priorScores = scoredEventPercentages(priorEvents);
        }

        const { data: lrData, error: learningError } = await supabase
          .from("learning_rates")
          .select("accuracy_slope")
          .eq("profile_id", profileId)
          .order("calculated_at", { ascending: false })
          .limit(1);
        if (learningError || !Array.isArray(lrData)) throw learningError ?? new Error('Learning rate read unavailable');
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
          sessionCount: sessionIds.length,
          avgAccuracy: avgAcc,
          priorAvgAccuracy: priorAvg,
          accuracySlope: lrData?.[0]?.accuracy_slope ?? null,
          isLoading: false,
          error: null,
        } });
      } catch (err) {
        if (cancelled) return;
        console.error("[useWeeklySessionStats] error:", err);
        // Never present stale patient metrics as the result of a failed load.
        setState({ profileId, stats: {
          ...emptyStats(false),
          error: 'Clinical session metrics unavailable. Please retry.',
        } });
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [profileId]);

  return state.profileId === profileId ? state.stats : emptyStats(!!profileId);
}
