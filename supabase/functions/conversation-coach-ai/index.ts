/**
 * Conversation Coach AI — Maya's conversational intelligence
 * 
 * Upgraded from keyword-grep memory to:
 * 1. AI-maintained semantic rolling memory (via tool calling)
 * 2. Therapy intent-driven responses
 * 3. Slimmed prompt with personality-first design
 * 4. Speech-aware adaptation (unchanged)
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =========================================================================
// Semantic Memory Builder (replaces old keyword-grep approach)
// =========================================================================

/**
 * Build semantic context from actual conversation history + AI rolling memory.
 * No hardcoded word lists — works with whatever the user actually says.
 */
function buildSemanticMemory(
  history: { role: string; text: string }[],
  rollingMemory?: string
): string {
  if (!history || history.length === 0) return rollingMemory || '';

  const userMessages = history
    .filter(m => m.role === 'user' && m.text && m.text !== '(no speech)' && m.text !== '(silence)')
    .map(m => m.text.trim());

  if (userMessages.length === 0) return rollingMemory || '';

  // Build Q&A exchange log from actual conversation pairs
  const exchanges: string[] = [];
  for (let i = 0; i < history.length - 1; i++) {
    if (history[i].role === 'ai' && history[i + 1]?.role === 'user') {
      const answer = history[i + 1].text;
      if (answer && answer !== '(no speech)' && answer !== '(silence)') {
        exchanges.push(
          `You asked: "${history[i].text.slice(0, 35)}…" → They said: "${answer.slice(0, 55)}"`
        );
      }
    }
  }

  let memory = '';
  if (rollingMemory) {
    memory += `WHAT YOU REMEMBER: ${rollingMemory}\n`;
  }
  if (exchanges.length > 0) {
    memory += `RECENT EXCHANGES:\n${exchanges.slice(-3).join('\n')}\n`;
  }
  memory += `LATEST FROM USER: "${userMessages[userMessages.length - 1].slice(0, 80)}"`;
  memory += '\nCRITICAL: Reference specific things they said. Never re-ask something already discussed.';

  return memory;
}

// =========================================================================
// Therapy Intent Instructions
// =========================================================================

function getIntentInstruction(intent?: string): string {
  const map: Record<string, string> = {
    expand_topic:
      'Ask a specific follow-up about what they just shared. Reference a detail from their words.',
    probe_word_finding:
      'Gently elicit a specific word. Ask "what was it called?" or "which one?" about something they mentioned.',
    probe_sentence:
      'Encourage a slightly longer response. Ask something that needs more than one word to answer.',
    confirm_understanding:
      'Briefly check you understood. Paraphrase what they said and ask "right?"',
    build_confidence:
      'Be warmly supportive. Acknowledge what they said. Keep your question very easy (yes/no or A-or-B choice).',
    gentle_repair:
      'They struggled. Acknowledge naturally, maybe model a simpler way to say it, then give an easy follow-up.',
    shift_topic:
      'Smoothly move to something new but connected to what they already shared.',
    prepare_exercise:
      'Set up a natural transition to a practice activity.',
    reflect_progress:
      'Notice something they did well and mention it naturally.',
  };
  return map[intent || 'expand_topic'] || map.expand_topic;
}

// =========================================================================
// Types
// =========================================================================

interface SpeechAnalysis {
  effortfulSpeech: boolean;
  pausePattern: 'fluent' | 'hesitant' | 'very_slow';
  circumlocutionDetected: boolean;
  fluencyScore: number;
  wordCount: number;
  completionConfidence: 'high' | 'medium' | 'low';
  speechContext?: string;
  pronunciationScore?: number | null;
  challengingSounds?: string[];
  microFluencyNotes?: string[];
}

interface UserSpeechContext {
  primaryChallenge?: string;
  bestCueType?: string;
  typicalPace?: string;
  predominantErrorPattern?: string;
  effortfulSpeechRate?: number;
}

