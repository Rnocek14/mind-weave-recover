import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthedUser, jsonResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Smart Coach Turn — Thin Relay
 * 
 * Accepts { systemPrompt, messages } from the frontend coach engine.
 * Passes them INTACT to the AI gateway. No coaching logic. No truncation.
 * 
 * Transport-level guardrails only:
 * - Required field validation
 * - Max prompt/message sanity checks
 * - Timeout fallback
 * - Telemetry logging
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require a valid Supabase session — prevents anonymous AI-credit abuse.
    const caller = await getAuthedUser(req);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { systemPrompt, messages } = body;

    // --- Transport validation (no coaching logic) ---
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing systemPrompt', response: null }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or empty messages array', response: null }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanity caps — reject obviously malformed payloads
    if (systemPrompt.length > 15000) {
      console.warn(`[smart-coach-turn] systemPrompt too large: ${systemPrompt.length} chars`);
      return new Response(
        JSON.stringify({ error: 'systemPrompt exceeds 15000 chars', response: null }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (messages.length > 30) {
      console.warn(`[smart-coach-turn] Too many messages: ${messages.length}`);
      return new Response(
        JSON.stringify({ error: 'messages array exceeds 30 entries', response: null }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Build gateway payload ---
    const gatewayMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content: m.content,
      })),
    ];

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('[smart-coach-turn] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ response: null, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Telemetry ---
    const startMs = Date.now();
    console.log(`[smart-coach-turn] prompt=${systemPrompt.length}c messages=${messages.length}`);

    // --- Call AI gateway ---
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    let response: Response;
    try {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: gatewayMessages,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error('[smart-coach-turn] Request timed out after 25s');
        return new Response(
          JSON.stringify({ response: null, error: 'timeout' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[smart-coach-turn] Gateway ${response.status}: ${errorText}`);

      return new Response(
        JSON.stringify({ response: null, error: `gateway_${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content?.trim() || null;
    const elapsedMs = Date.now() - startMs;
    const wordCount = aiResponse ? aiResponse.split(/\s+/).length : 0;

    console.log(`[smart-coach-turn] ${elapsedMs}ms words=${wordCount}`);

    // --- Return raw response, no transformation ---
    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[smart-coach-turn] Unhandled:', error);
    return new Response(
      JSON.stringify({ response: null, error: 'internal' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
