/**
 * clinician-action — authorize-then-dispatch for all clinician quick actions.
 *
 * The underlying `clinician_*` RPCs are SECURITY DEFINER (they bypass RLS) and
 * are now revoked from anon/authenticated (see migration
 * 20260710150000_lock_down_privileged_rpcs.sql). They can only be invoked with
 * the service-role key, which lives here. This function:
 *   1. authenticates the caller's JWT,
 *   2. verifies the caller is an admin OR the assigned clinician for the target
 *      profile,
 *   3. derives the acting clinician id from the JWT (never the request body) and
 *      looks up the patient's owning user_id server-side,
 *   4. invokes the requested RPC with the service-role client.
 *
 * This closes the hole where any authenticated patient could call the RPCs
 * directly with an attacker-chosen p_clinician_id and tamper with another
 * patient's clinical settings while forging the audit trail.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { userHasAnyRole, isAssignedClinician } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// action → { rpc, passthrough params, whether to inject the acting clinician id }
const ACTIONS: Record<
  string,
  { rpc: string; params: string[]; injectClinician: boolean }
> = {
  reduce_dose:        { rpc: "clinician_reduce_dose",        params: ["p_domain_slug", "p_reduction_pct"], injectClinician: true },
  adjust_difficulty:  { rpc: "clinician_adjust_difficulty",  params: ["p_direction", "p_exercise_slug"],    injectClinician: true },
  reverse_override:   { rpc: "clinician_reverse_override",   params: ["p_override_id", "p_reason"],          injectClinician: true },
  schedule_outreach:  { rpc: "clinician_schedule_outreach",  params: ["p_reason"],                           injectClinician: true },
  assign_practice:    { rpc: "clinician_assign_practice",    params: ["p_notes"],                            injectClinician: true },
  review_cueing:      { rpc: "clinician_review_cueing",      params: ["p_new_cue_level"],                    injectClinician: true },
  approve_override:   { rpc: "clinician_approve_override",   params: ["p_override_id"],                      injectClinician: true },
  reject_override:    { rpc: "clinician_reject_override",    params: ["p_override_id", "p_reason"],          injectClinician: true },
  // Suggestion identifies the source via p_suggested_by (a label), not a clinician id.
  suggest_override:   { rpc: "clinician_suggest_override",   params: ["p_suggested_by", "p_override_type", "p_target_slug", "p_value_after", "p_reason"], injectClinician: false },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Verify the caller via the anon client + their bearer token.
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { action, profileId, params } = body ?? {};
    const actionParams = (params && typeof params === "object") ? params : {};

    const spec = action ? ACTIONS[action] : undefined;
    if (!spec) {
      return json({ error: `Unknown action: ${action}` }, 400);
    }
    if (!profileId) {
      return json({ error: "Missing profileId" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Authorize: admin OR assigned clinician for THIS profile.
    const isAdmin = await userHasAnyRole(admin, user.id, ["admin"]);
    if (!isAdmin) {
      const isClinician = await userHasAnyRole(admin, user.id, ["clinician", "moderator"]);
      if (!isClinician) {
        return json({ error: "Forbidden: clinician role required" }, 403);
      }
      const assigned = await isAssignedClinician(admin, user.id, profileId);
      if (!assigned) {
        return json({ error: "Forbidden: not assigned to this patient" }, 403);
      }
    }

    // Resolve the patient's owning user_id server-side (never trust the body).
    const { data: profileRow, error: profileErr } = await admin
      .from("profiles")
      .select("user_id")
      .eq("id", profileId)
      .maybeSingle();
    if (profileErr || !profileRow) {
      return json({ error: "Profile not found" }, 404);
    }

    // Build the RPC arguments: identity params are server-derived; the rest are
    // the action-specific passthrough params from the client.
    const rpcArgs: Record<string, unknown> = {
      p_profile_id: profileId,
      p_user_id: profileRow.user_id,
    };
    if (spec.injectClinician) {
      rpcArgs.p_clinician_id = user.id; // acting clinician = the authenticated caller
    }
    for (const key of spec.params) {
      if (key in actionParams) rpcArgs[key] = actionParams[key];
    }

    const { data: result, error: rpcError } = await admin.rpc(spec.rpc, rpcArgs);
    if (rpcError) {
      console.error(`[clinician-action] ${action} failed:`, rpcError.message);
      return json({ success: false, message: rpcError.message }, 400);
    }

    return json(result ?? { success: true });
  } catch (err) {
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});
