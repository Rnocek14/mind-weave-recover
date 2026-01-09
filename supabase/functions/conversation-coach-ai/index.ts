/**
 * Conversation Coach AI - Intelligent, speech-aware conversation partner
 * 
 * This is a sophisticated AI that:
 * 1. Receives real-time speech analysis data including pronunciation
 * 2. Adapts responses based on user's speech patterns and phoneme difficulties
 * 3. Uses user's speech profile for deep personalization
 * 4. Provides supportive responses that acknowledge specific difficulties
 * 5. Generates contextual cues when user struggles
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract key topics from conversation history for memory
function buildConversationMemory(history: { role: string; text: string }[]): string {
  if (!history || history.length === 0) return '';
  
  const keyTopics: string[] = [];
  const keyDetails: string[] = [];
  
  // Extract nouns and key info from user messages
  for (const msg of history) {
    if (msg.role === 'user') {
      const text = msg.text.toLowerCase();
      
      // Food items
      const foods = ['eggs', 'toast', 'coffee', 'tea', 'bread', 'cereal', 'fruit', 'milk', 'juice', 'bacon', 'pancakes'];
      foods.forEach(f => { if (text.includes(f)) keyTopics.push(f); });
      
      // People
      const people = ['sister', 'brother', 'mom', 'mother', 'dad', 'father', 'wife', 'husband', 'daughter', 'son', 'friend'];
      people.forEach(p => { if (text.includes(p)) keyDetails.push(`mentioned ${p}`); });
      
      // Activities
      const activities = ['went to', 'watched', 'cooked', 'made', 'ate', 'saw', 'visited', 'called'];
      activities.forEach(a => { if (text.includes(a)) keyDetails.push(text.slice(text.indexOf(a), text.indexOf(a) + 20).split(/[.!?]/)[0]); });
    }
  }
  
  if (keyTopics.length === 0 && keyDetails.length === 0) return '';
  
  let memory = '\nCONVERSATION MEMORY (REMEMBER THIS!):\n';
  if (keyTopics.length > 0) {
    memory += `- Topics discussed: ${[...new Set(keyTopics)].join(', ')}\n`;
  }
  if (keyDetails.length > 0) {
    memory += `- Key details: ${[...new Set(keyDetails)].slice(0, 3).join('; ')}\n`;
  }
  memory += '- NEVER ask about something user already told you!\n';
  
  return memory;
}

// Build the system prompt with full user profile context
function buildSystemPrompt(
  userProfile: UserSpeechContext | null, 
  sessionMetrics: SessionMetrics | null,
  pronunciationContext: PronunciationContext | null,
  conversationMemory: string
): string {
  let profileContext = '';
  
  if (userProfile) {
    profileContext = `
USER'S SPEECH PROFILE (use to personalize):
- Main challenge: ${userProfile.primaryChallenge || 'General word-finding'}
- Best support type: ${userProfile.bestCueType || 'Gentle encouragement'}
- Typical speech pace: ${userProfile.typicalPace || 'Variable'}
${userProfile.predominantErrorPattern ? `- Error pattern: ${userProfile.predominantErrorPattern} (adapt cues accordingly)` : ''}
${userProfile.effortfulSpeechRate ? `- Effort level: ${userProfile.effortfulSpeechRate > 0.3 ? 'Often effortful - keep demands low' : 'Generally comfortable'}` : ''}
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
${sessionMetrics.avgPronunciationScore ? `- Pronunciation: ${sessionMetrics.avgPronunciationScore}%` : ''}
${sessionMetrics.challengingSounds?.length ? `- Challenging sounds this session: ${sessionMetrics.challengingSounds.join(', ')}` : ''}
`;
  }
  
  let pronunciationContext_str = '';
  if (pronunciationContext) {
    pronunciationContext_str = `
PRONUNCIATION INSIGHTS FOR THIS TURN:
${pronunciationContext.pronunciationScore !== null ? `- Overall pronunciation: ${pronunciationContext.pronunciationScore}%` : ''}
${pronunciationContext.challengingSounds?.length ? `- Sounds that were difficult: ${pronunciationContext.challengingSounds.join(', ')} - AVOID words with these sounds in your response` : ''}
${pronunciationContext.microFluencyNotes?.length ? `- Fluency notes: ${pronunciationContext.microFluencyNotes.join('; ')}` : ''}
`;
  }

  return `You are a warm, patient conversation partner helping someone practice speaking after a stroke.

${profileContext}
${sessionContext}
${conversationMemory}
${pronunciationContext_str}

ABSOLUTE RULES (NEVER BREAK):
1. MAXIMUM 18 WORDS per response. Count them. NEVER exceed.
2. NEVER mention being an AI, assistant, or program. You're just a friendly person chatting.
3. Use simple, everyday words (3rd grade level).
4. If user has challenging sounds, AVOID using words with those sounds in your response.
5. CRITICAL: NEVER ask about something the user already told you! Read conversation memory!

THE MOST IMPORTANT RULE - KEEP CONVERSATION FLOWING:
- ALWAYS echo something specific they said
- ALWAYS end with something that invites them to continue
- NEVER just say "Nice." or "I see." - those kill the conversation
- NEVER repeat a question the user already answered!

RESPONSE FORMULA:
1. Brief echo of what they said (2-4 words referencing their topic)
2. Follow-up that invites more speech (question OR "tell me more")

EXAMPLES OF GOOD RESPONSES:
User: "toast"
You: "Toast! Good. What did you put on it?"

User: "went to store"
You: "The store, nice. What did you get?"

User: "my sister"
You: "Oh, your sister! What did you do together?"

User: [after saying eggs earlier] "my sister made them"
You: "Nice! Your sister cooked. Does she visit often?" (NOT "what did she cook" - already said eggs!)

WHEN USER STRUGGLES (effortful/slow speech):
- Still echo what they said
- Use simpler follow-up: "Nice. And?" or "Got it. What else?"
- Never just validate without continuation

WHEN USER IS FLOWING WELL:
- Match their energy with engaged follow-up
- "Sounds fun! What happened next?"

WHEN USER SAYS VERY LITTLE (1-2 words):
- Echo the word and ask easy yes/no: "Coffee? Do you like it strong?"

NEVER:
- Ask about something already answered (check memory!)
- Say just "I see" or "Nice." without follow-up
- Say "That's wonderful" or "How lovely" (too formal)
- Ask "How did that make you feel?" (too therapy-like)
- Exceed 18 words`;
}

interface SpeechAnalysis {
  effortfulSpeech: boolean;
  pausePattern: 'fluent' | 'hesitant' | 'very_slow';
  circumlocutionDetected: boolean;
  fluencyScore: number;
  wordCount: number;
  completionConfidence: 'high' | 'medium' | 'low';
  speechContext?: string;
  // Enhanced pronunciation data
  pronunciationScore?: number | null;
  challengingSounds?: string[];
  microFluencyNotes?: string[];
}

interface UserSpeechContext {
  primaryChallenge?: string;
  bestCueType?: string;
  typicalPace?: string;
  // Enhanced profile data
  predominantErrorPattern?: string;
  effortfulSpeechRate?: number;
  phonemeDifficultyMap?: Record<string, number>;
  commonSubstitutions?: Record<string, string>;
}

interface SessionMetrics {
  turnsCompleted: number;
  avgFluency: number;
  fluencyTrend: 'improving' | 'stable' | 'declining';
  effortfulCount: number;
  // Enhanced metrics
  avgPronunciationScore?: number | null;
  challengingSounds?: string[];
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

interface PronunciationContext {
  pronunciationScore: number | null;
  challengingSounds: string[];
  microFluencyNotes: string[];
}

interface CueContext {
  cueType: 'semantic' | 'phonemic' | 'encouragement';
  cueText: string;
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
      suggestedCue,
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
      suggestedCue?: CueContext;
    };

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ response: "Tell me more.", followupType: 'contextual' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No forced wrap-up - user ends when ready

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

    // Build pronunciation context from speech analysis
    const pronunciationContext: PronunciationContext | null = speechAnalysis ? {
      pronunciationScore: speechAnalysis.pronunciationScore ?? null,
      challengingSounds: speechAnalysis.challengingSounds || [],
      microFluencyNotes: speechAnalysis.microFluencyNotes || [],
    } : null;

    // Build conversation memory to prevent repetition
    const conversationMemory = buildConversationMemory(conversationHistory || []);

    // Build system prompt with all context
    const systemPrompt = buildSystemPrompt(
      userProfile || null, 
      sessionMetrics || null,
      pronunciationContext,
      conversationMemory
    );

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

    // Add card context if available - help AI connect card result to conversation
    if (cardContext) {
      const cardResultNote = cardContext.success 
        ? `[CARD COMPLETED: User successfully named/answered "${cardContext.response}" in a ${cardContext.cardType} game. Echo their answer and ask a simple follow-up about it. Example: "Cat! Nice. Do you have a cat?" or "Toast! Good. What did you put on it?"]`
        : `[CARD COMPLETED: User attempted a ${cardContext.cardType} game. Acknowledge kindly and continue conversation. Example: "Good try! Let's keep chatting. What were we talking about?"]`;
      messages.push({
        role: 'system',
        content: cardResultNote
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
      
      // Add pronunciation context
      if (speechAnalysis.pronunciationScore !== undefined && speechAnalysis.pronunciationScore !== null) {
        if (speechAnalysis.pronunciationScore < 60) {
          analysisNote += `Low pronunciation score (${speechAnalysis.pronunciationScore}%) - use simple words. `;
        }
      }
      
      if (speechAnalysis.challengingSounds && speechAnalysis.challengingSounds.length > 0) {
        analysisNote += `AVOID words with: ${speechAnalysis.challengingSounds.join(', ')}. `;
      }
      
      if (speechAnalysis.speechContext) {
        analysisNote += speechAnalysis.speechContext;
      }
      
      analysisNote += ']';
      messages.push({ role: 'system', content: analysisNote });
    }

    // Add cue context if provided
    if (suggestedCue) {
      messages.push({
        role: 'system',
        content: `[User is struggling. Naturally incorporate this ${suggestedCue.cueType} cue into your response: "${suggestedCue.cueText}". Do NOT say "here's a hint".]`
      });
    }

    // Add current user message
    const userMessage = userTranscript?.trim() || "(silence)";
    messages.push({ role: 'user', content: userMessage });

    // No forced wrap-up hints - user ends when ready

    // Log for debugging
    console.log(`Turn ${turnNumber}/${maxTurns}:`, {
      transcript: userTranscript?.slice(0, 50),
      analysis: speechAnalysis ? {
        effortful: speechAnalysis.effortfulSpeech,
        fluency: speechAnalysis.fluencyScore,
        circumlocution: speechAnalysis.circumlocutionDetected,
        pronunciationScore: speechAnalysis.pronunciationScore,
        challengingSounds: speechAnalysis.challengingSounds,
      } : 'none',
      hasCue: !!suggestedCue,
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
        followupType: 'contextual', // No forced wrap-up
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