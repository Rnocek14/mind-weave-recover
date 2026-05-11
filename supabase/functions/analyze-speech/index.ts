import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBlob, mimeType } = await req.json();
    
    if (!audioBlob) {
      throw new Error('No audio data provided');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audioBlob), c => c.charCodeAt(0));
    
    // Check minimum audio size (rough estimate: 0.1s of audio at typical bitrates is ~1-2KB minimum)
    const minAudioBytes = 500; // Very conservative minimum
    if (binaryAudio.length < minAudioBytes) {
      console.warn(`Audio too short: ${binaryAudio.length} bytes (minimum ${minAudioBytes})`);
      return new Response(
        JSON.stringify({
          transcript: '',
          confidence: 0,
          acousticMetrics: null,
          warning: 'audio_too_short',
          message: 'Recording was too short to analyze. Please try speaking for at least 1 second.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Prepare form data for Whisper — derive extension from mimeType so Whisper
    // accepts the file (it validates by filename extension, not bytes).
    const resolvedMime = (mimeType || 'audio/webm').toLowerCase();
    const extFromMime = (() => {
      if (resolvedMime.includes('webm')) return 'webm';
      if (resolvedMime.includes('ogg') || resolvedMime.includes('opus')) return 'ogg';
      if (resolvedMime.includes('wav') || resolvedMime.includes('wave') || resolvedMime.includes('x-pcm')) return 'wav';
      if (resolvedMime.includes('mp4') || resolvedMime.includes('m4a') || resolvedMime.includes('aac')) return 'mp4';
      if (resolvedMime.includes('mpeg') || resolvedMime.includes('mp3')) return 'mp3';
      if (resolvedMime.includes('flac')) return 'flac';
      return 'webm';
    })();
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: resolvedMime });
    formData.append('file', blob, `audio.${extFromMime}`);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json'); // Get word-level timestamps

    console.log(`Sending ${binaryAudio.length} bytes to Whisper API...`);

    // Call OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', whisperResponse.status, errorText);
      
      // Handle rate limit (429) and server errors (5xx) gracefully
      if (whisperResponse.status === 429 || whisperResponse.status >= 500) {
        return new Response(
          JSON.stringify({
            transcript: '',
            confidence: 0,
            acousticMetrics: null,
            fallback: true,
            warning: whisperResponse.status === 429 ? 'rate_limited' : 'service_unavailable',
            message: 'Speech service is temporarily busy. Your browser speech recognition will be used instead.',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      // Handle specific Whisper errors gracefully
      if (errorText.includes('audio_too_short')) {
        return new Response(
          JSON.stringify({
            transcript: '',
            confidence: 0,
            acousticMetrics: null,
            warning: 'audio_too_short',
            message: 'Recording was too short to analyze. Please try speaking for at least 1 second.',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      throw new Error(`Whisper API error: ${whisperResponse.status}`);
    }

    const whisperData = await whisperResponse.json();
    
    // Calculate acoustic metrics
    const acousticMetrics = calculateAcousticMetrics(whisperData);
    const confidence = calculateOverallConfidence(whisperData);

    // Speech Validity Gate (Phase 1) — classify before scoring
    const recordingDurationMs = Math.round((whisperData.duration ?? 0) * 1000);
    const validity = classifyUtteranceValidity({
      transcript: whisperData.text,
      asrConfidence: confidence,
      recordingDurationMs,
      acousticMetrics: {
        speechToPauseRatio: acousticMetrics.speechToPauseRatio,
        speechRateWpm: acousticMetrics.speechRateWpm,
      },
    });

    return new Response(
      JSON.stringify({
        transcript: whisperData.text,
        confidence,
        acousticMetrics,
        validity,
        rawWhisperData: whisperData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in analyze-speech:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function calculateOverallConfidence(whisperData: any): number {
  // Whisper doesn't provide word-level confidence in standard API
  // Use duration and segment count as proxy for confidence
  if (!whisperData.segments || whisperData.segments.length === 0) {
    return 0;
  }
  
  // Higher segment count relative to duration suggests clearer speech
  const avgSegmentDuration = whisperData.duration / whisperData.segments.length;
  
  // Typical clear speech has segments of 2-4 seconds
  // Too short = fragmented, too long = mumbled
  if (avgSegmentDuration >= 2 && avgSegmentDuration <= 4) {
    return 0.9;
  } else if (avgSegmentDuration >= 1 && avgSegmentDuration <= 6) {
    return 0.7;
  }
  
  return 0.5;
}

function calculateAcousticMetrics(whisperData: any): any {
  const segments = whisperData.segments || [];
  const duration = whisperData.duration || 0;
  const text = whisperData.text || '';
  
  // Calculate speech rate (words per minute)
  const wordCount = text.trim().split(/\s+/).length;
  const speechRate = duration > 0 ? (wordCount / duration) * 60 : 0;
  
  // Calculate pause patterns
  const pauses: number[] = [];
  for (let i = 1; i < segments.length; i++) {
    const pauseDuration = segments[i].start - segments[i - 1].end;
    if (pauseDuration > 0.1) { // Only count pauses > 100ms
      pauses.push(pauseDuration);
    }
  }
  
  const avgPauseDuration = pauses.length > 0 
    ? pauses.reduce((a, b) => a + b, 0) / pauses.length 
    : 0;
  
  const totalPauseDuration = pauses.reduce((a, b) => a + b, 0);
  
  // Calculate speech vs pause ratio
  const actualSpeechDuration = duration - totalPauseDuration;
  const speechToPauseRatio = totalPauseDuration > 0 
    ? actualSpeechDuration / totalPauseDuration 
    : actualSpeechDuration;
  
  return {
    speechRateWpm: Math.round(speechRate * 10) / 10,
    totalDurationSec: Math.round(duration * 10) / 10,
    wordCount,
    pauseCount: pauses.length,
    avgPauseDurationMs: Math.round(avgPauseDuration * 1000),
    totalPauseDurationSec: Math.round(totalPauseDuration * 10) / 10,
    speechToPauseRatio: Math.round(speechToPauseRatio * 100) / 100,
    segmentCount: segments.length,
  };
}

// ===== Speech Validity Gate (Phase 1) =====
// Mirrors src/lib/clinical/classifyUtteranceValidity.ts
// Edge functions cannot import from src/, so logic is duplicated here.
// Keep both files in sync.

const FILLER_TOKEN = /^(um+|uh+|hmm+|mm+|er+|ah+|eh+|oh+)$/i;
const MIN_VALID_DURATION_MS = 400;
const LOW_CONFIDENCE_THRESHOLD = 0.4;
const NOISE_SPEECH_RATIO = 0.2;

function isFillerOnly(transcript: string): boolean {
  const tokens = transcript
    .toLowerCase()
    .replace(/[.,!?;:"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => FILLER_TOKEN.test(t));
}

function classifyUtteranceValidity(input: {
  transcript?: string | null;
  asrConfidence?: number | null;
  recordingDurationMs?: number | null;
  acousticMetrics?: { speechToPauseRatio?: number | null; speechRateWpm?: number | null } | null;
}) {
  const transcriptRaw = (input.transcript ?? '').trim();
  const durationMs = Math.max(0, Math.round(input.recordingDurationMs ?? 0));
  const asrConfidence =
    typeof input.asrConfidence === 'number' && Number.isFinite(input.asrConfidence)
      ? input.asrConfidence
      : null;
  const speechToPauseRatio =
    typeof input.acousticMetrics?.speechToPauseRatio === 'number'
      ? input.acousticMetrics.speechToPauseRatio
      : null;

  const signals = {
    durationMs,
    trimmedTranscriptLength: transcriptRaw.length,
    asrConfidence,
    speechToPauseRatio,
    matchedFiller: false as boolean,
  };

  if (durationMs < MIN_VALID_DURATION_MS || transcriptRaw.length === 0) {
    if (
      durationMs >= MIN_VALID_DURATION_MS &&
      transcriptRaw.length === 0 &&
      speechToPauseRatio !== null &&
      speechToPauseRatio < NOISE_SPEECH_RATIO
    ) {
      return {
        validity: 'background_noise',
        reason: 'No transcribed speech; audio appears to be background noise.',
        confidence: 0.7,
        countsTowardScore: false,
        signals,
      };
    }
    return {
      validity: 'no_response',
      reason:
        durationMs < MIN_VALID_DURATION_MS
          ? `Recording too short (${durationMs}ms < ${MIN_VALID_DURATION_MS}ms).`
          : 'Empty transcript — no speech detected.',
      confidence: 0.9,
      countsTowardScore: false,
      signals,
    };
  }

  if (isFillerOnly(transcriptRaw)) {
    signals.matchedFiller = true;
    return {
      validity: 'filler_only',
      reason: 'Transcript contains only filler sounds (um/uh/hmm). Not a language attempt.',
      confidence: 0.85,
      countsTowardScore: false,
      signals,
    };
  }

  if (
    asrConfidence !== null &&
    asrConfidence < LOW_CONFIDENCE_THRESHOLD &&
    transcriptRaw.length < 3
  ) {
    return {
      validity: 'low_confidence',
      reason: `ASR confidence ${asrConfidence.toFixed(2)} below ${LOW_CONFIDENCE_THRESHOLD} on a very short transcript. Flagged for clinician review.`,
      confidence: 0.6,
      countsTowardScore: false,
      signals,
    };
  }

  return {
    validity: 'valid_attempt',
    reason: 'Patient produced a scorable speech attempt.',
    confidence: 0.9,
    countsTowardScore: true,
    signals,
  };
}
