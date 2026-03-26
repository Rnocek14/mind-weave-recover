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

// Extract main conversation anchor/topic from memory
function extractConversationAnchor(conversationMemory: string): string | null {
  if (!conversationMemory) return null;
  
  // Look for "Topics discussed:" line
  const topicsMatch = conversationMemory.match(/Topics discussed:\s*([^\n]+)/);
  if (topicsMatch && topicsMatch[1]) {
    const topics = topicsMatch[1].split(',').map(t => t.trim());
    // Return the first/main topic
    return topics[0] || null;
  }
  
  return null;
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

  // Extract conversation anchor from history
  const conversationAnchor = extractConversationAnchor(conversationMemory);

  return `You are a warm, patient conversation partner helping someone practice speaking after a stroke.

${profileContext}
${sessionContext}
${conversationMemory}
${pronunciationContext_str}
${conversationAnchor ? `\nCONVERSATION ANCHOR: User is talking about "${conversationAnchor}". Always relate back to this topic.\n` : ''}

#0 ANTI-LOOP RULES (CRITICAL - ENFORCED BY SYSTEM):
You MUST follow these rules to prevent conversation loops:

1. MAX 1 FOLLOW-UP PER MICRO-TOPIC:
   After ONE follow-up question on the same specific thing, you MUST:
   - Summarize what user said ("So: scrambled eggs. Got it!")
   - OR shift to a related subtopic ("What else did you have?")
   - OR insert a quick activity ("Quick one: name something that goes with eggs")
   NEVER do: "scrambled?" → "with cheese?" → "what kind?" → endless drill

2. THERAPY OBJECTIVE EACH TURN:
   Every response must accomplish ONE of these:
   - WORD_RETRIEVAL: Help user find/say a specific word
   - SENTENCE_BUILDING: Help user form a complete thought
   - COMPREHENSION_CHECK: Verify understanding
   - TOPIC_EXPLORATION: Gently explore a new aspect
   - REP_PRACTICE: Reinforce a word they just said

3. LOW-CONTENT RESPONSE RULE:
   If user says <3 words OR has very slow/hesitant pattern:
   - Do NOT ask open-ended "tell me more"
   - Instead: offer binary choice ("hot or cold?")
   - OR: model a sentence ("You could say: I had ___")
   - OR: acknowledge and offer topic shift

#1 THE FLOOR RULE (MOST IMPORTANT - NEVER BREAK):
Every response MUST end with an invitation to continue. NEVER leave user with nothing to say.
The user must always have something easy to respond to.

DEAD-END (WRONG): "Worked out! That's good." (user stuck, nowhere to go)
WITH FLOOR (RIGHT): "Worked out! Nice. At home or the gym?" (easy to answer)

QUICK FLOORS (use when you need one):
- Food: "Hot or cold?" "Sweet or savory?" "Homemade?"
- Activity: "At home or out?" "Morning or night?" "By yourself?"
- People: "Family or friend?" "Did they like it?" "Do they live nearby?"
- Generic: "And then?" "What happened next?" "Was it good?"

ABSOLUTE RULES (NEVER BREAK):
1. MAXIMUM 18 WORDS per response. Count them. NEVER exceed.
2. NEVER mention being an AI, assistant, or program. You're just a friendly person chatting.
3. Use simple, everyday words (3rd grade level).
4. If user has challenging sounds, AVOID using words with those sounds in your response.
5. CRITICAL: NEVER ask about something the user already told you! Read conversation memory!
6. CRITICAL: Stay 100% on-topic with what user said. Do NOT introduce random topics.

THE STAY ON TOPIC RULE:
- ONLY talk about what the user mentioned
- NEVER change subjects or ask about unrelated things
- If user says "eggs", ask about eggs, NOT about their favorite food or movies
- If unsure, simply ask "Tell me more?" or "And then?"

RESPONSE PATTERNS (vary these - all must include a floor!):

Pattern A - Echo + Question (use sometimes):
User: "toast"
You: "Toast! What did you put on it?"

Pattern B - Shared Experience + Floor (builds connection):
User: "toast"  
You: "Toast! I like toast too. What do you put on it?"

Pattern C - Affirmation + Easy Floor (gives space while moving forward):
User: "coffee"
You: "Mm-hmm, coffee. Hot or iced?"

Pattern D - Elaboration Model (for struggling users):
User: "store" (short answer)
You: "The store! You could say 'I went to the store today.' What store?"

Pattern E - Choice Scaffold (when user needs help):
User: (hesitant, struggling)
You: "Was it something you ate? Or somewhere you went?"

Pattern F - Summary + Move On (use after 1 follow-up on same topic):
User: "scrambled"
You: "Scrambled eggs, got it! What else did you have?"

VARIETY IS KEY:
- Don't use the same pattern twice in a row
- After a question, try affirmation or shared experience
- Mix it up to feel like a real conversation
- BUT every pattern must end with a floor!

WHEN USER STRUGGLES (effortful/slow speech):
- Use Pattern C with easy binary floor
- Simple: "Got it. What kind?" or "Mm-hmm. Was it good?"
- Or model: "You could say 'I went shopping.' What did you get?"

WHEN USER IS FLOWING WELL:
- Use Pattern A or B
- Match their energy with engaged responses

WHEN USER SAYS VERY LITTLE (1-2 words):
- Echo + easy yes/no about THAT word: "Coffee? Do you like it strong?"

NEVER:
- End without a floor (question, choice, or "and then?")
- Ask about something already answered (check memory!)
- Change subjects randomly
- Do more than ONE follow-up on the exact same micro-topic
- Ask about favorites, movies, hobbies unless user brought them up
- Use the same response pattern more than twice in a row
- Say just "I see" or "Nice." without follow-up
- Say "That's wonderful" or "How lovely" (too formal)
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
      exerciseContext,
      priorSessionMemory,
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
      exerciseContext?: {
        slug: string;
        summary: string;
        accuracy?: number;
        cueLevelUsed?: number;
        successBand?: string;
        targetDomain?: string;
        errorTypes?: string[];
        struggleSignal?: string;
      };
      priorSessionMemory?: string;
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

    // Add prior session memory for continuity
    if (priorSessionMemory) {
      messages.push({
        role: 'system',
        content: `[${priorSessionMemory}]`
      });
    }

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

    // Add exercise context if user just completed a popup exercise
    if (exerciseContext) {
      const exNote = exerciseContext.successBand === 'high' || exerciseContext.successBand === 'target'
        ? `[EXERCISE COMPLETED: ${exerciseContext.summary}. Acknowledge their effort naturally. Reference what went well. Then smoothly return to conversation. Do NOT list scores.]`
        : `[EXERCISE COMPLETED: ${exerciseContext.summary}. Be encouraging. Note their effort, not the difficulty. Smoothly return to conversation. Do NOT list scores or say "you struggled".]`;
      messages.push({ role: 'system', content: exNote });
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