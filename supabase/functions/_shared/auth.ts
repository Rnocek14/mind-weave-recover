// ============================================================================
// _shared/auth.ts — common auth/authorization helpers for edge functions.
//
// Edge functions deploy with verify_jwt = false, so JWTs MUST be validated in
// code. These helpers centralise that: identity verification (via the anon
// client + the caller's Bearer token), DB role checks, and assigned-clinician
// checks (all via the service-role admin client).
// ============================================================================
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface AuthedUser {
  id: string;
  email?: string;
}

/**
 * Verify the caller's JWT using the anon client + their Bearer token.
 * Returns null when there is no valid Supabase session.
 */
export async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anon = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await anon.auth.getUser();
  if (error || !user) return null;
  return { id: user.id, email: user.email ?? undefined };
}

/** Service-role client for privileged reads (role/assignment lookups, writes). */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** True when the user holds any of the given roles in user_roles. */
export async function userHasAnyRole(
  admin: SupabaseClient,
  userId: string,
  roles: string[],
): Promise<boolean> {
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data) return false;
  return data.some((r: { role: string }) => roles.includes(r.role));
}

/** True when the user is an assigned clinician for the given profile. */
export async function isAssignedClinician(
  admin: SupabaseClient,
  clinicianId: string,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc("is_assigned_clinician", {
    _clinician_id: clinicianId,
    _profile_id: profileId,
  });
  if (error) return false;
  return data === true;
}
