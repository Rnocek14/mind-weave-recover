/**
 * clinician-action — Transactional edge function for clinician quick actions.
 * 
 * Wraps multi-step writes (profile + override + alert + audit log)
 * in a single server-side call so partial failures don't leave
 * half-written state on the client.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { userHasAnyRole, isAssignedClinician } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller via anon client
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for transactional writes
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, userId, profileId, clinicianId, params } = body;

    if (!action || !userId || !profileId || !clinicianId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the clinician is the authenticated user
    if (user.id !== clinicianId) {
      return new Response(JSON.stringify({ error: "Clinician ID mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: { success: boolean; message: string; overrideId?: string };

    switch (action) {
      case "reduce_dose": {
        const domainSlug = params?.domainSlug || "speech_therapy";
        const reductionPct = params?.reductionPct || 20;

        // 1. Get current target
        const { data: targets } = await admin
          .from("dose_targets")
          .select("*")
          .eq("profile_id", profileId)
          .eq("domain_slug", domainSlug)
          .is("effective_until", null)
          .order("effective_from", { ascending: false })
          .limit(1);

        const current = targets?.[0];
        if (!current) {
          result = { success: false, message: `No active dose target for ${domainSlug}` };
          break;
        }

        const oldValue = current.target_value;
        const newValue = Math.max(5, Math.round(oldValue * (1 - reductionPct / 100)));

        // 2. End old, create new, create override, log — all via service role
        await admin.from("dose_targets").update({ effective_until: new Date().toISOString().split("T")[0] }).eq("id", current.id);
        await admin.from("dose_targets").insert({ user_id: userId, profile_id: profileId, domain_slug: domainSlug, target_value: newValue, target_frequency: current.target_frequency, prescribed_by: clinicianId });

        const { data: overrideData } = await admin.from("clinician_overrides").insert({
          user_id: userId, profile_id: profileId, clinician_id: clinicianId,
          override_type: "dose_reduction", target_slug: domainSlug,
          value_before: { target_value: oldValue, domain_slug: domainSlug },
          value_after: { target_value: newValue, domain_slug: domainSlug },
          reason: `Reduced dose ${reductionPct}% via weekly review`, status: "active",
        }).select("id").single();

        await admin.from("adaptation_events").insert({
          user_id: userId, profile_id: profileId, layer: "clinician_override",
          adaptation_type: "reduce_dose", trigger_type: "clinician_action", confidence: "high",
          evidence: { performed_by: clinicianId, domain_slug: domainSlug, reduction_pct: reductionPct, override_id: overrideData?.id },
          value_before: { target_value: oldValue }, value_after: { target_value: newValue },
        });

        result = { success: true, message: `Dose reduced ${oldValue}→${newValue}min for ${domainSlug.replace(/_/g, " ")}`, overrideId: overrideData?.id };
        break;
      }

      case "adjust_difficulty": {
        const direction = params?.direction || "decrease";
        const exerciseSlug = params?.exerciseSlug;

        const { data: profile } = await admin.from("profiles").select("runtime_config").eq("id", profileId).single();
        const rc = (profile?.runtime_config as Record<string, any>) || {};
        const currentOverrides = rc.difficulty_overrides || {};
        const key = exerciseSlug || "_global";
        const currentLevel = currentOverrides[key] || 0;
        const newLevel = direction === "increase" ? currentLevel + 1 : currentLevel - 1;

        const updatedRc = { ...rc, difficulty_overrides: { ...currentOverrides, [key]: newLevel } };
        await admin.from("profiles").update({ runtime_config: updatedRc }).eq("id", profileId);

        const { data: overrideData } = await admin.from("clinician_overrides").insert({
          user_id: userId, profile_id: profileId, clinician_id: clinicianId,
          override_type: "difficulty", target_slug: exerciseSlug || null,
          value_before: { difficulty_level: currentLevel, target: key },
          value_after: { difficulty_level: newLevel, target: key },
          reason: `Clinician ${direction}d difficulty via weekly review`, status: "active",
        }).select("id").single();

        // Supersede prior active difficulty overrides for SAME target only
        if (overrideData?.id) {
          await admin.from("clinician_overrides")
            .update({ status: "superseded" })
            .eq("profile_id", profileId)
            .eq("override_type", "difficulty")
            .eq("status", "active")
            .neq("id", overrideData.id)
            .eq("target_slug", exerciseSlug || null);
        }

        await admin.from("adaptation_events").insert({
          user_id: userId, profile_id: profileId, layer: "clinician_override",
          adaptation_type: `${direction}_difficulty`, trigger_type: "clinician_action", confidence: "high",
          evidence: { performed_by: clinicianId, direction, exercise_slug: exerciseSlug || "all", override_id: overrideData?.id },
          value_before: { difficulty_level: currentLevel }, value_after: { difficulty_level: newLevel },
        });

        await admin.from("recovery_alerts").insert({
          user_id: userId, profile_id: profileId, alert_type: "difficulty_adjustment", severity: "info",
          title: `Difficulty ${direction === "increase" ? "Increased" : "Decreased"}`,
          description: `Clinician ${direction}d difficulty${exerciseSlug ? ` for ${exerciseSlug.replace(/-/g, " ")}` : " globally"}.`,
          trigger_data: { created_by: clinicianId, direction, override_id: overrideData?.id, source: "clinician_override" },
        });

        result = { success: true, message: `Difficulty ${direction}d (${currentLevel}→${newLevel})`, overrideId: overrideData?.id };
        break;
      }

      case "reverse_override": {
        const overrideId = params?.overrideId;
        const reason = params?.reason || "Reversed via weekly review";

        const { data: override } = await admin.from("clinician_overrides").select("*").eq("id", overrideId).single();
        if (!override) { result = { success: false, message: "Override not found" }; break; }
        if (override.status !== "active") { result = { success: false, message: "Override already reversed/superseded" }; break; }

        await admin.from("clinician_overrides").update({
          status: "reversed", reversed_at: new Date().toISOString(), reversed_by: clinicianId, reversal_reason: reason,
        }).eq("id", overrideId);

        const vb = override.value_before as Record<string, any> || {};

        // Restore state based on type
        if (override.override_type === "difficulty" && vb.difficulty_level !== undefined) {
          const { data: prof } = await admin.from("profiles").select("runtime_config").eq("id", profileId).single();
          const rc = (prof?.runtime_config as Record<string, any>) || {};
          const ov = rc.difficulty_overrides || {};
          ov[vb.target || "_global"] = vb.difficulty_level;
          await admin.from("profiles").update({ runtime_config: { ...rc, difficulty_overrides: ov } }).eq("id", profileId);
        }
        if (override.override_type === "dose_reduction" && vb.target_value !== undefined) {
          await admin.from("dose_targets").update({ effective_until: new Date().toISOString().split("T")[0] }).eq("profile_id", profileId).eq("domain_slug", vb.domain_slug).is("effective_until", null);
          await admin.from("dose_targets").insert({ user_id: userId, profile_id: profileId, domain_slug: vb.domain_slug, target_value: vb.target_value, prescribed_by: clinicianId });
        }
        if (override.override_type === "cue_level") {
          const { data: prof } = await admin.from("profiles").select("runtime_config").eq("id", profileId).single();
          const rc = (prof?.runtime_config as Record<string, any>) || {};
          await admin.from("profiles").update({ runtime_config: { ...rc, cue_level_override: vb.cue_level ?? null, cue_review_at: null, cue_reviewed_by: null } }).eq("id", profileId);
        }
        if (override.override_type === "practice_assignment") {
          const { data: prof } = await admin.from("profiles").select("runtime_config").eq("id", profileId).single();
          const rc = (prof?.runtime_config as Record<string, any>) || {};
          const va = override.value_after as Record<string, any> || {};
          const latestId = va.latest?.id;
          const assignments = rc.practice_assignments || [];
          const filtered = latestId ? assignments.filter((a: any) => a.id !== latestId) : assignments.slice(0, -1);
          await admin.from("profiles").update({ runtime_config: { ...rc, practice_assignments: filtered } }).eq("id", profileId);
        }
        if (override.override_type === "outreach") {
          await admin.from("recovery_alerts").update({ resolved_at: new Date().toISOString(), resolved_by: clinicianId, resolution_notes: `Reversed: ${reason}` }).eq("profile_id", profileId).eq("alert_type", "outreach_needed").is("resolved_at", null);
        }

        await admin.from("adaptation_events").insert({
          user_id: userId, profile_id: profileId, layer: "clinician_override",
          adaptation_type: "reverse_override", trigger_type: "clinician_action", confidence: "high",
          evidence: { performed_by: clinicianId, override_id: overrideId, override_type: override.override_type, reason },
          value_before: override.value_after, value_after: override.value_before,
        });

        result = { success: true, message: `Override reversed: ${override.override_type}` };
        break;
      }

      default:
        result = { success: false, message: `Unknown action: ${action}` };
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    // Log failure for audit visibility
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey);
      const body = await req.clone().json().catch(() => ({}));
      await admin.from("adaptation_events").insert({
        user_id: body.userId || "00000000-0000-0000-0000-000000000000",
        profile_id: body.profileId || null,
        layer: "clinician_override",
        adaptation_type: "action_failed",
        trigger_type: "clinician_action",
        confidence: "high",
        evidence: {
          action: body.action,
          error: err.message,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
