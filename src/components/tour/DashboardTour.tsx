/**
 * DashboardTour — wires the SpotlightTour into a role dashboard.
 *
 * Behaviour (per product decision):
 *  - Auto-runs ONCE on a user's first visit to that dashboard (per role +
 *    tour version), tracked in localStorage.
 *  - Can be replayed anytime via the "?" RoleHelpButton, which dispatches a
 *    `replay-dashboard-tour` event carrying the role.
 *
 * Drop <DashboardTour role="caregiver" /> near the top of a dashboard page.
 */
import { useCallback, useEffect, useState } from "react";
import { SpotlightTour } from "@/components/tour/SpotlightTour";
import { DASHBOARD_TOUR_STEPS, TOUR_VERSION } from "@/lib/dashboardTourSteps";
import type { NonPatientRole } from "@/lib/roleOnboardingSteps";

export const REPLAY_TOUR_EVENT = "replay-dashboard-tour";

function storageKey(role: NonPatientRole) {
  return `dashboardTourSeen:${role}:v${TOUR_VERSION}`;
}

/** Fire this to replay a dashboard tour from anywhere (e.g. a help button). */
export function replayDashboardTour(role: NonPatientRole) {
  window.dispatchEvent(new CustomEvent(REPLAY_TOUR_EVENT, { detail: { role } }));
}

interface DashboardTourProps {
  role: NonPatientRole;
  /** Wait until real content is ready before auto-running (avoids empty anchors). */
  ready?: boolean;
}

export function DashboardTour({ role, ready = true }: DashboardTourProps) {
  const [open, setOpen] = useState(false);
  const steps = DASHBOARD_TOUR_STEPS[role];

  // First-visit auto-run.
  useEffect(() => {
    if (!ready) return;
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey(role)) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;

    // Give the dashboard a beat to mount its real elements.
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey(role), "1");
      } catch {
        /* ignore */
      }
      setOpen(true);
    }, 600);
    return () => clearTimeout(t);
  }, [role, ready]);

  // Replay support.
  useEffect(() => {
    const onReplay = (e: Event) => {
      const detail = (e as CustomEvent).detail as { role?: NonPatientRole } | undefined;
      if (!detail?.role || detail.role === role) setOpen(true);
    };
    window.addEventListener(REPLAY_TOUR_EVENT, onReplay);
    return () => window.removeEventListener(REPLAY_TOUR_EVENT, onReplay);
  }, [role]);

  const handleClose = useCallback(() => setOpen(false), []);

  return <SpotlightTour steps={steps} open={open} onClose={handleClose} />;
}
