import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DoseLog {
  id: string;
  domain_slug: string;
  log_date: string;
  dose_value: number;
  source: string;
  intensity_score: number | null;
  quality_score: number | null;
  notes: string | null;
  metadata: Record<string, any>;
}

export interface RecoveryDomain {
  slug: string;
  display_name: string;
  dose_unit: string;
  icon_name: string | null;
  is_active: boolean;
  sort_order: number;
}

interface UpsertDoseLogInput {
  domain_slug: string;
  dose_value: number;
  log_date?: string;
  source?: string;
  intensity_score?: number | null;
  notes?: string | null;
}

export function useDoseLogs(profileId: string | undefined, days: number = 7) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [domains, setDomains] = useState<RecoveryDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const start = startDate.toISOString().slice(0, 10);

  const fetchDomains = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("recovery_domains")
      .select("slug, display_name, dose_unit, icon_name, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order");

    if (!error && data) setDomains(data);
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!user?.id || !profileId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from("dose_logs")
        .select("*")
        .eq("profile_id", profileId)
        .gte("log_date", start)
        .lte("log_date", today)
        .order("log_date", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("[useDoseLogs] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profileId, start, today]);

  useEffect(() => {
    fetchDomains();
    fetchLogs();
  }, [fetchDomains, fetchLogs]);

  const upsertDoseLog = useCallback(
    async (input: UpsertDoseLogInput) => {
      if (!user?.id || !profileId) return null;

      setIsSaving(true);
      try {
        const { data, error } = await (supabase as any)
          .from("dose_logs")
          .insert({
            user_id: user.id,
            profile_id: profileId,
            domain_slug: input.domain_slug,
            log_date: input.log_date ?? today,
            dose_value: input.dose_value,
            source: input.source ?? "manual",
            intensity_score: input.intensity_score ?? null,
            notes: input.notes ?? null,
            metadata: {},
          })
          .select()
          .single();

        if (error) throw error;
        await fetchLogs();
        return data;
      } catch (err) {
        console.error("[useDoseLogs] insert error:", err);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [user?.id, profileId, today, fetchLogs]
  );

  // Aggregate: total dose per domain for the range
  const doseByDomain = useCallback(
    (domainSlug: string) => {
      return logs
        .filter((l) => l.domain_slug === domainSlug)
        .reduce((sum, l) => sum + Number(l.dose_value), 0);
    },
    [logs]
  );

  // Today's logs per domain
  const todayLogs = logs.filter((l) => l.log_date === today);

  return {
    logs,
    todayLogs,
    domains,
    isLoading,
    isSaving,
    upsertDoseLog,
    doseByDomain,
    refetch: fetchLogs,
  };
}
