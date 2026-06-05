import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { migrateLocalToSupabase, hasLocalData } from "@/lib/accountUpgrade";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Loader2 } from "lucide-react";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const { signUp, signIn, signInAnonymously, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, dismiss } = useToast();
  const from = typeof location.state?.from === "string" ? location.state.from : "/today";

  // Redirect if already logged in (only after loading completes)
  useEffect(() => {
    if (!loading && user) {
      localStorage.removeItem("offlineMode");
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from]);

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
            description: isSignUp 
              ? "Please check your email to verify your account." 
              : "Redirecting to dashboard..."
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

  const handleAnonymous = async () => {
    dismiss();
    setSubmitting(true);
    const { error } = await signInAnonymously();
    
    if (error) {
      // Fallback to local, sessionless practice while anonymous auth is unavailable
      localStorage.setItem("offlineMode", "true");
      navigate(from, { replace: true });
    } else {
      toast({
        title: "Starting session",
        description: "You can create an account later to save your progress."
      });
      // Navigation will happen via useEffect when user state updates
    }
    setSubmitting(false);
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
