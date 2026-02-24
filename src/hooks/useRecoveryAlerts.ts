import { useEffect, useCallback, useState, useRef } from "react";
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

function timelineHash(timeline: SnapshotDay[]): string {
  return timeline
    .map((d) => `${d.date}-${d.totalMinutes}-${d.fatigueRating ?? "n"}`)
    .join("|");
}

export function useRecoveryAlerts(
  profileId: string | undefined,
  timeline: SnapshotDay[]
) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<RecoveryAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastHashRef = useRef<string>("");

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

    // Write throttle: skip if timeline hasn't materially changed
    const hash = timelineHash(timeline);
    if (hash === lastHashRef.current) return;
    lastHashRef.current = hash;

    const runDetection = async () => {
      const detected = detectRecoveryAlerts(timeline);
      if (detected.length === 0) return;

      // Fresh-fetch unresolved alerts to avoid stale closure dedup
      const { data: currentAlerts } = await (supabase as any)
        .from("recovery_alerts")
        .select("id, alert_type, domain_slug, resolved_at")
        .eq("profile_id", profileId)
        .is("resolved_at", null);

      const dedupKey = (type: string, domain: string | null) =>
        `${type}:${domain ?? "all"}`;

      const existingByKey = new Map<string, { id: string; alert_type: string; domain_slug: string | null }>(
        (currentAlerts ?? []).map((a: any) => [dedupKey(a.alert_type, a.domain_slug), a])
      );

      for (const alert of detected) {
        const key = dedupKey(alert.alert_type, alert.domain_slug);
        const existing = existingByKey.get(key);
        if (existing) {
          await (supabase as any)
            .from("recovery_alerts")
            .update({
              trigger_data: alert.trigger_data,
              severity: alert.severity,
              title: alert.title,
              description: alert.description,
            })
            .eq("id", existing.id);
        } else {
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
