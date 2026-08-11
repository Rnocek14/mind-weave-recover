// _shared/rateLimit.ts — per-user fixed-window rate limiting.
//
// Wraps the service-role `check_rate_limit` RPC (see migration
// 20260811011500_rate_limit_counters.sql). Limits are deliberately generous:
// they exist to stop loops and abuse of the paid Gemini/OpenAI/ElevenLabs/
// Azure endpoints, never to interrupt a real patient mid-session.
//
// Fail-open by design: if the RPC itself errors (migration not applied yet,
// transient DB issue), the request is allowed and the failure is logged —
// availability of therapy beats strictness of the limiter.

import { adminClient } from "./auth.ts";

export interface RateLimitResult {
  allowed: boolean;
}

export async function checkRateLimit(
  userId: string,
  bucket: string,
  maxPerWindow: number,
  windowSeconds = 3600,
): Promise<RateLimitResult> {
  try {
    const admin = adminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      _user_id: userId,
      _bucket: bucket,
      _max: maxPerWindow,
      _window_seconds: windowSeconds,
    });
    if (error) {
      console.error(`[rateLimit] RPC failed for ${bucket}:`, error.message);
      return { allowed: true };
    }
    if (data === false) {
      console.warn(`[rateLimit] user ${userId} over limit for ${bucket} (${maxPerWindow}/${windowSeconds}s)`);
      return { allowed: false };
    }
    return { allowed: true };
  } catch (err) {
    console.error(`[rateLimit] unexpected error for ${bucket}:`, err);
    return { allowed: true };
  }
}

/** Standard 429 body shared by all limited endpoints. */
export function rateLimitedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: "RATE_LIMITED",
      message: "You've been practicing a lot! Please take a short break and try again soon.",
    }),
    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
