import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readAllById } from "@/lib/clinical/readAllById";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useAuth } from "@/hooks/useAuth";
import { localYYYYMMDD } from "@/lib/localDate";
import { isComparableScoredEvent } from "@/lib/clinical/metricsPresentation";

export interface CaseloadPatient {
  profileId: string;
  userId: string;
  name: string;
  strokeDate: string | null;
  daysPostStroke: number | null;
  aphasiaLabel: string | null;

  // Phenotype (from new queryable columns)
  aphasiaType: string | null;
  laterality: string | null;
  chronicity: string | null;
  strokeMechanism: string | null;

  // 7-day aggregates
  trials7d: number;
  priorTrials7d: number;
  adherenceDays7d: number; // Observed days of practice, NOT prescribed adherence
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

export function useClinicianCaseload() {
  const { user } = useAuth();
  const role = useUserPermissions(user?.id);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [patients, setPatients] = useState<CaseloadPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const requestId = useRef(0);
  const viewerKey = user?.id && !role.isLoading ? `${user.id}|${role.isAdmin}` : null;

  const load = useCallback(async () => {
    const request = ++requestId.current;
    if (!viewerKey || !user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const assigned = role.isAdmin ? null : await readAllById(after => {
        let q = supabase.from("clinician_assignments").select("id, profile_id")
          .eq("clinician_id", user.id).is("revoked_at", null).order("id").limit(500);
        if (after) q = q.gt("id",after);
        return q;
      });
      const ids = assigned === null ? null : new Set(assigned.map(a => a.profile_id));
      const visible = await readAllById(after => {
        let q = supabase.from("profiles")
          .select("id, user_id, profile_name, stroke_date, clinical_profile, aphasia_type, laterality, chronicity_tag, stroke_mechanism_tag")
          .eq("profile_kind","patient").order("id").limit(500);
        if (after) q = q.gt("id", after);
        return q;
      });
      if (request !== requestId.current) return;
      const profiles = visible.filter(p => ids === null || ids.has(p.id)).sort((a,b) => a.profile_name.localeCompare(b.profile_name));
      if (!profiles.length) { setPatients([]); setLastUpdatedAt(new Date()); return; }

        const profileIds = profiles.map(p => p.id);

        // Use timezone-safe date boundaries
        const now = new Date();
        const sevenAgoDate = new Date(now);
        sevenAgoDate.setHours(0,0,0,0);
        sevenAgoDate.setDate(sevenAgoDate.getDate() - 6);
        const fourteenAgoDate = new Date(now);
        fourteenAgoDate.setHours(0,0,0,0);
        fourteenAgoDate.setDate(fourteenAgoDate.getDate() - 13);

        const sevenAgoStr = localYYYYMMDD(sevenAgoDate);
        const fourteenAgoStr = localYYYYMMDD(fourteenAgoDate);

        // Step 2: Batch fetch 14d sessions for all profiles
        const patientSet = new Set(profileIds);
        const periodSessions = await readAllById(after => {
          let q = supabase.from("sessions").select("id, profile_id, ended_at, duration_sec")
            .gte("ended_at", fourteenAgoDate.toISOString()).lte("ended_at",now.toISOString())
            .gte("duration_sec",60).order("id").limit(500);
          if (after) q = q.gt("id",after);
          return q;
        });
        const sessions14d = periodSessions.filter(s => s.profile_id && patientSet.has(s.profile_id));

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
        const sessionOwner = new Map(sessions14d.map(s => [s.id,s.profile_id]));
        const allSessionIds = [...sessionOwner.keys()];
        const eventsBySession = new Map<string, number[]>();

        if (allSessionIds.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < allSessionIds.length; i += 100) {
            chunks.push(allSessionIds.slice(i, i + 100));
          }
          for (const chunk of chunks) {
            const events = await readAllById(after => {
              let q = supabase.from("exercise_events")
                .select("id, session_id, profile_id, score, exercise_slug, counts_toward_score, validity_label, clinician_validity_override, task_parameters, engagement_flags")
                .in("session_id",chunk).order("id").limit(500);
              if (after) q = q.gt("id",after);
              return q;
            });

            for (const event of events) {
              // Identical read-side validity rules to the patient-specific
              // review. Never restore invalid caregiver/noise/assisted samples
              // by averaging raw scores in the caseload.
              if ((event.profile_id && event.profile_id !== sessionOwner.get(event.session_id)) || !isComparableScoredEvent(event)) continue;
              const scores = eventsBySession.get(event.session_id) ?? [];
              const score = event.score!;
              scores.push(score <= 1 ? score * 100 : score);
              eventsBySession.set(event.session_id, scores);
            }
          }
        }

        // Step 4: Batch fetch unresolved alerts
        const alertsRaw = await readAllById(after => {
          let q = supabase.from("recovery_alerts").select("id,profile_id,severity").is("resolved_at",null).order("id").limit(500);
          if (after) q = q.gt("id",after);
          return q;
        });

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
        const doseLogs = await readAllById(after => {
          let q = supabase.from("dose_logs").select("id,profile_id,log_date").gt("dose_value",0)
            .gte("log_date",fourteenAgoStr).lte("log_date",localYYYYMMDD(now)).order("id").limit(500);
          if (after) q = q.gt("id",after);
          return q;
        });

        const lastDoseDateByProfile = new Map<string, string>();
        const activeDaysByProfile = new Map<string, Set<string>>();
        for (const d of doseLogs || []) {
          if (d.log_date > (lastDoseDateByProfile.get(d.profile_id) ?? "")) {
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
          if (sessionDateStr >= sevenAgoStr) {
            const days = activeDaysByProfile.get(s.profile_id) ?? new Set<string>();
            days.add(sessionDateStr); activeDaysByProfile.set(s.profile_id, days);
          }
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
            aphasiaType: (p as any).aphasia_type || null,
            laterality: (p as any).laterality || null,
            chronicity: (p as any).chronicity_tag || null,
            strokeMechanism: (p as any).stroke_mechanism_tag || null,
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

        if (request !== requestId.current) return;
        setPatients(result);
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (request !== requestId.current) return;
        console.error("[useClinicianCaseload] error:", err);
        // Never leave prior/potentially wrong patients on screen after an
        // incomplete load. A missing response is not a clean zero.
        setPatients([]);
        setError("Caseload evidence could not be loaded reliably");
      } finally {
        if (request === requestId.current) { setIsLoading(false); setLoadedFor(viewerKey); }
      }
  }, [user?.id, role.isAdmin, viewerKey]);

  useEffect(() => {
    void load();
    return () => { requestId.current++; };
  }, [load]);

  return { isAdmin:role.isAdmin, patients: loadedFor === viewerKey ? patients : [], isLoading: !viewerKey || loadedFor !== viewerKey || isLoading,
    error: loadedFor === viewerKey ? error : null, lastUpdatedAt: loadedFor === viewerKey ? lastUpdatedAt : null, refetch: load };
}
