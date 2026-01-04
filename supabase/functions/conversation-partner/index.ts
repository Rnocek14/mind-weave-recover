import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a warm, supportive conversation partner helping someone practice speaking after a stroke.

Your personality:
- Patient and encouraging, like a friendly neighbor
- Genuinely curious about what they share
- Natural and conversational, not clinical

Your job:
1. Listen and acknowledge what they said
2. Ask ONE simple follow-up question to keep them talking

CRITICAL RULES:
- Keep responses SHORT (15-25 words max)
- Use everyday words
- Ask about what THEY just said, not random topics
- If they struggled to speak, make your question simpler
- Never correct their speech
- End with ONE clear, simple question
- Be warm but not condescending

Examples:
User: "I had eggs for breakfast"
You: "Eggs, nice! Did you make them yourself?"

User: "my son visited yesterday"
You: "That's wonderful! What did you two do together?"

User: "um... I... the thing..."
You: "Take your time. What were you thinking about?"

User: (silence or very short)
You: "That's okay. What's something you enjoyed today?"`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userTranscript, turnNumber, maxTurns, conversationHistory } = await req.json();

    // Use Lovable AI gateway
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          response: "Tell me more about that.",
          followupType: 'contextual'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Force wrap_up on final turn
    if (turnNumber >= maxTurns) {
      return new Response(
        JSON.stringify({ 
          followupType: 'wrap_up',
          response: "Thanks for chatting with me! That was really nice."
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
      conversationHistory.slice(-6).forEach((turn: { role: string; text: string }) => {
        messages.push({
          role: turn.role === 'ai' ? 'assistant' : 'user',
          content: turn.text
        });
      });
    }

    // Add current user message
    const userMessage = userTranscript?.trim() || "(silence)";
    messages.push({ role: 'user', content: userMessage });

    // Add wrap-up hint for second-to-last turn
    if (turnNumber >= maxTurns - 1) {
      messages.push({ 
        role: 'system', 
        content: 'This is the last exchange. Wrap up warmly without asking another question.' 
      });
    }

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
          JSON.stringify({ error: 'Rate limited', response: "Let's take a moment. What were you saying?" }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required', response: "Tell me more about that." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ response: "That's interesting. Tell me more." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content?.trim() || 'Tell me more.';
    
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
        response: "That's interesting. Tell me more."
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
