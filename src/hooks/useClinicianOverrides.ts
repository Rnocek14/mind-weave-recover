/**
 * Fetches clinician overrides for a profile.
 * Supports refetch() for post-action invalidation.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClinicianOverride {
  id: string;
  overrideType: string;
  targetSlug: string | null;
  valueBefore: Record<string, any>;
  valueAfter: Record<string, any>;
  reason: string | null;
  status: string;
  clinicianId: string;
  createdAt: string;
  reversedAt: string | null;
}

export function useClinicianOverrides(profileId: string | undefined) {
  const [overrides, setOverrides] = useState<ClinicianOverride[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profileId) {
      setOverrides([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("clinician_overrides")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(50);

      setOverrides(
        (data || []).map((d: any) => ({
          id: d.id,
          overrideType: d.override_type,
          targetSlug: d.target_slug,
          valueBefore: d.value_before || {},
          valueAfter: d.value_after || {},
          reason: d.reason,
          status: d.status,
          clinicianId: d.clinician_id,
          createdAt: d.created_at,
          reversedAt: d.reversed_at,
        }))
      );
    } catch (err) {
      console.error("[useClinicianOverrides] error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeOverrides = overrides.filter((o) => o.status === "active");
  const recentOverrides = overrides.slice(0, 10);

  return { overrides, activeOverrides, recentOverrides, isLoading, refetch: load };
}
