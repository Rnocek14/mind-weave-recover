// delete-account — full self-service account deletion.
//
// The old client-side deleteAllData() removed profile rows and photo blobs
// but never deleted the auth.users account, while the Privacy Policy promises
// account deletion. This function is the promise, kept:
//   1. caller identity is verified from their JWT (they can only delete
//      themselves),
//   2. their storage objects are removed (photos + session recordings),
//   3. auth.admin.deleteUser() removes the account, and every user-keyed
//      table cascades (see migration 20260811010000_account_deletion_cascade).
//
// Requires the body { confirm: "DELETE" } so a stray invocation can't wipe
// an account.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthedUser, adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";

const BUCKETS = ["photos", "session-recordings"];

async function removeUserObjects(admin: ReturnType<typeof adminClient>, bucket: string, userId: string) {
  // Objects are stored under a per-user prefix. Page through and remove;
  // a few hundred files per user is the realistic ceiling.
  for (let page = 0; page < 20; page++) {
    const { data: objects, error } = await admin.storage.from(bucket).list(userId, {
      limit: 100,
      offset: 0, // list shrinks as we remove, so always take the first page
    });
    if (error || !objects || objects.length === 0) return;
    const paths = objects.map((o) => `${userId}/${o.name}`);
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) {
      console.error(`[delete-account] failed removing from ${bucket}:`, removeError.message);
      return; // storage leftovers are logged, not fatal — the account still goes
    }
    if (objects.length < 100) return;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const caller = await getAuthedUser(req);
  if (!caller) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: { confirm?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid body" }, 400);
  }
  if (body?.confirm !== "DELETE") {
    return jsonResponse({ error: 'Confirmation required: { "confirm": "DELETE" }' }, 400);
  }

  const admin = adminClient();

  try {
    for (const bucket of BUCKETS) {
      await removeUserObjects(admin, bucket, caller.id);
    }

    const { error } = await admin.auth.admin.deleteUser(caller.id);
    if (error) {
      console.error("[delete-account] deleteUser failed:", error.message);
      return jsonResponse({ error: "Account deletion failed. Please contact support." }, 500);
    }

    console.log(`[delete-account] account ${caller.id} deleted`);
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("[delete-account] unexpected error:", err);
    return jsonResponse({ error: "Account deletion failed. Please contact support." }, 500);
  }
});
