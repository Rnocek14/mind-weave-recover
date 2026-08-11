/**
 * OnboardingPreviewDev — Dev-only gallery of the role onboarding walkthroughs.
 *
 * Renders the admin, clinician, and caregiver flows side by side (all steps
 * stacked) so the team can review the content without having to log in under
 * each role. No auth side effects — this never marks onboarding complete.
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { ROLE_STEPS, type NonPatientRole } from "@/lib/roleOnboardingSteps";

const ROLES: NonPatientRole[] = ["admin", "clinician", "caregiver"];
const LABELS: Record<NonPatientRole, string> = {
  admin: "Administrator",
  clinician: "Clinician",
  caregiver: "Caregiver",
};

export default function OnboardingPreviewDev() {
  return (
    <div className="min-h-dvh bg-gradient-calm p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Role Onboarding Preview</h1>
          <p className="text-sm text-muted-foreground">
            All steps for each non-patient role. This is a dev gallery — nothing here is saved.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {ROLES.map((role) => (
            <section key={role} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {LABELS[role]}
              </h2>
              {ROLE_STEPS[role].map((step, i) => {
                const Icon = step.icon;
                return (
                  <Card key={i} className="p-5 space-y-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Step {i + 1}
                      </span>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Icon className="w-7 h-7 text-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                    </div>
                    <div className="rounded-lg border bg-card/50 p-3">{step.visual}</div>
                  </Card>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
