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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  // Log request for debugging
  console.log("➡️ pipeline-ops", req.method, path);

  // Verify staff role via JWT using user-scoped client
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // Create user-scoped client for auth verification
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // Create service client for privileged operations
  const supabase = createClient(supabaseUrl, serviceKey);

  // Check if user has admin or moderator role using service client
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

    // POST /process-pending-azure - Process pending jobs via Azure Speech API
    if (req.method === "POST" && path === "process-pending-azure") {
      const body = await req.json().catch(() => ({}));
      const limit = Math.min(Number(body?.limit ?? 20), 100);

      console.log(`🔊 Processing up to ${limit} pending jobs via Azure`);

      // Get pending jobs with audio
      const { data: pendingJobs, error: fetchError } = await supabase
        .from("utterance_analyses")
        .select("attempt_id, audio_storage_path, target_word, transcript")
        .eq("analysis_status", "pending")
        .not("audio_storage_path", "is", null)
        .order("analysis_priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(limit);

      if (fetchError) throw fetchError;

      if (!pendingJobs || pendingJobs.length === 0) {
        return new Response(JSON.stringify({ 
          ok: true, 
          processed: 0, 
          failed: 0,
          message: "No pending jobs with audio found" 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`📋 Found ${pendingJobs.length} pending jobs`);

      // Mark jobs as processing
      const attemptIds = pendingJobs.map(j => j.attempt_id);
      await supabase
        .from("utterance_analyses")
        .update({ 
          analysis_status: "processing", 
          locked_at: new Date().toISOString(),
          locked_by: "pipeline-ops-azure"
        })
        .in("attempt_id", attemptIds);

      let processed = 0;
      let failed = 0;

      // Process each job
      for (const job of pendingJobs) {
        try {
          // Download audio from storage
          const { data: audioData, error: downloadError } = await supabase
            .storage
            .from("session-recordings")
            .download(job.audio_storage_path!);

          if (downloadError) {
            console.error(`❌ Failed to download audio for ${job.attempt_id}:`, downloadError);
            await markJobFailed(supabase, job.attempt_id, `Download error: ${downloadError.message}`);
            failed++;
            continue;
          }

          // Convert to base64
          const arrayBuffer = await audioData.arrayBuffer();
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

          // Call analyze-pronunciation function
          const azureKey = Deno.env.get("AZURE_SPEECH_KEY");
          const azureRegion = Deno.env.get("AZURE_SPEECH_REGION");

          if (!azureKey || !azureRegion) {
            console.error("❌ Azure credentials not configured");
            await markJobFailed(supabase, job.attempt_id, "Azure credentials not configured");
            failed++;
            continue;
          }

          // Call Azure Speech API directly
          const referenceText = job.target_word || job.transcript || "";
          const pronunciationResponse = await callAzurePronunciation(
            base64Audio,
            referenceText,
            azureKey,
            azureRegion
          );

          if (!pronunciationResponse.ok) {
            console.error(`❌ Azure API error for ${job.attempt_id}:`, pronunciationResponse.error);
            await markJobFailed(supabase, job.attempt_id, pronunciationResponse.error || "Unknown Azure error");
            failed++;
            continue;
          }

          // Update job with results
          const { error: updateError } = await supabase
            .from("utterance_analyses")
            .update({
              analysis_status: "complete",
              alignment_data: pronunciationResponse.alignmentData,
              gop_data: pronunciationResponse.gopData,
              locked_at: null,
              locked_by: null,
              updated_at: new Date().toISOString(),
            })
            .eq("attempt_id", job.attempt_id);

          if (updateError) {
            console.error(`❌ Failed to update ${job.attempt_id}:`, updateError);
            failed++;
          } else {
            processed++;
            console.log(`✅ Processed ${job.attempt_id}`);
          }
        } catch (e) {
          console.error(`❌ Error processing ${job.attempt_id}:`, e);
          await markJobFailed(supabase, job.attempt_id, e instanceof Error ? e.message : "Unknown error");
          failed++;
        }
      }

      console.log(`✅ Finished: ${processed} processed, ${failed} failed`);
      return new Response(JSON.stringify({ 
        ok: true, 
        processed, 
        failed,
        message: `Processed ${processed} jobs, ${failed} failed`
      }), {
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

// Helper: Mark job as failed with error message
async function markJobFailed(supabase: any, attemptId: string, errorMessage: string) {
  await supabase
    .from("utterance_analyses")
    .update({
      analysis_status: "failed",
      error_message: errorMessage,
      retry_count: 5, // Mark as permanently failed
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("attempt_id", attemptId);
}

// Helper: Call Azure Pronunciation Assessment API
async function callAzurePronunciation(
  base64Audio: string,
  referenceText: string,
  azureKey: string,
  azureRegion: string
): Promise<{ ok: boolean; alignmentData?: any; gopData?: any; error?: string }> {
  try {
    // Decode base64 to binary
    const audioBytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));

    // Build pronunciation assessment config
    const assessmentConfig = {
      referenceText,
      gradingSystem: "HundredMark",
      granularity: "Phoneme",
      dimension: "Comprehensive",
      enableMiscue: true,
    };

    const configBase64 = btoa(JSON.stringify(assessmentConfig));

    const response = await fetch(
      `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": azureKey,
          "Content-Type": "audio/wav",
          "Pronunciation-Assessment": configBase64,
          "Accept": "application/json",
        },
        body: audioBytes,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: `Azure API ${response.status}: ${errorText}` };
    }

    const result = await response.json();

    // Parse Azure response into our format
    const nBest = result.NBest?.[0];
    if (!nBest) {
      return { ok: false, error: "No recognition result from Azure" };
    }

    const alignmentData = {
      transcript: nBest.Display || nBest.Lexical || "",
      confidence: nBest.Confidence || 0,
      word_segments: nBest.Words?.map((w: any) => ({
        word: w.Word,
        start_time: w.Offset / 10000000, // Convert 100ns units to seconds
        end_time: (w.Offset + w.Duration) / 10000000,
        confidence: w.PronunciationAssessment?.AccuracyScore / 100 || 0,
      })) || [],
    };

    const gopData = {
      source: "azure",
      overallScore: nBest.PronunciationAssessment?.PronScore || 0,
      accuracyScore: nBest.PronunciationAssessment?.AccuracyScore || 0,
      fluencyScore: nBest.PronunciationAssessment?.FluencyScore || 0,
      completenessScore: nBest.PronunciationAssessment?.CompletenessScore || 0,
      words: nBest.Words?.map((w: any) => ({
        word: w.Word,
        accuracyScore: w.PronunciationAssessment?.AccuracyScore || 0,
        errorType: w.PronunciationAssessment?.ErrorType || "None",
        phonemes: w.Phonemes?.map((p: any) => ({
          phoneme: p.Phoneme,
          accuracyScore: p.PronunciationAssessment?.AccuracyScore || 0,
        })) || [],
      })) || [],
    };

    return { ok: true, alignmentData, gopData };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
