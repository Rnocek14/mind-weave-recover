import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Azure ticks are 100-nanosecond units. 10,000,000 ticks = 1 second.
const TICKS_PER_SECOND = 10_000_000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBlob, mimeType } = await req.json();

    if (!audioBlob) {
      throw new Error('No audio data provided');
    }

    const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
    const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION');
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      throw new Error('AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not configured');
    }

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audioBlob), c => c.charCodeAt(0));

    // Check minimum audio size (rough estimate: ~0.1s of audio is ~1-2KB minimum)
    const minAudioBytes = 500;
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine content type for Azure (matches analyze-pronunciation)
    const resolvedMime = (mimeType || 'audio/webm').toLowerCase();
    const contentType = resolvedMime.includes('webm')
      ? 'audio/webm; codecs=opus'
      : resolvedMime.includes('mp4') || resolvedMime.includes('m4a') || resolvedMime.includes('aac')
      ? 'audio/mp4'
      : resolvedMime.includes('ogg') || resolvedMime.includes('opus')
      ? 'audio/ogg; codecs=opus'
      : 'audio/wav';

    // Azure Speech-to-Text, detailed format gives confidence + word-level timing.
    const azureUrl = `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;

    console.log(`[analyze-speech] Sending ${binaryAudio.length} bytes to Azure STT...`);

    const azureResponse = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': contentType,
        'Accept': 'application/json',
      },
      body: binaryAudio,
    });

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error('[analyze-speech] Azure STT error:', azureResponse.status, errorText);

      // Rate limit / server errors → graceful fallback to browser recognition.
      if (azureResponse.status === 429 || azureResponse.status >= 500) {
        return new Response(
          JSON.stringify({
            transcript: '',
            confidence: 0,
            acousticMetrics: null,
            fallback: true,
            warning: azureResponse.status === 429 ? 'rate_limited' : 'service_unavailable',
            message: 'Speech service is temporarily busy. Your browser speech recognition will be used instead.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          transcript: '',
          confidence: 0,
          acousticMetrics: null,
          fallback: true,
          warning: 'stt_rejected',
          message: 'Speech analysis unavailable for this clip. Falling back to browser recognition.',
          detail: errorText.slice(0, 300),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const azureData = await azureResponse.json();
    const recognitionStatus = azureData.RecognitionStatus;

    // No speech recognized → empty transcript (validity gate handles classification).
    if (recognitionStatus && recognitionStatus !== 'Success') {
      const durationMsNoSpeech = Math.round(((azureData.Duration ?? 0) / TICKS_PER_SECOND) * 1000);
      const validity = classifyUtteranceValidity({
        transcript: '',
        asrConfidence: 0,
        recordingDurationMs: durationMsNoSpeech,
        acousticMetrics: null,
      });
      return new Response(
        JSON.stringify({
          transcript: '',
          confidence: 0,
          acousticMetrics: null,
          validity,
          rawWhisperData: azureData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const best = azureData.NBest?.[0] ?? null;
    const transcript = (best?.Display ?? azureData.DisplayText ?? '').trim();
    const confidence = typeof best?.Confidence === 'number' ? best.Confidence : 0;
    const totalDurationSec = (azureData.Duration ?? 0) / TICKS_PER_SECOND;

    const acousticMetrics = calculateAcousticMetrics(best?.Words ?? [], totalDurationSec, transcript);

    // Speech Validity Gate (Phase 1) — classify before scoring
    const recordingDurationMs = Math.round(totalDurationSec * 1000);
    const validity = classifyUtteranceValidity({
      transcript,
      asrConfidence: confidence,
      recordingDurationMs,
      acousticMetrics: {
        speechToPauseRatio: acousticMetrics.speechToPauseRatio,
        speechRateWpm: acousticMetrics.speechRateWpm,
      },
    });

    return new Response(
      JSON.stringify({
        transcript,
        confidence,
        acousticMetrics,
        validity,
        rawWhisperData: azureData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

// Calculate acoustic metrics from Azure word-level timing (Offset/Duration in ticks).
function calculateAcousticMetrics(words: any[], duration: number, text: string): any {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const speechRate = duration > 0 ? (wordCount / duration) * 60 : 0;

  // Pauses = gaps between consecutive words.
  const pauses: number[] = [];
  for (let i = 1; i < words.length; i++) {
    const prevEnd = (words[i - 1].Offset + words[i - 1].Duration) / TICKS_PER_SECOND;
    const curStart = words[i].Offset / TICKS_PER_SECOND;
    const pauseDuration = curStart - prevEnd;
    if (pauseDuration > 0.1) {
      pauses.push(pauseDuration);
    }
  }

  const avgPauseDuration = pauses.length > 0
    ? pauses.reduce((a, b) => a + b, 0) / pauses.length
    : 0;
  const totalPauseDuration = pauses.reduce((a, b) => a + b, 0);

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
    segmentCount: words.length,
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
