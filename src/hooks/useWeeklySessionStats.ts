import { useState, useEffect } from "react";
import { slopePerDayToPctPerWeek } from "@/lib/learningRateUnits";
import { isSpeechScoredRow } from "@/lib/sessionAccuracySummary";
import {
  LEARNING_RATE_DOMAIN,
  LEARNING_RATE_WINDOW_DAYS,
  learningRateSlopeIfTrustworthy,
} from "@/lib/learningRateUnits";
import { supabase } from "@/integrations/supabase/client";

interface WeeklySessionStats {
  trialCount: number;
  sessionCount: number;
  avgAccuracy: number | null;
  priorAvgAccuracy: number | null;
  /**
   * learning_rates.accuracy_slope as stored: a fraction of accuracy per DAY.
   * The alert detector, progress note and next-action thresholds (±0.01,
   * > 0.5) are calibrated to this unit — do not convert it here.
   */
  accuracySlope: number | null;
  /** The same slope in percentage points per WEEK, for the glance cards (see learningRateUnits). */
  accuracySlopePctPerWeek: number | null;
  isLoading: boolean;
}

/**
 * Fetches aggregated session/trial stats for the last 7 and prior 7 days.
 * Used by the progress note generator.
 */
export function useWeeklySessionStats(profileId: string | undefined): WeeklySessionStats {
  const [stats, setStats] = useState<WeeklySessionStats>({
    trialCount: 0,
    sessionCount: 0,
    avgAccuracy: null,
    priorAvgAccuracy: null,
    accuracySlope: null,
    accuracySlopePctPerWeek: null,
    isLoading: true,
  });

  useEffect(() => {
    if (!profileId) {
      setStats((s) => ({ ...s, isLoading: false }));
      return;
    }

    const load = async () => {
      try {
        const now = new Date();
        const sevenAgo = new Date(now);
        sevenAgo.setDate(sevenAgo.getDate() - 7);
        const fourteenAgo = new Date(now);
        fourteenAgo.setDate(fourteenAgo.getDate() - 14);

        const fmt = (d: Date) => d.toISOString();

        // Recent 7 days: sessions + events
        const { data: recentSessions } = await supabase
          .from("sessions")
          .select("id, ended_at, duration_sec")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .gte("ended_at", fmt(sevenAgo))
          .gte("duration_sec", 60);

        const sessionIds = (recentSessions || []).map((s) => s.id);
        let recentScores: number[] = [];

        if (sessionIds.length > 0) {
          // Speech accuracy only: the same predicate Session Review and the
          // session summary use, so taps, gated clips and manual confirmations
          // never inflate the week-over-week comparison.
          const { data: events } = await supabase
            .from("exercise_events")
            .select("score, session_id, counts_toward_score, validity_label, exercise_slug")
            .in("session_id", sessionIds)
            .not("score", "is", null);

          recentScores = (events || []).filter(isSpeechScoredRow).map((e) => {
            const s = e.score!;
            const normalized = s <= 1 ? s * 100 : s;
            return Math.max(0, Math.min(100, normalized));
          });
        }

        // Prior 7 days
        const { data: priorSessions } = await supabase
          .from("sessions")
          .select("id")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .gte("ended_at", fmt(fourteenAgo))
          .lt("ended_at", fmt(sevenAgo))
          .gte("duration_sec", 60);

        let priorScores: number[] = [];
        const priorIds = (priorSessions || []).map((s) => s.id);
        if (priorIds.length > 0) {
          const { data: priorEvents } = await supabase
            .from("exercise_events")
            .select("score, counts_toward_score, validity_label, exercise_slug")
            .in("session_id", priorIds)
            .not("score", "is", null);

          priorScores = (priorEvents || []).filter(isSpeechScoredRow).map((e) => {
            const s = e.score!;
            const normalized = s <= 1 ? s * 100 : s;
            return Math.max(0, Math.min(100, normalized));
          });
        }

        // Learning rate. calculate-learning-rates writes one row per domain ×
        // window (7 × 3) on every run; taking "the most recent row" returned
        // whichever of the 21 happened to be written last. Name the row: the
        // speech domain over 14 days, the window the hub already reasons in.
        const { data: lrData } = await supabase
          .from("learning_rates")
          .select("accuracy_slope, trial_count, active_days, confidence_score")
          .eq("profile_id", profileId)
          .eq("domain", LEARNING_RATE_DOMAIN)
          .eq("time_window_days", LEARNING_RATE_WINDOW_DAYS)
          .order("calculated_at", { ascending: false })
          .limit(1);
        const slope = learningRateSlopeIfTrustworthy(lrData?.[0]);

        const avgAcc = recentScores.length > 0
          ? recentScores.reduce((s, n) => s + n, 0) / recentScores.length
          : null;
        const priorAvg = priorScores.length > 0
          ? priorScores.reduce((s, n) => s + n, 0) / priorScores.length
          : null;

        setStats({
          trialCount: recentScores.length,
          sessionCount: sessionIds.length,
          avgAccuracy: avgAcc,
          priorAvgAccuracy: priorAvg,
          accuracySlope: slope,
          accuracySlopePctPerWeek: slopePerDayToPctPerWeek(slope),
          isLoading: false,
        });
      } catch (err) {
        console.error("[useWeeklySessionStats] error:", err);
        setStats((s) => ({ ...s, isLoading: false }));
      }
    };

    load();
  }, [profileId]);

  return stats;
}
