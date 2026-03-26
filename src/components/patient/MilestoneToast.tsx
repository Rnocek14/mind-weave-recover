/**
 * MilestoneToast — Triggers a celebration toast for Maya milestones.
 * 
 * Renders nothing — purely a side-effect component that fires
 * a toast when a milestone is detected.
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { MayaMilestone } from "@/lib/mayaNarrative";

interface MilestoneToastProps {
  milestone: MayaMilestone | null;
}

export function MilestoneToast({ milestone }: MilestoneToastProps) {
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!milestone) return;

    // Prevent double-firing for same milestone
    const key = `${milestone.type}-${milestone.message}`;
    if (firedRef.current === key) return;
    firedRef.current = key;

    // Small delay so it feels natural after page load
    const timer = setTimeout(() => {
      toast(`${milestone.emoji} ${milestone.message}`, {
        duration: 5000,
        position: "top-center",
        className: "!bg-primary/10 !text-foreground !border-primary/20 !shadow-lg text-base font-semibold",
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [milestone]);

  return null;
}
