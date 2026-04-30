import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAYA_DEFAULT_VOICE_ID = 'XrExE9yKIg1WjnnlVkGX'; // Matilda

// Mirror of src/lib/constants/voice.ts — keep in sync.
const VOICE_SETTINGS = {
  fast: {
    model_id: 'eleven_turbo_v2_5',
    stability: 0.55,
    similarity_boost: 0.8,
    style: 0.25,
    use_speaker_boost: true,
    speed: 0.95,
  },
  natural: {
    model_id: 'eleven_multilingual_v2',
    stability: 0.6,
    similarity_boost: 0.85,
    style: 0.35,
    use_speaker_boost: true,
    speed: 0.95,
  },
} as const;

type Mode = keyof typeof VOICE_SETTINGS;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const text: string | undefined = body?.text;
    const voiceId: string = body?.voiceId || MAYA_DEFAULT_VOICE_ID;
    const mode: Mode = (body?.mode === 'natural' ? 'natural' : 'fast');
    const previousText: string | undefined = body?.previousText;
    const nextText: string | undefined = body?.nextText;

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY_1') || Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      console.error('ELEVENLABS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'TTS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const settings = VOICE_SETTINGS[mode];
    console.log(`[TTS] mode=${mode} voice=${voiceId} text="${text.substring(0, 60)}..."`);

    const payload: Record<string, unknown> = {
      text,
      model_id: settings.model_id,
      voice_settings: {
        stability: settings.stability,
        similarity_boost: settings.similarity_boost,
        style: settings.style,
        use_speaker_boost: settings.use_speaker_boost,
        speed: settings.speed,
      },
    };
    if (previousText) payload.previous_text = previousText;
    if (nextText) payload.next_text = nextText;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);

      const isAuthOrBilling = response.status === 401 || response.status === 402;
      if (isAuthOrBilling) {
        return new Response(
          JSON.stringify({ error: 'TTS_BILLING_ISSUE', fallback: true, details: errorText }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'SERVICE_UNAVAILABLE', fallback: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Error in text-to-speech-stream:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
