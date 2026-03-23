/**
 * Clinician Quick Actions — writes real state changes to DB.
 * 
 * Each action is logged to adaptation_events for audit trail,
 * and writes to the relevant table (dose_targets, recovery_alerts, profiles).
 */
import { supabase } from "@/integrations/supabase/client";

export interface QuickActionResult {
  success: boolean;
  message: string;
}

interface ActionContext {
  userId: string;
  profileId: string;
  clinicianId: string; // auth.uid() of the clinician performing the action
}

/** Log every clinician action to adaptation_events for audit trail */
async function logAction(
  ctx: ActionContext,
  actionType: string,
  detail: Record<string, any>
) {
  await supabase.from("adaptation_events").insert({
    user_id: ctx.userId,
    profile_id: ctx.profileId,
    layer: "clinician_override",
    adaptation_type: actionType,
    trigger_type: "clinician_action",
    confidence: "high",
    evidence: {
      performed_by: ctx.clinicianId,
      timestamp: new Date().toISOString(),
      ...detail,
    },
    value_before: detail.value_before ?? null,
    value_after: detail.value_after ?? null,
  });
}

/**
 * Reduce dose target for a domain by a percentage.
 * Creates a new dose_target row with reduced value.
 */
export async function reduceDose(
  ctx: ActionContext,
  domainSlug: string = "speech_therapy",
  reductionPct: number = 20
): Promise<QuickActionResult> {
  try {
    // Get current target
    const { data: targets } = await (supabase as any)
      .from("dose_targets")
      .select("*")
      .eq("profile_id", ctx.profileId)
      .eq("domain_slug", domainSlug)
      .is("effective_until", null)
      .order("effective_from", { ascending: false })
      .limit(1);

    const current = targets?.[0];
    if (!current) {
      return { success: false, message: `No active dose target found for ${domainSlug}` };
    }

    const oldValue = current.target_value;
    const newValue = Math.max(5, Math.round(oldValue * (1 - reductionPct / 100)));

    // End the old target
    await (supabase as any)
      .from("dose_targets")
      .update({ effective_until: new Date().toISOString().split("T")[0] })
      .eq("id", current.id);

    // Create new reduced target
    await (supabase as any).from("dose_targets").insert({
      user_id: ctx.userId,
      profile_id: ctx.profileId,
      domain_slug: domainSlug,
      target_value: newValue,
      target_frequency: current.target_frequency,
      prescribed_by: ctx.clinicianId,
    });

    await logAction(ctx, "reduce_dose", {
      domain_slug: domainSlug,
      reduction_pct: reductionPct,
      value_before: { target_value: oldValue },
      value_after: { target_value: newValue },
      reason: "Clinician reduced dose via weekly review quick action",
    });

    return {
      success: true,
      message: `Dose reduced from ${oldValue}min to ${newValue}min/day for ${domainSlug.replace(/_/g, " ")}`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to reduce dose" };
  }
}

/**
 * Create an outreach alert for the care team.
 */
export async function scheduleOutreach(
  ctx: ActionContext,
  reason: string
): Promise<QuickActionResult> {
  try {
    await supabase.from("recovery_alerts").insert({
      user_id: ctx.userId,
      profile_id: ctx.profileId,
      alert_type: "outreach_needed",
      severity: "warning",
      title: "Outreach Scheduled",
      description: reason || "Clinician flagged patient for follow-up outreach.",
      trigger_data: {
        created_by: ctx.clinicianId,
        source: "clinician_quick_action",
      },
    });

    await logAction(ctx, "schedule_outreach", { reason });

    return { success: true, message: "Outreach alert created for care team" };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to schedule outreach" };
  }
}

/**
 * Log a difficulty adjustment recommendation.
 * Writes to adaptation_events so it shows in the audit trail.
 */
export async function adjustDifficulty(
  ctx: ActionContext,
  direction: "increase" | "decrease",
  exerciseSlug?: string
): Promise<QuickActionResult> {
  try {
    await logAction(ctx, `${direction}_difficulty`, {
      direction,
      exercise_slug: exerciseSlug || "all",
      value_before: { direction: "current" },
      value_after: { direction },
      reason: `Clinician recommended ${direction} difficulty via weekly review`,
    });

    // Also create an alert so the recommendation is visible
    await supabase.from("recovery_alerts").insert({
      user_id: ctx.userId,
      profile_id: ctx.profileId,
      alert_type: "difficulty_adjustment",
      severity: "info",
      title: `Difficulty ${direction === "increase" ? "Increase" : "Decrease"} Recommended`,
      description: `Clinician recommended ${direction === "increase" ? "increasing" : "decreasing"} difficulty${exerciseSlug ? ` for ${exerciseSlug.replace(/-/g, " ")}` : ""}.`,
      trigger_data: {
        created_by: ctx.clinicianId,
        direction,
        exercise_slug: exerciseSlug || null,
        source: "clinician_quick_action",
      },
    });

    return {
      success: true,
      message: `Difficulty ${direction} logged and alert created`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to adjust difficulty" };
  }
}

/**
 * Create a practice assignment alert.
 */
export async function assignPractice(
  ctx: ActionContext,
  notes?: string
): Promise<QuickActionResult> {
  try {
    await supabase.from("recovery_alerts").insert({
      user_id: ctx.userId,
      profile_id: ctx.profileId,
      alert_type: "practice_assignment",
      severity: "info",
      title: "New Practice Assignment",
      description: notes || "Clinician assigned additional home practice exercises.",
      trigger_data: {
        created_by: ctx.clinicianId,
        source: "clinician_quick_action",
      },
    });

    await logAction(ctx, "assign_practice", { notes });

    return { success: true, message: "Practice assignment created" };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to assign practice" };
  }
}

/**
 * Log a cueing strategy review.
 */
export async function reviewCueing(
  ctx: ActionContext
): Promise<QuickActionResult> {
  try {
    await logAction(ctx, "review_cueing", {
      reason: "Clinician flagged cueing strategy for review",
    });

    return { success: true, message: "Cueing review logged to audit trail" };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to log cueing review" };
  }
}
