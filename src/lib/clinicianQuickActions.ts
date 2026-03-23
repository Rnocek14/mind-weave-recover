/**
 * Clinician Quick Actions — writes real state changes to DB.
 * 
 * Each action:
 * 1. Creates a clinician_overrides record (reversible, auditable)
 * 2. Writes to the relevant operational table (dose_targets, recovery_alerts, profiles)
 * 3. Logs to adaptation_events for audit trail
 */
import { supabase } from "@/integrations/supabase/client";

export interface QuickActionResult {
  success: boolean;
  message: string;
  overrideId?: string; // ID of the clinician_overrides record for reversal
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

/**
 * Reduce dose target for a domain by a percentage.
 * Creates a new dose_target row with reduced value + override record.
 */
export async function reduceDose(
  ctx: ActionContext,
  domainSlug: string = "speech_therapy",
  reductionPct: number = 20
): Promise<QuickActionResult> {
  try {
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

    // Create reversible override record
    const overrideId = await createOverride(
      ctx, "dose_reduction",
      { target_value: oldValue, domain_slug: domainSlug },
      { target_value: newValue, domain_slug: domainSlug },
      `Reduced dose ${reductionPct}% via weekly review`,
      domainSlug
    );

    await logAction(ctx, "reduce_dose", {
      domain_slug: domainSlug,
      reduction_pct: reductionPct,
      value_before: { target_value: oldValue },
      value_after: { target_value: newValue },
      override_id: overrideId,
      reason: "Clinician reduced dose via weekly review quick action",
    });

    return {
      success: true,
      message: `Dose reduced from ${oldValue}min to ${newValue}min/day for ${domainSlug.replace(/_/g, " ")}`,
      overrideId: overrideId || undefined,
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
 * Adjust difficulty — writes to clinical_profile and creates override record.
 * This changes the actual live config, not just an alert.
 */
export async function adjustDifficulty(
  ctx: ActionContext,
  direction: "increase" | "decrease",
  exerciseSlug?: string
): Promise<QuickActionResult> {
  try {
    // Read current clinical profile to get difficulty settings
    const { data: profile } = await supabase
      .from("profiles")
      .select("clinical_profile")
      .eq("id", ctx.profileId)
      .single();

    const cp = (profile?.clinical_profile as Record<string, any>) || {};
    const currentOverrides = cp.difficulty_overrides || {};
    const key = exerciseSlug || "_global";
    const currentLevel = currentOverrides[key] || 0;
    const newLevel = direction === "increase" ? currentLevel + 1 : currentLevel - 1;

    // Write difficulty override directly to clinical_profile
    const updatedOverrides = { ...currentOverrides, [key]: newLevel };
    const updatedCp = { ...cp, difficulty_overrides: updatedOverrides };

    await supabase
      .from("profiles")
      .update({ clinical_profile: updatedCp })
      .eq("id", ctx.profileId);

    // Create reversible override record
    const overrideId = await createOverride(
      ctx, "difficulty",
      { difficulty_level: currentLevel, target: key },
      { difficulty_level: newLevel, target: key },
      `Clinician ${direction}d difficulty via weekly review`,
      exerciseSlug
    );

    await logAction(ctx, `${direction}_difficulty`, {
      direction,
      exercise_slug: exerciseSlug || "all",
      value_before: { difficulty_level: currentLevel },
      value_after: { difficulty_level: newLevel },
      override_id: overrideId,
      reason: `Clinician recommended ${direction} difficulty via weekly review`,
    });

    // Also create a visible alert
    await supabase.from("recovery_alerts").insert({
      user_id: ctx.userId,
      profile_id: ctx.profileId,
      alert_type: "difficulty_adjustment",
      severity: "info",
      title: `Difficulty ${direction === "increase" ? "Increased" : "Decreased"}`,
      description: `Clinician ${direction}d difficulty${exerciseSlug ? ` for ${exerciseSlug.replace(/-/g, " ")}` : " globally"}. Override ID: ${overrideId}`,
      trigger_data: {
        created_by: ctx.clinicianId,
        direction,
        exercise_slug: exerciseSlug || null,
        override_id: overrideId,
        source: "clinician_override",
      },
    });

    return {
      success: true,
      message: `Difficulty ${direction}d ${exerciseSlug ? `for ${exerciseSlug.replace(/-/g, " ")}` : "globally"} (level ${currentLevel} → ${newLevel})`,
      overrideId: overrideId || undefined,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to adjust difficulty" };
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
    // Read current profile
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

/**
 * Reverse a clinician override — restores previous state.
 */
export async function reverseOverride(
  ctx: ActionContext,
  overrideId: string,
  reason: string
): Promise<QuickActionResult> {
  try {
    // Get the override
    const { data: override } = await (supabase as any)
      .from("clinician_overrides")
      .select("*")
      .eq("id", overrideId)
      .single();

    if (!override) {
      return { success: false, message: "Override not found" };
    }

    if (override.status !== "active") {
      return { success: false, message: "Override is already reversed or superseded" };
    }

    // Mark override as reversed
    await (supabase as any)
      .from("clinician_overrides")
      .update({
        status: "reversed",
        reversed_at: new Date().toISOString(),
        reversed_by: ctx.clinicianId,
        reversal_reason: reason,
      })
      .eq("id", overrideId);

    // Restore previous state based on override type
    const valueBefore = override.value_before;

    if (override.override_type === "difficulty" && valueBefore?.difficulty_level !== undefined) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("clinical_profile")
        .eq("id", ctx.profileId)
        .single();

      const cp = (profile?.clinical_profile as Record<string, any>) || {};
      const overrides = cp.difficulty_overrides || {};
      const key = valueBefore.target || "_global";
      overrides[key] = valueBefore.difficulty_level;

      await supabase
        .from("profiles")
        .update({ clinical_profile: { ...cp, difficulty_overrides: overrides } })
        .eq("id", ctx.profileId);
    }

    if (override.override_type === "dose_reduction" && valueBefore?.target_value !== undefined) {
      // End current target and restore old value
      await (supabase as any)
        .from("dose_targets")
        .update({ effective_until: new Date().toISOString().split("T")[0] })
        .eq("profile_id", ctx.profileId)
        .eq("domain_slug", valueBefore.domain_slug)
        .is("effective_until", null);

      await (supabase as any).from("dose_targets").insert({
        user_id: ctx.userId,
        profile_id: ctx.profileId,
        domain_slug: valueBefore.domain_slug,
        target_value: valueBefore.target_value,
        prescribed_by: ctx.clinicianId,
      });
    }

    await logAction(ctx, "reverse_override", {
      override_id: overrideId,
      override_type: override.override_type,
      value_before: override.value_after,
      value_after: override.value_before,
      reason,
    });

    return { success: true, message: `Override reversed: ${override.override_type}` };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to reverse override" };
  }
}
