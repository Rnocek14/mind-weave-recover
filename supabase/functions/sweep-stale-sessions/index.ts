import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { reduceAccuracy, accuracySummaryToSummaryFields, type ScoredRow } from '../_shared/sessionAccuracySummary.ts';

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

    // Idle threshold: a session is only "stale" if it has had NO ACTIVITY for
    // this long. Keying on last activity (not started_at) is critical for
    // aphasia users — a slow patient can legitimately be 45+ minutes into a
    // guided lesson and still actively practicing; keying on session AGE would
    // sweep them mid-session. Default 30 min of inactivity.
    let thresholdMinutes = 30;
    try {
      const body = await req.json();
      if (body.thresholdMinutes && typeof body.thresholdMinutes === 'number') {
        thresholdMinutes = Math.max(15, Math.min(1440, body.thresholdMinutes)); // 15 min to 24 hours
      }
    } catch {
      // No body or invalid JSON - use default
    }

    const sweepTime = new Date().toISOString();
    const idleCutoff = Date.now() - thresholdMinutes * 60 * 1000;
    const idleCutoffTime = new Date(idleCutoff).toISOString();

    console.log(`[SessionSweeper] Starting sweep at ${sweepTime}`);
    console.log(`[SessionSweeper] Idle threshold: ${thresholdMinutes} minutes since last activity`);

    // Candidate open sessions that STARTED before the idle cutoff (necessary but
    // not sufficient — we then require no recent activity below).
    const { data: staleSessions, error: selectError } = await supabase
      .from('sessions')
      .select('id, user_id, profile_id, started_at, plan, summary')
      .is('ended_at', null)
      .lt('started_at', idleCutoffTime);

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

    const candidateIds = staleSessions!.map(s => s.id);

    // Pull all trials for these sessions — used both for the accuracy summary
    // AND to compute last-activity (so we never sweep a session that is still
    // being actively worked on, however long it has been open).
    const { data: events, error: eventsError } = await supabase
      .from('exercise_events')
      .select('session_id, score, cue_level, counts_toward_score, validity_label, exercise_slug, task_parameters, engagement_flags, whisper_transcript, browser_transcript, created_at')
      .in('session_id', candidateIds);

    if (eventsError) {
      // The trial query supplies BOTH summary accuracy and last activity.
      // Never sweep patients with unknown activity or stamp null summaries
      // as though their attempts were absent.
      console.error('[SessionSweeper] Error fetching exercise_events:', eventsError);
      return new Response(
        JSON.stringify({ error: 'Unable to verify recent session activity' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const eventsBySession = new Map<string, ScoredRow[]>();
    const lastActivityBySession = new Map<string, number>();
    for (const e of (events ?? []) as Array<ScoredRow & { session_id: string; created_at?: string }>) {
      const arr = eventsBySession.get(e.session_id) ?? [];
      arr.push(e);
      eventsBySession.set(e.session_id, arr);
      const t = e.created_at ? Date.parse(e.created_at) : 0;
      if (t > (lastActivityBySession.get(e.session_id) ?? 0)) {
        lastActivityBySession.set(e.session_id, t);
      }
    }

    // Only sweep sessions whose LAST activity (most recent trial, or start time
    // if no trials) is older than the idle cutoff. A session with a recent trial
    // is still active and must never be swept.
    const sessionsToSweep = staleSessions!.filter((s) => {
      const lastActivity = lastActivityBySession.get(s.id) ?? Date.parse(s.started_at as string);
      return lastActivity < idleCutoff;
    });
    const staleIds = sessionsToSweep.map((s) => s.id);
    console.log(`[SessionSweeper] ${staleSessions!.length} candidates, ${sessionsToSweep.length} actually idle`);

    // Update each idle session individually so we can merge its own summary
    // (preserving summary.mode) and stamp its own accuracy fields.
    let updateCount = 0;
    let updateFailures = 0;
    for (const s of sessionsToSweep) {
      const existingSummary = (s.summary as Record<string, unknown> | null) ?? {};
      const accFields = accuracySummaryToSummaryFields(reduceAccuracy(eventsBySession.get(s.id) ?? []));
      const mergedSummary = {
        ...existingSummary,
        ...accFields,
        swept: true,
        swept_at: sweepTime,
        stale_since: idleCutoffTime,
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
