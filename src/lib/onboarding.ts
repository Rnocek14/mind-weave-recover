/**
 * Onboarding completion tracking.
 *
 * First-run onboarding is skippable (per user's choice), so "skipped" and
 * "finished" both mark it complete — we never nag a user twice.
 *
 * Source of truth: profiles.onboarding_completed_at in the database, so
 * completion is consistent across devices and queryable for the study.
 * localStorage is kept only as a fast local cache to avoid a flash of the
 * onboarding flow before the DB round-trip resolves.
 *
 * Roles supported for onboarding routing:
 *  - patient  -> warm Maya intro at /welcome
 *  - clinician / caregiver / admin -> guided setup at /onboarding/role
 */

import { supabase } from "@/integrations/supabase/client";

export type OnboardingRole = "patient" | "clinician" | "caregiver" | "admin";

const KEY_PREFIX = "onboarding_v1_done:";

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/** Synchronous local-cache read — used to avoid a flash before the DB resolves. */
export function isOnboardingCompleteCached(
  userId: string | undefined | null
): boolean {
  if (!userId || typeof window === "undefined") return true;
  try {
    return localStorage.getItem(key(userId)) === "true";
  } catch {
    return true;
  }
}

function setCache(userId: string, done: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (done) localStorage.setItem(key(userId), "true");
    else localStorage.removeItem(key(userId));
  } catch {
    /* ignore storage failures */
  }
}

/**
 * Authoritative check against the database. Falls back to the local cache if
 * the network call fails so we never trap a user in onboarding.
 */
export async function fetchOnboardingComplete(
  userId: string | undefined | null
): Promise<boolean> {
  if (!userId) return true;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) return isOnboardingCompleteCached(userId);

    const done = !!data?.onboarding_completed_at;
    setCache(userId, done);
    return done;
  } catch {
    return isOnboardingCompleteCached(userId);
  }
}

/** Mark onboarding complete in the DB (and cache it locally immediately). */
export async function markOnboardingComplete(
  userId: string | undefined | null
): Promise<void> {
  if (!userId) return;
  setCache(userId, true); // optimistic — no flash on the next landing
  try {
    await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("onboarding_completed_at", null);
  } catch {
    /* cache already set; DB will be reconciled on next write */
  }
}

/**
 * The landing route a role lands on after auth. We only trigger onboarding
 * when the user is on their own landing route, so deep links / exercises are
 * never interrupted.
 */
export const ROLE_HOME: Record<OnboardingRole, string> = {
  patient: "/today",
  clinician: "/clinician/review",
  caregiver: "/caregiver",
  admin: "/admin",
};

/** The onboarding destination for a given role. */
export function onboardingRouteFor(role: OnboardingRole): string {
  return role === "patient" ? "/welcome" : "/onboarding/role";
}
