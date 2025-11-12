import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const { toast } = useToast();

  // Redirect if already logged in (only after loading completes)
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

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
    setSubmitting(true);
    const { error } = await signInAnonymously();
    
    if (error) {
      // Fallback to sessionless mode
      toast({
        title: "Starting in offline mode",
        description: "Your progress will be saved locally. Create an account to sync across devices.",
      });
      // Still navigate to dashboard for sessionless mode
      navigate("/dashboard");
    } else {
      toast({
        title: "Starting session",
        description: "You can create an account later to save your progress."
      });
      // Navigation will happen via useEffect when user state updates
    }
    setSubmitting(false);
  };

  const handleAdminLogin = async () => {
    setSubmitting(true);
    const adminEmail = "demo.admin@gmail.com";
    const adminPassword = "Tomford8*";

    try {
      // Try to sign in first
      let { error: signInError } = await signIn(adminEmail, adminPassword);

      // If user doesn't exist, sign up
      if (signInError?.message.includes("Invalid login credentials")) {
        const { error: signUpError } = await signUp(adminEmail, adminPassword, "Admin");
        if (signUpError) throw signUpError;
        
        // Wait a moment for the user to be created
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set up admin role using the database function
        const { error: roleError } = await supabase.rpc('setup_admin_user', {
          admin_email: adminEmail
        });
        
        if (roleError) {
          console.error("Role setup error:", roleError);
        }
      } else if (signInError) {
        throw signInError;
      }

      toast({
        title: "Demo admin access ready!",
        description: "Logged in as demo.admin@gmail.com"
      });
      
      // Wait for auth state to update, then navigate
      setTimeout(() => {
        navigate("/dashboard");
      }, 500);
    } catch (error: any) {
      console.error("Admin login error:", error);
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
            {isSignUp ? "Create an account to save your progress" : "Sign in to continue your journey"}
          </p>
        </div>

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

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full"
          onClick={handleAnonymous}
          disabled={submitting || loading}
        >
          Start Without Account
        </Button>

        <Button 
          variant="secondary" 
          className="w-full"
          onClick={handleAdminLogin}
          disabled={submitting || loading}
        >
          🔑 Admin Login (Test)
        </Button>

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
      </Card>
    </div>
  );
};

export default Auth;
