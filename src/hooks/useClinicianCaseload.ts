import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { localYYYYMMDD } from "@/lib/localDate";

export interface CaseloadPatient {
  profileId: string;
  userId: string;
  name: string;
  strokeDate: string | null;
  daysPostStroke: number | null;
  aphasiaLabel: string | null;

  // 7-day aggregates
  trials7d: number;
  priorTrials7d: number;
  adherenceDays7d: number; // 0–7
  avgAccuracy7d: number | null;
  accuracyDelta7d: number | null; // vs prior 7d — null if insufficient trials

  // Safety / triage
  activeAlertCount: number;
  criticalAlertCount: number;
  lastActiveDate: string | null;
  trend: "up" | "down" | "flat" | "unknown";
}

/** Derive aphasia label from clinical_profile JSON */
function deriveAphasiaLabel(cp: Record<string, any> | null): string | null {
  if (!cp) return null;
  const speech: string[] = cp?.impairments?.speech || [];
  const normalized = speech.map(s => s.toLowerCase().replace(/[^a-z]/g, ""));
  if (normalized.some(s => s.includes("broca") || s === "expressiveaphasia")) return "Expressive";
  if (normalized.some(s => s.includes("wernicke") || s === "receptiveaphasia")) return "Receptive";
  if (normalized.some(s => s.includes("global"))) return "Global";
  if (normalized.some(s => s.includes("anomic"))) return "Anomic";
  if (speech.length > 0) return speech[0].replace(/_/g, " ");
  return null;
}

/**
 * Sprint 2 caseload hook — Mode A (temporary linking).
 * 
 * Fetches profiles the current user can see via RLS.
 * Admins see all profiles; regular users see only their own.
 * Sprint 3 will swap to clinician_patient_links.
 */
