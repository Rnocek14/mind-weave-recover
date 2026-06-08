/**
 * PendingApproval — holding screen for self-requested professional roles.
 *
 * When someone signs up and selects "Clinician" or "Caregiver" without an
 * invite, a role_request row is created (status: pending) and they land here.
 * The screen polls their permissions; once an admin approves, they are routed
 * to their role home. If the request is rejected, we show a neutral message.
 * Calm, adult tone — no celebration, never a dead end (always a sign-out).
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_HOME } from "@/lib/onboarding";
import { Clock, Loader2, ShieldCheck } from "lucide-react";

type RequestStatus = "pending" | "approved" | "rejected" | "none";

const PendingApproval = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { isAdmin, isClinician, isCaregiver, isLoading: permsLoading } =
    useUserPermissions(user?.id);

  const [status, setStatus] = useState<RequestStatus>("pending");
  const [requestedRole, setRequestedRole] = useState<string | null>(null);

  // Not logged in -> back to auth.
  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  // If a role has already been granted, leave immediately.
  useEffect(() => {
    if (loading || permsLoading || !user) return;
    if (isAdmin || isClinician || isCaregiver) {
      const home = isAdmin
        ? ROLE_HOME.admin
        : isClinician
        ? ROLE_HOME.clinician
        : ROLE_HOME.caregiver;
      navigate(home, { replace: true });
    }
  }, [loading, permsLoading, user, isAdmin, isClinician, isCaregiver, navigate]);

  // Poll the request status every few seconds.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase
        .from("role_requests")
        .select("requested_role, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (!data) {
        setStatus("none");
        return;
      }
      setRequestedRole(data.requested_role);
      setStatus(data.status as RequestStatus);
    };

    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  const roleLabel = useMemo(() => {
    if (requestedRole === "clinician") return "Clinician";
    if (requestedRole === "caregiver") return "Caregiver";
    return "professional";
  }, [requestedRole]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rejected = status === "rejected";

  return (
    <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            {rejected ? (
              <ShieldCheck className="w-8 h-8 text-muted-foreground" />
            ) : (
              <Clock className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
        </div>

        {rejected ? (
          <>
            <h1 className="text-2xl font-bold">Access not granted</h1>
            <p className="text-muted-foreground">
              Your request for {roleLabel} access was not approved. If you
              believe this is a mistake, please contact your administrator.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Awaiting approval</h1>
            <p className="text-muted-foreground">
              Your request for <span className="font-medium text-foreground">{roleLabel}</span> access
              is being reviewed by an administrator. This page will update
              automatically once it's approved.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking status…
            </div>
          </>
        )}

        <Button variant="outline" className="w-full" onClick={handleSignOut}>
          Sign out
        </Button>
      </Card>
    </div>
  );
};

export default PendingApproval;
