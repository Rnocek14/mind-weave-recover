import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthedUser } from "../_shared/auth.ts";
import { detectCrisis, crisisSafetyMessage } from "../_shared/crisisDetection.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a warm conversation partner helping someone practice speaking after a stroke.

#1 THE FLOOR RULE (MOST IMPORTANT - NEVER BREAK):
Every response MUST end with an invitation to continue. NEVER leave user with nothing to say.

DEAD-END (WRONG): "Worked out! That's good." (user stuck)
WITH FLOOR (RIGHT): "Worked out! Nice. At home or the gym?" (easy to answer)

DEAD-END (WRONG): "Mm-hmm, coffee. Good stuff." (nowhere to go)
WITH FLOOR (RIGHT): "Mm-hmm, coffee. Hot or iced?" (binary choice)

QUICK FLOORS: "And then?" "Was it good?" "At home or out?" "Morning or night?"

ABSOLUTE RULES:
1. MAXIMUM 20 WORDS per response. Count them. Never exceed.
2. NEVER say "I'm an AI" or mention being artificial.
3. ONE simple question or choice only. No compound questions.
4. Use 3rd-grade vocabulary only.
5. EVERY response must end with a floor (question, choice, or "and then?")

Your style:
- Warm but brief, like texting a friend
- Acknowledge what they said in 2-5 words
- Then give them a floor (question or easy choice)

Format: "[Brief acknowledgment]. [Floor - question or choice]?"

Examples:
User: "I had eggs"
You: "Eggs, yum! Scrambled or fried?"

User: "my son came over"
You: "That's nice! What did you do?"

User: "worked out"
You: "Worked out, nice! At home or the gym?"

User: "um... the... thing..."
You: "No rush. What thing?"

User: (silence or very short)
You: "Take your time. Something you ate? Or did?"

NEVER:
- End without a floor (no dead-ends like "That's good.")
- Use more than 20 words
- Ask "how did that make you feel?"
- Give advice or information
- Say "that's wonderful" or "how lovely" (too formal)
- Mention being an AI or program`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require an authenticated caller — this endpoint spends the app's paid
    // AI-gateway credits and processes patient speech. Without this, anyone
    // with the public anon key could invoke it (cost abuse + prompt injection).
    const caller = await getAuthedUser(req);
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userTranscript, turnNumber, maxTurns, conversationHistory, cardContext } = await req.json();

    // Safety gate — BEFORE the LLM. If the user expresses self-harm intent or an
    // acute medical/stroke emergency, break the conversational loop and return a
    // fixed safety message with emergency guidance instead of a cheerful
    // follow-up question. Flagged so the client can halt the session.
    const crisis = detectCrisis(userTranscript);
    if (crisis.isCrisis && crisis.kind) {
      return new Response(
        JSON.stringify({
          response: crisisSafetyMessage(crisis.kind),
          followupType: 'crisis',
          crisis: true,
          crisisKind: crisis.kind,
          endSession: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Lovable AI gateway
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          response: "Tell me more.",
          followupType: 'contextual'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // System prompt is fixed server-side. It must NOT be caller-supplied —
    // a client-provided prompt would let a caller override the therapy
    // guardrails and turn this into an arbitrary LLM proxy.
    const systemPrompt = SYSTEM_PROMPT;

    // Build conversation context
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.slice(-6).forEach((turn: { role: string; text: string }) => {
        messages.push({
          role: turn.role === 'ai' ? 'assistant' : 'user',
          content: turn.text
        });
      });
    }

    // Add card context if available (what happened in an exercise card)
    if (cardContext) {
      messages.push({
        role: 'system',
        content: `Context: User just did a quick exercise and said "${cardContext.response}" (${cardContext.cardType}). Acknowledge this briefly and continue the conversation.`
      });
    }

    // Add current user message
    const userMessage = userTranscript?.trim() || "(silence)";
    messages.push({ role: 'user', content: userMessage });

    // No forced wrap-up hints - user ends when ready

    console.log(`Turn ${turnNumber}/${maxTurns}: "${userTranscript?.slice(0, 50)}..."`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limited', response: "Go on..." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required', response: "Tell me more." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ response: "Interesting! What else?" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let aiResponse = data.choices?.[0]?.message?.content?.trim() || 'Tell me more.';
    
    // Enforce word limit - truncate if over 25 words
    const words = aiResponse.split(/\s+/);
    if (words.length > 25) {
      // Find the last question mark within limit, or just cut
      const truncated = words.slice(0, 20).join(' ');
      const lastQuestion = truncated.lastIndexOf('?');
      if (lastQuestion > 10) {
        aiResponse = truncated.slice(0, lastQuestion + 1);
      } else {
        aiResponse = truncated + '?';
      }
      console.log('Truncated long response to:', aiResponse);
    }
    
    console.log('AI response:', aiResponse);

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        followupType: turnNumber >= maxTurns - 1 ? 'wrap_up' : 'contextual'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in conversation-partner:', error);
    return new Response(
      JSON.stringify({ 
        response: "What else?"
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
