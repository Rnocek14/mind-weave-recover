/**
 * RoleOnboarding — Guided first-run setup for non-patient roles.
 *
 * Admin, clinician, and caregiver each get a short, role-specific walkthrough
 * that orients them to their job in the app. Each step pairs plain-language
 * guidance with a small visual preview of where the feature actually lives, so
 * it works as a "show me where everything is" primer. Skippable; completion is
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
import { Badge } from "@/components/ui/badge";
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
  /** A small mock of the real UI this step refers to. */
  visual: React.ReactNode;
}

/** A faux navigation pill — points at where in the app a feature lives. */
function NavHint({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
        active
          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
          : "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}

/** A faux row in a list/table preview. */
function MockRow({
  primary,
  secondary,
  trailing,
}: {
  primary: string;
  secondary?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
      <div className="text-left">
        <p className="text-xs font-medium text-foreground">{primary}</p>
        {secondary && (
          <p className="text-[11px] text-muted-foreground">{secondary}</p>
        )}
      </div>
      {trailing}
    </div>
  );
}

const STEPS: Record<Exclude<OnboardingRole, "patient">, Step[]> = {
  admin: [
    {
      icon: ShieldCheck,
      title: "Welcome, Administrator",
      body: "You manage who can access the platform and how care teams are connected. Let's cover the essentials.",
      visual: (
        <div className="flex flex-wrap justify-center gap-1.5">
          <NavHint label="Overview" active />
          <NavHint label="Users" />
          <NavHint label="Care Assignments" />
          <NavHint label="Invitations" />
        </div>
      ),
    },
    {
      icon: Users,
      title: "Grant roles",
      body: "In Admin → Users → Roles, assign the clinician or caregiver role to each provider account before they can see patient data.",
      visual: (
        <div className="space-y-2">
          <div className="flex justify-center gap-1.5">
            <NavHint label="Users" active />
            <NavHint label="Roles" active />
          </div>
          <MockRow
            primary="dr.lee@clinic.org"
            secondary="Provider account"
            trailing={<Badge variant="outline" className="text-[10px]">clinician</Badge>}
          />
          <MockRow
            primary="sam.caregiver@home.com"
            secondary="Family member"
            trailing={<Badge variant="outline" className="text-[10px]">caregiver</Badge>}
          />
        </div>
      ),
    },
    {
      icon: ClipboardList,
      title: "Connect care teams",
      body: "Under Care Assignments, link each clinician or caregiver to the patients they support. Patients practice independently — assignment only controls visibility.",
      visual: (
        <div className="space-y-2">
          <div className="flex justify-center gap-1.5">
            <NavHint label="Care Assignments" active />
          </div>
          <MockRow
            primary="Dr. Lee"
            secondary="→ 4 patients linked"
            trailing={<CheckCircle2 className="h-4 w-4 text-primary" />}
          />
          <MockRow
            primary="Sam (caregiver)"
            secondary="→ 1 patient linked"
            trailing={<CheckCircle2 className="h-4 w-4 text-primary" />}
          />
        </div>
      ),
    },
    {
      icon: HeartHandshake,
      title: "Invite by email",
      body: "Use the Invitations tab to pre-assign a role to someone's email. When they sign up with that address, they land in the right place automatically.",
      visual: (
        <div className="space-y-2">
          <div className="flex justify-center gap-1.5">
            <NavHint label="Invitations" active />
          </div>
          <MockRow
            primary="new.clinician@clinic.org"
            secondary="Invited as clinician"
            trailing={<Badge className="text-[10px]">Pending</Badge>}
          />
          <MockRow
            primary="jordan@home.com"
            secondary="Signed up & provisioned"
            trailing={<Badge variant="secondary" className="text-[10px]">Used</Badge>}
          />
        </div>
      ),
    },
  ],
  clinician: [
    {
      icon: Stethoscope,
      title: "Welcome, Clinician",
      body: "This is your workspace for reviewing patient progress and adjusting their therapy plans.",
      visual: (
        <div className="flex flex-wrap justify-center gap-1.5">
          <NavHint label="Triage" active />
          <NavHint label="Review" />
          <NavHint label="Decide" />
        </div>
      ),
    },
    {
      icon: Eye,
      title: "Your caseload",
      body: "You'll see the patients assigned to you by an administrator. Open a patient to review sessions, voice evidence, and recovery trends.",
      visual: (
        <div className="space-y-2">
          <div className="flex justify-center gap-1.5">
            <NavHint label="Triage" active />
          </div>
          <MockRow
            primary="Patient A"
            secondary="Needs attention · accuracy ↓"
            trailing={<Badge className="text-[10px]">Review</Badge>}
          />
          <MockRow
            primary="Patient B"
            secondary="On track · 5-day streak"
            trailing={<Badge variant="secondary" className="text-[10px]">Stable</Badge>}
          />
        </div>
      ),
    },
    {
      icon: ClipboardList,
      title: "Make decisions",
      body: "Use the weekly review to adjust difficulty, cueing, and dose, add notes, or schedule outreach. Every change is logged for the study.",
      visual: (
        <div className="space-y-2">
          <div className="flex justify-center gap-1.5">
            <NavHint label="Review" active />
            <NavHint label="Decide" active />
          </div>
          <MockRow primary="Difficulty" secondary="Level 4 → 5" trailing={<ArrowRight className="h-3.5 w-3.5 text-primary" />} />
          <MockRow primary="Cueing" secondary="Reduce phonemic cue" trailing={<ArrowRight className="h-3.5 w-3.5 text-primary" />} />
          <MockRow primary="Clinician note" secondary="Logged for the study" trailing={<CheckCircle2 className="h-4 w-4 text-primary" />} />
        </div>
      ),
    },
  ],
  caregiver: [
    {
      icon: HeartHandshake,
      title: "Welcome",
      body: "Thank you for supporting someone's recovery. This space keeps you informed about their practice.",
      visual: (
        <div className="flex flex-wrap justify-center gap-1.5">
          <NavHint label="Status" active />
          <NavHint label="Practice" />
          <NavHint label="Progress" />
        </div>
      ),
    },
    {
      icon: Eye,
      title: "Your linked patient",
      body: "You'll see at-a-glance cards for the patient you're linked to: their status, recent practice, and progress over time.",
      visual: (
        <div className="grid grid-cols-2 gap-2">
          <MockRow primary="Status" secondary="Practiced today" />
          <MockRow primary="Practice" secondary="3 sessions / wk" />
          <MockRow primary="Listen" secondary="2 new clips" />
          <MockRow primary="Progress" secondary="Trending up" />
        </div>
      ),
    },
    {
      icon: CheckCircle2,
      title: "How to help",
      body: "Encourage daily practice and watch the progress cards. If something looks off, the care team is notified through the app.",
      visual: (
        <div className="space-y-2">
          <MockRow
            primary="Daily practice"
            secondary="Gentle encouragement helps most"
            trailing={<HeartHandshake className="h-4 w-4 text-primary" />}
          />
          <MockRow
            primary="Recovery alerts"
            secondary="Care team is notified automatically"
            trailing={<CheckCircle2 className="h-4 w-4 text-primary" />}
          />
        </div>
      ),
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