interface SessionMetrics {
  turnsCompleted: number;
  avgFluency: number;
  fluencyTrend: 'improving' | 'stable' | 'declining';
  effortfulCount: number;
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

// =========================================================================
// System Prompt — Slimmed, personality-first, intent-aware
// =========================================================================

function buildSystemPrompt(
  userProfile: UserSpeechContext | null,
  sessionMetrics: SessionMetrics | null,
  challengingSounds: string[],
  semanticMemory: string,
  therapyIntent?: string,
): string {
  let context = '';

  if (userProfile) {
    context += `\nUSER: ${userProfile.primaryChallenge || 'Word-finding'} challenge. ${userProfile.typicalPace || 'Variable'} pace.`;
    if (userProfile.effortfulSpeechRate && userProfile.effortfulSpeechRate > 0.3) {
      context += ' Often effortful — keep demands low.';
    }
  }

  if (sessionMetrics) {
    context += `\nSESSION: Turn ${sessionMetrics.turnsCompleted}. Fluency ${sessionMetrics.avgFluency}% (${sessionMetrics.fluencyTrend}).`;
    if (sessionMetrics.effortfulCount > 1) context += ' Reduce pressure.';
  }

  if (challengingSounds.length > 0) {
    context += `\nAVOID words containing these sounds: ${challengingSounds.join(', ')}.`;
  }

  const intentLine = getIntentInstruction(therapyIntent);

  return `You are Maya — a warm, genuinely curious conversation partner helping someone practice speaking after a stroke.

You're like a thoughtful friend who keeps people talking naturally. You notice details, remember what they said, and ask about things that matter to them.${context}

CONVERSATION CONTEXT:
${semanticMemory || 'This is the start of the conversation.'}

YOUR GOAL THIS TURN: ${intentLine}
Do this naturally. Never announce what you're doing.

RULES:
1. MAX 18 WORDS per response. Never exceed.
2. End every response with something easy to answer — a question, a choice, or "and then?"
3. Stay on what THEY said. Never introduce random topics.
4. Never re-ask something they already told you.
5. Never say you're an AI or assistant.
6. Simple words only (3rd grade level).
7. After ONE follow-up on the same detail, summarize it and move on to something related.
8. Sound like a real person — not a therapist reading a script.

WHEN THEY STRUGGLE: Validate + easy yes/no or A-or-B choice. Model a sentence if needed.
WHEN THEY FLOW: Match energy. Ask about specifics they mentioned. Show genuine interest.`;
}

// =========================================================================
// Tool definition for structured response + memory
// =========================================================================

const RESPOND_TOOL = {
  type: "function" as const,
  function: {
    name: "respond_and_remember",
    description: "Respond to the user and update your conversation memory",
    parameters: {
      type: "object",
      properties: {
        response: {
          type: "string",
          description:
            "Your spoken response to the user. Maximum 18 words. Must end with a question, choice, or continuation invitation.",
        },
        memory: {
          type: "string",
          description:
            "1-2 sentence summary of EVERYTHING discussed so far in this conversation. Include all topics, people, places, activities, foods, events — anything the user mentioned. This will be your memory for the next turn.",
        },
      },
      required: ["response", "memory"],
      additionalProperties: false,
    },
  },
};

// =========================================================================
// Main Handler
// =========================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      userTranscript,
      turnNumber,
      conversationHistory,
      cardContext,
      speechAnalysis,
      userProfile,
      sessionMetrics,
      engagementState,
      suggestedCue,
      exerciseContext,
      priorSessionMemory,
      rollingMemory,
      therapyIntent,
    } = await req.json() as {
      userTranscript: string;
      turnNumber: number;
      conversationHistory?: { role: string; text: string }[];
      cardContext?: CardContext;
      speechAnalysis?: SpeechAnalysis;
      userProfile?: UserSpeechContext;
      sessionMetrics?: SessionMetrics;
      engagementState?: EngagementState;
      suggestedCue?: { cueType: string; cueText: string };
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
      rollingMemory?: string;
      therapyIntent?: string;
    };

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ response: "Tell me more.", memoryUpdate: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Engagement safety check
    if (engagementState?.frustration === 'high' || engagementState?.fatigue === 'high') {
      return new Response(
        JSON.stringify({
          response: "Let's take a break. You're doing great.",
          suggestBreak: true,
          memoryUpdate: rollingMemory || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build semantic memory from actual conversation + AI rolling memory
    const semanticMemory = buildSemanticMemory(
      conversationHistory || [],
      rollingMemory
    );

    // Collect challenging sounds from all sources
    const challengingSounds: string[] = [
      ...(speechAnalysis?.challengingSounds || []),
      ...(sessionMetrics?.challengingSounds || []),
    ];

    // Build system prompt (slimmed, intent-aware)
    const systemPrompt = buildSystemPrompt(
      userProfile || null,
      sessionMetrics || null,
      challengingSounds,
      semanticMemory,
      therapyIntent,
    );

    // Construct messages
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Prior session memory (MayaState cross-session context)
    if (priorSessionMemory) {
      messages.push({
        role: 'system',
        content: `[PRIOR SESSIONS — reference naturally, don't repeat verbatim: ${priorSessionMemory}]`,
      });
    }

    // Conversation history (increased window from 6 to 8)
    if (conversationHistory?.length) {
      conversationHistory.slice(-8).forEach((turn: { role: string; text: string }) => {
        messages.push({
          role: turn.role === 'ai' ? 'assistant' : 'user',
          content: turn.text,
        });
      });
    }

    // Card context
    if (cardContext) {
      const note = cardContext.success
        ? `[User named "${cardContext.response}" in a ${cardContext.cardType}. Echo it naturally and ask a follow-up about it.]`
        : `[User tried a ${cardContext.cardType}. Be encouraging, then continue conversation.]`;
      messages.push({ role: 'system', content: note });
    }

    // Exercise context
    if (exerciseContext) {
      const note =
        exerciseContext.successBand === 'high' || exerciseContext.successBand === 'target'
          ? `[Exercise done: ${exerciseContext.summary}. Acknowledge naturally, return to conversation.]`
          : `[Exercise done: ${exerciseContext.summary}. Be encouraging, return to conversation.]`;
      messages.push({ role: 'system', content: note });
    }

    // Speech analysis context
    if (speechAnalysis) {
      let note = '[SPEECH: ';
      if (speechAnalysis.effortfulSpeech) {
        note += 'HIGH EFFORT — validate, don\'t push. ';
      } else if (speechAnalysis.pausePattern === 'hesitant') {
        note += 'Hesitant — keep simple. ';
      }
      if (speechAnalysis.circumlocutionDetected) {
        note += 'Circumlocution — help find the word. ';
      }
      if (speechAnalysis.wordCount < 4) {
        note += 'Brief response. ';
      } else if (speechAnalysis.fluencyScore > 80) {
        note += 'Flowing well. ';
      }
      if (speechAnalysis.speechContext) {
        note += speechAnalysis.speechContext;
      }
      note += ']';
      messages.push({ role: 'system', content: note });
    }

    // Cue context
    if (suggestedCue) {
      messages.push({
        role: 'system',
        content: `[User struggling. Work this ${suggestedCue.cueType} cue in naturally: "${suggestedCue.cueText}"]`,
      });
    }

    // Current user message
    messages.push({ role: 'user', content: userTranscript?.trim() || '(silence)' });

    console.log(`Turn ${turnNumber}:`, {
      transcript: userTranscript?.slice(0, 50),
      intent: therapyIntent,
      hasMemory: !!rollingMemory,
      effortful: speechAnalysis?.effortfulSpeech,
    });

    // Call AI with tool calling for structured response + memory
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        tools: [RESPOND_TOOL],
        tool_choice: { type: "function", function: { name: "respond_and_remember" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limited', response: 'Go on...', memoryUpdate: rollingMemory }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required', response: 'Tell me more.', memoryUpdate: rollingMemory }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const fallback = speechAnalysis?.effortfulSpeech ? "Take your time." : "Interesting! Go on.";
      return new Response(
        JSON.stringify({ response: fallback, memoryUpdate: rollingMemory || null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // Parse structured response from tool call
    let aiResponse = 'Tell me more.';
    let memoryUpdate: string | null = rollingMemory || null;

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        aiResponse = args.response || aiResponse;
        memoryUpdate = args.memory || memoryUpdate;
      } catch (e) {
        console.warn('Failed to parse tool call, using content fallback:', e);
        aiResponse = data.choices?.[0]?.message?.content?.trim() || aiResponse;
      }
    } else {
      // Fallback: model returned plain text instead of tool call
      aiResponse = data.choices?.[0]?.message?.content?.trim() || aiResponse;
    }

    // Enforce word limit
    const words = aiResponse.split(/\s+/);
    if (words.length > 20) {
      let cutoff = 18;
      const qIdx = words.slice(0, 20).findIndex((w: string) => w.includes('?'));
      if (qIdx > 5) cutoff = qIdx + 1;
      aiResponse = words.slice(0, cutoff).join(' ');
      if (!aiResponse.match(/[.!?]$/)) aiResponse += '?';
    }

    // Remove AI self-references
    aiResponse = aiResponse
      .replace(/as an ai/gi, '')
      .replace(/I'm an AI/gi, '')
      .replace(/I am an AI/gi, '')
      .replace(/as your assistant/gi, '')
      .trim();

    console.log('Maya:', aiResponse, '| Memory:', memoryUpdate?.slice(0, 60));

    return new Response(
      JSON.stringify({ response: aiResponse, memoryUpdate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in conversation-coach-ai:', error);
    return new Response(
      JSON.stringify({ response: "What else?", memoryUpdate: null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
