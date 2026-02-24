import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { detectRecoveryAlerts, type DetectedAlert } from "@/lib/recoveryAlertDetector";
import type { SnapshotDay } from "@/hooks/useWeeklyRecoverySnapshot";

export interface RecoveryAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  domain_slug: string | null;
  trigger_data: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

export function useRecoveryAlerts(
  profileId: string | undefined,
  timeline: SnapshotDay[]
) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<RecoveryAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch existing unresolved alerts
  const fetchAlerts = useCallback(async () => {
    if (!user?.id || !profileId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from("recovery_alerts")
        .select("*")
        .eq("profile_id", profileId)
        .is("resolved_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (err) {
      console.error("[useRecoveryAlerts] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profileId]);

  // Run detection + upsert when timeline changes
  useEffect(() => {
    if (!user?.id || !profileId || timeline.length === 0) return;

    const runDetection = async () => {
      const detected = detectRecoveryAlerts(timeline);
      if (detected.length === 0) return;

      // For each detected alert, check if an unresolved one of the same type exists
      for (const alert of detected) {
        const existing = alerts.find(
          (a) => a.alert_type === alert.alert_type && !a.resolved_at
        );
        if (existing) {
          // Update trigger_data on existing alert
          await (supabase as any)
            .from("recovery_alerts")
            .update({ trigger_data: alert.trigger_data, severity: alert.severity })
            .eq("id", existing.id);
        } else {
          // Insert new alert
          await (supabase as any)
            .from("recovery_alerts")
            .insert({
              user_id: user.id,
              profile_id: profileId,
              alert_type: alert.alert_type,
              severity: alert.severity,
              title: alert.title,
              description: alert.description,
              domain_slug: alert.domain_slug,
              trigger_data: alert.trigger_data,
            });
        }
      }

      // Re-fetch to get latest state
      await fetchAlerts();
    };

    runDetection();
  }, [user?.id, profileId, timeline.length]); // intentionally not depending on alerts to avoid loops

  // Resolve an alert
  const resolveAlert = useCallback(
    async (alertId: string, notes?: string) => {
      if (!user?.id) return;

      try {
        const { error } = await (supabase as any)
          .from("recovery_alerts")
          .update({
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
            resolution_notes: notes || null,
          })
          .eq("id", alertId);

        if (error) throw error;
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      } catch (err) {
        console.error("[useRecoveryAlerts] resolve error:", err);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, isLoading, resolveAlert, refetch: fetchAlerts };
}
