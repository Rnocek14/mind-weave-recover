import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useUiMode } from "@/hooks/useUiMode";
import { Loader2 } from "lucide-react";

interface ClinicianProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * Route wrapper that allows clinicians, moderators, and admins.
 * Falls back to uiMode check if no DB roles exist (dev/testing).
 */
export function ClinicianProtectedRoute({ 
  children, 
  redirectTo = "/today" 
}: ClinicianProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isModerator, roles, isLoading: permissionsLoading } = useUserPermissions(user?.id);
  const { isAtLeast } = useUiMode();

  if (authLoading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Allow if DB roles grant access, OR if uiMode is clinician+ (dev/testing fallback)
  const hasDbAccess = isAdmin || isModerator;
  const hasUiModeAccess = roles.length === 0 && isAtLeast("clinician");

  if (!hasDbAccess && !hasUiModeAccess) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
