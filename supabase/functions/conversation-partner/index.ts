import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid follow-up types - must match client-side
const VALID_FOLLOWUP_TYPES = [
  'what_next',
  'what_did',
  'how_felt',
  'tell_more',
  'clarify_small',
  'acknowledge',
  'wrap_up'
] as const;

type FollowupType = typeof VALID_FOLLOWUP_TYPES[number];

const SYSTEM_PROMPT = `You are analyzing a conversation turn to choose the best follow-up type. 
You are helping someone practice speaking after a stroke. Your job is ONLY to pick a follow-up label.

Available labels:
- what_next: Ask what happened next (use after they describe an event)
- what_did: Ask what they did about something (use after they mention a situation)
- how_felt: Ask about their feeling/reaction (use sparingly, after emotional content)
- tell_more: Simple continuation (use when they gave a short but complete answer)
- clarify_small: Narrow to a smaller detail (use if they seem overwhelmed or gave very little)
- acknowledge: Just acknowledge without asking more (use after a good complete answer mid-conversation)
- wrap_up: End the conversation warmly (use ONLY when it's the final turn)

Rules:
- Return ONLY the label, nothing else
- Never correct or rephrase what they said
- If unsure, pick "tell_more"
- For final turn, always pick "wrap_up"`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userTranscript, turnNumber, maxTurns, conversationHistory } = await req.json();

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured', fallbackType: 'tell_more' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Force wrap_up on final turn
    if (turnNumber >= maxTurns) {
      console.log('Final turn - returning wrap_up');
      return new Response(
        JSON.stringify({ followupType: 'wrap_up' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context message
    const contextParts = [];
    if (conversationHistory && conversationHistory.length > 0) {
      contextParts.push('Previous exchanges:');
      conversationHistory.slice(-3).forEach((turn: { role: string; text: string }) => {
        contextParts.push(`${turn.role}: ${turn.text}`);
      });
    }
    contextParts.push(`Turn ${turnNumber} of ${maxTurns}`);
    contextParts.push(`User just said: "${userTranscript || '(silence)'}"`);
    contextParts.push('Pick the best follow-up label.');

    const userMessage = contextParts.join('\n');

    console.log(`Conversation partner request - Turn ${turnNumber}/${maxTurns}, user said: "${userTranscript?.slice(0, 50)}..."`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 20,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI request failed', fallbackType: 'tell_more' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const gptResponse = data.choices?.[0]?.message?.content?.trim().toLowerCase() || '';
    
    console.log('GPT raw response:', gptResponse);

    // Parse to valid follow-up type
    let followupType: FollowupType = 'tell_more';
    for (const validType of VALID_FOLLOWUP_TYPES) {
      if (gptResponse.includes(validType)) {
        followupType = validType;
        break;
      }
    }

    console.log('Selected follow-up type:', followupType);

    return new Response(
      JSON.stringify({ followupType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in conversation-partner:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackType: 'tell_more'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
