import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify worker secret (shared between Edge and Fly.io worker)
    const workerSecret = req.headers.get('x-worker-secret');
    const expectedSecret = Deno.env.get('SPEECH_WORKER_SECRET');
    
    if (!expectedSecret) {
      console.error('SPEECH_WORKER_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (workerSecret !== expectedSecret) {
      console.error('Invalid worker secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { attempt_id, worker_id } = await req.json();
    
    if (!attempt_id || !worker_id) {
      return new Response(
        JSON.stringify({ error: 'Missing attempt_id or worker_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Verify the job is valid and locked by this worker
    const { data: job, error: jobError } = await supabaseAdmin
      .from('utterance_analyses')
      .select('attempt_id, audio_storage_path, analysis_status, locked_by')
      .eq('attempt_id', attempt_id)
      .single();

    if (jobError || !job) {
      console.error('Job not found:', jobError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security checks
    if (job.analysis_status !== 'processing') {
      return new Response(
        JSON.stringify({ error: 'Job is not in processing status' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.locked_by !== worker_id) {
      return new Response(
        JSON.stringify({ error: 'Job is not locked by this worker' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!job.audio_storage_path) {
      return new Response(
        JSON.stringify({ error: 'No audio file associated with this job' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL (valid for 3 minutes)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from('session-recordings')
      .createSignedUrl(job.audio_storage_path, 180);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Failed to create signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate signed URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Signed URL generated for attempt ${attempt_id} by worker ${worker_id}`);

    return new Response(
      JSON.stringify({ 
        signed_url: signedUrlData.signedUrl,
        expires_in_seconds: 180,
        audio_path: job.audio_storage_path
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('get-audio-signed-url error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
