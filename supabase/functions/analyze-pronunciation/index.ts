import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthedUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NBestPhoneme {
  phoneme: string;
  score: number;
}

interface PronunciationPhoneme {
  phoneme: string;
  accuracyScore: number;
  duration: number;
  nbestPhonemes?: NBestPhoneme[];
}

interface PronunciationWord {
  word: string;
  accuracyScore: number;
  errorType: string;
  phonemes: PronunciationPhoneme[];
}

// Alignment data format compatible with micro-fluency analyzer
interface AlignmentData {
  word_segments: { word: string; start: number; end: number }[];
  phone_segments: { phone: string; start: number; end: number }[];
}

interface PronunciationData {
  transcript: string;
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore?: number;
  words: PronunciationWord[];
  duration: number;
  alignmentData?: AlignmentData;
}

// Structured response types - explicit ok/error for bulletproof client handling
interface SuccessResponse {
  ok: true;
  data: PronunciationData;
}

interface ErrorResponse {
  ok: false;
  error: {
    stage: 'auth' | 'validation' | 'azure_api' | 'parse' | 'unexpected';
    message: string;
    details?: Record<string, unknown>;
  };
}

type ApiResponse = SuccessResponse | ErrorResponse;

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
    
    if (!audioBlob) {
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
    
    if (!referenceText) {
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
    const binaryAudio = Uint8Array.from(atob(audioBlob), c => c.charCodeAt(0));
    
    // Determine content type for Azure
    const contentType = mimeType?.includes('webm') 
      ? 'audio/webm; codecs=opus'
      : mimeType?.includes('mp4')
      ? 'audio/mp4'
      : 'audio/wav';

    // Build pronunciation assessment config
    // NBestPhonemeCount enables spoken phoneme alternatives for substitution detection
    const pronunciationConfig = {
      referenceText: referenceText,
      gradingSystem: "HundredMark",
      granularity: "Phoneme",
      dimension: "Comprehensive",
      enableMiscue: true,
      enableProsodyAssessment: true,
      NBestPhonemeCount: 5,  // Request top 5 phoneme candidates per phoneme
    };

    const configBase64 = btoa(JSON.stringify(pronunciationConfig));

    // Call Azure Speech-to-Text with Pronunciation Assessment
    const azureUrl = `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;

    console.log('[analyze-pronunciation] Calling Azure API', { 
      pronRequestId, 
      url: azureUrl,
      audioSize: binaryAudio.length 
    });

    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': contentType,
        'Pronunciation-Assessment': configBase64,
        'Accept': 'application/json',
      },
      body: binaryAudio,
    });

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

    const azureData = await response.json();
    
    // TEMPORARY: Log sample phoneme structure for NBest schema discovery
    // Gate behind env flag to avoid log spam in prod
    const LOG_SAMPLE = Deno.env.get('LOG_AZURE_PA_SAMPLE') === 'true';
    if (LOG_SAMPLE && azureData.NBest?.[0]?.Words?.length > 0) {
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
      hasNBest: !!azureData.NBest,
      recognitionStatus: azureData.RecognitionStatus
    });

    // Check for recognition failures
    if (azureData.RecognitionStatus !== 'Success') {
      console.warn('[analyze-pronunciation] Recognition not successful', { 
        pronRequestId, 
        status: azureData.RecognitionStatus 
      });
      const errorResponse: ErrorResponse = {
        ok: false,
        error: { 
          stage: 'azure_api', 
          message: `Recognition failed: ${azureData.RecognitionStatus}`,
          details: { recognitionStatus: azureData.RecognitionStatus }
        }
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 200, // Still return 200 since Azure worked, just no speech recognized
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse Azure response
    const result = parseAzureResponse(azureData, referenceText);

    console.log('[analyze-pronunciation] Success', { 
      pronRequestId,
      pronunciationScore: result.pronunciationScore,
      accuracyScore: result.accuracyScore,
      wordCount: result.words.length
    });

    const successResponse: SuccessResponse = {
      ok: true,
      data: result
    };

    return new Response(
      JSON.stringify(successResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[analyze-pronunciation] Unexpected error', { 
      pronRequestId, 
      error: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
    const errorResponse: ErrorResponse = {
      ok: false,
      error: { 
        stage: 'unexpected', 
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function parseAzureResponse(azureData: any, referenceText: string): PronunciationData {
  // Handle Azure response - scores are directly on NBest[0], not under PronunciationAssessment
  const nBest = azureData.NBest?.[0];
  const displayText = nBest?.Display || azureData.DisplayText || '';
  const duration = (azureData.Duration || 0) / 10000000; // Convert from 100-nanosecond units to seconds

  // Azure returns scores directly on nBest: AccuracyScore, FluencyScore, PronScore, etc.
  if (!nBest || (nBest.AccuracyScore === undefined && nBest.PronScore === undefined)) {
    console.warn('[analyze-pronunciation] No pronunciation scores in response');
    return {
      transcript: displayText || referenceText,
      pronunciationScore: 0,
      accuracyScore: 0,
      fluencyScore: 0,
      completenessScore: 0,
      prosodyScore: 0,
      words: [],
      duration
    };
  }

  // Extract word-level data - scores are directly on word objects
  const words: PronunciationWord[] = [];
  const azureWords = nBest?.Words || [];
  
  // Build alignment data from Azure timing (Offset/Duration in 100-nanosecond units)
  const wordSegments: { word: string; start: number; end: number }[] = [];
  const phoneSegments: { phone: string; start: number; end: number }[] = [];

  for (const w of azureWords) {
    const phonemes: PronunciationPhoneme[] = [];
    
    // Convert Azure timing to seconds for alignment
    const wordStart = (w.Offset || 0) / 10000000;
    const wordEnd = wordStart + ((w.Duration || 0) / 10000000);
    
    wordSegments.push({
      word: w.Word || '',
      start: wordStart,
      end: wordEnd
    });

    // Extract phoneme data - scores are directly on phoneme objects
    if (w.Phonemes) {
      for (const p of w.Phonemes) {
        const phoneStart = (p.Offset || 0) / 10000000;
        const phoneEnd = phoneStart + ((p.Duration || 0) / 10000000);
        
        // Extract NBest phoneme candidates (what was actually spoken)
        // Azure returns these when NBestPhonemeCount > 0 in config
        const nbestPhonemes: NBestPhoneme[] | undefined = p.NBestPhonemes?.map(
          (nb: any) => ({ phoneme: nb.Phoneme || '', score: nb.Score ?? 0 })
        );
        
        phonemes.push({
          phoneme: p.Phoneme || '',
          accuracyScore: p.AccuracyScore || 0,
          duration: (p.Duration || 0) / 10000000,
          ...(nbestPhonemes && nbestPhonemes.length > 0 ? { nbestPhonemes } : {}),
        });
        
        phoneSegments.push({
          phone: p.Phoneme || '',
          start: phoneStart,
          end: phoneEnd
        });
      }
    }

    words.push({
      word: w.Word || '',
      accuracyScore: w.AccuracyScore || 0,
      errorType: w.ErrorType || 'None',
      phonemes,
    });
  }
  
  // Build alignment data if we have timing info
  const alignmentData: AlignmentData | undefined = wordSegments.length > 0 
    ? { word_segments: wordSegments, phone_segments: phoneSegments }
    : undefined;

  console.log('[analyze-pronunciation] Parsed scores', {
    pronunciationScore: nBest.PronScore,
    accuracyScore: nBest.AccuracyScore,
    fluencyScore: nBest.FluencyScore,
    wordCount: words.length,
    hasAlignment: !!alignmentData
  });

  return {
    transcript: displayText,
    pronunciationScore: nBest.PronScore || 0,
    accuracyScore: nBest.AccuracyScore || 0,
    fluencyScore: nBest.FluencyScore || 0,
    completenessScore: nBest.CompletenessScore || 0,
    prosodyScore: nBest.ProsodyScore,
    words,
    duration,
    alignmentData
  };
}