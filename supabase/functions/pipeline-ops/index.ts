import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  // Verify staff role via JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // Check if user has admin or moderator role
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const isStaff = roles?.some(r => r.role === 'admin' || r.role === 'moderator');
  if (!isStaff) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { 
      status: 403, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  try {
    // GET /stats - Pipeline statistics
    if (req.method === "GET" && path === "stats") {
      console.log('📊 Fetching pipeline stats');

      const { data, error } = await supabase
        .from("utterance_analyses")
        .select("analysis_status, created_at, locked_at, retry_count");

      if (error) throw error;

      const now = Date.now();
      const pending = data?.filter(r => r.analysis_status === 'pending') ?? [];
      const processing = data?.filter(r => r.analysis_status === 'processing') ?? [];
      const complete = data?.filter(r => r.analysis_status === 'complete') ?? [];
      const failed = data?.filter(r => r.analysis_status === 'failed') ?? [];

      // Calculate pending ages
      const pendingAges = pending.map(r => (now - new Date(r.created_at).getTime()) / 60000);
      pendingAges.sort((a, b) => a - b);

      // Calculate stuck processing (>10 min)
      const stuckProcessing = processing.filter(r => 
        r.locked_at && (now - new Date(r.locked_at).getTime()) > 10 * 60 * 1000
      );

      // Permanently failed (retry_count >= 5)
      const permFailed = failed.filter(r => (r.retry_count ?? 0) >= 5);

      const stats = {
        counts: {
          pending: pending.length,
          processing: processing.length,
          complete: complete.length,
          failed: failed.length,
          permFailed: permFailed.length,
          stuckProcessing: stuckProcessing.length,
        },
        pendingAge: {
          oldestMin: pendingAges.length ? Math.round(pendingAges[pendingAges.length - 1]) : 0,
          p50Min: pendingAges.length ? Math.round(pendingAges[Math.floor(pendingAges.length * 0.5)]) : 0,
          p90Min: pendingAges.length ? Math.round(pendingAges[Math.floor(pendingAges.length * 0.9)]) : 0,
        },
        total: data?.length ?? 0,
      };

      console.log('📊 Stats computed:', stats.counts);
      return new Response(JSON.stringify({ ok: true, stats }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /requeue-stuck - Requeue stuck processing jobs
    if (req.method === "POST" && path === "requeue-stuck") {
      const body = await req.json().catch(() => ({}));
      const minutes = Number(body?.minutes ?? 10);

      console.log(`🔄 Requeuing jobs stuck > ${minutes} minutes`);

      const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("utterance_analyses")
        .update({
          analysis_status: "pending",
          locked_at: null,
          locked_by: null,
          next_retry_at: null,
        })
        .eq("analysis_status", "processing")
        .lt("locked_at", cutoff)
        .select("attempt_id");

      if (error) throw error;

      console.log(`✅ Requeued ${data?.length ?? 0} jobs`);
      return new Response(JSON.stringify({ ok: true, requeued: data?.length ?? 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /bump-priority - Bump priority for specific attempts or user
    if (req.method === "POST" && path === "bump-priority") {
      const body = await req.json().catch(() => ({}));
      const { attemptIds, userId, priority } = body;

      if (!attemptIds && !userId) {
        return new Response(JSON.stringify({ error: 'Must provide attemptIds or userId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const newPriority = Number(priority ?? 10);
      console.log(`⬆️ Bumping priority to ${newPriority}`);

      let query = supabase
        .from("utterance_analyses")
        .update({ analysis_priority: newPriority })
        .eq("analysis_status", "pending");

      if (attemptIds?.length) {
        query = query.in("attempt_id", attemptIds);
      } else if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query.select("attempt_id");

      if (error) throw error;

      console.log(`✅ Bumped priority for ${data?.length ?? 0} jobs`);
      return new Response(JSON.stringify({ ok: true, bumped: data?.length ?? 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /reset-failed - Reset permanently failed jobs for retry
    if (req.method === "POST" && path === "reset-failed") {
      console.log('🔄 Resetting permanently failed jobs');

      const { data, error } = await supabase
        .from("utterance_analyses")
        .update({
          analysis_status: "pending",
          retry_count: 0,
          error_message: null,
          next_retry_at: null,
        })
        .eq("analysis_status", "failed")
        .gte("retry_count", 5)
        .select("attempt_id");

      if (error) throw error;

      console.log(`✅ Reset ${data?.length ?? 0} failed jobs`);
      return new Response(JSON.stringify({ ok: true, reset: data?.length ?? 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Pipeline ops error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
