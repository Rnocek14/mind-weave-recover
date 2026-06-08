import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Loader2 } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const markReady = () => {
      if (!cancelled) {
        setReady(true);
        setVerificationError(null);
      }
    };

    const markInvalid = (message: string) => {
      if (!cancelled) {
        setReady(false);
        setVerificationError(message);
      }
    };

    const getRecoveryParam = (key: string) => {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      return url.searchParams.get(key) ?? hashParams.get(key);
    };

    const cleanRecoveryUrl = () => {
      const url = new URL(window.location.href);
      ["code", "token", "token_hash", "type", "email", "error", "error_code", "error_description"].forEach((key) =>
        url.searchParams.delete(key)
      );
      url.hash = "";
      window.history.replaceState(window.history.state, document.title, url.toString());
    };

    // Recovery event from Supabase's built-in URL/session detection.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        markReady();
      }
    });

    (async () => {
      let lastError: string | null = null;
      const urlError = getRecoveryParam("error_description") ?? getRecoveryParam("error");
      if (urlError) {
        markInvalid(decodeURIComponent(urlError.replace(/\+/g, " ")));
        return;
      }

      const accessToken = getRecoveryParam("access_token");
      const refreshToken = getRecoveryParam("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          cleanRecoveryUrl();
          markReady();
          return;
        }
        lastError = error.message;
      }

      const tokenHash = getRecoveryParam("token_hash");
      if (tokenHash) {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (!error && data.session) {
          cleanRecoveryUrl();
          markReady();
          return;
        }
        lastError = error?.message ?? "This reset link could not be verified.";
      }

      const token = getRecoveryParam("token");
      const email = getRecoveryParam("email");
      if (token && email) {
        const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
        if (!error && data.session) {
          cleanRecoveryUrl();
          markReady();
          return;
        }
        lastError = error?.message ?? "This reset link could not be verified.";
      }

      const code = getRecoveryParam("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          cleanRecoveryUrl();
          markReady();
          return;
        }
        lastError = error.message;
      }

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          markReady();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      markInvalid(lastError ?? "This reset link could not be verified. Please request a new password reset email.");
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated!", description: "Redirecting to dashboard..." });
      navigate("/today");
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
          <h1 className="text-2xl font-bold">Set New Password</h1>
          <p className="text-muted-foreground">
            {ready
              ? "Enter your new password below."
              : verificationError ?? "Verifying your reset link..."}
          </p>
        </div>

        {verificationError && !ready && (
          <Button type="button" className="w-full" onClick={() => navigate("/auth")}>
            Request a new reset link
          </Button>
        )}

        {ready && (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full bg-gradient-healing" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default ResetPassword;
