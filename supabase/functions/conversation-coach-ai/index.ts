/**
 * Conversation Coach AI - Intelligent, speech-aware conversation partner
 * 
 * This is an upgraded version of conversation-partner that:
 * 1. Receives real-time speech analysis data
 * 2. Adapts responses based on user's speech patterns
 * 3. Uses user's speech profile for personalization
 * 4. Provides supportive responses that acknowledge specific difficulties
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Build the system prompt with user profile context
function buildSystemPrompt(userProfile: UserSpeechContext | null, sessionMetrics: SessionMetrics | null): string {
  let profileContext = '';
  
  if (userProfile) {
    profileContext = `
USER'S SPEECH PROFILE (use to personalize):
- Main challenge: ${userProfile.primaryChallenge || 'General word-finding'}
- Best support type: ${userProfile.bestCueType || 'Gentle encouragement'}
- Typical speech pace: ${userProfile.typicalPace || 'Variable'}
${userProfile.additionalNotes || ''}
`;
  }
  
  let sessionContext = '';
  if (sessionMetrics) {
    sessionContext = `
SESSION SO FAR:
- Turns: ${sessionMetrics.turnsCompleted}
- Average fluency: ${sessionMetrics.avgFluency}%
- Trend: ${sessionMetrics.fluencyTrend}
${sessionMetrics.effortfulCount > 1 ? '- Multiple effortful responses - reduce cognitive load' : ''}
`;
  }

  return `You are a warm, patient conversation partner helping someone practice speaking after a stroke.

${profileContext}
${sessionContext}

ABSOLUTE RULES (NEVER BREAK):
1. MAXIMUM 18 WORDS per response. Count them. NEVER exceed.
2. NEVER mention being an AI, assistant, or program. You're just a friendly person chatting.
3. ONE simple question OR supportive statement. Never both.
4. Use simple, everyday words (3rd grade level).

ADAPT YOUR RESPONSE BASED ON SPEECH ANALYSIS:

When speech analysis shows EFFORTFUL/SLOW speech:
- Don't ask questions - just validate: "That makes sense." "Nice."
- If you must respond: "Take your time. I'm listening."
- NEVER add cognitive load with questions

When speech analysis shows CIRCUMLOCUTION (describing instead of naming):
- Help without pointing out the difficulty: "Oh, the coffee maker?" 
- Don't ask "what word were you looking for?"

When speech analysis shows STRONG FLOW:
- Match their energy with a brief follow-up question
- Keep momentum: "Sounds fun! What happened next?"

When speech analysis shows BRIEF/MINIMAL response:
- Don't push. Acknowledge and offer easy out: "Got it." or simple yes/no question

FORMAT: 
- Start with 2-4 word acknowledgment
- Then either stop OR add ONE simple question
- Total: under 18 words

EXAMPLES:

User: (HIGH effort, slow speech) "um... the... we went... to the place"
You: "Nice. Sounds like a good trip."

User: (circumlocution) "the thing you drink from in the morning, the hot drink thing"  
You: "Ah, coffee? I love coffee too."

User: (flowing) "we had a great time at the beach and the kids played all day"
You: "Sounds wonderful! What was your favorite part?"

User: (brief, 2 words) "was good"
You: "Good to hear."

User: (card just completed, said "apple")
You: "Apple - nice! Were you thinking about food?"

NEVER:
- Exceed 18 words
- Say "that's wonderful" or "how lovely" (too formal)
- Ask "how did that make you feel?"
- Give advice or information
- Mention AI/technology
- Use complex words`;
}

interface SpeechAnalysis {
  effortfulSpeech: boolean;
  pausePattern: 'fluent' | 'hesitant' | 'very_slow';
  circumlocutionDetected: boolean;
  fluencyScore: number;
  wordCount: number;
  completionConfidence: 'high' | 'medium' | 'low';
  speechContext?: string;
}

interface UserSpeechContext {
  primaryChallenge?: string;
  bestCueType?: string;
  typicalPace?: string;
  additionalNotes?: string;
}

interface SessionMetrics {
  turnsCompleted: number;
  avgFluency: number;
  fluencyTrend: 'improving' | 'stable' | 'declining';
  effortfulCount: number;
}

interface CardContext {
  cardType: string;
  response: string;
  success: boolean;
}

interface EngagementState {
  frustration: 'none' | 'low' | 'medium' | 'high';
  fatigue: 'none' | 'low' | 'medium' | 'high';
  recommendedAction?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      userTranscript, 
      turnNumber, 
      maxTurns, 
      conversationHistory,
      cardContext,
      speechAnalysis,
      userProfile,
      sessionMetrics,
      engagementState,
    } = await req.json() as {
      userTranscript: string;
      turnNumber: number;
      maxTurns: number;
      conversationHistory?: { role: string; text: string }[];
      cardContext?: CardContext;
      speechAnalysis?: SpeechAnalysis;
      userProfile?: UserSpeechContext;
      sessionMetrics?: SessionMetrics;
      engagementState?: EngagementState;
    };

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ response: "Tell me more.", followupType: 'contextual' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for wrap-up conditions
    if (turnNumber >= maxTurns) {
      return new Response(
        JSON.stringify({ 
          response: "Great chat! Talk again soon.",
          followupType: 'wrap_up',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is highly frustrated or fatigued
    if (engagementState?.frustration === 'high' || engagementState?.fatigue === 'high') {
      return new Response(
        JSON.stringify({ 
          response: "Let's take a break. You're doing great.",
          followupType: 'break_prompt',
          suggestBreak: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(userProfile || null, sessionMetrics || null);

    // Build conversation
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.slice(-6).forEach((turn) => {
        messages.push({
          role: turn.role === 'ai' ? 'assistant' : 'user',
          content: turn.text
        });
      });
    }

    // Add card context if available
    if (cardContext) {
      messages.push({
        role: 'system',
        content: `[Card completed: User said "${cardContext.response}" in a ${cardContext.cardType} exercise. Acknowledge briefly.]`
      });
    }

    // Add speech analysis context
    if (speechAnalysis) {
      let analysisNote = `[SPEECH ANALYSIS for this turn: `;
      
      if (speechAnalysis.effortfulSpeech) {
        analysisNote += 'HIGH EFFORT - Do NOT ask questions, just validate. ';
      } else if (speechAnalysis.pausePattern === 'hesitant') {
        analysisNote += 'Some hesitation - keep response simple. ';
      }
      
      if (speechAnalysis.circumlocutionDetected) {
        analysisNote += 'Circumlocution detected - help name the word naturally. ';
      }
      
      if (speechAnalysis.wordCount < 4) {
        analysisNote += 'Very brief response - don\'t push for more. ';
      } else if (speechAnalysis.fluencyScore > 80) {
        analysisNote += 'Flowing well - can ask follow-up question. ';
      }
      
      if (speechAnalysis.speechContext) {
        analysisNote += speechAnalysis.speechContext;
      }
      
      analysisNote += ']';
      messages.push({ role: 'system', content: analysisNote });
    }

    // Add current user message
    const userMessage = userTranscript?.trim() || "(silence)";
    messages.push({ role: 'user', content: userMessage });

    // Add wrap-up hint for final turn
    if (turnNumber >= maxTurns - 1) {
      messages.push({ 
        role: 'system', 
        content: '[FINAL TURN - End warmly in under 12 words. No question.]' 
      });
    }

    // Log for debugging
    console.log(`Turn ${turnNumber}/${maxTurns}:`, {
      transcript: userTranscript?.slice(0, 50),
      analysis: speechAnalysis ? {
        effortful: speechAnalysis.effortfulSpeech,
        fluency: speechAnalysis.fluencyScore,
        circumlocution: speechAnalysis.circumlocutionDetected,
      } : 'none',
    });

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
      
      // Fallback based on speech analysis
      const fallback = speechAnalysis?.effortfulSpeech 
        ? "Take your time."
        : "Interesting! Go on.";
      return new Response(
        JSON.stringify({ response: fallback }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let aiResponse = data.choices?.[0]?.message?.content?.trim() || 'Tell me more.';
    
    // STRICT word limit enforcement
    const words = aiResponse.split(/\s+/);
    if (words.length > 20) {
      // Find natural break point
      let cutoff = 18;
      const questionIdx = words.slice(0, 20).findIndex((w: string) => w.includes('?'));
      if (questionIdx > 5) {
        cutoff = questionIdx + 1;
      }
      aiResponse = words.slice(0, cutoff).join(' ');
      if (!aiResponse.match(/[.!?]$/)) {
        aiResponse += '.';
      }
      console.log('Truncated response to:', aiResponse);
    }
    
    // Remove any AI self-references that slipped through
    aiResponse = aiResponse
      .replace(/as an ai/gi, '')
      .replace(/I'm an AI/gi, '')
      .replace(/I am an AI/gi, '')
      .replace(/as your assistant/gi, '')
      .trim();
    
    console.log('AI response:', aiResponse);

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        followupType: turnNumber >= maxTurns - 1 ? 'wrap_up' : 'contextual',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in conversation-coach-ai:', error);
    return new Response(
      JSON.stringify({ response: "What else?" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
