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
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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
      .select('id, user_id, profile_id, started_at, plan')
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

    // Update all stale sessions
    const staleIds = staleSessions!.map(s => s.id);
    
    const { error: updateError, count: updateCount } = await supabase
      .from('sessions')
      .update({
        ended_at: sweepTime,
        ended_reason: 'timeout_sweep',
        summary: { 
          swept: true, 
          swept_at: sweepTime,
          stale_since: cutoffTime 
        }
      })
      .in('id', staleIds)
      .is('ended_at', null); // Double-check still not ended

    if (updateError) {
      console.error('[SessionSweeper] Error updating stale sessions:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update stale sessions', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log summary for monitoring
    const result = {
      success: true,
      sweptCount: updateCount ?? staleCount,
      sweepTime,
      thresholdMinutes,
      staleSessionIds: staleIds,
      message: `Swept ${updateCount ?? staleCount} stale sessions`
    };

    console.log(`[SessionSweeper] Sweep complete:`, result);

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
