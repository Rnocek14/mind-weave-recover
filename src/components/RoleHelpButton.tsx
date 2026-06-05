/**
 * RoleTourDialog + RoleHelpButton
 *
 * Replayable version of the first-run role walkthrough. The same step content
 * (src/lib/roleOnboardingSteps.tsx) that powers the one-time onboarding can be
 * reopened anytime from a dashboard via a small "?" help button.
 *
 * Drop <RoleHelpButton /> into a dashboard header. It figures out the viewer's
 * role on its own and renders nothing for plain patients. Opening the tour here
 * never marks onboarding complete and has no side effects.
 */

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { ROLE_STEPS, type NonPatientRole } from "@/lib/roleOnboardingSteps";
import { replayDashboardTour } from "@/components/tour/DashboardTour";
import { cn } from "@/lib/utils";

interface RoleTourDialogProps {
  role: NonPatientRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleTourDialog({ role, open, onOpenChange }: RoleTourDialogProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = ROLE_STEPS[role];
  const current = steps[stepIndex];
  const Icon = current.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const close = () => {
    onOpenChange(false);
    // Reset to the start for the next time it's opened.
    setTimeout(() => setStepIndex(0), 200);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Icon className="w-8 h-8 text-primary" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center text-xl">{current.title}</DialogTitle>
          <DialogDescription className="text-center text-base">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-card/50 p-4">{current.visual}</div>

        <DialogFooter className="flex-col sm:flex-col gap-3">
          <div
            className="flex justify-center gap-1.5"
            role="status"
            aria-label={`Step ${stepIndex + 1} of ${steps.length}`}
          >
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === stepIndex ? "bg-primary w-6" : "bg-muted w-2"
                )}
                aria-hidden="true"
              />
            ))}
          </div>

          <div className="flex gap-2 w-full">
            {!isFirst && (
              <Button
                variant="outline"
                className="flex-1 gap-1"
                onClick={() => setStepIndex((s) => s - 1)}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            <Button
              className="flex-1 gap-1"
              onClick={() => (isLast ? close() : setStepIndex((s) => s + 1))}
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RoleHelpButtonProps {
  /** Force a role instead of inferring from the signed-in user (optional). */
  role?: NonPatientRole;
  className?: string;
  /** Show a "Tour" text label next to the icon. */
  withLabel?: boolean;
  /**
   * When true, the button replays the in-place spotlight coachmark tour for
   * the resolved role (requires a <DashboardTour> mounted on the page).
   * When false (default), it opens the centered modal walkthrough.
   */
  spotlight?: boolean;
}

/**
 * Small "?" button that replays the role walkthrough. Self-contained: infers
 * the viewer's role and renders nothing for plain patients.
 */
export function RoleHelpButton({ role, className, withLabel, spotlight }: RoleHelpButtonProps) {
  const { user } = useAuth();
  const { isAdmin, isClinician, isCaregiver } = useUserPermissions(user?.id);
  const [open, setOpen] = useState(false);

  const resolved: NonPatientRole | null =
    role ??
    (isAdmin ? "admin" : isClinician ? "clinician" : isCaregiver ? "caregiver" : null);

  if (!resolved) return null;

  return (
    <>
      <Button
        variant="ghost"
        size={withLabel ? "sm" : "icon"}
        className={cn("text-muted-foreground gap-1.5", className)}
        onClick={() => (spotlight ? replayDashboardTour(resolved) : setOpen(true))}
        aria-label="Take the tour again"
        title="Take the tour again"
      >
        <HelpCircle className="w-4 h-4" />
        {withLabel && <span>Tour</span>}
      </Button>
      {!spotlight && <RoleTourDialog role={resolved} open={open} onOpenChange={setOpen} />}
    </>
  );
}