export function useClinicianCaseload() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<CaseloadPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        // Step 1: Get all accessible profiles (RLS-filtered)
        const { data: profiles, error: profileErr } = await supabase
          .from("profiles")
          .select("id, user_id, profile_name, stroke_date, clinical_profile, is_active")
          .eq("is_active", true)
          .order("profile_name");

        if (profileErr) throw profileErr;
        if (!profiles || profiles.length === 0) {
          setPatients([]);
          setIsLoading(false);
          return;
        }

        const profileIds = profiles.map(p => p.id);

        // Use timezone-safe date boundaries
        const now = new Date();
        const sevenAgoDate = new Date(now);
        sevenAgoDate.setDate(sevenAgoDate.getDate() - 7);
        const fourteenAgoDate = new Date(now);
        fourteenAgoDate.setDate(fourteenAgoDate.getDate() - 14);

        const todayStr = localYYYYMMDD(now);
        const sevenAgoStr = localYYYYMMDD(sevenAgoDate);
        const fourteenAgoStr = localYYYYMMDD(fourteenAgoDate);

        // Step 2: Batch fetch 14d sessions for all profiles
        const { data: sessions14d } = await supabase
          .from("sessions")
          .select("id, profile_id, ended_at, duration_sec")
          .in("profile_id", profileIds)
          .not("ended_at", "is", null)
          .gte("ended_at", fourteenAgoDate.toISOString())
          .gte("duration_sec", 60);

        // Group sessions by profile + window using date string comparison
        const sessionsByProfile = new Map<string, { recent: any[]; prior: any[] }>();
        for (const p of profileIds) {
          sessionsByProfile.set(p, { recent: [], prior: [] });
        }
        for (const s of sessions14d || []) {
          const bucket = sessionsByProfile.get(s.profile_id);
          if (!bucket) continue;
          // Compare as local date strings to avoid TZ off-by-one
          const sessionDateStr = localYYYYMMDD(new Date(s.ended_at!));
          if (sessionDateStr >= sevenAgoStr) {
            bucket.recent!.push(s);
          } else {
            bucket.prior!.push(s);
          }
        }

        // Step 3: Batch fetch events for all sessions
        const allSessionIds = (sessions14d || []).map(s => s.id);
        const eventsBySession = new Map<string, number[]>();

        if (allSessionIds.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < allSessionIds.length; i += 100) {
            chunks.push(allSessionIds.slice(i, i + 100));
          }
          for (const chunk of chunks) {
            const { data: events } = await supabase
              .from("exercise_events")
              .select("session_id, score")
              .in("session_id", chunk)
              .not("score", "is", null);

            for (const e of events || []) {
              if (!eventsBySession.has(e.session_id)) {
                eventsBySession.set(e.session_id, []);
              }
              const s = e.score!;
              const normalized = s <= 1 ? s * 100 : s;
              eventsBySession.get(e.session_id)!.push(Math.max(0, Math.min(100, normalized)));
            }
          }
        }

        // Step 4: Batch fetch unresolved alerts
        const { data: alertsRaw } = await (supabase as any)
          .from("recovery_alerts")
          .select("profile_id, severity")
          .in("profile_id", profileIds)
          .is("resolved_at", null);

        const alertsByProfile = new Map<string, { total: number; critical: number }>();
        for (const a of alertsRaw || []) {
          if (!alertsByProfile.has(a.profile_id)) {
            alertsByProfile.set(a.profile_id, { total: 0, critical: 0 });
          }
          const bucket = alertsByProfile.get(a.profile_id)!;
          bucket.total++;
          if (a.severity === "critical") bucket.critical++;
        }

        // Step 5: Batch fetch dose_logs for adherence + last active (dose side)
        const { data: doseLogs } = await supabase
          .from("dose_logs")
          .select("profile_id, log_date")
          .in("profile_id", profileIds)
          .gte("log_date", fourteenAgoStr)
          .order("log_date", { ascending: false });

        const lastDoseDateByProfile = new Map<string, string>();
        const activeDaysByProfile = new Map<string, Set<string>>();
        for (const d of doseLogs || []) {
          if (!lastDoseDateByProfile.has(d.profile_id)) {
            lastDoseDateByProfile.set(d.profile_id, d.log_date);
          }
          // Count unique active days in last 7 using string comparison
          if (d.log_date >= sevenAgoStr) {
            if (!activeDaysByProfile.has(d.profile_id)) {
              activeDaysByProfile.set(d.profile_id, new Set());
            }
            activeDaysByProfile.get(d.profile_id)!.add(d.log_date);
          }
        }

        // Derive lastActiveDate = max(dose_logs.log_date, sessions.ended_at)
        const lastActiveDateByProfile = new Map<string, string>();
        // Seed from dose logs
        for (const [pid, dateStr] of lastDoseDateByProfile) {
          lastActiveDateByProfile.set(pid, dateStr);
        }
        // Compare with latest session ended_at (converted to local date)
        for (const s of sessions14d || []) {
          const sessionDateStr = localYYYYMMDD(new Date(s.ended_at!));
          const existing = lastActiveDateByProfile.get(s.profile_id);
          if (!existing || sessionDateStr > existing) {
            lastActiveDateByProfile.set(s.profile_id, sessionDateStr);
          }
        }

        // Step 6: Assemble patient cards
        const result: CaseloadPatient[] = profiles.map(p => {
          const cp = p.clinical_profile as Record<string, any> | null;
          const daysPost = p.stroke_date
            ? Math.floor((Date.now() - new Date(p.stroke_date).getTime()) / (1000 * 60 * 60 * 24))
            : null;

          const bucket = sessionsByProfile.get(p.id);
          const recentSessionIds = (bucket?.recent || []).map((s: any) => s.id);
          const priorSessionIds = (bucket?.prior || []).map((s: any) => s.id);

          // Aggregate scores
          const recentScores = recentSessionIds.flatMap(id => eventsBySession.get(id) || []);
          const priorScores = priorSessionIds.flatMap(id => eventsBySession.get(id) || []);

          const avgAcc = recentScores.length > 0
            ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
            : null;
          const priorAvg = priorScores.length > 0
            ? priorScores.reduce((a, b) => a + b, 0) / priorScores.length
            : null;

          // Gate accuracy delta on sufficient trial count (≥10 in both windows)
          const hasSufficientTrials = recentScores.length >= 10 && priorScores.length >= 10;
          const delta = hasSufficientTrials && avgAcc !== null && priorAvg !== null
            ? Math.round(avgAcc - priorAvg)
            : null;

          let trend: CaseloadPatient["trend"] = "unknown";
          if (delta !== null) {
            if (delta > 3) trend = "up";
            else if (delta < -3) trend = "down";
            else trend = "flat";
          }

          const alerts = alertsByProfile.get(p.id) || { total: 0, critical: 0 };
          const adherenceDays = activeDaysByProfile.get(p.id)?.size || 0;

          return {
            profileId: p.id,
            userId: p.user_id,
            name: p.profile_name,
            strokeDate: p.stroke_date,
            daysPostStroke: daysPost,
            aphasiaLabel: deriveAphasiaLabel(cp),
            trials7d: recentScores.length,
            priorTrials7d: priorScores.length,
            adherenceDays7d: adherenceDays,
            avgAccuracy7d: avgAcc !== null ? Math.round(avgAcc) : null,
            accuracyDelta7d: delta,
            activeAlertCount: alerts.total,
            criticalAlertCount: alerts.critical,
            lastActiveDate: lastActiveDateByProfile.get(p.id) || null,
            trend,
          };
        });

        // Filter out the clinician's own profile to avoid confusion
        const filtered = result.filter(x => x.userId !== user.id);
        setPatients(filtered);
      } catch (err) {
        console.error("[useClinicianCaseload] error:", err);
        setError("Failed to load caseload");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [user?.id]);

  return { patients, isLoading, error };
}
