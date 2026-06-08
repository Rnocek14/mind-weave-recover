/**
 * useProbeResults
 *
 * Reads real generalization-probe data from `probe_results`.
 *
 * Generalization probes use UNTRAINED words to estimate whether learning is
 * transferring (true recovery) vs. memorization of practiced items. This is a
 * signal, NOT a validated clinical outcome measure — label it as such wherever
 * it is surfaced.
 *
 * Two views:
 *   - `recent`     : the most recent N probe trials (for a session summary)
 *   - `dailyTrend` : per-day aggregates (for a clinician trend over time)
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProbeTrialRow {
  probe_word: string;
  target_difficulty: number;
  correct: boolean;
  error_type: string | null;
  cues_needed: number;
  reaction_time_ms: number | null;
  created_at: string;
  session_id: string | null;
}

export interface ProbeDailyPoint {
  assessment_date: string;
  total_probes: number;
  correct_count: number;
  accuracy_pct: number;
  avg_cues_needed: number;
  avg_reaction_time_ms: number;
  avg_difficulty: number;
}

export interface ProbeSummary {
  /** Independent accuracy = correct AND zero cues needed (true generalization). */
  independentAccuracyPct: number | null;
  accuracyPct: number | null;
  avgCuesNeeded: number | null;
  avgReactionTimeMs: number | null;
  topErrorType: string | null;
  totalTrials: number;
}

interface UseProbeResultsOptions {
  userId: string | undefined;
  profileId?: string | null;
  /** How many of the most-recent trials to use for the session summary. */
  recentLimit?: number;
  /** How many days of daily-trend points to load (clinician view). */
  trendDays?: number;
}

function summarize(rows: ProbeTrialRow[]): ProbeSummary {
  if (rows.length === 0) {
    return {
      independentAccuracyPct: null,
      accuracyPct: null,
      avgCuesNeeded: null,
      avgReactionTimeMs: null,
      topErrorType: null,
      totalTrials: 0,
    };
  }

  const total = rows.length;
  const correct = rows.filter((r) => r.correct).length;
  const independent = rows.filter((r) => r.correct && r.cues_needed === 0).length;
  const cues = rows.reduce((s, r) => s + (r.cues_needed ?? 0), 0);

  const rtRows = rows.filter((r) => typeof r.reaction_time_ms === "number");
  const rt = rtRows.reduce((s, r) => s + (r.reaction_time_ms ?? 0), 0);

  const errorCounts = new Map<string, number>();
  rows.forEach((r) => {
    if (!r.correct && r.error_type) {
      errorCounts.set(r.error_type, (errorCounts.get(r.error_type) ?? 0) + 1);
    }
  });
  let topErrorType: string | null = null;
  let topCount = 0;
  errorCounts.forEach((count, type) => {
    if (count > topCount) {
      topCount = count;
      topErrorType = type;
    }
  });

  return {
    independentAccuracyPct: Math.round((independent / total) * 100),
    accuracyPct: Math.round((correct / total) * 100),
    avgCuesNeeded: Math.round((cues / total) * 100) / 100,
    avgReactionTimeMs: rtRows.length ? Math.round(rt / rtRows.length) : null,
    topErrorType,
    totalTrials: total,
  };
}

export function useProbeResults({
  userId,
  profileId,
  recentLimit = 10,
  trendDays = 90,
}: UseProbeResultsOptions) {
  const [recent, setRecent] = useState<ProbeTrialRow[]>([]);
  const [dailyTrend, setDailyTrend] = useState<ProbeDailyPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Recent trials for the session-summary view.
        let trialsQ = (supabase as any)
          .from("probe_results")
          .select(
            "probe_word, target_difficulty, correct, error_type, cues_needed, reaction_time_ms, created_at, session_id"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(recentLimit);
        if (profileId) trialsQ = trialsQ.eq("profile_id", profileId);

        // Daily aggregates for the clinician trend.
        const sinceISO = new Date(
          Date.now() - trendDays * 24 * 60 * 60 * 1000
        ).toISOString();
        let trendQ = (supabase as any)
          .from("probe_analytics")
          .select(
            "assessment_date, total_probes, correct_count, accuracy_pct, avg_cues_needed, avg_reaction_time_ms, avg_difficulty"
          )
          .eq("user_id", userId)
          .gte("assessment_date", sinceISO.split("T")[0])
          .order("assessment_date", { ascending: true });
        if (profileId) trendQ = trendQ.eq("profile_id", profileId);

        const [{ data: trials }, { data: trend }] = await Promise.all([
          trialsQ,
          trendQ,
        ]);

        if (cancelled) return;
        setRecent((trials as ProbeTrialRow[]) ?? []);
        setDailyTrend((trend as ProbeDailyPoint[]) ?? []);
      } catch (err) {
        console.error("[useProbeResults] failed to load probe data", err);
        if (!cancelled) {
          setRecent([]);
          setDailyTrend([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, profileId, recentLimit, trendDays]);

  return {
    loading,
    recent,
    dailyTrend,
    summary: summarize(recent),
    hasData: recent.length > 0,
  };
}
