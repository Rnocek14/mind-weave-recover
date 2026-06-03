import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

/**
 * RequireAuth — layout route guard for authenticated-only areas
 * (e.g. /exercise/*). Prevents deep-link dead states: an unauthenticated
 * deep link is redirected to /auth instead of rendering an exercise shell
 * that can never load a profile (CLEAN-2).
 *
 * Presentation/routing only — does not touch progression, scoring, or
 * clinical logic. Real authorization for clinician/admin areas stays in
 * ClinicianProtectedRoute / AdminProtectedRoute.
 */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  return <Outlet />;
}
