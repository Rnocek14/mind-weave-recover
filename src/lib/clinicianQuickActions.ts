/**
 * Clinician Quick Actions — ALL actions use atomic Postgres RPCs.
 * 
 * Every action executes in a single DB transaction:
 * 1. Writes to the operational table (profiles.runtime_config, dose_targets, recovery_alerts)
 * 2. Creates a clinician_overrides record (reversible, auditable)
 * 3. Logs to adaptation_events for audit trail
 * 
 * Runtime config (difficulty, cueing, practice) lives in profiles.runtime_config,
 * separate from clinical_profile (impairments, goals, severity).
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

/** Helper to call an RPC and parse the jsonb result */
async function callClinicianRpc(
  rpcName: string,
  params: Record<string, any>
): Promise<QuickActionResult> {
  const { data, error } = await (supabase as any).rpc(rpcName, params);
  if (error) throw error;
  const result = data as any;
  return {
    success: result.success,
    message: result.message,
    overrideId: result.override_id || undefined,
  };
}

/**
 * Reduce dose target — ATOMIC via clinician_reduce_dose RPC.
 */
export async function reduceDose(
  ctx: ActionContext,
  domainSlug: string = "speech_therapy",
  reductionPct: number = 20
): Promise<QuickActionResult> {
  try {
    return await callClinicianRpc("clinician_reduce_dose", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_clinician_id: ctx.clinicianId,
      p_domain_slug: domainSlug,
      p_reduction_pct: reductionPct,
    });
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to reduce dose" };
  }
}

/**
 * Adjust difficulty — ATOMIC via clinician_adjust_difficulty RPC.
 * Writes to runtime_config.difficulty_overrides (not clinical_profile).
 */
export async function adjustDifficulty(
  ctx: ActionContext,
  direction: "increase" | "decrease",
  exerciseSlug?: string
): Promise<QuickActionResult> {
  try {
    return await callClinicianRpc("clinician_adjust_difficulty", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_clinician_id: ctx.clinicianId,
      p_direction: direction,
      p_exercise_slug: exerciseSlug || null,
    });
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to adjust difficulty" };
  }
}

/**
 * Reverse override — ATOMIC via clinician_reverse_override RPC.
 */
export async function reverseOverride(
  ctx: ActionContext,
  overrideId: string,
  reason: string
): Promise<QuickActionResult> {
  try {
    return await callClinicianRpc("clinician_reverse_override", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_clinician_id: ctx.clinicianId,
      p_override_id: overrideId,
      p_reason: reason,
    });
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to reverse override" };
  }
}

/**
 * Schedule outreach — ATOMIC via clinician_schedule_outreach RPC.
 */
export async function scheduleOutreach(
  ctx: ActionContext,
  reason: string
): Promise<QuickActionResult> {
  try {
    return await callClinicianRpc("clinician_schedule_outreach", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_clinician_id: ctx.clinicianId,
      p_reason: reason || "Clinician flagged patient for follow-up outreach.",
    });
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to schedule outreach" };
  }
}

/**
 * Assign practice — ATOMIC via clinician_assign_practice RPC.
 * Writes to runtime_config.practice_assignments (not clinical_profile).
 */
export async function assignPractice(
  ctx: ActionContext,
  notes?: string
): Promise<QuickActionResult> {
  try {
    return await callClinicianRpc("clinician_assign_practice", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_clinician_id: ctx.clinicianId,
      p_notes: notes || "Additional home practice exercises assigned.",
    });
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to assign practice" };
  }
}

/**
 * Review cueing — ATOMIC via clinician_review_cueing RPC.
 * Writes to runtime_config.cue_level_override (not clinical_profile).
 */
export async function reviewCueing(
  ctx: ActionContext,
  newCueLevel?: number
): Promise<QuickActionResult> {
  try {
    return await callClinicianRpc("clinician_review_cueing", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_clinician_id: ctx.clinicianId,
      p_new_cue_level: newCueLevel ?? null,
    });
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to review cueing" };
  }
}

/**
 * Suggest an override (creates in 'suggested' status, does NOT apply).
 * Used by system/AI recommendations that need clinician approval.
 */
export async function suggestOverride(
  ctx: ActionContext,
  overrideType: string,
  valueAfter: Record<string, any>,
  reason: string,
  suggestedBy: string = "system",
  targetSlug?: string
): Promise<QuickActionResult> {
  try {
    return await callClinicianRpc("clinician_suggest_override", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_suggested_by: suggestedBy,
      p_override_type: overrideType,
      p_target_slug: targetSlug || null,
      p_value_after: valueAfter,
      p_reason: reason,
    });
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to create suggestion" };
  }
}

/**
 * Approve a suggested override — applies it to runtime_config atomically.
 */
export async function approveOverride(
  ctx: ActionContext,
  overrideId: string
): Promise<QuickActionResult> {
  try {
    return await callClinicianRpc("clinician_approve_override", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_clinician_id: ctx.clinicianId,
      p_override_id: overrideId,
    });
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to approve override" };
  }
}

/**
 * Reject a suggested override — marks as reversed without applying.
 */
export async function rejectOverride(
  ctx: ActionContext,
  overrideId: string,
  reason: string = "Clinician declined suggestion"
): Promise<QuickActionResult> {
  try {
    return await callClinicianRpc("clinician_reject_override", {
      p_user_id: ctx.userId,
      p_profile_id: ctx.profileId,
      p_clinician_id: ctx.clinicianId,
      p_override_id: overrideId,
      p_reason: reason,
    });
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to reject suggestion" };
  }
}
