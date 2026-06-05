/**
 * DashboardTour — wires the SpotlightTour into a role dashboard.
 *
 * Behaviour (per product decision):
 *  - Auto-runs ONCE on a user's first visit to that dashboard (per tour id +
 *    tour version), tracked in localStorage.
 *  - Can be replayed anytime via the "?" RoleHelpButton, which dispatches a
 *    `replay-dashboard-tour` event carrying the tour id.
 *
 * Drop <DashboardTour role="caregiver" /> near the top of a dashboard page.
 * Pass `tourId` when a page needs a tour distinct from its role (e.g. the
 * Patient Hub uses tourId="patient-hub" even though the viewer is a clinician).
 */
import { useCallback, useEffect, useState } from "react";
import { SpotlightTour } from "@/components/tour/SpotlightTour";
import { DASHBOARD_TOUR_STEPS, TOUR_VERSION, type TourId } from "@/lib/dashboardTourSteps";

export const REPLAY_TOUR_EVENT = "replay-dashboard-tour";

function storageKey(id: TourId) {
  return `dashboardTourSeen:${id}:v${TOUR_VERSION}`;
}

/** Fire this to replay a dashboard tour from anywhere (e.g. a help button). */
export function replayDashboardTour(id: TourId) {
  window.dispatchEvent(new CustomEvent(REPLAY_TOUR_EVENT, { detail: { id } }));
}

interface DashboardTourProps {
  /** Convenience: use the role as the tour id (caregiver/clinician/admin). */
  role?: TourId;
  /** Explicit tour id; overrides role. */
  tourId?: TourId;
  /** Wait until real content is ready before auto-running (avoids empty anchors). */
  ready?: boolean;
}

export function DashboardTour({ role, tourId, ready = true }: DashboardTourProps) {
  const id = (tourId ?? role) as TourId;
  const [open, setOpen] = useState(false);
  const steps = DASHBOARD_TOUR_STEPS[id];

  // First-visit auto-run.
  useEffect(() => {
    if (!ready || !id) return;
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey(id)) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;

    // Give the dashboard a beat to mount its real elements.
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey(id), "1");
      } catch {
        /* ignore */
      }
      setOpen(true);
    }, 600);
    return () => clearTimeout(t);
  }, [id, ready]);

  // Replay support.
  useEffect(() => {
    const onReplay = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: TourId } | undefined;
      if (!detail?.id || detail.id === id) setOpen(true);
    };
    window.addEventListener(REPLAY_TOUR_EVENT, onReplay);
    return () => window.removeEventListener(REPLAY_TOUR_EVENT, onReplay);
  }, [id]);

  const handleClose = useCallback(() => setOpen(false), []);

  if (!steps) return null;

  return <SpotlightTour steps={steps} open={open} onClose={handleClose} />;
}
