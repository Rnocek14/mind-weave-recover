import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { migrateLocalToSupabase, hasLocalData } from "@/lib/accountUpgrade";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Brain, Loader2 } from "lucide-react";

type SignupRole = "patient" | "clinician" | "caregiver";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signupRole, setSignupRole] = useState<SignupRole>("patient");
  const [submitting, setSubmitting] = useState(false);
  
  const { signUp, signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isAdmin, isClinician, isCaregiver, isLoading: permsLoading } =
    useUserPermissions(user?.id);

  // An explicit redirect target (e.g. a protected route that bounced the user
  // here) always wins. Otherwise we send each role to its own home.
  const explicitFrom =
    typeof location.state?.from === "string" ? location.state.from : null;

  // Redirect once we know who the user is AND what roles they hold.
  useEffect(() => {
    if (loading || !user) return;
    if (permsLoading) return; // wait for roles so we route to the right home

    localStorage.removeItem("offlineMode");

    if (explicitFrom) {
      navigate(explicitFrom, { replace: true });
      return;
    }

    // Users with a granted role go to their home.
    if (isAdmin || isClinician || isCaregiver) {
      const home = isAdmin
        ? "/admin"
        : isClinician
        ? "/clinician/review"
        : "/caregiver";
      navigate(home, { replace: true });
      return;
    }

    // No role yet: reconcile any pending professional request. The request may
    // not exist yet if email confirmation delayed the session at sign-up time,
    // so we recover it from the user's metadata before deciding where to route.
    (async () => {
      const metaRole = (user.user_metadata as Record<string, unknown> | null)
        ?.requested_role;
      const requestedRole =
        metaRole === "clinician" || metaRole === "caregiver" ? metaRole : null;

      let { data } = await supabase
        .from("role_requests")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();

      // Backfill a missing request from metadata (idempotent on user_id+role).
      if (!data && requestedRole) {
        await supabase.from("role_requests").insert({
          user_id: user.id,
          email: user.email ?? "",
          requested_role: requestedRole,
        });
        const recheck = await supabase
          .from("role_requests")
          .select("status")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .limit(1)
          .maybeSingle();
        data = recheck.data;
      }

      navigate(data || requestedRole ? "/pending-approval" : "/today", {
        replace: true,
      });
    })();
  }, [
    user,
    loading,
    permsLoading,
    isAdmin,
    isClinician,
    isCaregiver,
    explicitFrom,
    navigate,
  ]);


  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setResetSent(true);
      toast({ title: "Check your email", description: "We sent a password reset link." });
    }
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = isSignUp 
        ? await signUp(email, password, displayName)
        : await signIn(email, password);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        // Fetch current user safely
        const { data: authUser } = await supabase.auth.getUser();
        const uid = authUser.user?.id;

        // On professional sign-up, record a pending role request (unless an
        // invite already granted the role). Granting itself is admin-only.
        if (isSignUp && uid && signupRole !== "patient") {
          await supabase.from("role_requests").insert({
            user_id: uid,
            email: email.trim(),
            requested_role: signupRole,
          });
        }

        if (uid && hasLocalData()) {
          const migrated = await migrateLocalToSupabase(uid);
          if (migrated) {
            toast({
              title: isSignUp ? "Account created!" : "Welcome back!",
              description: "Your local data has been saved to your account.",
            });
          }
        } else {
          toast({
            title: isSignUp ? "Account created!" : "Welcome back!",
            description:
              isSignUp && signupRole !== "patient"
                ? "Your access request was submitted for admin approval."
                : isSignUp
                ? "Please check your email to verify your account."
                : "Redirecting…",
          });
        }
        // Navigation will happen via useEffect when user state updates
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };




  return (
    <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-healing flex items-center justify-center">
              <Brain className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Welcome to NeuroRecover</h1>
          <p className="text-muted-foreground">
            {forgotMode
              ? (resetSent ? "Check your email for a reset link" : "Enter your email to reset your password")
              : isSignUp ? "Create an account to save your progress" : "Sign in to continue your journey"}
          </p>
        </div>

        {forgotMode ? (
          resetSent ? (
            <Button variant="outline" className="w-full" onClick={() => { setForgotMode(false); setResetSent(false); }}>
              Back to Sign In
            </Button>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-gradient-healing" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
              </Button>
              <button type="button" className="text-sm text-primary hover:underline w-full text-center" onClick={() => setForgotMode(false)}>
                Back to Sign In
              </button>
            </form>
          )
        ) : (
        <>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required={isSignUp}
              />
            </div>
          )}

          {isSignUp && (
            <div className="space-y-2">
              <label className="text-sm font-medium">I'm signing up as</label>
              <Select
                value={signupRole}
                onValueChange={(v) => setSignupRole(v as SignupRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">Patient (someone recovering)</SelectItem>
                  <SelectItem value="clinician">Clinician / Therapist</SelectItem>
                  <SelectItem value="caregiver">Caregiver / Family</SelectItem>
                </SelectContent>
              </Select>
              {signupRole !== "patient" && (
                <p className="text-xs text-muted-foreground">
                  Professional access requires admin approval after you sign up.
                </p>
              )}
            </div>
          )}

          
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {!isSignUp && (
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => setForgotMode(true)}>
              Forgot password?
            </button>
          )}

          <Button 
            type="submit" 
            className="w-full bg-gradient-healing"
            disabled={submitting || loading}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              isSignUp ? "Create Account" : "Sign In"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            className="text-primary hover:underline font-medium"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
        </>
        )}
      </Card>
    </div>
  );
};

export default Auth;
