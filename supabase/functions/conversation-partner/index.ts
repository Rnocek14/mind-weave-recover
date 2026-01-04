import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a supportive conversation partner helping someone practice speaking after a stroke.

Your job is to:
1. Acknowledge what they said briefly and naturally
2. Ask ONE simple follow-up question to keep them talking

CRITICAL RULES:
- Keep your response SHORT (15-25 words max)
- Use simple, everyday words
- Ask about what they just said, not random topics
- If they said very little, ask something easier
- Never correct their speech or grammar
- Be warm but not patronizing
- End with ONE clear question

RESPONSE PATTERNS:
- They shared something: "That sounds [nice/interesting]. [Simple follow-up question about it]"
- They gave short answer: "[Brief acknowledgment]. What else about that?"
- They struggled: "Take your time. [Simpler question about same topic]"
- Wrap up (final turn): "Thanks for sharing. That was a nice chat."

Examples:
User: "I had eggs for breakfast"
Response: "Eggs, nice. Did you make them yourself?"

User: "my son visited"
Response: "That's lovely. What did you two do together?"

User: "um... I... the thing..."
Response: "No rush. Just tell me one small part."`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userTranscript, turnNumber, maxTurns, conversationHistory, mode } = await req.json();

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured', fallbackResponse: "Tell me more about that." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Force wrap_up on final turn
    if (turnNumber >= maxTurns) {
      console.log('Final turn - returning wrap_up');
      return new Response(
        JSON.stringify({ 
          followupType: 'wrap_up',
          response: "Thanks for sharing with me. That was a nice chat."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build conversation context
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.slice(-4).forEach((turn: { role: string; text: string }) => {
        messages.push({
          role: turn.role === 'ai' ? 'assistant' : 'user',
          content: turn.text
        });
      });
    }

    // Add current user message
    const userMessage = userTranscript?.trim() || "(silence)";
    messages.push({ role: 'user', content: userMessage });

    // Add context about turn
    if (turnNumber >= maxTurns - 1) {
      messages.push({ 
        role: 'system', 
        content: 'This is the last exchange. Wrap up warmly without asking another question.' 
      });
    }

    console.log(`Conversation request - Turn ${turnNumber}/${maxTurns}, user said: "${userTranscript?.slice(0, 50)}..."`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 60,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI request failed', fallbackResponse: "Tell me more about that." }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const gptResponse = data.choices?.[0]?.message?.content?.trim() || 'Tell me more.';
    
    console.log('GPT response:', gptResponse);

    return new Response(
      JSON.stringify({ 
        response: gptResponse,
        followupType: turnNumber >= maxTurns - 1 ? 'wrap_up' : 'contextual'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in conversation-partner:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackResponse: "That's interesting. Tell me more."
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
