/**
 * RoleOnboarding — Guided first-run setup for non-patient roles.
 *
 * Admin, clinician, and caregiver each get a short, role-specific walkthrough
 * that orients them to their job in the app. Each step pairs plain-language
 * guidance with a small visual preview of where the feature actually lives, so
 * it works as a "show me where everything is" primer. Skippable; completion is
 * remembered per user. On finish/skip we route to the role's home.
 *
 * Step content lives in src/lib/roleOnboardingSteps.tsx (shared with the dev
 * preview page).
 */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  markOnboardingComplete,
  ROLE_HOME,
  type OnboardingRole,
} from "@/lib/onboarding";
import { ROLE_STEPS, type NonPatientRole } from "@/lib/roleOnboardingSteps";
import { cn } from "@/lib/utils";

export default function RoleOnboarding() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isClinician, isCaregiver, isLoading: rolesLoading } =
    useUserPermissions(user?.id);
  const [stepIndex, setStepIndex] = useState(0);

  const role: NonPatientRole = useMemo(() => {
    if (isAdmin) return "admin";
    if (isClinician) return "clinician";
    return "caregiver";
  }, [isAdmin, isClinician]);

  const steps = ROLE_STEPS[role];
  const homeForRole: OnboardingRole = isAdmin
    ? "admin"
    : isClinician
    ? "clinician"
    : isCaregiver
    ? "caregiver"
    : "patient";

  const finish = () => {
    markOnboardingComplete(user?.id);
    navigate(ROLE_HOME[homeForRole], { replace: true });
  };

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // A plain patient should never see this flow.
  if (!isAdmin && !isClinician && !isCaregiver) {
    navigate("/welcome", { replace: true });
    return null;
  }

  const current = steps[stepIndex];
  const Icon = current.icon;
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  return (
    <div className="min-h-screen bg-gradient-calm flex flex-col">
      <div className="p-6 flex justify-center gap-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              i === stepIndex ? "bg-primary w-6" : i < stepIndex ? "bg-primary/50 w-2" : "bg-border w-2"
            )}
          />
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 space-y-6 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Icon className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold">{current.title}</h1>
            <p className="text-muted-foreground leading-relaxed">{current.body}</p>
          </div>

          <div className="rounded-lg border bg-card/50 p-4">{current.visual}</div>

          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="outline" className="flex-1 gap-1" onClick={() => setStepIndex((s) => s - 1)}>
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            <Button
              className="flex-1 gap-1"
              onClick={() => (isLast ? finish() : setStepIndex((s) => s + 1))}
            >
              {isLast ? "Go to my dashboard" : "Next"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="ghost" className="w-full text-muted-foreground" onClick={finish}>
            Skip for now
          </Button>
        </Card>
      </div>
    </div>
  );
}
