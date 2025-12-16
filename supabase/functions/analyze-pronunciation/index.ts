import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PronunciationWord {
  word: string;
  accuracyScore: number;
  errorType: string;
  phonemes: {
    phoneme: string;
    accuracyScore: number;
    duration: number;
  }[];
}

interface PronunciationResult {
  transcript: string;
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore?: number;
  words: PronunciationWord[];
  duration: number;
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // Manual auth check - require Bearer token to prevent anonymous Azure API abuse
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized - Bearer token required' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  try {
    const { audioBlob, mimeType, referenceText } = await req.json();
    
    if (!audioBlob) {
      throw new Error('No audio data provided');
    }
    
    if (!referenceText) {
      throw new Error('No reference text provided');
    }

    const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
    const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION');
    
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      throw new Error('Azure Speech credentials not configured');
    }

    console.log('[analyze-pronunciation] Starting analysis for:', referenceText);

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audioBlob), c => c.charCodeAt(0));
    
    // Determine content type for Azure
    const contentType = mimeType?.includes('webm') 
      ? 'audio/webm; codecs=opus'
      : mimeType?.includes('mp4')
      ? 'audio/mp4'
      : 'audio/wav';

    // Build pronunciation assessment config
    const pronunciationConfig = {
      referenceText: referenceText,
      gradingSystem: "HundredMark",
      granularity: "Phoneme",
      dimension: "Comprehensive",
      enableMiscue: true,
      enableProsodyAssessment: true
    };

    const configBase64 = btoa(JSON.stringify(pronunciationConfig));

    // Call Azure Speech-to-Text with Pronunciation Assessment
    const azureUrl = `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;

    console.log('[analyze-pronunciation] Calling Azure API:', azureUrl);

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
      console.error('[analyze-pronunciation] Azure API error:', response.status, errorText);
      throw new Error(`Azure API error: ${response.status} - ${errorText}`);
    }

    const azureData = await response.json();
    console.log('[analyze-pronunciation] Azure response:', JSON.stringify(azureData, null, 2));

    // Parse Azure response
    const result = parseAzureResponse(azureData, referenceText);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[analyze-pronunciation] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        pronunciationScore: 0,
        accuracyScore: 0,
        fluencyScore: 0,
        completenessScore: 0,
        words: [],
        transcript: ''
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function parseAzureResponse(azureData: any, referenceText: string): PronunciationResult {
  // Handle different Azure response structures
  const nBest = azureData.NBest?.[0];
  const pronAssessment = nBest?.PronunciationAssessment || azureData.PronunciationAssessment;
  const displayText = nBest?.Display || azureData.DisplayText || '';
  const duration = (azureData.Duration || 0) / 10000000; // Convert from 100-nanosecond units to seconds

  if (!pronAssessment) {
    console.warn('[analyze-pronunciation] No pronunciation assessment in response');
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

  // Extract word-level data
  const words: PronunciationWord[] = [];
  const azureWords = nBest?.Words || azureData.Words || [];

  for (const w of azureWords) {
    const wordAssessment = w.PronunciationAssessment || {};
    const phonemes: { phoneme: string; accuracyScore: number; duration: number }[] = [];

    // Extract phoneme data if available
    if (w.Phonemes) {
      for (const p of w.Phonemes) {
        const phonemeAssessment = p.PronunciationAssessment || {};
        phonemes.push({
          phoneme: p.Phoneme || '',
          accuracyScore: phonemeAssessment.AccuracyScore || 0,
          duration: (p.Duration || 0) / 10000000, // Convert to seconds
        });
      }
    }

    words.push({
      word: w.Word || '',
      accuracyScore: wordAssessment.AccuracyScore || 0,
      errorType: wordAssessment.ErrorType || 'None',
      phonemes,
    });
  }

  return {
    transcript: displayText,
    pronunciationScore: pronAssessment.PronScore || pronAssessment.PronunciationScore || 0,
    accuracyScore: pronAssessment.AccuracyScore || 0,
    fluencyScore: pronAssessment.FluencyScore || 0,
    completenessScore: pronAssessment.CompletenessScore || 0,
    prosodyScore: pronAssessment.ProsodyScore,
    words,
    duration
  };
}
