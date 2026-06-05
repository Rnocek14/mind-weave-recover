import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Loader2 } from "lucide-react";

interface ClinicianProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * Route wrapper that allows clinicians, moderators, and admins.
 *
 * Authorization boundary = real DB roles (user_roles), NOT uiMode.
 * uiMode lives in localStorage and is freely editable, so it must never
 * gate clinician access. A user only reaches clinician screens if they
 * hold the clinician/moderator/admin role in the database.
 */
export function ClinicianProtectedRoute({
  children,
  redirectTo = "/today"
}: ClinicianProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isClinician, isLoading: permissionsLoading } = useUserPermissions(user?.id);

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

  if (!isClinician) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
