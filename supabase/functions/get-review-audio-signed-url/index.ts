import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role (reviewers are admins)
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Error checking roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Admin role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { attempt_id } = await req.json();
    
    if (!attempt_id) {
      return new Response(
        JSON.stringify({ error: 'Missing attempt_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client to bypass RLS for audio access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get the utterance analysis to verify it exists and get audio path
    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('utterance_analyses')
      .select('attempt_id, audio_storage_path, target_word, transcript, analysis_status')
      .eq('attempt_id', attempt_id)
      .single();

    if (analysisError || !analysis) {
      console.error('Analysis not found:', analysisError);
      return new Response(
        JSON.stringify({ error: 'Utterance analysis not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!analysis.audio_storage_path) {
      return new Response(
        JSON.stringify({ error: 'No audio file associated with this analysis' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL (valid for 5 minutes for review)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from('session-recordings')
      .createSignedUrl(analysis.audio_storage_path, 300);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Failed to create signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate audio URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Review audio URL generated for attempt ${attempt_id} by admin ${user.id}`);

    return new Response(
      JSON.stringify({ 
        signed_url: signedUrlData.signedUrl,
        expires_in_seconds: 300,
        audio_path: analysis.audio_storage_path,
        target_word: analysis.target_word,
        transcript: analysis.transcript
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('get-review-audio-signed-url error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
