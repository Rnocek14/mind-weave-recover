import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Session Sweeper Edge Function
 * 
 * Marks stale sessions as ended when clients fail to call endSession()
 * (e.g., tab closed, iOS Safari pagehide not firing, crashes).
 * 
 * Run this via cron every 5-10 minutes for reliable session cleanup.
 * 
 * Safety rules:
 * - Only ends sessions older than the threshold (default 30 min)
 * - Sets ended_reason = 'timeout_sweep' for auditing
 * - Logs sweep results for monitoring
 * - MERGES the canonical accuracy summary fields into the existing summary
 *   (preserving summary.mode) rather than overwriting, so swept sessions get
 *   the same accuracy stamping as client-ended sessions. accuracy stays null
 *   when there are no scored trials (never faked to 0%).
 */

// Canonical accuracy reducer — mirrors src/lib/sessionAccuracySummary.ts
// (reduceAccuracy + accuracySummaryToSummaryFields). Kept in sync manually.
interface ScoredRow {
  score: number | null;
  cue_level: number | null;
  counts_toward_score: boolean | null;
  validity_label?: string | null;
  exercise_slug?: string | null;
}

// Keep in sync with ACCURACY_EXCLUDED_SLUGS in src/lib/sessionAccuracySummary.ts.
const ACCURACY_EXCLUDED_SLUGS = new Set([
  'conversation_partner',
  'conversation_coach',
  'conversation_turn',
]);

function accuracySummaryFields(rows: ScoredRow[]): Record<string, number | null> {
  const mean = (xs: number[]) =>
    xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
  const isManual = (r: ScoredRow) => r.validity_label === 'manual_confirmed';
  const isExcludedSlug = (r: ScoredRow) =>
    typeof r.exercise_slug === 'string' && ACCURACY_EXCLUDED_SLUGS.has(r.exercise_slug);

  const scored = rows.filter(
    (r) => typeof r.score === 'number' && r.counts_toward_score !== false && !isManual(r) && !isExcludedSlug(r),
  );
  const manual = rows.filter((r) => typeof r.score === 'number' && isManual(r) && !isExcludedSlug(r));

  const all = scored.map((r) => r.score as number);
  const independent = scored.filter((r) => (r.cue_level ?? 0) === 0).map((r) => r.score as number);
  const cued = scored.filter((r) => (r.cue_level ?? 0) > 0).map((r) => r.score as number);
  const practice = [...all, ...manual.map((r) => r.score as number)];

  const accuracy = mean(all);

  return {
    ...(accuracy != null ? { accuracy } : {}),
    independent_accuracy: mean(independent),
    cue_assisted_accuracy: mean(cued),
    asr_accuracy: accuracy,
    practice_accuracy: mean(practice),
    scored_trials: all.length,
    manual_confirmed_trials: manual.length,
    participation_trials: all.length + manual.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authorize: this is a privileged, service-role, RLS-bypassing endpoint that
    // mutates every user's sessions. It must only be callable by the cron job
    // (service-role bearer) or an admin — never an anonymous caller.
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    let isAuthorized = false;
    if (token && token === serviceRoleKey) {
      isAuthorized = true;
    } else if (token) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (u?.user) {
        const adminCheck = createClient(supabaseUrl, serviceRoleKey);
        const { data: hasAdmin } = await adminCheck.rpc('has_role', { _user_id: u.user.id, _role: 'admin' });
        isAuthorized = Boolean(hasAdmin);
      }
    }
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body for custom threshold (optional)
    let thresholdMinutes = 30;
    try {
      const body = await req.json();
      if (body.thresholdMinutes && typeof body.thresholdMinutes === 'number') {
        thresholdMinutes = Math.max(5, Math.min(1440, body.thresholdMinutes)); // 5 min to 24 hours
      }
    } catch {
      // No body or invalid JSON - use default
    }

    const sweepTime = new Date().toISOString();
    const cutoffTime = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

    console.log(`[SessionSweeper] Starting sweep at ${sweepTime}`);
    console.log(`[SessionSweeper] Threshold: ${thresholdMinutes} minutes`);
    console.log(`[SessionSweeper] Cutoff time: ${cutoffTime}`);

    // Find and update stale sessions in one query
    const { data: staleSessions, error: selectError } = await supabase
      .from('sessions')
      .select('id, user_id, profile_id, started_at, plan, summary')
      .is('ended_at', null)
      .lt('started_at', cutoffTime);

    if (selectError) {
      console.error('[SessionSweeper] Error finding stale sessions:', selectError);
      return new Response(
        JSON.stringify({ error: 'Failed to query stale sessions', details: selectError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staleCount = staleSessions?.length ?? 0;
    console.log(`[SessionSweeper] Found ${staleCount} stale sessions`);

    if (staleCount === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          sweptCount: 0, 
          message: 'No stale sessions found',
          sweepTime,
          thresholdMinutes 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staleIds = staleSessions!.map(s => s.id);

    // Pull all scored trials for these sessions so we can stamp the canonical
    // accuracy summary (instead of overwriting with a bare swept marker).
    const { data: events, error: eventsError } = await supabase
      .from('exercise_events')
      .select('session_id, score, cue_level, counts_toward_score, validity_label, exercise_slug')
      .in('session_id', staleIds);

    if (eventsError) {
      console.error('[SessionSweeper] Error fetching exercise_events:', eventsError);
    }

    const eventsBySession = new Map<string, ScoredRow[]>();
    for (const e of (events ?? []) as Array<ScoredRow & { session_id: string }>) {
      const arr = eventsBySession.get(e.session_id) ?? [];
      arr.push(e);
      eventsBySession.set(e.session_id, arr);
    }

    // Update each stale session individually so we can merge its own summary
    // (preserving summary.mode) and stamp its own accuracy fields.
    let updateCount = 0;
    let updateFailures = 0;
    for (const s of staleSessions!) {
      const existingSummary = (s.summary as Record<string, unknown> | null) ?? {};
      const accFields = accuracySummaryFields(eventsBySession.get(s.id) ?? []);
      const mergedSummary = {
        ...existingSummary,
        ...accFields,
        swept: true,
        swept_at: sweepTime,
        stale_since: cutoffTime,
      };

      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          ended_at: sweepTime,
          ended_reason: 'timeout_sweep',
          duration_sec: Math.max(
            0,
            Math.round((Date.parse(sweepTime) - Date.parse(s.started_at as string)) / 1000),
          ),
          summary: mergedSummary,
        })
        .eq('id', s.id)
        .is('ended_at', null); // Double-check still not ended

      if (updateError) {
        updateFailures += 1;
        console.error('[SessionSweeper] Error updating session', s.id, updateError.message);
      } else {
        updateCount += 1;
      }
    }

    if (updateFailures > 0) {
      console.warn(`[SessionSweeper] ${updateFailures} session updates failed`);
    }


    // Log summary for monitoring. Do NOT return raw session IDs to the caller —
    // they are other users' identifiers.
    const result = {
      success: true,
      sweptCount: updateCount,
      updateFailures,
      sweepTime,
      thresholdMinutes,
      message: `Swept ${updateCount} stale sessions`
    };

    console.log(`[SessionSweeper] Sweep complete:`, { ...result, staleSessionIds: staleIds });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SessionSweeper] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
