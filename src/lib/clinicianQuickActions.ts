/**
 * Clinician Quick Actions — calls atomic Postgres RPCs for safety-critical
 * operations (reduce_dose, adjust_difficulty, reverse_override).
 * 
 * Non-transactional actions (outreach, practice, cueing) use standard writes.
 * All actions create clinician_overrides records for governance/reversal.
 */
import { supabase } from "@/integrations/supabase/client";

export interface QuickActionResult {
  success: boolean;
  message: string;
  overrideId?: string;
}

interface ActionContext {
  userId: string;
  profileId: string;
  clinicianId: string;
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

/** Create a clinician_overrides record for governance/reversal */
async function createOverride(
  ctx: ActionContext,
  overrideType: string,
  valueBefore: any,
  valueAfter: any,
  reason: string,
  targetSlug?: string
): Promise<string | null> {
  const { data, error } = await (supabase as any)
    .from("clinician_overrides")
    .insert({
      user_id: ctx.userId,
      profile_id: ctx.profileId,
      clinician_id: ctx.clinicianId,
      override_type: overrideType,
      target_slug: targetSlug || null,
      value_before: valueBefore,
      value_after: valueAfter,
      reason,
      status: "active",
    })
    .select("id")
    .single();

  return data?.id || null;
}

// ═══════════════════════════════════════════════════════════════
// ATOMIC ACTIONS — via Postgres RPC (true DB transactions)
// ═══════════════════════════════════════════════════════════════

/**
 * Reduce dose target — ATOMIC via clinician_reduce_dose RPC.
 * All writes (dose_targets, clinician_overrides, adaptation_events) happen
 * in a single Postgres transaction. No partial state possible.
 */
export async function reduceDose(
  ctx: ActionContext,
  domainSlug: string = "speech_therapy",
  reductionPct: number = 20
): Promise<QuickActionResult> {
  try {
    const { data, error } = await supabase.rpc("clinician_reduce_dose", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_clinician_id: ctx.clinicianId,
      p_domain_slug: domainSlug,
      p_reduction_pct: reductionPct,
    });

    if (error) throw error;
    const result = data as any;
    return {
      success: result.success,
      message: result.message,
      overrideId: result.override_id || undefined,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to reduce dose" };
  }
}

/**
 * Adjust difficulty — ATOMIC via clinician_adjust_difficulty RPC.
 * Superseding is target-specific (only same exercise_slug or same global).
 */
export async function adjustDifficulty(
  ctx: ActionContext,
  direction: "increase" | "decrease",
  exerciseSlug?: string
): Promise<QuickActionResult> {
  try {
    const { data, error } = await supabase.rpc("clinician_adjust_difficulty", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_clinician_id: ctx.clinicianId,
      p_direction: direction,
      p_exercise_slug: exerciseSlug || null,
    });

    if (error) throw error;
    const result = data as any;
    return {
      success: result.success,
      message: result.message,
      overrideId: result.override_id || undefined,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to adjust difficulty" };
  }
}

/**
 * Reverse override — ATOMIC via clinician_reverse_override RPC.
 * Restores prior state + marks override as reversed in one transaction.
 */
export async function reverseOverride(
  ctx: ActionContext,
  overrideId: string,
  reason: string
): Promise<QuickActionResult> {
  try {
    const { data, error } = await supabase.rpc("clinician_reverse_override", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_clinician_id: ctx.clinicianId,
      p_override_id: overrideId,
      p_reason: reason,
    });

    if (error) throw error;
    const result = data as any;
    return {
      success: result.success,
      message: result.message,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to reverse override" };
  }
}

// ═══════════════════════════════════════════════════════════════
// NON-ATOMIC ACTIONS — standard writes (lower risk, no multi-table deps)
// ═══════════════════════════════════════════════════════════════

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

    const overrideId = await createOverride(
      ctx, "outreach",
      {},
      { reason },
      reason || "Clinician scheduled outreach"
    );

    await logAction(ctx, "schedule_outreach", { reason, override_id: overrideId });

    return { success: true, message: "Outreach alert created for care team", overrideId: overrideId || undefined };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to schedule outreach" };
  }
}

/**
 * Assign practice — writes to clinical_profile.practice_assignments + creates alert.
 */
export async function assignPractice(
  ctx: ActionContext,
  notes?: string
): Promise<QuickActionResult> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("clinical_profile")
      .eq("id", ctx.profileId)
      .single();

    const cp = (profile?.clinical_profile as Record<string, any>) || {};
    const assignments = cp.practice_assignments || [];
    const newAssignment = {
      id: crypto.randomUUID(),
      notes: notes || "Additional home practice exercises assigned.",
      assigned_by: ctx.clinicianId,
      assigned_at: new Date().toISOString(),
      status: "active",
    };

    const updatedCp = {
      ...cp,
      practice_assignments: [...assignments, newAssignment],
    };

    await supabase
      .from("profiles")
      .update({ clinical_profile: updatedCp })
      .eq("id", ctx.profileId);

    const overrideId = await createOverride(
      ctx, "practice_assignment",
      { assignment_count: assignments.length },
      { assignment_count: assignments.length + 1, latest: newAssignment },
      notes || "Assigned additional home practice"
    );

    await supabase.from("recovery_alerts").insert({
      user_id: ctx.userId,
      profile_id: ctx.profileId,
      alert_type: "practice_assignment",
      severity: "info",
      title: "New Practice Assignment",
      description: notes || "Clinician assigned additional home practice exercises.",
      trigger_data: {
        created_by: ctx.clinicianId,
        override_id: overrideId,
        source: "clinician_override",
      },
    });

    await logAction(ctx, "assign_practice", { notes, override_id: overrideId });

    return { success: true, message: "Practice assignment saved to care plan", overrideId: overrideId || undefined };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to assign practice" };
  }
}

/**
 * Review cueing — writes cue_level_override to clinical_profile.
 */
export async function reviewCueing(
  ctx: ActionContext,
  newCueLevel?: number
): Promise<QuickActionResult> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("clinical_profile")
      .eq("id", ctx.profileId)
      .single();

    const cp = (profile?.clinical_profile as Record<string, any>) || {};
    const oldCueLevel = cp.cue_level_override ?? null;

    const updatedCp = {
      ...cp,
      cue_level_override: newCueLevel ?? null,
      cue_review_at: new Date().toISOString(),
      cue_reviewed_by: ctx.clinicianId,
    };

    await supabase
      .from("profiles")
      .update({ clinical_profile: updatedCp })
      .eq("id", ctx.profileId);

    const overrideId = await createOverride(
      ctx, "cue_level",
      { cue_level: oldCueLevel },
      { cue_level: newCueLevel ?? "reviewed", reviewed_at: new Date().toISOString() },
      "Clinician reviewed cueing strategy"
    );

    await logAction(ctx, "review_cueing", {
      value_before: { cue_level: oldCueLevel },
      value_after: { cue_level: newCueLevel ?? "reviewed" },
      override_id: overrideId,
      reason: "Clinician reviewed cueing strategy via weekly review",
    });

    return {
      success: true,
      message: newCueLevel !== undefined
        ? `Cue level override set to ${newCueLevel}`
        : "Cueing strategy reviewed and logged",
      overrideId: overrideId || undefined,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to review cueing" };
  }
}
