import { AzureSpeechResponseError, parseAzureSpeechResponse } from "./response.ts";
import { AzureAudioValidationError, buildAzureSpeechRequest, decodeAudioBase64 } from "../_shared/azureSpeechRequest.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthedUser } from "../_shared/auth.ts";
import { checkRateLimit, rateLimitedResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// A speech trial is seconds of audio; 10MB of base64 (~7.5MB binary) is far
// beyond any legitimate recording and bounds per-request Azure spend.
const MAX_AUDIO_BASE64_LENGTH = 10_000_000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate the caller's Supabase JWT in code — verify_jwt alone accepts the
  // anon key shipped in every browser bundle, which left this paid Azure STT
  // endpoint open to anyone. Mirrors analyze-pronunciation.
  const caller = await getAuthedUser(req);
  if (!caller) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Paid Azure STT call per trial — bound per-user throughput.
  const rate = await checkRateLimit(caller.id, 'speech_analysis', 600);
  if (!rate.allowed) return rateLimitedResponse(corsHeaders);

  try {
    const { audioBlob, mimeType } = await req.json();

    if (!audioBlob) {
      throw new AzureAudioValidationError('No audio data provided');
    }

    if (typeof audioBlob !== 'string' || audioBlob.length > MAX_AUDIO_BASE64_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'Audio payload too large' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
    const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION');
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      throw new Error('AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not configured');
    }

    // Convert base64 to binary
    const binaryAudio = decodeAudioBase64(audioBlob);

    // Check minimum audio size (rough estimate: ~0.1s of audio is ~1-2KB minimum)
    const minAudioBytes = 500;
    if (binaryAudio.length < minAudioBytes) {
      console.warn(`Audio too short: ${binaryAudio.length} bytes (minimum ${minAudioBytes})`);
      return new Response(
        JSON.stringify({
          transcript: '',
          confidence: null,
          acousticMetrics: null,
          warning: 'audio_too_short',
          message: 'Recording was too short to analyze. Please try speaking for at least 1 second.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const azureRequest = buildAzureSpeechRequest({
      region: AZURE_SPEECH_REGION, key: AZURE_SPEECH_KEY,
      audio: binaryAudio, mimeType,
    });
    console.log(`[analyze-speech] Sending ${binaryAudio.length} bytes to Azure STT...`);
    const azureResponse = await fetch(azureRequest.url, azureRequest.init);

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error('[analyze-speech] Azure STT error:', azureResponse.status, errorText);
      return new Response(JSON.stringify({
        error: { stage: 'azure_api', message: `Azure STT failed (${azureResponse.status}).` },
        fallback: true,
        warning: azureResponse.status === 429 ? 'rate_limited' : 'service_unavailable',
      }), {
        status: azureResponse.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let azureData: unknown;
    try { azureData = await azureResponse.json(); }
    catch { throw new AzureSpeechResponseError('Azure speech response is not valid JSON.'); }
    const result = parseAzureSpeechResponse(azureData);
    console.log('[analyze-speech] Azure response normalized', {
      confidence: result.confidence, wordCount: result.acousticMetrics?.wordCount ?? null,
      timingAvailable: result.acousticMetrics?.pauseCount !== null && result.acousticMetrics !== null,
    });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-speech:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error',
        stage: error instanceof AzureAudioValidationError ? 'validation' : error instanceof AzureSpeechResponseError ? error.stage : 'unexpected',
      }),
      {
        status: error instanceof AzureAudioValidationError ? 400 : error instanceof AzureSpeechResponseError ? 502 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
