/**
 * Survivor self-start telemetry (launch KPI, plan A4).
 *
 * Records each time a stroke survivor independently reaches the daily Start
 * button. The launch question this answers is NOT "did they buy" but "can the
 * survivor reach therapy on their own on day 1 / 3 / 7 / 14 / 30" — broken down
 * by aphasia severity and type. That signal may end up more predictive than
 * onboarding completion.
 *
 * Best-effort and non-blocking: telemetry must never delay or block the
 * survivor from actually starting practice.
 */

import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return null;
  const diff = Date.now() - start;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function deriveSeverity(clinicalProfile: unknown): string | null {
  if (!clinicalProfile || typeof clinicalProfile !== "object") return null;
  const sev = (clinicalProfile as Record<string, unknown>).severity;
  if (typeof sev === "string") return sev;
  if (sev && typeof sev === "object") {
    // severity is a per-domain map; surface the worst band present.
    const order = ["severe", "moderate", "mild"];
    const values = Object.values(sev as Record<string, unknown>).map((v) =>
      String(v).toLowerCase()
    );
    for (const band of order) {
      if (values.includes(band)) return band;
    }
  }
  return null;
}

export function useSurvivorSelfStart() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();

  /**
   * @param caregiverPresent pass true/false when known (e.g. a "someone is
   *   helping me" hint), otherwise leave undefined.
   * @param surface where the start happened (defaults to "today").
   */
  const recordSelfStart = useCallback(
    async (caregiverPresent?: boolean, surface = "today") => {
      if (!user?.id) return;
      try {
        const profile = activeProfile as
          | (Record<string, unknown> & {
              id?: string;
              aphasia_type?: string | null;
              clinical_profile?: unknown;
              profile_created_at?: string | null;
            })
          | null;

        await supabase.from("survivor_self_start_events").insert({
          user_id: user.id,
          profile_id: profile?.id ?? null,
          day_index: daysSince(
            profile?.profile_created_at ?? user.created_at ?? null
          ),
          caregiver_present:
            typeof caregiverPresent === "boolean" ? caregiverPresent : null,
          aphasia_type: profile?.aphasia_type ?? null,
          severity: deriveSeverity(profile?.clinical_profile),
          surface,
        });
      } catch (err) {
        console.warn("recordSelfStart failed (non-blocking):", err);
      }
    },
    [user, activeProfile]
  );

  return { recordSelfStart };
}
