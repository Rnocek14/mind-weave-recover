import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PhysicalRow } from "@/lib/buildSnapshotTimeline";

export function usePhysicalMetrics(
  profileId: string | undefined,
  start: string,
  end: string
) {
  const { user } = useAuth();
  const [physicalRows, setPhysicalRows] = useState<PhysicalRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id || !profileId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from("physical_daily_metrics")
        .select("metric_date, steps, active_minutes, workout_minutes, sleep_minutes, source, last_sync_at")
        .eq("profile_id", profileId)
        .gte("metric_date", start)
        .lte("metric_date", end);

      if (error) {
        console.error("[usePhysicalMetrics] query failed:", error);
        setPhysicalRows([]);
      } else {
        setPhysicalRows(data || []);
      }
    } catch (err) {
      console.error("[usePhysicalMetrics] fetch error:", err);
      setPhysicalRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profileId, start, end]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { physicalRows, isLoading, refetch: fetch };
}
