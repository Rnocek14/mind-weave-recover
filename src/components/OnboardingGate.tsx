/**
 * OnboardingGate
 *
 * Mounted once inside the router. On first login it sends a user to the right
 * onboarding experience for their role:
 *   - patient   -> /welcome (warm Maya intro, skippable)
 *   - clinician / caregiver / admin -> /onboarding/role (guided setup)
 *
 * Non-intrusive by design: it only redirects when the user is sitting on a
 * landing route, so deep links, exercises, and refreshes mid-flow are never
 * hijacked. Completion (finish OR skip) is remembered per user.
 */

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  fetchOnboardingComplete,
  onboardingRouteFor,
  type OnboardingRole,
} from "@/lib/onboarding";

// Routes where it's appropriate to bounce a first-time user into onboarding.
const LANDING_ROUTES = new Set<string>([
  "/",
  "/today",
  "/clinician",
  "/clinician/review",
  "/caregiver",
  "/admin",
]);

// Never redirect away from the onboarding flows themselves.
const ONBOARDING_ROUTES = new Set<string>(["/welcome", "/onboarding/role"]);

export function OnboardingGate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isClinician, isCaregiver, isLoading: rolesLoading } =
    useUserPermissions(user?.id);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!user) return;

    const path = location.pathname;
    if (ONBOARDING_ROUTES.has(path)) return;
    if (!LANDING_ROUTES.has(path)) return;

    let cancelled = false;
    (async () => {
      // Only patients get a redirect-based first-run flow (/welcome).
      // Clinician / caregiver / admin learn the UI via the in-dashboard
      // spotlight tour, so they land straight on their dashboard.
      if (isAdmin || isClinician || isCaregiver) return;

      // Authoritative, cross-device completion check (patients only).
      const done = await fetchOnboardingComplete(user.id);
      if (cancelled || done) return;

      navigate(onboardingRouteFor("patient"), { replace: true });
    })();


    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    rolesLoading,
    user,
    isAdmin,
    isClinician,
    isCaregiver,
    location.pathname,
    navigate,
  ]);

  return null;
}
