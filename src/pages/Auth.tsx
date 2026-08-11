import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
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
import { trackEvent, FUNNEL_EVENTS } from "@/lib/appEvents";

type SignupRole = "patient" | "clinician" | "caregiver";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signupRole, setSignupRole] = useState<SignupRole>("patient");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
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

    // No granted role. Three remaining lanes:
    //  - clinician (professional): pending request / metadata -> approval wall.
    //  - caregiver (family): self-serve -> setup if no patient yet, else home.
    //  - survivor: straight into the patient flow.
    (async () => {
      const meta = (user.user_metadata as Record<string, unknown> | null) ?? null;
      const metaRole = meta?.requested_role;
      const requestedRole =
        metaRole === "clinician" ? "clinician" : null;
      const isCaregiverIntent =
        String(meta?.account_intent ?? "").toLowerCase() === "caregiver";

      // Clinician approval reconciliation (unchanged).
      if (requestedRole) {
        let { data } = await supabase
          .from("role_requests")
          .select("status")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .limit(1)
          .maybeSingle();

        if (!data) {
          await supabase.from("role_requests").insert({
            user_id: user.id,
            email: user.email ?? "",
            requested_role: requestedRole,
          });
        }
        navigate("/pending-approval", { replace: true });
        return;
      }

      // Family caregiver: route to setup until they've added the person
      // recovering (a profile_kind='patient' row owned by them).
      if (isCaregiverIntent) {
        const { data: patient } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .eq("profile_kind", "patient")
          .limit(1)
          .maybeSingle();
        navigate(patient ? "/caregiver" : "/caregiver/setup", {
          replace: true,
        });
        return;
      }

      // Survivor.
      navigate("/today", { replace: true });
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
    // Defense in depth alongside the disabled button: no signup without consent.
    if (isSignUp && !agreedToTerms) {
      toast({
        title: "One more step",
        description: "Please agree to the Terms and Privacy Policy to create your account.",
      });
      return;
    }
    setSubmitting(true);

    try {
      const requestedRole = signupRole === "clinician" ? "clinician" : undefined;
      const accountIntent = signupRole === "caregiver" ? "caregiver" : undefined;

      const { error } = isSignUp
        ? await signUp(email, password, displayName, requestedRole, accountIntent)
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

        if (isSignUp && uid) {
          trackEvent(FUNNEL_EVENTS.SIGNUP_COMPLETED, { role: signupRole });
        }

        // Only clinicians (professionals reaching other people's data) need an
        // approval request. Family caregivers are self-serve.
        if (isSignUp && uid && signupRole === "clinician") {
          await supabase.from("role_requests").insert({
            user_id: uid,
            email: email.trim(),
            requested_role: "clinician",
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
              isSignUp && signupRole === "clinician"
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
                  <SelectItem value="patient">I'm recovering</SelectItem>
                  <SelectItem value="caregiver">I'm helping someone</SelectItem>
                  <SelectItem value="clinician">I'm a clinician</SelectItem>
                </SelectContent>
              </Select>
              {signupRole === "caregiver" && (
                <p className="text-xs text-muted-foreground">
                  You'll set up the person you're helping in the next step.
                </p>
              )}
              {signupRole === "clinician" && (
                <p className="text-xs text-muted-foreground">
                  Clinician access requires admin approval after you sign up.
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

          {/* Required consent — this app records practice audio of a medical
              population; signup must not proceed without informed agreement. */}
          {isSignUp && (
            <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-3 py-3">
              <Checkbox
                id="terms-consent"
                checked={agreedToTerms}
                onCheckedChange={(v) => setAgreedToTerms(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="terms-consent" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                I agree to the{" "}
                <Link to="/terms" target="_blank" className="text-primary underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" target="_blank" className="text-primary underline">
                  Privacy Policy
                </Link>
                , including recording my practice audio so it can be scored and
                reviewed by my care team.
              </label>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-gradient-healing"
            disabled={submitting || loading || (isSignUp && !agreedToTerms)}
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
