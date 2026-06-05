/**
 * RoleOnboarding — Guided first-run setup for non-patient roles.
 *
 * Admin, clinician, and caregiver each get a short, role-specific walkthrough
 * that orients them to their job in the app. Skippable; completion is
 * remembered per user. On finish/skip we route to the role's home.
 */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Stethoscope,
  HeartHandshake,
  Users,
  ClipboardList,
  Eye,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  markOnboardingComplete,
  ROLE_HOME,
  type OnboardingRole,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
}

const STEPS: Record<Exclude<OnboardingRole, "patient">, Step[]> = {
  admin: [
    {
      icon: ShieldCheck,
      title: "Welcome, Administrator",
      body: "You manage who can access the platform and how care teams are connected. Let's cover the essentials.",
    },
    {
      icon: Users,
      title: "Grant roles",
      body: "In Admin → Users → Roles, assign the clinician or caregiver role to each provider account before they can see patient data.",
    },
    {
      icon: ClipboardList,
      title: "Connect care teams",
      body: "Under Care Assignments, link each clinician or caregiver to the patients they support. Patients practice independently — assignment only controls visibility.",
    },
  ],
  clinician: [
    {
      icon: Stethoscope,
      title: "Welcome, Clinician",
      body: "This is your workspace for reviewing patient progress and adjusting their therapy plans.",
    },
    {
      icon: Eye,
      title: "Your caseload",
      body: "You'll see the patients assigned to you by an administrator. Open a patient to review sessions, voice evidence, and recovery trends.",
    },
    {
      icon: ClipboardList,
      title: "Make decisions",
      body: "Use the weekly review to adjust difficulty, cueing, and dose, add notes, or schedule outreach. Every change is logged for the study.",
    },
  ],
  caregiver: [
    {
      icon: HeartHandshake,
      title: "Welcome",
      body: "Thank you for supporting someone's recovery. This space keeps you informed about their practice.",
    },
    {
      icon: Eye,
      title: "Your linked patient",
      body: "You'll see at-a-glance cards for the patient you're linked to: their status, recent practice, and progress over time.",
    },
    {
      icon: CheckCircle2,
      title: "How to help",
      body: "Encourage daily practice and watch the progress cards. If something looks off, the care team is notified through the app.",
    },
  ],
};

export default function RoleOnboarding() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isClinician, isCaregiver, isLoading: rolesLoading } =
    useUserPermissions(user?.id);
  const [stepIndex, setStepIndex] = useState(0);

  const role: Exclude<OnboardingRole, "patient"> = useMemo(() => {
    if (isAdmin) return "admin";
    if (isClinician) return "clinician";
    return "caregiver";
  }, [isAdmin, isClinician]);

  const steps = STEPS[role];
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
        <Card className="w-full max-w-md p-8 space-y-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Icon className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold">{current.title}</h1>
            <p className="text-muted-foreground leading-relaxed">{current.body}</p>
          </div>

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
