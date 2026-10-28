import { parseAzurePronunciationResponse, pronunciationResponseStatus } from "./response.ts";
import { AzureAudioValidationError, buildAzureSpeechRequest, decodeAudioBase64 } from "../_shared/azureSpeechRequest.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthedUser } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Structured response types - explicit ok/error for bulletproof client handling
interface ErrorResponse {
  ok: false;
  error: {
    stage: 'auth' | 'validation' | 'azure_api' | 'parse' | 'unexpected';
    message: string;
    details?: Record<string, unknown>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint - explicitly require GET + /health path
  const url = new URL(req.url);
  if (req.method === 'GET' && url.pathname.endsWith('/health')) {
    const hasKey = !!Deno.env.get('AZURE_SPEECH_KEY');
    const hasRegion = !!Deno.env.get('AZURE_SPEECH_REGION');
    return new Response(
      JSON.stringify({ 
        ok: true, 
        configured: hasKey && hasRegion,
        hasKey,
        hasRegion,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Require POST for analysis
  if (req.method !== 'POST') {
    const response: ErrorResponse = {
      ok: false,
      error: { stage: 'validation', message: 'Method not allowed' }
    };
    return new Response(JSON.stringify(response), { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // Validate the caller's Supabase JWT — a bare "Bearer " prefix check is not
  // auth (any string passes). This endpoint spends the app's paid Azure Speech
  // key, so it must require a real authenticated user.
  const caller = await getAuthedUser(req);
  if (!caller) {
    const response: ErrorResponse = {
      ok: false,
      error: { stage: 'auth', message: 'Unauthorized' }
    };
    return new Response(JSON.stringify(response), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Paid Azure PA call per trial — bound per-user throughput.
  const rate = await checkRateLimit(caller.id, 'speech_analysis', 600);
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({ ok: false, error: { stage: 'rate_limit', message: 'RATE_LIMITED' } }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Extract correlation ID for logging
  let pronRequestId: string | undefined;

  try {
    const { audioBlob, mimeType, referenceText, pronRequestId: reqId } = await req.json();
    pronRequestId = reqId;
    
    console.log('[analyze-pronunciation] Request received', { 
      pronRequestId,
      hasAudio: !!audioBlob, 
      audioLen: audioBlob?.length,
      referenceText 
    });
    
    if (typeof audioBlob !== 'string' || !audioBlob) {
      const response: ErrorResponse = {
        ok: false,
        error: { stage: 'validation', message: 'No audio data provided' }
      };
      return new Response(JSON.stringify(response), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Guard: reject audio over 1MB base64 (~750KB binary ≈ ~23 seconds at 16kHz WAV)
    const MAX_BASE64_LEN = 1_400_000; // ~1MB binary
    if (audioBlob.length > MAX_BASE64_LEN) {
      console.warn('[analyze-pronunciation] Audio too large, rejecting', { 
        pronRequestId, audioLen: audioBlob.length, maxLen: MAX_BASE64_LEN 
      });
      const response: ErrorResponse = {
        ok: false,
        error: { stage: 'validation', message: `Audio too large (${(audioBlob.length / 1_000_000).toFixed(1)}MB). Max ~1MB. Please record a shorter clip.` }
      };
      return new Response(JSON.stringify(response), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (typeof referenceText !== 'string' || !referenceText.trim()) {
      const response: ErrorResponse = {
        ok: false,
        error: { stage: 'validation', message: 'No reference text provided' }
      };
      return new Response(JSON.stringify(response), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
    const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION');
    
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      console.error('[analyze-pronunciation] Azure credentials not configured', { pronRequestId });
      const response: ErrorResponse = {
        ok: false,
        error: { stage: 'azure_api', message: 'Azure Speech credentials not configured' }
      };
      return new Response(JSON.stringify(response), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('[analyze-pronunciation] Starting Azure API call', { pronRequestId, referenceText });

    // Convert base64 to binary
    const binaryAudio = decodeAudioBase64(audioBlob);
    
    const azureRequest = buildAzureSpeechRequest({
      region: AZURE_SPEECH_REGION, key: AZURE_SPEECH_KEY,
      audio: binaryAudio, mimeType, referenceText,
    });
    console.log('[analyze-pronunciation] Calling Azure API', {
      pronRequestId, url: azureRequest.url, audioSize: binaryAudio.length,
    });
    const response = await fetch(azureRequest.url, azureRequest.init);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyze-pronunciation] Azure API error', { 
        pronRequestId, 
        status: response.status, 
        error: errorText 
      });
      const errorResponse: ErrorResponse = {
        ok: false,
        error: { 
          stage: 'azure_api', 
          message: `Azure API error: ${response.status}`,
          details: { statusCode: response.status, body: errorText }
        }
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let azureData;
    try { azureData = await response.json(); }
    catch {
      return new Response(JSON.stringify({ ok: false, error: {
        stage: 'parse', message: 'Azure pronunciation response is not valid JSON.',
      } }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // TEMPORARY: Log sample phoneme structure for NBest schema discovery
    // Gate behind env flag to avoid log spam in prod
    const LOG_SAMPLE = Deno.env.get('LOG_AZURE_PA_SAMPLE') === 'true';
    if (LOG_SAMPLE && azureData?.NBest?.[0]?.Words?.[0]) {
      const sampleWord = azureData.NBest[0].Words[0];
      console.log('[analyze-pronunciation] SAMPLE_PHONEME_STRUCTURE', JSON.stringify({
        pronRequestId,
        wordShape: {
          Word: sampleWord.Word,
          AccuracyScore: sampleWord.AccuracyScore,
          ErrorType: sampleWord.ErrorType,
          // Capture first phoneme's full structure
          firstPhoneme: sampleWord.Phonemes?.[0] ?? null,
          phonemeCount: sampleWord.Phonemes?.length ?? 0,
        },
        configUsed: {
          granularity: 'Phoneme',
          dimension: 'Comprehensive',
          enableMiscue: true,
          NBestPhonemeCount: 5,
        },
      }, null, 2));
    }
    
    console.log('[analyze-pronunciation] Azure response received', { 
      pronRequestId,
      hasNBest: !!azureData?.NBest,
      recognitionStatus: azureData?.RecognitionStatus
    });

    const result = parseAzurePronunciationResponse(azureData);
    if (result.ok === true) {
      console.log('[analyze-pronunciation] Success', {
        pronRequestId, pronunciationScore: result.data.pronunciationScore,
        accuracyScore: result.data.accuracyScore, wordCount: result.data.words.length,
      });
    }
    return new Response(JSON.stringify(result), {
      status: pronunciationResponseStatus(result),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[analyze-pronunciation] Unexpected error', { 
      pronRequestId, 
      error: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
    const errorResponse: ErrorResponse = {
      ok: false,
      error: { 
        stage: error instanceof AzureAudioValidationError ? 'validation' : 'unexpected',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
    return new Response(
      JSON.stringify(errorResponse),
      {
        status: error instanceof AzureAudioValidationError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
