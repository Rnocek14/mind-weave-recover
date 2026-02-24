import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { localYYYYMMDD } from "@/lib/localDate";

export interface SnapshotDay {
  date: string;
  speechMinutes: number;
  therapyMinutes: number; // PT + OT + cognitive
  activityMinutes: number; // activity domain
  totalMinutes: number;
  fatigueRating: number | null;
  hasAnySignal: boolean;
}

export interface RecoveryFlag {
  type: "no_signal" | "fatigue_spike";
  label: string;
  days: number;
}

export function useWeeklyRecoverySnapshot(
  profileId: string | undefined,
  days: number = 14
) {
  const { user } = useAuth();
  const [timeline, setTimeline] = useState<SnapshotDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = localYYYYMMDD();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const start = localYYYYMMDD(startDate);

  const fetchSnapshot = useCallback(async () => {
    if (!user?.id || !profileId) {
      setIsLoading(false);
      return;
    }

    setError(null);

    try {
      const [readinessRes, doseRes] = await Promise.all([
        (supabase as any)
          .from("daily_readiness")
          .select("checkin_date, fatigue_rating")
          .eq("profile_id", profileId)
          .gte("checkin_date", start)
          .lte("checkin_date", today),
        (supabase as any)
          .from("dose_logs")
          .select("log_date, domain_slug, dose_value")
          .eq("profile_id", profileId)
          .gte("log_date", start)
          .lte("log_date", today),
      ]);

      // Check for query errors
      if (readinessRes.error) {
        console.error("[WeeklyRecoverySnapshot] readiness query failed:", readinessRes.error);
        setError("Failed to load readiness data");
        setTimeline([]);
        setIsLoading(false);
        return;
      }
      if (doseRes.error) {
        console.error("[WeeklyRecoverySnapshot] dose_logs query failed:", doseRes.error);
        setError("Failed to load dose data");
        setTimeline([]);
        setIsLoading(false);
        return;
      }

      // Index readiness by date
      const fatigueMap = new Map<string, number>();
      if (readinessRes.data) {
        for (const r of readinessRes.data) {
          fatigueMap.set(r.checkin_date, r.fatigue_rating);
        }
      }

      // Aggregate dose by date, split: speech / therapy (pt+ot+cognitive) / activity
      const THERAPY_DOMAINS = new Set(["pt", "ot", "cognitive"]);
      const speechMap = new Map<string, number>();
      const therapyMap = new Map<string, number>();
      const activityMap = new Map<string, number>();

      if (doseRes.data) {
        for (const d of doseRes.data) {
          const val = Number(d.dose_value) || 0;
          if (d.domain_slug === "speech") {
            speechMap.set(d.log_date, (speechMap.get(d.log_date) || 0) + val);
          } else if (d.domain_slug === "activity") {
            activityMap.set(d.log_date, (activityMap.get(d.log_date) || 0) + val);
          } else if (THERAPY_DOMAINS.has(d.domain_slug)) {
            therapyMap.set(d.log_date, (therapyMap.get(d.log_date) || 0) + val);
          } else {
            // Future domains default to therapy bucket
            therapyMap.set(d.log_date, (therapyMap.get(d.log_date) || 0) + val);
          }
        }
      }

      // Build timeline array for every day in range
      const result: SnapshotDay[] = [];
      const cursor = new Date(startDate);
      for (let i = 0; i < days; i++) {
        const d = localYYYYMMDD(cursor);
        const speech = speechMap.get(d) || 0;
        const therapy = therapyMap.get(d) || 0;
        const activity = activityMap.get(d) || 0;
        const fatigue = fatigueMap.get(d) ?? null;
        result.push({
          date: d,
          speechMinutes: speech,
          therapyMinutes: therapy,
          activityMinutes: activity,
          totalMinutes: speech + therapy + activity,
          fatigueRating: fatigue,
          hasAnySignal: speech > 0 || therapy > 0 || activity > 0 || fatigue !== null,
        });
        cursor.setDate(cursor.getDate() + 1);
      }

      setTimeline(result);
    } catch (err) {
      console.error("[useWeeklyRecoverySnapshot] fetch error:", err);
      setError("Failed to load recovery snapshot");
      setTimeline([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profileId, start, today, days]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // Computed flags
  const flags = useMemo<RecoveryFlag[]>(() => {
    if (timeline.length === 0) return [];
    const result: RecoveryFlag[] = [];

    // Flag 1: trailing no-signal streak
    let noSignalStreak = 0;
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (!timeline[i].hasAnySignal) noSignalStreak++;
      else break;
    }
    if (noSignalStreak >= 3) {
      result.push({
        type: "no_signal",
        label: `${noSignalStreak}-day engagement gap`,
        days: noSignalStreak,
      });
    }

    // Flag 2: fatigue ≥4 for 3+ recent days AND dose dropped vs prior week
    const recent7 = timeline.slice(-7);
    const highFatigueDays = recent7.filter(
      (d) => d.fatigueRating !== null && d.fatigueRating >= 4
    );
    if (highFatigueDays.length >= 3) {
      const avgDose =
        recent7.reduce((s, d) => s + d.totalMinutes, 0) / recent7.length;
      const prior7 = timeline.slice(-14, -7);
      const priorAvgDose =
        prior7.length > 0
          ? prior7.reduce((s, d) => s + d.totalMinutes, 0) / prior7.length
          : avgDose;
      if (priorAvgDose > 0 && avgDose < priorAvgDose * 0.7) {
        result.push({
          type: "fatigue_spike",
          label: "High fatigue + dose drop",
          days: highFatigueDays.length,
        });
      }
    }

    return result;
  }, [timeline]);

  // Last active day
  const lastActiveDate = useMemo(() => {
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].hasAnySignal) return timeline[i].date;
    }
    return null;
  }, [timeline]);

  return {
    timeline,
    flags,
    lastActiveDate,
    isLoading,
    error,
    refetch: fetchSnapshot,
  };
}
