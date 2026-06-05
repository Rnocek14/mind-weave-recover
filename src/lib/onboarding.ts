/**
 * Onboarding completion tracking.
 *
 * First-run onboarding is skippable (per user's choice), so "skipped" and
 * "finished" both mark it complete — we never nag a user twice. Stored in
 * localStorage keyed by user id so it survives refreshes on the same device.
 *
 * Roles supported for onboarding routing:
 *  - patient  -> warm Maya intro at /welcome
 *  - clinician / caregiver / admin -> guided setup at /onboarding/role
 */

export type OnboardingRole = "patient" | "clinician" | "caregiver" | "admin";

const KEY_PREFIX = "onboarding_v1_done:";

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function isOnboardingComplete(userId: string | undefined | null): boolean {
  if (!userId || typeof window === "undefined") return true; // no user => nothing to gate
  try {
    return localStorage.getItem(key(userId)) === "true";
  } catch {
    return true;
  }
}

export function markOnboardingComplete(userId: string | undefined | null): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(key(userId), "true");
  } catch {
    /* ignore storage failures */
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
